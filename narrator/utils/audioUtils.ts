/**
 * Decodes a base64 string into a Uint8Array.
 * @param base64 The base64 encoded string.
 * @returns A Uint8Array containing the decoded data.
 */
export function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer.
 * @param data The raw PCM audio data as a Uint8Array.
 * @param ctx The AudioContext to use for decoding.
 * @param sampleRate The sample rate of the audio.
 * @param numChannels The number of channels in the audio.
 * @returns A promise that resolves with the decoded AudioBuffer.
 */
export async function decodePcmAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}


/**
 * Parses bits per sample and rate from an audio MIME type string.
 * Assumes bits per sample is encoded like "L16" and rate as "rate=xxxxx".
 * @param mimeType The audio MIME type string (e.g., "audio/L16;rate=24000").
 * @returns An object with "bitsPerSample" and "sampleRate".
 */
const parseAudioMimeType = (mimeType: string): { bitsPerSample: number; sampleRate: number } => {
    let bitsPerSample = 16;
    let sampleRate = 24000; // Common default

    const rateMatch = mimeType.match(/rate=(\d+)/);
    if (rateMatch) {
        sampleRate = parseInt(rateMatch[1], 10);
    }

    const bitsMatch = mimeType.match(/audio\/L(\d+)/);
    if (bitsMatch) {
        bitsPerSample = parseInt(bitsMatch[1], 10);
    }

    return { bitsPerSample, sampleRate };
};

/**
 * Generates a WAV file header for the given audio data and parameters
 * and prepends it to the audio data.
 * @param pcmData The raw PCM audio data as a Uint8Array.
 * @param mimeType Mime type of the audio data.
 * @returns A Uint8Array representing the complete WAV file data.
 */
export const addWavHeader = (pcmData: Uint8Array, mimeType: string): Uint8Array => {
    const { bitsPerSample, sampleRate } = parseAudioMimeType(mimeType);
    const numChannels = 1;
    const dataSize = pcmData.length;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    // RIFF header
    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");

    // "fmt " sub-chunk
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // Sub-chunk size (16 for PCM)
    view.setUint16(20, 1, true); // Audio format (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // "data" sub-chunk
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    // Combine header and PCM data
    const wavData = new Uint8Array(44 + dataSize);
    wavData.set(new Uint8Array(buffer), 0);
    wavData.set(pcmData, 44);

    return wavData;
};

function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

/**
 * Converts raw PCM audio data (as Int16Array) to a WAV file Blob.
 * @param pcmData The raw PCM audio data as an Int16Array.
 * @param sampleRate The sample rate of the audio.
 * @returns A Blob representing the complete WAV file data.
 */
export function pcmToWav(pcmData: Int16Array, sampleRate: number): Blob {
    const numSamples = pcmData.length;
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit PCM

    const dataSize = numSamples * numChannels * bytesPerSample;
    const fileSize = 36 + dataSize;
    
    const buffer = new ArrayBuffer(fileSize + 8); // +8 for RIFF chunk
    const view = new DataView(buffer);

    let offset = 0;

    // RIFF header
    writeString(view, offset, 'RIFF'); offset += 4;
    view.setUint32(offset, fileSize, true); offset += 4;
    writeString(view, offset, 'WAVE'); offset += 4;

    // fmt chunk
    writeString(view, offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4; // chunk size
    view.setUint16(offset, 1, true); offset += 2; // audio format (1 = PCM)
    view.setUint16(offset, numChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * numChannels * bytesPerSample, true); offset += 4; // byte rate
    view.setUint16(offset, numChannels * bytesPerSample, true); offset += 2; // block align
    view.setUint16(offset, 16, true); offset += 2; // bits per sample

    // data chunk
    writeString(view, offset, 'data'); offset += 4;
    view.setUint32(offset, dataSize, true); offset += 4;
    
    // Write PCM data
    for (let i = 0; i < numSamples; i++, offset += 2) {
        view.setInt16(offset, pcmData[i], true);
    }

    return new Blob([view], { type: 'audio/wav' });
}