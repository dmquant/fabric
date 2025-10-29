import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useLanguage } from '../contexts/LanguageContext';
import { generateSpeech, generatePodcastSpeech } from '../services/geminiService';
import { decode, pcmToWav } from '../utils/audioUtils';
import { useAssets } from '../contexts/AssetContext';

// Declare Chart.js from global scope (loaded via CDN)
declare const Chart: any;

interface ThreeDeeVisualizerProps {
  sceneData: any;
}
// --- Constants for Abstract Theme ---
const GEOMETRIES = {
    'Market Indexes': new THREE.BoxGeometry(10, 1, 10),
    'Commodities': new THREE.CylinderGeometry(5, 5, 1, 32),
    'Major Stocks': new THREE.ConeGeometry(5, 1, 32),
    'Sector Performance': new THREE.TorusGeometry(5, 1, 16, 100),
    'Magnificent 7': new THREE.OctahedronGeometry(6, 0)
};
const DEFAULT_GEOMETRY = new THREE.BoxGeometry(8, 1, 8);
const SCALE_MULTIPLIER = 50;

const geminiVoices = [
  { id: 'Kore', name: 'Kore (Female)' },
  { id: 'Puck', name: 'Puck (Male)' },
  { id: 'Charon', name: 'Charon (Female)' },
  { id: 'Zephyr', name: 'Zephyr (Male)' },
  { id: 'Fenrir', name: 'Fenrir (Male)' },
];

/**
 * Renders a detailed, high-fidelity presentation slide onto a 2D canvas.
 */
function drawTextSlide(ctx: CanvasRenderingContext2D, slide: any, colors: any, canvasWidth: number, canvasHeight: number, slideNumber: number, totalSlides: number) {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, colors.slide_bg_start || '#252930');
    gradient.addColorStop(1, colors.slide_bg_end || '#1a1d23');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    ctx.fillStyle = colors.accent || '#D4AF37';
    ctx.fillRect(0, 0, canvasWidth, 10);
    
    ctx.fillStyle = colors.text_primary || '#E0E0E0';
    ctx.font = 'bold 70px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(slide.title, 50, 100);

    ctx.strokeStyle = colors.accent || '#D4AF37';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(50, 130);
    ctx.lineTo(canvasWidth / 2, 130);
    ctx.stroke();

    ctx.fillStyle = colors.text_secondary || '#cccccc';
    ctx.font = '42px Arial';
    ctx.textAlign = 'left';
    let currentY = 200;
    const lineHeight = 60;
    const maxWidth = canvasWidth - 100;

    if (slide.content && Array.isArray(slide.content)) {
      slide.content.forEach((line: string) => {
          currentY = wrapText(ctx, line, 60, currentY, maxWidth, lineHeight);
      });
    }

    ctx.fillStyle = colors.footer_text || '#666';
    ctx.font = '24px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`幻灯片 ${slideNumber} / ${totalSlides}`, canvasWidth - 50, canvasHeight - 40);
}


