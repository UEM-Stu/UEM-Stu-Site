/**
 * <uem-easter-egg> 官网交互彩蛋管理器
 *
 * 全局捕获 Logo 连击与秘籍，触发以下彩蛋流程：
 * 1. 平滑回到页面最顶部。
 * 2. 隐去 Hero 原有的主内容（保留背景）。
 * 3. 屏幕上飘起大量 iMessage 风格的蓝青色渐变 "win" 气泡，从小变大再变小淡出。
 * 4. 气泡飘飞中，Hero 模块中央优雅浮现出两行励志标语。
 * 5. 5秒后，标语淡出，Hero 原内容以平滑渐显的方式复原。
 */

export class UemEasterEgg extends HTMLElement {
    // Logo 点击统计
    private _clickCount = 0;
    private _clickTimer: number | null = null;

    // 键盘输入缓存队列
    private _inputBuffer: string[] = [];

    // 彩蛋运行状态标志，防止运行中重复触发
    private _isActive = false;

    // 保存事件处理器引用以便清理
    private _clickHandler: ((e: MouseEvent) => void) | null = null;
    private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;

    connectedCallback(): void {
        this.setupStyles();
        this.setupEventListeners();
        console.log('[UEM-Stu] Win气泡彩蛋已加载。提示：连击 Logo 3次 或键盘输入 "win" 触发！');
    }

    disconnectedCallback(): void {
        if (this._clickHandler) {
            document.removeEventListener('click', this._clickHandler);
        }
        if (this._keydownHandler) {
            window.removeEventListener('keydown', this._keydownHandler);
        }
    }

    /**
     * 插入彩蛋专属 CSS 样式
     */
    private setupStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
      /* win 气泡外层容器，只负责屏幕定位和无顿挫的平滑位移 */
      .win-bubble-wrapper {
        position: fixed;
        z-index: 9999;
        pointer-events: none;
        will-change: transform;
      }

