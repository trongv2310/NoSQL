
(function () {
    function initHorizontalSliders() {
        var containers = document.querySelectorAll('.promo-slider-container');
        containers.forEach(function (container) {
            var wrap = container.querySelector('.promo-slider-track-wrap');
            var prevBtn = container.querySelector('.promo-slider-btn.prev');
            var nextBtn = container.querySelector('.promo-slider-btn.next');
            if (!wrap) return;

            function syncCardDimensions() {
                var containerWidth = wrap.clientWidth;
                if (!containerWidth) return;

                var visibleCards = 4;
                var gap = 20;

                if (window.innerWidth <= 480) {
                    visibleCards = 2;
                    gap = 10;
                } else if (window.innerWidth <= 768) {
                    visibleCards = 2;
                    gap = 14;
                } else if (window.innerWidth <= 992) {
                    visibleCards = 3;
                    gap = 16;
                }

                var cardWidth = (containerWidth - (gap * (visibleCards - 1))) / visibleCards;
                var cards = wrap.querySelectorAll('.product-card');
                cards.forEach(function (card) {
                    card.style.flex = '0 0 ' + cardWidth + 'px';
                    card.style.width = cardWidth + 'px';
                    card.style.maxWidth = cardWidth + 'px';
                });
            }

            syncCardDimensions();
            window.addEventListener('resize', syncCardDimensions);

            if (container.dataset.sliderInitialized) return;
            container.dataset.sliderInitialized = 'true';

            function getStep() {
                var cards = wrap.querySelectorAll('.product-card');
                if (cards.length >= 2) {
                    var diff = cards[1].offsetLeft - cards[0].offsetLeft;
                    if (diff > 0) return diff;
                }
                var card = cards[0];
                var gap = 20;
                if (window.innerWidth <= 480) gap = 10;
                else if (window.innerWidth <= 768) gap = 14;
                else if (window.innerWidth <= 992) gap = 16;
                return card ? (card.offsetWidth + gap) : 280;
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', function () {
                    var step = getStep();
                    if (Math.ceil(wrap.scrollLeft + wrap.clientWidth) >= wrap.scrollWidth - 15) {
                        wrap.scrollTo({ left: 0, behavior: 'smooth' });
                    } else {
                        wrap.scrollBy({ left: step, behavior: 'smooth' });
                    }
                });
            }

            if (prevBtn) {
                prevBtn.addEventListener('click', function () {
                    var step = getStep();
                    if (wrap.scrollLeft <= 15) {
                        wrap.scrollTo({ left: wrap.scrollWidth, behavior: 'smooth' });
                    } else {
                        wrap.scrollBy({ left: -step, behavior: 'smooth' });
                    }
                });
            }

            var autoTimer = null;
            function startAuto() {
                stopAuto();
                autoTimer = setInterval(function () {
                    var step = getStep();
                    if (Math.ceil(wrap.scrollLeft + wrap.clientWidth) >= wrap.scrollWidth - 15) {
                        wrap.scrollTo({ left: 0, behavior: 'smooth' });
                    } else {
                        wrap.scrollBy({ left: step, behavior: 'smooth' });
                    }
                }, 3800);
            }

            function stopAuto() {
                if (autoTimer) {
                    clearInterval(autoTimer);
                    autoTimer = null;
                }
            }

            container.addEventListener('mouseenter', stopAuto);
            container.addEventListener('mouseleave', startAuto);
            container.addEventListener('touchstart', stopAuto, { passive: true });
            container.addEventListener('touchend', startAuto, { passive: true });

            startAuto();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHorizontalSliders);
    } else {
        initHorizontalSliders();
    }
})();
