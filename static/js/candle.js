class CandleAnimation {
    constructor() {
        this.totalTime = 20; // 总时长18秒
        this.currentTime = 0;
        this.isRunning = false;
        this.animationFrameId = null;
        this.startTime = 0;
        this.pausedTime = 0;

        // DOM元素
        this.timerElement = document.getElementById('timer');
        this.progressFill = document.getElementById('progress-fill');
        this.progressText = document.getElementById('progress-text');
        this.statusText = document.getElementById('status-text');
        this.flameElement = document.querySelector('.flame');
        this.candleBody = document.querySelector('.candle-body');
        this.waxDrips = document.querySelectorAll('.wax-drip');
        this.smokeElement = document.querySelector('.smoke');
        this.wickElement = document.querySelector('.wick');

        // 按钮
        this.startBtn = document.getElementById('start-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.resetBtn = document.getElementById('reset-btn');

        // 绑定事件
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());

        // 初始化
        this.updateDisplay();
    }

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.startTime = Date.now() - this.pausedTime;
        this.pausedTime = 0;

        this.updateButtonStates();
        this.statusText.textContent = '燃烧中...';
        this.statusText.style.color = '#ff9a00';

        this.animate();
    }

    pause() {
        if (!this.isRunning) return;

        this.isRunning = false;
        this.pausedTime = Date.now() - this.startTime;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        this.updateButtonStates();
        this.statusText.textContent = '已暂停';
        this.statusText.style.color = '#2196F3';
    }

    reset() {
        this.pause();
        this.currentTime = 0;
        this.pausedTime = 0;
        this.updateDisplay();
        this.resetVisualEffects();
        this.statusText.textContent = '准备开始';
        this.statusText.style.color = '#4CAF50';
    }

    animate() {
        if (!this.isRunning) return;

        const elapsed = (Date.now() - this.startTime) / 1000;
        this.currentTime = Math.min(elapsed, this.totalTime);

        this.updateDisplay();
        this.updateVisualEffects();

        if (this.currentTime >= this.totalTime) {
            this.complete();
        } else {
            this.animationFrameId = requestAnimationFrame(() => this.animate());
        }
    }

    updateDisplay() {
        // 更新计时器
        const remaining = (this.totalTime - this.currentTime).toFixed(1);
        this.timerElement.textContent = remaining;

        // 更新进度条
        const progress = (this.currentTime / this.totalTime) * 100;
        this.progressFill.style.width = `${progress}%`;
        this.progressText.textContent = `${Math.round(progress)}%`;

        // 更新计时器颜色（根据剩余时间变化）
        if (remaining <= 5) {
            this.timerElement.style.color = '#ff4444';
        } else if (remaining <= 10) {
            this.timerElement.style.color = '#ffaa00';
        } else {
            this.timerElement.style.color = '#ff9a00';
        }
    }

    updateVisualEffects() {
        const progress = this.currentTime / this.totalTime;

        // 蜡烛主体：随时间变短（烧掉85%）
        const candleHeight = 280 * (1 - progress * 0.85);
        this.candleBody.style.height = `${candleHeight}px`;

        // 计算高度减少量，用于调整火焰和烛芯位置
        const heightReduction = 280 - candleHeight;

        // 火焰效果：随时间变小（缩小80%）并调整位置
        const flameScale = 1 - (progress * 0.8);
        this.flameElement.style.transform = `translateX(-50%) scale(${flameScale}, ${flameScale})`;
        this.flameElement.style.top = `${-60 + heightReduction}px`;

        // 烛芯位置调整
        this.wickElement.style.top = `${-10 + heightReduction}px`;

        // 蜡滴效果：随时间逐渐显现（提前出现）
        this.waxDrips.forEach((drip, index) => {
            const dripProgress = Math.max(0, progress - 0.15 - index * 0.08);
            if (dripProgress > 0) {
                drip.style.opacity = Math.min(dripProgress * 3, 1);
                drip.style.transform = `translateY(${dripProgress * 25}px)`;
            }
        });

        // 烟雾效果：提前出现（70%进度时开始）
        if (progress > 0.7) {
            const smokeProgress = (progress - 0.7) * 3.3;
            this.smokeElement.style.opacity = smokeProgress;
            this.smokeElement.style.transform = `translateX(-50%) translateY(${-smokeProgress * 50}px)`;
            this.smokeElement.style.width = `${10 + smokeProgress * 20}px`;
        }

        // 火焰颜色变化：随时间变暗（提前变暗）
        if (progress > 0.5) {
            const darken = (progress - 0.5) * 2;
            const red = Math.round(255 - darken * 120);
            const orange = Math.round(154 - darken * 120);
            this.flameElement.style.background =
                `linear-gradient(to bottom, rgb(${red}, ${orange}, 0), rgb(${red}, 80, 0), rgb(${red}, 30, 0))`;
        }
    }

    resetVisualEffects() {
        // 重置火焰
        this.flameElement.style.transform = 'translateX(-50%) scale(1, 1)';
        this.flameElement.style.background =
            'linear-gradient(to bottom, #ff9a00, #ff6b00, #ff3300)';
        this.flameElement.style.top = '';

        // 重置烛芯
        this.wickElement.style.top = '';

        // 重置蜡烛主体
        this.candleBody.style.height = '280px';

        // 重置蜡滴
        this.waxDrips.forEach(drip => {
            drip.style.opacity = '0';
            drip.style.transform = 'translateY(0)';
        });

        // 重置烟雾
        this.smokeElement.style.opacity = '0';
        this.smokeElement.style.transform = 'translateX(-50%)';
        this.smokeElement.style.width = '10px';
    }

    updateButtonStates() {
        this.startBtn.disabled = this.isRunning;
        this.pauseBtn.disabled = !this.isRunning;
    }

    complete() {
        this.isRunning = false;
        this.currentTime = this.totalTime;

        this.updateButtonStates();
        this.statusText.textContent = '燃烧完成！';
        this.statusText.style.color = '#f44336';

        // 最终效果：火焰熄灭
        this.flameElement.style.opacity = '0';
        this.smokeElement.style.opacity = '0.5';
        this.smokeElement.style.transform = 'translateX(-50%) translateY(-100px)';
        this.smokeElement.style.width = '50px';
        this.smokeElement.style.height = '100px';
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new CandleAnimation();
});