      /* win 气泡通用样式，只负责外观和缩放/渐变动画 */
      .win-bubble {
        background: linear-gradient(135deg, #007aff 0%, #00c6ff 100%);
        color: #ffffff;
        padding: 8px 16px;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
        font-weight: 600;
        font-size: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 15px rgba(0, 122, 255, 0.35);
        opacity: 0;
        transform: scale(0);
        will-change: transform, opacity;
      }

      /* 右下缺口气泡 (发送方风格) */
      .win-bubble.bubble-right {
        border-radius: 20px 20px 8px 20px;
      }

      /* 左下缺口气泡 (接收方风格) */
      .win-bubble.bubble-left {
        border-radius: 20px 20px 20px 8px;
      }

      /* 气泡平移漂移 keyframes */
      @keyframes win-fly {
        0% {
          transform: translate3d(0, 0, 0);
        }
        100% {
          transform: translate3d(var(--tx-end), var(--ty-end), 0);
        }
      }

      /* 气泡缩放与淡入淡出 keyframes */
      @keyframes win-scale-fade {
        0% {
          opacity: 0;
          transform: scale(0.2);
        }
        /* 快速膨胀到稍微过载的大小，营造充盈的气泡弹性 */
        12% {
          opacity: 1;
          transform: scale(1.15);
        }
        /* 微弱回缩 */
        24% {
          opacity: 1;
          transform: scale(0.97);
        }
        /* 稳定到标准尺寸，并持续保持到漂流末期 */
        34%, 80% {
          opacity: 1;
          transform: scale(1);
        }
        /* 顺滑地缩小并淡出 */
        100% {
          opacity: 0;
          transform: scale(0.1);
        }
      }

      /* 心跳呼吸动效（用于标语第二行） */
      @keyframes heartbeat-scale {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.06);
        }
      }
      .animate-pulse-scale {
        animation: heartbeat-scale 2.5s infinite ease-in-out;
      }
    `;
        this.appendChild(style);
    }

    /**
     * 绑定点击与键盘监听事件
     */
    private setupEventListeners(): void {
        // 1. 委托监听 Logo 的点击（1.5秒内连击 3次 触发）
        this._clickHandler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const logo = target.closest('uem-header img[alt="UEM-Stu Logo"]');
            if (logo) {
                this.handleLogoClick();
            }
        };
        document.addEventListener('click', this._clickHandler);

        // 2. 键盘事件监听 (键入 "win")
        this._keydownHandler = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            // 忽略在输入框或可编辑区域的打字输入
            if (
                activeEl &&
                (activeEl.tagName === 'INPUT' ||
                    activeEl.tagName === 'TEXTAREA' ||
                    (activeEl as HTMLElement).isContentEditable)
            ) {
                return;
            }

            if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
                this._inputBuffer.push(e.key.toLowerCase());
                if (this._inputBuffer.length > 5) {
                    this._inputBuffer.shift();
                }

                const currentString = this._inputBuffer.join('');
                if (currentString.endsWith('win')) {
                    this.triggerWinEasterEgg();
                    this._inputBuffer = [];
                }
            }
        };
        window.addEventListener('keydown', this._keydownHandler);
    }

    /**
     * 处理 Logo 连击计数
     */
    private handleLogoClick(): void {
        this._clickCount++;
        if (this._clickTimer) {
            window.clearTimeout(this._clickTimer);
        }

        if (this._clickCount >= 3) {
            this.triggerWinEasterEgg();
            this._clickCount = 0;
        } else {
            this._clickTimer = window.setTimeout(() => {
                this._clickCount = 0;
            }, 1500);
        }
    }

    /**
     * 触发全新的 "Win" 气泡变幻彩蛋
     */
    private triggerWinEasterEgg(): void {
        if (this._isActive) return;
        this._isActive = true;

        console.log('🚀 迎大(win)！冲鸭！全新交互彩蛋触发成功！');

        // 1. 回到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // 2. 寻找 Hero 模块的相关节点
        const wrapper = document.querySelector('uem-hero #hero-content-wrapper') as HTMLElement;
        const eggContainer = document.querySelector('uem-hero #hero-easter-egg-container') as HTMLElement;

        // 3. 丝滑隐去原 Hero 内容 (延迟 100ms 保证滚动动作已开始)
        setTimeout(() => {
            if (wrapper) {
                wrapper.style.opacity = '0';
                wrapper.style.transform = 'translateY(-30px) scale(0.96)';
                wrapper.style.pointerEvents = 'none';
            }
        }, 150);

        // 4. 生成满屏 "win" 聊天气泡
        setTimeout(() => {
            this.spawnWinBubbles();
        }, 200);

        // 5. 气泡飘散中，优雅渐显双行励志标语 (气泡启动后 800ms)
        setTimeout(() => {
            if (eggContainer) {
                eggContainer.innerHTML = `
          <div 
            style="
              opacity: 0;
              transform: translateY(20px);
              transition: all 1.2s cubic-bezier(0.25, 1, 0.5, 1);
            "
            class="easter-egg-line1 font-headline-md font-bold text-2xl md:text-4xl lg:text-5xl text-white mb-6 tracking-wide drop-shadow-md text-center px-4"
          >
            和优秀的人，做有挑战的事。
          </div>
          <div 
            style="
              opacity: 0;
              transform: translateY(20px);
              transition: all 1.2s cubic-bezier(0.25, 1, 0.5, 1) 0.3s;
            "
            class="easter-egg-line2 font-headline-lg font-extrabold text-3xl md:text-5xl lg:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-[#00c6ff] to-[#007aff] dark:from-[#8ab4f8] dark:to-[#4285f4] tracking-wider drop-shadow-lg text-center animate-pulse-scale"
          >
            应大冲鸭！
          </div>
        `;

                // 占位容器显示
                eggContainer.style.opacity = '1';
                eggContainer.style.transform = 'translateY(0)';

                // 逐行渐显动画
                requestAnimationFrame(() => {
                    const l1 = eggContainer.querySelector('.easter-egg-line1') as HTMLElement;
                    const l2 = eggContainer.querySelector('.easter-egg-line2') as HTMLElement;
                    if (l1) {
                        l1.style.opacity = '1';
                        l1.style.transform = 'translateY(0)';
                    }
                    if (l2) {
                        l2.style.opacity = '1';
                        l2.style.transform = 'translateY(0)';
                    }
                });
            }
        }, 1000);

        // 6. 5秒展示期后自动复原
        setTimeout(() => {
            this.restoreHero();
        }, 6000);
    }

    /**
     * 在视口中生成满屏幕的 iMessage 风格 win 气泡
     */
    private spawnWinBubbles(): void {
        const bubbleCount = 50; // 气泡总数，层层叠叠
        const fragment = document.createDocumentFragment();
        const activeWrappers: HTMLDivElement[] = [];

        for (let i = 0; i < bubbleCount; i++) {
            // 1. 创建外层容器（只控制定位与平移动画）
            const wrapper = document.createElement('div');
            wrapper.className = 'win-bubble-wrapper';

            // 2. 创建内层气泡（只控制气泡圆角、背景、文字及缩放淡出动画）
            const bubble = document.createElement('div');

            // 随机分配发送方/接收方的气泡样式尾巴
            const bubbleClass = Math.random() > 0.5 ? 'bubble-right' : 'bubble-left';
            bubble.className = `win-bubble ${bubbleClass}`;
            bubble.textContent = 'win';

            // 3. 随机基础尺寸 (32px 到 85px)
            const size = Math.floor(Math.random() * 53) + 32;
            bubble.style.width = `${size}px`;
            bubble.style.height = `${size * 0.72}px`; // 维持好看的长宽比
            bubble.style.fontSize = `${size * 0.32}px`; // 字体大小自适应

            // 4. 随机屏幕起始位置 (视口占比)
            const startX = Math.random() * 90 + 5; // 5vw - 95vw
            const startY = Math.random() * 80 + 10; // 10vh - 90vh
            wrapper.style.left = `${startX}vw`;
            wrapper.style.top = `${startY}vh`;

            // 5. 随机平移终点 (微漂移)
            const moveXEnd = (Math.random() - 0.5) * 90; // -45px 到 45px
            const moveYEnd = -Math.random() * 120 - 40;  // 持续向上飘动 (-160px 到 -40px)

            wrapper.style.setProperty('--tx-end', `${moveXEnd}px`);
            wrapper.style.setProperty('--ty-end', `${moveYEnd}px`);

            // 6. 随机动画延迟与持续时长
            const delay = Math.random() * 1.6; // 0s - 1.6s，形成错落有致的升起波浪
            const duration = Math.random() * 0.8 + 2.2; // 2.2s - 3.0s

            // 外层 wrapper 应用平移动画，使用缓出贝塞尔曲线提供无顿挫感平滑滑动
            wrapper.style.animation = `win-fly ${duration}s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s forwards`;

            // 内层 bubble 应用缩放和淡入淡出动画，使用经典的 cubic-bezier 缓动提供自然的回弹过程
            bubble.style.animation = `win-scale-fade ${duration}s cubic-bezier(0.25, 1, 0.5, 1) ${delay}s forwards`;

            wrapper.appendChild(bubble);
            fragment.appendChild(wrapper);
            activeWrappers.push(wrapper);
        }

        document.body.appendChild(fragment);

        // 动画整体完结后，彻底清除气泡 DOM
        setTimeout(() => {
            activeWrappers.forEach((w) => w.remove());
        }, 5500);
    }

    /**
     * 平滑恢复 Hero 模块原状
     */
    private restoreHero(): void {
        const wrapper = document.querySelector('uem-hero #hero-content-wrapper') as HTMLElement;
        const eggContainer = document.querySelector('uem-hero #hero-easter-egg-container') as HTMLElement;

        // 1. 标语渐隐
        if (eggContainer) {
            eggContainer.style.opacity = '0';
            eggContainer.style.transform = 'translateY(12px)';
        }

        // 2. 标语淡出完毕后恢复原 Hero 页面结构 (等待 1000ms 过渡)
        setTimeout(() => {
            if (eggContainer) {
                eggContainer.innerHTML = '';
            }

            if (wrapper) {
                wrapper.style.opacity = '1';
                wrapper.style.transform = 'translateY(0) scale(1)';
                wrapper.style.pointerEvents = 'auto';
            }

            // 解除活跃锁，允许下一次点击触发
            this._isActive = false;
        }, 1000);
    }
}

customElements.define('uem-easter-egg', UemEasterEgg);
