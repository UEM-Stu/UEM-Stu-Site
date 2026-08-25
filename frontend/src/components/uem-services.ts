/**
 * <uem-services> 校园服务组件
 *
 * 渲染"校园服务"区域，包含 <uem-service-card> 子组件
 */
import { PORTAL_ITEMS, FEEDBACK_LINKS } from '@/config/services';
import { openLightbox } from './uem-lightbox';

// 导入二维码图片资源
import qrcodeFeedback from '../../assets/survey-qrcode-feature-feedbck.png';
import qrcodeRequest from '../../assets/survey-qrcode-new-feature-request.png';

// 动态导入所有校历/作息表资源
const calendarImages = import.meta.glob('../../assets/university_calendar/*.{png,jpg,jpeg,webp}', { eager: true });

export class UemServices extends HTMLElement {
    connectedCallback(): void {
        this.render();
        this.initFeedbackDialog();
        this.initCalendarDialog();
    }

    private render(): void {
        const cardsHtml = PORTAL_ITEMS.map(
            (item) => `
      <uem-service-card
        icon="${item.icon}"
        title="${item.title}"
        description="${item.description}"
        href="${item.href}"
        soon="${'soon' in item && item.soon ? 'true' : 'false'}"
      ></uem-service-card>
    `
        ).join('');

        this.innerHTML = `
      <section class="py-20 px-margin-mobile md:px-margin-desktop relative" id="portals-container">
        <!-- 装饰性光晕背景（浅） -->
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl pointer-events-none"></div>

        <div class="max-w-container-max mx-auto relative z-10">
          <!-- 头部标题栏（对齐开源项目模块） -->
          <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <span class="text-xs md:text-sm font-bold tracking-wider text-primary/70 dark:text-primary-fixed-dim/70 uppercase mb-2 block font-mono">
                Campus Service
              </span>
              <h2 class="font-headline-lg text-3xl md:text-5xl font-extrabold text-on-surface tracking-tight leading-none mb-2 select-all">
                校园服务
              </h2>
            </div>
            
            <!-- 统计信息与外链操作 -->
            <div class="flex flex-col items-start md:items-end gap-3">
              <p class="text-xs md:text-sm text-on-surface-variant/80 leading-relaxed text-left md:text-right max-w-md">
                想要更多校园服务？请点击：
              </p>

              <a
                href="#"
                id="feedback-trigger"
                class="inline-flex items-center gap-1 text-sm font-semibold text-primary dark:text-primary-fixed hover:underline group/link cursor-pointer"
              >
                请求/反馈服务
                <span class="material-symbols-outlined text-[16px] group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform">
                  north_east
                </span>
              </a>
            </div>
          </div>

          <!-- 卡片网格（移动端展示为 2 列） -->
          <div class="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            ${cardsHtml}
          </div>
        </div>
      </section>

      <!-- 反馈与需求弹窗 -->
      <uem-float
        id="feedback-dialog"
        max-width="max-w-3xl"
        subtitle="Feedback & Request"
        title="请求与反馈服务"
      >
        <!-- 二维码网格布局 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 justify-items-center">
          <!-- 新功能请求 -->
          <a
            href="${FEEDBACK_LINKS.newFeatureRequest}"
            target="_blank"
            class="flex flex-col items-center group cursor-pointer w-full max-w-[280px] md:max-w-[320px] transition-transform duration-300"
          >
            <div class="overflow-hidden rounded-2xl shadow-md border border-outline-variant/10 group-hover:shadow-lg group-hover:border-primary/20 transition-all duration-300 bg-white">
              <img
                src="${qrcodeRequest}"
                alt="新功能请求"
                class="w-full h-auto object-contain transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </div>
            <p class="text-xs text-on-surface-variant/80 mt-3 flex items-center gap-1 text-center group-hover:text-primary transition-colors">
              <span class="material-symbols-outlined text-[14px]">open_in_new</span>
              点击或扫码提交新服务请求
            </p>
          </a>

          <!-- 功能反馈 -->
          <a
            href="${FEEDBACK_LINKS.featureFeedback}"
            target="_blank"
            class="flex flex-col items-center group cursor-pointer w-full max-w-[280px] md:max-w-[320px] transition-transform duration-300"
          >
            <div class="overflow-hidden rounded-2xl shadow-md border border-outline-variant/10 group-hover:shadow-lg group-hover:border-primary/20 transition-all duration-300 bg-white">
              <img
                src="${qrcodeFeedback}"
                alt="功能反馈"
                class="w-full h-auto object-contain transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </div>
            <p class="text-xs text-on-surface-variant/80 mt-3 flex items-center gap-1 text-center group-hover:text-primary transition-colors">
              <span class="material-symbols-outlined text-[14px]">open_in_new</span>
              点击或扫码提交功能反馈
            </p>
          </a>
        </div>
      </uem-float>

      <!-- 校历与作息表弹窗 -->
      <uem-float
        id="calendar-dialog"
        max-width="max-w-4xl"
        subtitle="University Calendar & Schedule"
        title="大学校历与作息表"
      >
        <!-- 控制器区域 (学年与类型切换) -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 w-full mb-6">
          <!-- 学年选择 (Chevron Selector) -->
          <div class="flex items-center gap-3 bg-[#e8eaed] dark:bg-[#25282a] px-3 py-1.5 rounded-full border border-outline/10 select-none w-full sm:w-auto justify-between sm:justify-start">
            <!-- Prev Tooltip Wrapper -->
            <div class="relative group/tooltip">
              <button
                id="btn-year-prev"
                class="flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200 cursor-pointer shadow-sm focus:outline-none text-on-surface"
                aria-label="前一年"
              >
                <span class="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <div id="tooltip-prev" class="hidden absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-neutral-900/90 text-white text-[10px] rounded shadow-lg pointer-events-none whitespace-nowrap z-50 opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200">
                没有更老的数据了
              </div>
            </div>
            
            <span id="calendar-year-label" class="text-xs font-bold text-on-surface min-w-[100px] text-center tracking-tight">学年加载中...</span>
            
            <!-- Next Tooltip Wrapper -->
            <div class="relative group/tooltip">
              <button
                id="btn-year-next"
                class="flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200 cursor-pointer shadow-sm focus:outline-none text-on-surface"
                aria-label="后一年"
              >
                <span class="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
              <div id="tooltip-next" class="hidden absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-neutral-900/90 text-white text-[10px] rounded shadow-lg pointer-events-none whitespace-nowrap z-50 opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200">
                没有更新的数据了
              </div>
            </div>
          </div>

          <!-- 类型选择 (Segmented Control) -->
          <div class="flex rounded-full bg-[#e8eaed] dark:bg-[#25282a] p-1 border border-outline/10 select-none w-full sm:w-auto">
            <button
              data-type="calendar"
              class="type-toggle-btn flex-1 sm:flex-initial px-5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer text-on-surface-variant/80 hover:text-on-surface"
            >
              大学校历
            </button>
            <button
              data-type="schedule"
              class="type-toggle-btn flex-1 sm:flex-initial px-5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer text-on-surface-variant/80 hover:text-on-surface"
            >
              作息时间表
            </button>
          </div>
        </div>

        <!-- 校历图片展示区 -->
        <div class="w-full overflow-y-auto max-h-[65vh] rounded-xl border border-outline-variant/10 bg-white flex justify-center p-2 mb-6 shadow-inner">
          <img
            id="calendar-img"
            src=""
            alt="学校校历"
            class="max-w-full h-auto object-contain rounded-lg transition-opacity duration-200 opacity-0 cursor-zoom-in"
          />
        </div>

        <!-- 下载/保存按钮及提示 -->
        <div class="flex flex-col items-center gap-3 w-full">
          <button
            id="calendar-download-btn"
            class="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-on-primary hover:bg-primary-container dark:bg-primary-fixed dark:text-on-primary hover:shadow-lg transition-all duration-200 cursor-pointer text-sm font-bold shadow-md focus:outline-none"
          >
            <span class="material-symbols-outlined text-[18px]">download</span>
            保存图片
          </button>
        </div>
      </uem-float>
    `;
    }

