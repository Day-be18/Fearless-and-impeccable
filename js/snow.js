// Простая реализация падающего снега
(function() {
    'use strict';

    const canvasId = 'snow-canvas';

    function createCanvas() {
        let canvas = document.getElementById(canvasId);
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = canvasId;
            document.body.appendChild(canvas);
        }
        return canvas;
    }

    class Snow {
        constructor() {
            this.canvas = createCanvas();
            this.ctx = this.canvas.getContext('2d');
            this.dpr = window.devicePixelRatio || 1;
            this.snowflakes = [];
            this.running = false;
            this.resize();
            this._tick = this._tick.bind(this);
            window.addEventListener('resize', () => this.resize());
        }

        resize() {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.canvas.width = Math.floor(this.width * this.dpr);
            this.canvas.height = Math.floor(this.height * this.dpr);
            this.canvas.style.width = this.width + 'px';
            this.canvas.style.height = this.height + 'px';
            this.ctx.scale(this.dpr, this.dpr);
        }

        start() {
            if (this.running) return;
            this.canvas.style.display = 'block';
            this.running = true;
            // initial population
            this.snowflakes = this.snowflakes.concat(this._generateFlakes(120));
            this._last = performance.now();
            requestAnimationFrame(this._tick);
        }

        stop() {
            this.running = false;
            this.canvas.style.display = 'none';
            this.snowflakes = [];
            this.ctx.clearRect(0, 0, this.width, this.height);
        }

        toggle() {
            if (this.running) this.stop(); else this.start();
        }

        _generateFlakes(n) {
            const arr = [];
            for (let i = 0; i < n; i++) {
                arr.push(this._createFlake());
            }
            return arr;
        }

        _createFlake() {
            const size = Math.random() * 3 + 1; // 1-4
            return {
                x: Math.random() * this.width,
                y: Math.random() * this.height - this.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: Math.random() * 1 + 0.3,
                r: size,
                alpha: Math.random() * 0.6 + 0.4
            };
        }

        _tick(now) {
            if (!this.running) return;
            const dt = (now - this._last) / 1000;
            this._last = now;
            this._update(dt);
            this._draw();
            requestAnimationFrame(this._tick);
        }

        _update(dt) {
            const w = this.width, h = this.height;
            for (let i = this.snowflakes.length - 1; i >= 0; i--) {
                const f = this.snowflakes[i];
                f.x += f.vx * 60 * dt;
                f.y += f.vy * 60 * dt;
                f.vx += Math.sin((f.y + f.x) * 0.001) * 0.01;
                if (f.y - f.r > h || f.x < -50 || f.x > w + 50) {
                    // recycle
                    this.snowflakes[i] = this._createFlake();
                    this.snowflakes[i].y = -10;
                    continue;
                }
            }
            // keep density roughly constant
            if (this.snowflakes.length < 150) {
                this.snowflakes.push(this._createFlake());
            }
        }

        _draw() {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.width, this.height);
            for (const f of this.snowflakes) {
                ctx.beginPath();
                ctx.fillStyle = 'rgba(255,255,255,' + f.alpha + ')';
                ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Экспортируем синглтон
    const snow = new Snow();
    window.SnowEffect = snow;
})();
