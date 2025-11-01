// Fix: Export the bootstrapScript constant to be used as an injectable script.
export const bootstrapScript = `
document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.slide');
    let currentSlide = 0;

    if (slides.length === 0) return;

    // This function scrolls the target slide into view.
    const goToSlide = (index) => {
        if (index >= 0 && index < slides.length) {
            slides[index].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            currentSlide = index;
        }
    }

    // Add keyboard navigation for slides.
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === ' ') {
            e.preventDefault();
            goToSlide(currentSlide + 1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goToSlide(currentSlide - 1);
        }
    });
    
    // Listen for messages from the parent frame to control navigation.
    window.addEventListener('message', (event) => {
        // Basic security check
        if (event.source !== window.parent) {
            return;
        }

        const { type, index } = event.data;
        if (type === 'goToSlide' && typeof index === 'number') {
            goToSlide(index);
        }
    });

    // Ensure slides are focusable for scrollIntoView to work correctly in all cases.
    if (slides.length > 0) {
       slides.forEach(slide => {
           if (!slide.hasAttribute('tabindex')) {
               slide.setAttribute('tabindex', '-1');
           }
       });
    }
});
`;