    private initFeedbackDialog(): void {
        const trigger = this.querySelector('#feedback-trigger');
        const dialog = this.querySelector('#feedback-dialog') as any;

        if (!trigger || !dialog) return;

        // 打开弹窗
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            dialog.showModal();
        });
    }

    private initCalendarDialog(): void {
        const dialog = this.querySelector('#calendar-dialog') as any;
        const downloadBtn = this.querySelector('#calendar-download-btn');
        const imgElement = this.querySelector('#calendar-img') as HTMLImageElement | null;
        const yearLabel = this.querySelector('#calendar-year-label');
        const prevYearBtn = this.querySelector('#btn-year-prev');
        const nextYearBtn = this.querySelector('#btn-year-next');
        const tooltipPrev = this.querySelector('#tooltip-prev');
        const tooltipNext = this.querySelector('#tooltip-next');

        if (!dialog) return;

        // 点击校历/作息表图片放大查看（支持双指捏合缩放）
        imgElement?.addEventListener('click', () => {
            if (imgElement.src) openLightbox(imgElement.src, imgElement.alt);
        });

        // 动态解析图片与文件名映射关系
        const IMAGE_MAP: Record<string, Record<string, { src: string; filename: string; label: string }>> = {};

        for (const path in calendarImages) {
            const filename = path.split('/').pop() || '';
            const match = filename.match(/^(\d{4}-\d{4})-(calendar|schedule)\.(png|jpg|jpeg|webp)$/i);
            if (match) {
                const year = match[1];
                const type = match[2].toLowerCase();
                const extension = match[3];
                const src = (calendarImages[path] as { default: string }).default;

                if (!IMAGE_MAP[year]) {
                    IMAGE_MAP[year] = {};
                }

                const typeLabel = type === 'calendar' ? '校历' : '作息时间表';
                IMAGE_MAP[year][type] = {
                    src,
                    filename: `UEM-NCIST-${year}-${type.charAt(0).toUpperCase() + type.slice(1)}.${extension}`,
                    label: `${year} 学年 ${typeLabel}`
                };
            }
        }

        const availableYears = Object.keys(IMAGE_MAP).sort((a, b) => b.localeCompare(a));
        
        let currentYearIndex = 0;
        let currentType = 'calendar';

        // 更新图片与按钮状态的函数
        const updateDisplay = (immediate = false) => {
            if (availableYears.length === 0) {
                if (yearLabel) yearLabel.textContent = '暂无数据';
                return;
            }

            const year = availableYears[currentYearIndex];
            if (yearLabel) yearLabel.textContent = `${year} 学年`;

            const types = IMAGE_MAP[year];
            if (!types) return;

            // 检查当前选定类型是否存在，若不存在则降级
            let activeType = currentType;
            if (!types[activeType]) {
                const firstAvailable = Object.keys(types)[0];
                if (firstAvailable) {
                    activeType = firstAvailable;
                }
            }

            const data = types[activeType];
            if (!data || !imgElement) return;

            // 更新类别按钮状态 (高亮和置灰)
            const typeBtns = this.querySelectorAll('.type-toggle-btn');
            typeBtns.forEach((btn) => {
                const btnType = btn.getAttribute('data-type') || '';
                const isAvailable = !!types[btnType];

                // 移除所有激活状态
                btn.classList.remove('bg-white', 'dark:bg-[#323639]', 'text-primary', 'dark:text-primary-fixed-dim', 'shadow-sm');
                btn.classList.add('text-on-surface-variant/80', 'hover:text-on-surface');

                if (isAvailable) {
                    btn.removeAttribute('disabled');
                    btn.classList.remove('opacity-40', 'cursor-not-allowed');
                    if (btnType === activeType) {
                        btn.classList.remove('text-on-surface-variant/80', 'hover:text-on-surface');
                        btn.classList.add('bg-white', 'dark:bg-[#323639]', 'text-primary', 'dark:text-primary-fixed-dim', 'shadow-sm');
                    }
                } else {
                    btn.setAttribute('disabled', 'true');
                    btn.classList.add('opacity-40', 'cursor-not-allowed');
                }
            });

            // 更新学年切换按钮状态和 Tooltip
            const isPrevDisabled = currentYearIndex === availableYears.length - 1;
            const isNextDisabled = currentYearIndex === 0;

            if (prevYearBtn) {
                if (isPrevDisabled) {
                    prevYearBtn.setAttribute('disabled', 'true');
                    prevYearBtn.classList.add('opacity-30', 'cursor-not-allowed');
                    prevYearBtn.classList.remove('hover:bg-surface-container-high', 'bg-white', 'dark:bg-[#323639]', 'shadow-sm');
                    prevYearBtn.classList.add('bg-transparent');
                    if (tooltipPrev) tooltipPrev.classList.remove('hidden');
                } else {
                    prevYearBtn.removeAttribute('disabled');
                    prevYearBtn.classList.remove('opacity-30', 'cursor-not-allowed', 'bg-transparent');
                    prevYearBtn.classList.add('hover:bg-surface-container-high', 'bg-white', 'dark:bg-[#323639]', 'shadow-sm');
                    if (tooltipPrev) tooltipPrev.classList.add('hidden');
                }
            }

            if (nextYearBtn) {
                if (isNextDisabled) {
                    nextYearBtn.setAttribute('disabled', 'true');
                    nextYearBtn.classList.add('opacity-30', 'cursor-not-allowed');
                    nextYearBtn.classList.remove('hover:bg-surface-container-high', 'bg-white', 'dark:bg-[#323639]', 'shadow-sm');
                    nextYearBtn.classList.add('bg-transparent');
                    if (tooltipNext) tooltipNext.classList.remove('hidden');
                } else {
                    nextYearBtn.removeAttribute('disabled');
                    nextYearBtn.classList.remove('opacity-30', 'cursor-not-allowed', 'bg-transparent');
                    nextYearBtn.classList.add('hover:bg-surface-container-high', 'bg-white', 'dark:bg-[#323639]', 'shadow-sm');
                    if (tooltipNext) tooltipNext.classList.add('hidden');
                }
            }

            // 执行淡入淡出动画
            if (immediate) {
                imgElement.src = data.src;
                imgElement.alt = data.label;
                imgElement.classList.remove('opacity-0');
                dialog.titleText = data.label;
            } else {
                imgElement.style.opacity = '0.3';
                setTimeout(() => {
                    imgElement.src = data.src;
                    imgElement.alt = data.label;
                    dialog.titleText = data.label;
                    imgElement.style.opacity = '1';
                }, 100);
            }
        };

        // 监听卡片点击
        this.addEventListener('click', (e) => {
            const cardLink = (e.target as HTMLElement).closest('a');
            if (cardLink && cardLink.getAttribute('href') === '#calendar') {
                e.preventDefault();
                dialog.showModal();
                updateDisplay(true); // 打开时立即渲染首屏
            }
        });

        // 绑定学年上一页（年份变老，Index 增加）点击事件
        if (prevYearBtn) {
            prevYearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (currentYearIndex < availableYears.length - 1) {
                    currentYearIndex++;
                    updateDisplay();
                }
            });
        }

        // 绑定学年下一页（年份变新，Index 减少）点击事件
        if (nextYearBtn) {
            nextYearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (currentYearIndex > 0) {
                    currentYearIndex--;
                    updateDisplay();
                }
            });
        }

        // 绑定内容类型切换事件
        const typeBtns = this.querySelectorAll('.type-toggle-btn');
        typeBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const clickedBtn = e.currentTarget as HTMLButtonElement;
                const type = clickedBtn.getAttribute('data-type');
                if (type && type !== currentType) {
                    currentType = type;
                    updateDisplay();
                }
            });
        });

        // 下载当前显示的图片
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (availableYears.length === 0) return;
                const year = availableYears[currentYearIndex];
                const types = IMAGE_MAP[year];
                if (!types) return;

                // 重新检查降级逻辑以确保下载正确的文件
                let activeType = currentType;
                if (!types[activeType]) {
                    const firstAvailable = Object.keys(types)[0];
                    if (firstAvailable) {
                        activeType = firstAvailable;
                    }
                }

                const data = types[activeType];
                if (!data) return;

                const link = document.createElement('a');
                link.href = data.src;
                link.download = data.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }
    }
}

