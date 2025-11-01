// Fix: Removed invalid file marker syntax that was causing compilation errors.
export const sample = {
  html: `
<section class="slide flex flex-col items-center justify-center h-screen bg-gray-900 text-white text-center p-8">
  <h1 class="text-6xl font-bold mb-4 animate-fade-in-down">The Rise of AI</h1>
  <p class="text-2xl text-gray-300 animate-fade-in-up">Exploring the Future of Intelligence</p>
</section>

<section class="slide flex flex-col items-center justify-center h-screen bg-gray-800 text-white p-8">
  <h2 class="text-4xl font-bold mb-8">AI Market Growth</h2>
  <div class="w-full max-w-4xl h-96">
    <canvas data-component="chart" data-chart='{
      "type": "bar",
      "data": {
        "labels": ["2022", "2023", "2024", "2025", "2026", "2027"],
        "datasets": [{
          "label": "Market Size (in Billions)",
          "data": [136, 196, 284, 412, 597, 869],
          "backgroundColor": "rgba(168, 85, 247, 0.6)",
          "borderColor": "rgba(168, 85, 247, 1)",
          "borderWidth": 1
        }]
      },
      "options": {
        "responsive": true,
        "maintainAspectRatio": false,
        "scales": { "y": { "beginAtZero": true } }
      }
    }'></canvas>
  </div>
</section>

<section class="slide flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-8">
    <h2 class="text-4xl font-bold mb-8">Key Metrics</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
        <div>
            <h3 class="text-6xl font-bold count-up" data-value="8.3">0</h3>
            <p class="text-xl text-gray-400 mt-2">Trillion Parameters</p>
        </div>
        <div>
            <h3 class="text-6xl font-bold count-up" data-value="97">0</h3>
            <p class="text-xl text-gray-400 mt-2">% Accuracy Rate</p>
        </div>
        <div>
            <h3 class="text-6xl font-bold count-up" data-value="300">0</h3>
            <p class="text-xl text-gray-400 mt-2">Million Daily Users</p>
        </div>
    </div>
</section>

<section class="slide flex flex-col items-center justify-center h-screen bg-gray-800 text-white p-8">
  <h2 class="text-4xl font-bold mb-8">AI Development Process</h2>
  <svg id="process-diagram" width="600" height="200" viewBox="0 0 600 200">
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#a78bfa" />
      </marker>
    </defs>
    <!-- Lines -->
    <path class="diagram-path" d="M 100 100 L 250 100" stroke="#a78bfa" stroke-width="2" fill="none" marker-end="url(#arrow)"/>
    <path class="diagram-path" d="M 350 100 L 500 100" stroke="#a78bfa" stroke-width="2" fill="none" marker-end="url(#arrow)"/>
    <!-- Circles and Text -->
    <g class="diagram-step opacity-0">
      <circle cx="50" cy="100" r="40" fill="#4b5563"/>
      <text x="50" y="105" font-family="sans-serif" font-size="14" fill="white" text-anchor="middle">Data</text>
    </g>
    <g class="diagram-step opacity-0">
      <circle cx="300" cy="100" r="40" fill="#4b5563"/>
      <text x="300" y="105" font-family="sans-serif" font-size="14" fill="white" text-anchor="middle">Training</text>
    </g>
    <g class="diagram-step opacity-0">
      <circle cx="550" cy="100" r="40" fill="#4b5563"/>
      <text x="550" y="105" font-family="sans-serif" font-size="14" fill="white" text-anchor="middle">Deployment</text>
    </g>
  </svg>
</section>

<section class="slide flex flex-col items-center justify-center h-screen bg-gray-900 text-white text-center p-8">
  <h2 class="text-4xl font-bold mb-4">Thank You</h2>
  <p class="text-xl">Questions?</p>
</section>
`,
  css: `
.slide {
  width: 100%;
  height: 100vh; /* vh ensures it takes full viewport height */
  scroll-snap-align: start;
  scroll-snap-stop: always;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}

.slide.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* Ensure body and html are full height for snapping */
html, body {
  height: 100%;
  margin: 0;
  scroll-snap-type: y mandatory;
  overflow-y: scroll;
  background-color: #111827; /* gray-900 */
}


/* Initial State for Animations */
.diagram-path {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
}


/* Simple Animations */
@keyframes fade-in-down {
    0% {
        opacity: 0;
        transform: translateY(-20px);
    }
    100% {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes fade-in-up {
    0% {
        opacity: 0;
        transform: translateY(20px);
    }
    100% {
        opacity: 1;
        transform: translateY(0);
    }
}

.animate-fade-in-down {
    animation: fade-in-down 0.8s ease-out forwards;
}

.animate-fade-in-up {
    animation: fade-in-up 0.8s ease-out 0.4s forwards;
    opacity: 0;
}
`,
  js: `
document.addEventListener('DOMContentLoaded', () => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.5 // Trigger when 50% of the element is visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add 'is-visible' class to slide for fade-in effect
                entry.target.classList.add('is-visible');

                // Animate elements within the slide
                const chartCanvas = entry.target.querySelector('[data-component="chart"]');
                const countUpElements = entry.target.querySelectorAll('.count-up');
                const processDiagram = entry.target.querySelector('#process-diagram');

                if (chartCanvas) {
                    const chartDataString = chartCanvas.dataset.chart;
                    
                    // Always destroy the previous chart instance before creating a new one
                    if (chartCanvas.chartInstance) {
                        chartCanvas.chartInstance.destroy();
                    }

                    if (chartDataString) {
                        try {
                            const chartData = JSON.parse(chartDataString);
                            // Store the new chart instance on the canvas element
                            chartCanvas.chartInstance = new Chart(chartCanvas.getContext('2d'), chartData);
                        } catch (e) {
                            console.error('Failed to parse chart data or create chart:', e);
                        }
                    } else {
                         console.error('Chart canvas is missing data-chart attribute or it is empty.');
                    }
                }

                if (countUpElements.length > 0) {
                    countUpElements.forEach(el => {
                        if (el.dataset.animated) return;
                        el.dataset.animated = true;
                        anime({
                            targets: el,
                            innerHTML: [0, el.dataset.value],
                            round: el.dataset.value % 1 === 0 ? 1 : 100, // Round to integer or 2 decimal places
                            easing: 'easeOutExpo',
                            duration: 2000
                        });
                    });
                }
                
                if (processDiagram && !processDiagram.dataset.animated) {
                    processDiagram.dataset.animated = true;
                    const tl = anime.timeline({
                        easing: 'easeOutExpo',
                        duration: 1000
                    });
                    tl.add({
                        targets: '.diagram-path',
                        strokeDashoffset: [anime.setDashoffset, 0],
                    }).add({
                        targets: '.diagram-step',
                        opacity: [0, 1],
                        duration: 500,
                        delay: anime.stagger(200)
                    }, '-=500');
                }

                // Optional: unobserve the element after it has been animated
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all slides
    document.querySelectorAll('.slide').forEach(slide => {
        observer.observe(slide);
    });
});
`,
};