/**
 * Wraps and draws long lines of text onto a canvas context.
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
    const bullet = '• ';
    const isBulletPoint = text.trim().startsWith(bullet);
    const contentText = isBulletPoint ? text.substring(bullet.length) : text;
    const words = contentText.split(' ');
    let line = '';
    
    if (isBulletPoint) {
      ctx.fillText(bullet, x, y);
    }
    const startX = isBulletPoint ? x + ctx.measureText(bullet).width : x;

    for(let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      let testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, startX, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, startX, y);
    return y + lineHeight;
}

function createSpeaker(name: string, shirtColor: string): THREE.Group {
    const group = new THREE.Group();
    
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 16, 16),
        new THREE.MeshStandardMaterial({ color: '#ffdbac' })
    );
    head.position.y = 1.3;
    head.castShadow = true;
    group.add(head);

    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.3, 0.8, 8),
        new THREE.MeshStandardMaterial({ color: shirtColor })
    );
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);
    
    group.userData = { name, isSpeaking: false };
    return group;
}


const ThreeDeeVisualizer: React.FC<ThreeDeeVisualizerProps> = ({ sceneData }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const { language, t } = useLanguage();
  const { addAsset, addLog } = useAssets();
  
  const [ttsStatus, setTtsStatus] = useState('准备生成音频');
  const [isGenerating, setIsGenerating] = useState(false);
  const [playbackLang, setPlaybackLang] = useState<'en' | 'zh'>('en');
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [progress, setProgress] = useState(0);

  const stateRef = useRef({
    renderer: null as THREE.WebGLRenderer | null,
    camera: null as THREE.PerspectiveCamera | null,
    scene: null as THREE.Scene | null,
    controls: null as OrbitControls | null,
    animationFrameId: 0,
    // Abstract theme specific
    animatedBlocks: [] as any[],
    narrator: {
        scrollY: 0, texture: null as THREE.CanvasTexture | null, context: null as CanvasRenderingContext2D | null,
        canvas: null as HTMLCanvasElement | null, textLines: [] as string[], audioElement: null as HTMLAudioElement | null,
        syncToAudio: false, isScrolling: false, isUserPaused: true,
    },
    // Showroom theme specific
    slideMeshes: [] as THREE.Mesh[],
    speakers: [] as THREE.Group[],
    dialogueTimings: [] as { sceneId: string, speakerName: string, startTime: number, endTime: number }[],
    cameraTargets: new Map<string, { position: THREE.Vector3, lookAt: THREE.Vector3 }>(),
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    isNarrationPlaying: false,
    lookAtTarget: new THREE.Object3D(),
    isUserInteracting: false,
    
  }).current;
  
  const isShowroomTheme = sceneData?.theme?.name === 'showroom';

  const allLabels = useMemo(() => {
    if (isShowroomTheme || !sceneData.dataRows) return [];
    return sceneData.dataRows.flatMap((row: any) => 
        row.items.map((item: any) => ({
            ...item.label,
            id: item.id,
            value: item.value,
        }))
    );
  }, [sceneData, isShowroomTheme]);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount || !sceneData) return;

    // --- Common Setup ---
    stateRef.scene = new THREE.Scene();
    stateRef.camera = new THREE.PerspectiveCamera(50, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    stateRef.renderer = new THREE.WebGLRenderer({ antialias: true });
    stateRef.renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    stateRef.renderer.shadowMap.enabled = true;
    currentMount.innerHTML = '';
    currentMount.appendChild(stateRef.renderer.domElement);
    stateRef.controls = new OrbitControls(stateRef.camera, stateRef.renderer.domElement);
    stateRef.controls.enableDamping = true;
    
    let animate: () => void;

    if (isShowroomTheme) {
        // --- SHOWROOM THEME ---
        initShowroom(stateRef, sceneData);
        animate = () => animateShowroom(stateRef);
    } else {
        // --- ABSTRACT THEME ---
        initAbstract(stateRef, sceneData, language);
        animate = () => animateAbstract(stateRef, mountRef);
    }
    
    // --- Animation Loop ---
    const runAnimation = () => {
        stateRef.animationFrameId = requestAnimationFrame(runAnimation);
        animate();
    };
    runAnimation();

    // --- Event Listeners & Cleanup ---
    const handleResize = () => {
        if (!stateRef.renderer || !stateRef.camera || !mountRef.current) return;
        stateRef.camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        stateRef.camera.updateProjectionMatrix();
        stateRef.renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    const onPointerMove = ( event: PointerEvent ) => {
        if (!mountRef.current) return;
        const rect = mountRef.current.getBoundingClientRect();
	    stateRef.mouse.x = ( (event.clientX - rect.left) / rect.width ) * 2 - 1;
	    stateRef.mouse.y = - ( (event.clientY - rect.top) / rect.height ) * 2 + 1;
    }
    
    window.addEventListener('resize', handleResize);
    if(isShowroomTheme) currentMount.addEventListener('pointermove', onPointerMove);

    return () => {
        window.removeEventListener('resize', handleResize);
        if(isShowroomTheme) currentMount.removeEventListener('pointermove', onPointerMove);
        cancelAnimationFrame(stateRef.animationFrameId);
        stateRef.renderer?.dispose();
        if (currentMount) {
          currentMount.innerHTML = '';
        }
        stateRef.animatedBlocks = [];
        stateRef.slideMeshes = [];
        stateRef.speakers = [];
        stateRef.dialogueTimings = [];
        if (stateRef.narrator.audioElement) {
          stateRef.narrator.audioElement.pause();
          stateRef.narrator.audioElement = null;
        }
    };
  }, [sceneData, language, isShowroomTheme, stateRef]); 

  // Language change effect for abstract theme
  useEffect(() => {
    if (isShowroomTheme || !sceneData.narratorScript) return;
      if(stateRef.narrator.canvas && stateRef.narrator.context){
        stateRef.narrator.scrollY = 0;
        updateNarrator(stateRef.narrator, sceneData.narratorScript[language]);
      }
      allLabels.forEach(label => {
        const el = document.getElementById(`label-${label.id}`);
        if(el) {
            el.innerText = `${label[language]} (${label.value > 0 ? '+' : ''}${label.value}%)`;
        }
      });
  }, [language, allLabels, sceneData.narratorScript, isShowroomTheme, stateRef.narrator]);

  const handleGeneratePodcast = useCallback(async () => {
    setIsGenerating(true);
    setTtsStatus(`正在生成播客...`);
    addLog('info', `Generating 3D scene podcast.`, { theme: 'showroom' });

    try {
        const audioData = await generatePodcastSpeech(sceneData.dialogue, sceneData.speakers);
        const pcmData = decode(audioData.data);
        const sampleRateMatch = audioData.mimeType.match(/rate=(\d+)/);
        const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;
        const pcm16 = new Int16Array(pcmData.buffer);
        const wavBlob = pcmToWav(pcm16, sampleRate);
        const audioUrl = URL.createObjectURL(wavBlob);

        const filename = `3d_scene_podcast.wav`;
        addAsset(filename, wavBlob, 'audio/wav');
        addLog('info', `Saved 3D scene podcast asset: ${filename}`);

        const audioEl = stateRef.narrator.audioElement || new Audio();
        stateRef.narrator.audioElement = audioEl;
        audioEl.src = audioUrl;

        audioEl.onloadedmetadata = () => {
            const totalChars = sceneData.dialogue.reduce((acc: number, turn: any) => acc + turn.text.length, 0);
            const duration = audioEl.duration;
            let currentTime = 0;
            stateRef.dialogueTimings = sceneData.dialogue.map((turn: any) => {
                const turnDuration = (turn.text.length / totalChars) * duration;
                const timing = {
                    sceneId: turn.sceneId,
                    speakerName: turn.speaker,
                    startTime: currentTime,
                    endTime: currentTime + turnDuration,
                };
                currentTime += turnDuration;
                return timing;
            });
        };
        
        audioEl.addEventListener('timeupdate', () => {
            setProgress(stateRef.narrator.audioElement?.currentTime || 0);
        });
        audioEl.addEventListener('ended', () => {
            stateRef.isNarrationPlaying = false;
        });

        setTtsStatus('播客已就绪');
    } catch (error) {
        console.error('Error generating TTS podcast:', error);
        setTtsStatus('生成失败，请重试');
        addLog('error', 'Failed to generate 3D scene podcast audio.', { error });
    } finally {
        setIsGenerating(false);
    }
  }, [sceneData, stateRef, addAsset, addLog]);
  
  const handleGenerateAudio = useCallback(async () => {
    setIsGenerating(true);
    setTtsStatus(`正在使用 ${selectedVoice} 生成...`);
    addLog('info', `Generating 3D scene narration.`, { theme: 'abstract', lang: playbackLang });
    
    try {
        const audioData = await generateSpeech(sceneData.narratorScript[playbackLang].join('\n'), selectedVoice);
        const pcmData = decode(audioData.data);
        const sampleRateMatch = audioData.mimeType.match(/rate=(\d+)/);
        const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;
        const pcm16 = new Int16Array(pcmData.buffer);
        const wavBlob = pcmToWav(pcm16, sampleRate);
        const audioUrl = URL.createObjectURL(wavBlob);

        const filename = `3d_scene_narration_${playbackLang}.wav`;
        addAsset(filename, wavBlob, 'audio/wav');
        addLog('info', `Saved 3D scene narration asset: ${filename}`);

        if (stateRef.narrator.audioElement) {
          stateRef.narrator.audioElement.src = audioUrl;
        } else {
          stateRef.narrator.audioElement = new Audio(audioUrl);
        }
        
        stateRef.narrator.audioElement.addEventListener('timeupdate', () => {
            setProgress(stateRef.narrator.audioElement?.currentTime || 0);
        });
        stateRef.narrator.audioElement.addEventListener('ended', () => {
            stateRef.narrator.syncToAudio = false;
        });

        setTtsStatus('旁白已就绪');
    } catch (error) {
        console.error('Error generating TTS:', error);
        setTtsStatus('生成失败，请重试');
        addLog('error', 'Failed to generate 3D scene narration audio.', { error });
    } finally {
        setIsGenerating(false);
    }
  }, [playbackLang, selectedVoice, sceneData.narratorScript, stateRef, addAsset, addLog]);

  // --- Common UI Handlers ---
  const handlePlay = () => {
    if (!stateRef.narrator.audioElement) return;
    stateRef.narrator.audioElement.currentTime = 0;
    setProgress(0);
    stateRef.narrator.audioElement.play();
    if(isShowroomTheme){
      stateRef.isNarrationPlaying = true;
      stateRef.isUserInteracting = false;
    } else {
      stateRef.narrator.scrollY = 0;
      stateRef.narrator.syncToAudio = true;
      stateRef.narrator.isUserPaused = false;
      stateRef.narrator.isScrolling = false;
    }
  };
  const handlePause = () => {
    if (!stateRef.narrator.audioElement) return;
    stateRef.narrator.audioElement.pause();
    if(isShowroomTheme){
      stateRef.isNarrationPlaying = false;
    } else {
      stateRef.narrator.syncToAudio = false;
      stateRef.narrator.isUserPaused = true;
    }
  };
  const handleSliderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!stateRef.narrator.audioElement) return;
    const time = parseFloat(e.target.value);
    stateRef.narrator.audioElement.currentTime = time;
    setProgress(time);
    if(!isShowroomTheme){
        stateRef.narrator.syncToAudio = true;
        stateRef.narrator.isUserPaused = false;
        stateRef.narrator.isScrolling = false;
    }
  };
  // --- Abstract theme specific handlers ---
  const handleScreenRoll = () => {
    stateRef.narrator.isScrolling = true;
    stateRef.narrator.isUserPaused = false;
    stateRef.narrator.syncToAudio = false;
    if (stateRef.narrator.audioElement && !stateRef.narrator.audioElement.paused) handlePause();
  };
  const handleScreenPause = () => {
    stateRef.narrator.isScrolling = false;
    stateRef.narrator.isUserPaused = true;
  };
  const handleScreenReset = () => {
    stateRef.narrator.scrollY = 0;
    stateRef.narrator.isScrolling = false;
    stateRef.narrator.isUserPaused = true;
  };

  const renderAbstractControls = () => (
    <>
      <div className="flex space-x-2 mb-2">
        <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} disabled={isGenerating} className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-xs text-white">
          {geminiVoices.map((voice) => ( <option key={voice.id} value={voice.id}>{voice.name}</option> ))}
        </select>
        <select value={playbackLang} onChange={(e) => setPlaybackLang(e.target.value as 'en' | 'zh')} disabled={isGenerating} className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-xs text-white">
          <option value="en">English</option>
          <option value="zh">Chinese</option>
        </select>
      </div>
      <button onClick={handleGenerateAudio} disabled={isGenerating}>{isGenerating ? t('generatingAudioButton') : t('generateScriptButton')}</button>
      <button onClick={handlePlay} disabled={!stateRef.narrator.audioElement || isGenerating} className="play-btn">{t('play')}</button>
      <button onClick={handlePause} disabled={!stateRef.narrator.audioElement || isGenerating} className="pause-btn">{t('pause')}</button>
      <input type="range" value={progress} max={stateRef.narrator.audioElement?.duration || 100} onChange={handleSliderInput} disabled={!stateRef.narrator.audioElement || isGenerating} />
      <div className="screen-controls">
          <button onClick={handleScreenRoll}>► Roll</button>
          <button onClick={handleScreenPause}>❚❚ Pause</button>
          <button onClick={handleScreenReset}>■ Reset</button>
      </div>
      <div className="tts-status">{isGenerating ? '生成中...' : ttsStatus}</div>
    </>
  );

  const renderShowroomControls = () => (
     <>
        <button onClick={handleGeneratePodcast} disabled={isGenerating}>
            {isGenerating ? '正在生成播客...' : '生成播客导览'}
        </button>
        <button onClick={handlePlay} disabled={!stateRef.narrator.audioElement || isGenerating} className="play-btn">播放导览</button>
        <button onClick={handlePause} disabled={!stateRef.narrator.audioElement || isGenerating} className="pause-btn">暂停导览</button>
        <input 
          type="range" 
          value={progress} 
          max={stateRef.narrator.audioElement?.duration || 100}
          onChange={handleSliderInput}
          disabled={!stateRef.narrator.audioElement || isGenerating}
        />
        <div className="tts-status">{ttsStatus}</div>
    </>
  );

  return (
    <div className="mt-8 pt-6 border-t border-gray-700 relative">
        <div ref={mountRef} className="w-full aspect-[9/16] md:aspect-video bg-black rounded-lg overflow-hidden shadow-2xl border-4 border-gray-700" />
        <div className="absolute inset-0 pointer-events-none">
            {!isShowroomTheme && sceneData.title && <div className="threedee-title">{sceneData.title[language]}</div>}
            {allLabels.map(label => {
                const value = label.value || 0;
                const className = `threedee-label ${value > 0.001 ? 'positive' : value < -0.001 ? 'negative' : 'neutral'}`;
                return ( <div key={label.id} id={`label-${label.id}`} className={className}>{`${label[language]} (${value > 0 ? '+' : ''}${value}%)`}</div>)
            })}
        </div>
        <div className="playback-menu">
            {isShowroomTheme ? renderShowroomControls() : renderAbstractControls()}
        </div>
    </div>
  );
};

// --- Showroom Theme Implementation ---
function initShowroom(stateRef: any, sceneData: any) {
    const { scene, camera, controls, lookAtTarget } = stateRef;
    const colors = sceneData.theme.colors;

    scene.background = new THREE.Color(colors.wall);
    scene.fog = new THREE.Fog(colors.wall, 50, 150);
    camera.position.set(0, 5, 30);
    controls.target.set(0, 5, 0);
    scene.add(lookAtTarget);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(0, 30, 25);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);
    
    // Room Geometry
    const ROOM_WIDTH = 100, ROOM_DEPTH = 50, ROOM_HEIGHT = 20;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH), new THREE.MeshStandardMaterial({ color: colors.floor, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH), new THREE.MeshStandardMaterial({ color: colors.ceiling }));
    ceiling.position.y = ROOM_HEIGHT;
    ceiling.rotation.x = Math.PI / 2;
    scene.add(ceiling);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: colors.wall });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT), wallMaterial);
    backWall.position.set(0, ROOM_HEIGHT/2, -ROOM_DEPTH/2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT), wallMaterial);
    leftWall.position.set(-ROOM_WIDTH/2, ROOM_HEIGHT/2, 0);
    leftWall.rotation.y = Math.PI/2;
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT), wallMaterial);
    rightWall.position.set(ROOM_WIDTH/2, ROOM_HEIGHT/2, 0);
    rightWall.rotation.y = -Math.PI/2;
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // Create and place slides
    const SLIDE_WIDTH = 16;
    const SLIDE_HEIGHT = 9;
    const PADDING = 4;
    const SLIDE_Y = 7;
    const slides = sceneData.slides || [];
    
    const backWallSlides = slides.slice(0, 5);
    const rightWallSlides = slides.slice(5, 5 + Math.floor((slides.length - 5) / 2));
    const leftWallSlides = slides.slice(5 + rightWallSlides.length);

    const placeSlides = (slideList: any[], wall: 'back' | 'left' | 'right') => {
      const totalWidth = slideList.length * SLIDE_WIDTH + Math.max(0, slideList.length - 1) * PADDING;
      let startOffset = -totalWidth / 2 + SLIDE_WIDTH / 2;

      slideList.forEach((slideData: any, index: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1600;
        canvas.height = 900;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        if (slideData.type === 'chart' && slideData.chartJsConfig) {
            new Chart(ctx, slideData.chartJsConfig);
        } else {
            drawTextSlide(ctx, slideData, colors, canvas.width, canvas.height, slides.indexOf(slideData) + 1, slides.length);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshStandardMaterial({ map: texture, metalness: 0.1, roughness: 0.8 });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SLIDE_WIDTH, SLIDE_HEIGHT), material);
        mesh.castShadow = true;
        mesh.userData.id = slideData.id;

        let position = new THREE.Vector3();
        let rotationY = 0;
        const offset = startOffset + index * (SLIDE_WIDTH + PADDING);

        if (wall === 'back') {
          position.set(offset, SLIDE_Y, -ROOM_DEPTH / 2 + 0.5);
        } else if (wall === 'right') {
          position.set(ROOM_WIDTH / 2 - 0.5, SLIDE_Y, offset);
          rotationY = -Math.PI / 2;
        } else if (wall === 'left') {
          position.set(-ROOM_WIDTH / 2 + 0.5, SLIDE_Y, offset);
          rotationY = Math.PI / 2;
        }

        mesh.position.copy(position);
        mesh.rotation.y = rotationY;
        
        scene.add(mesh);
        stateRef.slideMeshes.push(mesh);
        
        const cameraPos = position.clone().add(new THREE.Vector3(0,0,15).applyAxisAngle(new THREE.Vector3(0,1,0), rotationY));
        stateRef.cameraTargets.set(slideData.id, {
            position: cameraPos,
            lookAt: position,
        });
      });
    };

    placeSlides(backWallSlides, 'back');
    placeSlides(rightWallSlides, 'right');
    placeSlides(leftWallSlides, 'left');

    // Create and place speakers
    if (sceneData.speakers && sceneData.speakers.length > 0) {
      sceneData.speakers.forEach((speakerData: any, index: number) => {
        const speakerMesh = createSpeaker(speakerData.name, speakerData.shirtColor);
        const xPos = (index === 0) ? -4 : 4;
        speakerMesh.position.set(xPos, 0, 10);
        speakerMesh.lookAt(0, 5, 0);
        scene.add(speakerMesh);
        stateRef.speakers.push(speakerMesh);
      });
    }

    controls.addEventListener('start', () => { stateRef.isUserInteracting = true; });
    controls.addEventListener('end', () => { setTimeout(() => { stateRef.isUserInteracting = false; }, 2000) });
}

function animateShowroom(stateRef: any) {
    const { scene, camera, renderer, controls, raycaster, mouse, slideMeshes, isNarrationPlaying, narrator, cameraTargets, lookAtTarget, isUserInteracting, speakers, dialogueTimings } = stateRef;
    if (!renderer || !scene || !camera) return;
    controls.update();

    let currentTurn = null;
    if (narrator.audioElement) {
        const currentTime = narrator.audioElement.currentTime;
        currentTurn = dialogueTimings.find((t: any) => currentTime >= t.startTime && currentTime < t.endTime);
    }
    
    if (isNarrationPlaying && !isUserInteracting && currentTurn) {
        const target = cameraTargets.get(currentTurn.sceneId);
        if (target) {
            camera.position.lerp(target.position, 0.03);
            lookAtTarget.position.lerp(target.lookAt, 0.03);
            camera.lookAt(lookAtTarget.position);
        }
    }
    
    speakers.forEach((speaker: THREE.Group) => {
        const isSpeaking = currentTurn && speaker.userData.name === currentTurn.speakerName && isNarrationPlaying;
        if (isSpeaking) {
            speaker.position.y = Math.sin(Date.now() * 0.01) * 0.1;
        } else {
            speaker.position.y = THREE.MathUtils.lerp(speaker.position.y, 0, 0.1);
        }
    });
    
    raycaster.setFromCamera(mouse, camera);
	const intersects = raycaster.intersectObjects(slideMeshes);
    slideMeshes.forEach((mesh: THREE.Mesh<any, THREE.MeshStandardMaterial>) => { mesh.material.emissive.setHex(0x000000) });
    if(intersects.length > 0) {
        (intersects[0].object as THREE.Mesh<any, THREE.MeshStandardMaterial>).material.emissive.setHex(0x444444);
    }

    renderer.render(scene, camera);
}

// --- Abstract Theme Implementation ---
function initAbstract(stateRef: any, sceneData: any, language: string) {
    const { scene, camera, controls } = stateRef;
    scene.background = new THREE.Color(sceneData.theme.background);
    scene.fog = new THREE.Fog(sceneData.theme.background, 150, 500);
    camera.position.set(0, 80, 160);
    controls.target.set(0, 0, -50);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(50, 80, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    const gridHelper = new THREE.GridHelper(300, 30, sceneData.theme.grid, 0x444444);
    scene.add(gridHelper);

    setupNarratorScreen(scene!, stateRef.narrator, sceneData.narratorScript[language]);
    createDataObjects(scene!, sceneData, stateRef.animatedBlocks);
}

function animateAbstract(stateRef: any, mountRef: React.RefObject<HTMLDivElement>) {
    const { scene, camera, renderer, controls, animatedBlocks } = stateRef;
    if (!renderer || !scene || !camera) return;
    controls.update();
    updateNarrator(stateRef.narrator);
    updateObjectAnimations(animatedBlocks);
    updateLabels(animatedBlocks, camera, mountRef);
    renderer.render(scene, camera);
}

function createDataObjects(scene: THREE.Scene, sceneData: any, animatedBlocks: any[]) {
    const rowSpacing = 35;
    const colSpacing = 20;
    sceneData.dataRows.forEach((row: any, rowIndex: number) => {
        const z = -rowIndex * rowSpacing;
        const totalItems = row.items.length;
        const startX = -((totalItems - 1) / 2) * colSpacing;
        row.items.forEach((item: any, itemIndex: number) => {
            const geometry = GEOMETRIES[row.category.en as keyof typeof GEOMETRIES] || DEFAULT_GEOMETRY;
            const material = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.5, metalness: 0.1 });
            const block = new THREE.Mesh(geometry, material);
            block.position.set(startX + itemIndex * colSpacing, 0, z);
            block.scale.y = 1e-6;
            block.castShadow = true;
            block.receiveShadow = true;
            if (row.category.en === 'Sector Performance') block.rotation.x = Math.PI / 2;
            const change = item.value || 0;
            (block as any).targetScaleY = Math.max(1e-6, Math.abs(change / 100 * SCALE_MULTIPLIER));
            (block as any).targetPositionY = (change / 100 * SCALE_MULTIPLIER) / 2;
            (block as any).labelId = item.id;
            scene.add(block);
            animatedBlocks.push(block);
        });
    });
}

function setupNarratorScreen(scene: THREE.Scene, narrator: any, textLines: string[]) {
    narrator.canvas = document.createElement('canvas');
    narrator.canvas.width = 1024;
    narrator.canvas.height = 512;
    narrator.context = narrator.canvas.getContext('2d');
    narrator.texture = new THREE.CanvasTexture(narrator.canvas);
    const screenGeometry = new THREE.PlaneGeometry(160, 80);
    const screenMaterial = new THREE.MeshBasicMaterial({ map: narrator.texture, transparent: true, opacity: 0.8 });
    const screenMesh = new THREE.Mesh(screenGeometry, screenMaterial);
    screenMesh.position.set(0, 40, -150);
    scene.add(screenMesh);
    updateNarrator(narrator, textLines);
}

function updateNarrator(narrator: any, newTextLines?: string[]) {
    if (!narrator.context || !narrator.canvas) return;
    const LINE_HEIGHT = 40;
    const FONT_SIZE = 32;
    narrator.context.fillStyle = '#00001a';
    narrator.context.fillRect(0, 0, narrator.canvas.width, narrator.canvas.height);
    narrator.context.fillStyle = '#E0E0E0';
    narrator.context.font = `${FONT_SIZE}px Arial`;
    narrator.context.textBaseline = 'top';
    const textLines = newTextLines || narrator.textLines;
    narrator.textLines = textLines;

    if (narrator.syncToAudio && narrator.audioElement) {
        const duration = narrator.audioElement.duration;
        if (duration > 0) {
            const scrollPercent = narrator.audioElement.currentTime / duration;
            const totalTextHeight = textLines.length * LINE_HEIGHT;
            narrator.scrollY = scrollPercent * (totalTextHeight + narrator.canvas.height / 2);
        }
    } else if (narrator.isScrolling && !narrator.isUserPaused) {
        narrator.scrollY += 0.3;
        const totalTextHeight = textLines.length * LINE_HEIGHT;
        if (narrator.scrollY > totalTextHeight) narrator.scrollY = -narrator.canvas.height;
    }

    for (let i = 0; i < textLines.length; i++) {
        const y = (i * LINE_HEIGHT) - narrator.scrollY;
        if (y > -LINE_HEIGHT && y < narrator.canvas.height) {
            narrator.context.fillText(textLines[i], 20, y);
        }
    }
    if (narrator.texture) {
      narrator.texture.needsUpdate = true;
    }
}

function updateObjectAnimations(animatedBlocks: any[]) {
    const LERP_FACTOR = 0.05;
    animatedBlocks.forEach(block => {
        block.scale.y = THREE.MathUtils.lerp(block.scale.y, block.targetScaleY, LERP_FACTOR);
        block.position.y = THREE.MathUtils.lerp(block.position.y, block.targetPositionY, LERP_FACTOR);
    });
}

function updateLabels(animatedBlocks: any[], camera: THREE.PerspectiveCamera, mountRef: React.RefObject<HTMLDivElement>) {
    if (!mountRef.current) return;
    const screenWidth = mountRef.current.clientWidth;
    const screenHeight = mountRef.current.clientHeight;

    animatedBlocks.forEach(block => {
        const labelEl = document.getElementById(`label-${block.labelId}`);
        if (!labelEl) return;
        
        const labelYOffset = (block.targetPositionY >= 0) ? (block.position.y + block.scale.y / 2 + 3) : (block.position.y - block.scale.y / 2 - 3);
        const labelPosition = new THREE.Vector3(block.position.x, labelYOffset, block.position.z);
        labelPosition.project(camera);

        const x = (labelPosition.x * 0.5 + 0.5) * screenWidth;
        const y = (-labelPosition.y * 0.5 + 0.5) * screenHeight;

        if (labelPosition.z > 1 || x < 0 || x > screenWidth || y < 0 || y > screenHeight) {
            labelEl.style.display = 'none';
        } else {
            labelEl.style.display = 'block';
            labelEl.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        }
    });
}

export default ThreeDeeVisualizer;