customElements.define('uem-services', UemServices);

/**
 * <uem-service-card> 校园服务卡片组件
 *
 * 属性：
 *  - icon: Material Symbols 图标名
 *  - title: 卡片标题
 *  - href: 链接地址
 */
export class UemServiceCard extends HTMLElement {
  /** 监听的属性列表 */
  static get observedAttributes(): string[] {
    return ['icon', 'title', 'description', 'href', 'soon'];
  }

  private handleClick = (e: MouseEvent): void => {
    if (this.getAttribute('soon') === 'true') {
      e.preventDefault();
    }
  };

  connectedCallback(): void {
    this.style.display = 'block';
    this.render();
    this.addEventListener('click', this.handleClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.handleClick);
  }

  attributeChangedCallback(): void {
    if (this.isConnected) {
      this.render();
    }
  }

  private render(): void {
    const icon = this.getAttribute('icon') || 'help';
    const title = this.getAttribute('title') || '';
    const description = this.getAttribute('description') || '';
    const href = this.getAttribute('href') || '#';
    const soon = this.getAttribute('soon') === 'true';

    // 静态简易禁用样式
    const cardClass = soon
      ? 'group flex flex-col items-center justify-center text-center gap-2 md:gap-4 h-full bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4 md:p-8 shadow-sm relative overflow-hidden cursor-not-allowed select-none opacity-60'
      : 'group flex flex-col items-center justify-center text-center gap-2 md:gap-4 h-full bg-surface-container-lowest border border-outline-variant rounded-xl p-4 md:p-8 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 relative overflow-hidden';

    const hoverOverlay = soon
      ? ''
      : `<div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>`;

    const iconContainerClass = soon
      ? 'w-12 h-12 md:w-16 md:h-16 rounded-full bg-secondary-container/60 text-secondary/70 flex items-center justify-center relative z-10'
      : 'w-12 h-12 md:w-16 md:h-16 rounded-full bg-secondary-container text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary group-hover:scale-110 transition-all duration-300 relative z-10';

    const titleClass = soon
      ? 'font-headline-md font-bold text-base md:text-headline-md text-on-surface/70 relative z-10'
      : 'font-headline-md font-bold text-base md:text-headline-md text-on-surface relative z-10 group-hover:text-primary transition-colors duration-300';

    const descClass = soon
      ? 'text-xs md:text-sm text-on-surface-variant/60 relative z-10 line-clamp-2 max-w-[240px] leading-relaxed'
      : 'text-xs md:text-sm text-on-surface-variant/80 relative z-10 line-clamp-2 max-w-[240px] leading-relaxed';

    const badgeHtml = soon
      ? `
        <div class="absolute top-1.5 right-1.5 md:top-3 md:right-3 bg-secondary-container text-on-secondary-container text-[8px] md:text-[10px] font-semibold px-1.5 py-0.5 md:px-2 md:py-0.5 rounded-full select-none border border-outline-variant/40 z-20">
          即将推出
        </div>
      `
      : '';

    this.innerHTML = `
      <a
        class="${cardClass}"
        href="${soon ? '#' : href}"
      >
        <!-- 悬浮渐变遮罩 -->
        ${hoverOverlay}

        <!-- 静态即将推出 Badge -->
        ${badgeHtml}

        <!-- 图标容器 -->
        <div class="${iconContainerClass}">
          <span class="material-symbols-outlined text-xl md:text-3xl">${icon}</span>
        </div>

        <!-- 标题 -->
        <h3 class="${titleClass}">${title}</h3>

        <!-- 一句话介绍 -->
        ${description ? `
          <p class="${descClass}">
            ${description}
          </p>
        ` : ''}
      </a>
    `;
  }
}

customElements.define('uem-service-card', UemServiceCard);
