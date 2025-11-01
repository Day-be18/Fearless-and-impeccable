// UI enhancements: wire header buttons, theme toggle, and snow toggle
(function() {
    'use strict';

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    ready(() => {
        // Theme toggle in header
        const themeBtn = document.getElementById('themeToggleBtn');
        const snowBtn = document.getElementById('snowToggleBtn');

        function applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            // update icon
            if (theme === 'dark') {
                if (themeBtn) themeBtn.innerHTML = '<i class="fas fa-sun" aria-hidden="true"></i><span class="sr-only">Светлая тема</span>';
            } else {
                if (themeBtn) themeBtn.innerHTML = '<i class="fas fa-moon" aria-hidden="true"></i><span class="sr-only">Тёмная тема</span>';
            }
        }

        // Load saved theme or system preference
        const saved = localStorage.getItem('theme');
        if (saved) applyTheme(saved);
        else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) applyTheme('dark');
        else applyTheme('light');

        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme') || 'light';
                const next = current === 'light' ? 'dark' : 'light';
                applyTheme(next);
            });
        }

        // Snow toggle
        if (snowBtn && window.SnowEffect) {
            // restore previous state
            const snowOn = localStorage.getItem('snowEnabled') === 'true';
            if (snowOn) {
                window.SnowEffect.start();
                snowBtn.setAttribute('aria-pressed', 'true');
                snowBtn.classList.add('active');
            }

            snowBtn.addEventListener('click', () => {
                if (!window.SnowEffect) return;
                window.SnowEffect.toggle();
                const pressed = snowBtn.getAttribute('aria-pressed') === 'true';
                snowBtn.setAttribute('aria-pressed', (!pressed).toString());
                snowBtn.classList.toggle('active');
                localStorage.setItem('snowEnabled', (!pressed).toString());
            });
        }

        // Accessibility: keyboard support
        [themeBtn, snowBtn].forEach(btn => {
            if (!btn) return;
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    btn.click();
                }
            });
        });

        // Add ripple effect on click for header icon buttons
        function makeRipple(ev, el) {
            const rect = el.getBoundingClientRect();
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            const size = Math.max(rect.width, rect.height) * 1.2;
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (ev.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (ev.clientY - rect.top - size / 2) + 'px';
            el.appendChild(ripple);
            setTimeout(() => ripple.remove(), 700);
        }

        [themeBtn, snowBtn].forEach(btn => {
            if (!btn) return;
            btn.style.position = 'relative';
            btn.addEventListener('click', (e) => makeRipple(e, btn));
        });

        // Back to top button
        const backBtn = document.getElementById('backToTop');
        if (backBtn) {
            function checkScroll() {
                if (window.scrollY > window.innerHeight / 2) {
                    backBtn.style.display = 'inline-flex';
                    backBtn.setAttribute('aria-hidden', 'false');
                } else {
                    backBtn.style.display = 'none';
                    backBtn.setAttribute('aria-hidden', 'true');
                }
            }

            window.addEventListener('scroll', checkScroll, { passive: true });
            checkScroll();

            backBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            backBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    backBtn.click();
                }
            });
        }
    });
})();
