/**
 * <uem-projects> 优秀开源项目展示组件
 *
 * 渲染“优秀开源项目展览”，从项目候选池中随机挑选并展示 4 个开源项目。
 * 支持点击“随机换一批”按钮来实时重新挑选并渲染，提供流畅的淡入淡出及图标旋转动效。
 */
import { PROJECT_ITEMS, ProjectItem } from '@/config/projects';
import { GITHUB_SVG_PATH } from '@/config/theme';


export class UemProjects extends HTMLElement {
  /** 当前正在展示的 4 个项目数据 */
  private _displayedProjects: ProjectItem[] = [];

  connectedCallback(): void {
    this.shuffleProjects();
    this.render();
    this.loadCommitStats();
    this.setupEventListeners();
  }

  /**
   * 使用 Fisher-Yates 算法随机打乱候选项目，并截取前 4 个
   */
  private shuffleProjects(): void {
    const items = [...PROJECT_ITEMS];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    this._displayedProjects = items.slice(0, 4);
  }

  /**
   * 获取特定开发语言的颜色，如果未定义则使用项目默认颜色
   */
  private getLanguageColor(lang: string, defaultColor: string): string {
    const colors: Record<string, string> = {
      'TypeScript': '#3178c6',
      'JavaScript': '#f1e05a',
      'HTML': '#e34c26',
      'CSS': '#563d7c',
      'C#': '#178600',
      'C++': '#f34b7d',
      'C': '#555555',
      'Python': '#3572A5',
      'Markdown': '#083fa6',
    };
    return colors[lang] || defaultColor;
  }

  /**
   * 生成单个项目卡片的 HTML 字符串
   */
  private generateCardHtml(project: ProjectItem): string {
    const languagesHtml = project.languages
      .map(
        (lang) => `
        <div class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded-full" style="background-color: ${this.getLanguageColor(lang, project.color)}"></span>
          <span>${lang}</span>
        </div>
      `
      )
      .join('');

    return `
      <a
        href="${project.href}"
        target="_blank"
        class="block border border-outline-variant/20 rounded-2xl p-6 bg-surface-container-lowest hover:border-primary/30 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[170px] relative group cursor-pointer"
      >
        <div>
          <!-- 头部：GitHub 图标与项目名 -->
          <div class="flex items-center justify-between gap-4 mb-3 min-w-0">
            <div class="flex items-center gap-2 text-on-surface-variant min-w-0">
              <svg class="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
                <path d="${GITHUB_SVG_PATH}"/>
              </svg>
              <span class="font-mono text-sm tracking-tight text-on-surface-variant/80 flex-shrink-0">uem-stu /</span>
              <span class="font-mono font-bold text-primary group-hover:underline truncate" title="${project.name}">${project.name}</span>
            </div>
            
            <!-- 斜箭头外链图标 -->
            <span class="material-symbols-outlined text-[18px] text-on-surface-variant/40 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 flex-shrink-0">
              north_east
            </span>
          </div>
          
          <!-- 项目介绍 -->
          <p class="text-on-surface-variant text-sm leading-relaxed mb-4 line-clamp-2">
            ${project.description}
          </p>
        </div>

        <!-- 底部栏：开发语言 -->
        <div class="flex items-center gap-4 pt-3 border-t border-outline-variant/10 text-xs text-on-surface-variant/70 font-mono flex-wrap">
          ${languagesHtml}
        </div>
      </a>
    `;
  }

  /**
   * 渲染组件的主体 HTML
   */
  private render(): void {
    const cardsHtml = this._displayedProjects
      .map((project) => this.generateCardHtml(project))
      .join('');

    this.innerHTML = `
      <section class="py-20 px-margin-mobile md:px-margin-desktop relative" id="projects-container">
        <div class="max-w-container-max mx-auto">
          <!-- 头部标题栏 -->
          <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <div class="flex items-center gap-3 mb-2 flex-wrap select-none">
                <span class="text-xs md:text-sm font-bold tracking-wider text-primary/70 dark:text-primary-fixed-dim/70 uppercase font-mono">
                  Open Source
                </span>
                <button 
                  id="view-heatmap-btn" 
                  class="inline-flex items-center gap-1.5 text-[10px] md:text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold transition-all cursor-pointer select-none border border-emerald-500/20 active:scale-95"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  组织活跃热力图
                </button>
              </div>
              <h2 class="font-mono text-3xl md:text-5xl font-extrabold text-on-surface tracking-tight leading-none mb-2 select-all">
                <a href="https://github.com/uem-stu" target="_blank" class="inline-flex items-center gap-2 text-on-surface hover:text-primary dark:hover:text-primary-fixed-dim transition-colors duration-300 group/gh">
                  github.com/uem-stu
                  <span class="material-symbols-outlined text-[0.6em] opacity-0 -translate-x-1 group-hover/gh:opacity-100 group-hover/gh:translate-x-0 transition-all duration-300">north_east</span>
                </a>
              </h2>
            </div>
            
            <!-- 组织数据统计信息与外链 -->
            <div class="flex flex-col items-start md:items-end">
              <p class="text-xs md:text-sm text-on-surface-variant/80 leading-relaxed text-left md:text-right max-w-md">
                所有项目代码<strong class="text-on-surface font-bold">完全开源</strong>，欢迎 Fork、Issue 与 PR<span id="commit-stats-span" style="display: none;"></span>
              </p>
            </div>
          </div>

          <!-- 4 个卡片的网格容器 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity duration-300" id="project-cards-container">
            ${cardsHtml}
          </div>

          <!-- 底部控制按钮 -->
          <div class="flex justify-center items-center gap-4 mt-12">
            <button
              id="projects-shuffle-btn"
              class="flex items-center gap-2 border border-primary/20 hover:border-primary/50 text-primary dark:text-primary-fixed hover:bg-primary/5 font-label-md text-label-md px-6 py-3 rounded-xl transition-all duration-300 transform active:scale-95 shadow-sm hover:shadow"
            >
              <span class="material-symbols-outlined text-[20px] transition-transform duration-500" id="shuffle-icon">sync</span>
              随机换一批
            </button>
            <a
              href="https://github.com/UEM-Stu"
              target="_blank"
              class="flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-md text-label-md px-6 py-3 rounded-xl transition-all duration-300 transform active:scale-95 shadow-sm hover:shadow-md cursor-pointer"
            >
              查看全部项目
              <span class="material-symbols-outlined text-[18px]">north_east</span>
            </a>
          </div>

          <!-- 组织整体活跃热力图弹窗组件挂载 -->
          <uem-contribution-heatmap></uem-contribution-heatmap>
        </div>
      </section>
    `;
  }

  /**
   * 异步加载并解析来自 CDN 的提交行数统计，只展示最近七天的数据
   */
  private async loadCommitStats(): Promise<void> {
    try {
      const response = await fetch('https://cdn.jsdelivr.net/gh/UEM-Stu/UEM-Stu-Site@stats-data/stats.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        return;
      }

      // 获取当前北京时间 (UTC+8) 的 YYYY-MM-DD
      const bjOffset = 8 * 60 * 60 * 1000;
      const now = new Date();
      const nowBjMillis = now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + bjOffset;
      
      const past7Days: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const d = new Date(nowBjMillis - i * 24 * 60 * 60 * 1000);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        past7Days.push(`${year}-${month}-${day}`);
      }

      // 过滤并计算最近 7 天的 additions 和 deletions 之和
      const last7DaysData = data.filter((item: any) => item && past7Days.includes(item.date));
      const totalAdditions = last7DaysData.reduce((sum: number, item: any) => sum + (item.total_additions || 0), 0);
      const totalDeletions = last7DaysData.reduce((sum: number, item: any) => sum + (item.total_deletions || 0), 0);

      // 如果新增代码数大于 0 则显示
      if (totalAdditions > 0) {
        const statsSpan = this.querySelector<HTMLSpanElement>('#commit-stats-span');
        if (statsSpan) {
          // 格式化数据
          const formattedAdditions = totalAdditions.toLocaleString();
          const formattedDeletions = totalDeletions.toLocaleString();
          
          // 获取起止日期 (使用物理统计区间：昨天向前推七天)
          const dateRangeStr = `${past7Days[past7Days.length - 1]} 至 ${past7Days[0]}`;

          statsSpan.innerHTML = `
            · 近一周新增代码 <span class="text-emerald-500 font-semibold font-mono">+${formattedAdditions}</span> 行
            <uem-tooltip style="vertical-align: -0.125em;">
              <span class="material-symbols-outlined select-none align-middle cursor-help text-[15px] text-on-surface-variant/50 hover:text-primary transition-colors duration-200 ml-0.5 relative top-[1px]">help</span>
              <div slot="content" class="min-w-[240px] select-none">
                <span class="block font-bold text-on-surface mb-2 text-xs">代码变更统计</span>
                <span class="block text-on-surface-variant/80 mb-1 text-[11px]">
                  统计区间：<span class="font-mono text-on-surface font-semibold">${dateRangeStr}</span>
                </span>
                <span class="flex items-center gap-4 text-on-surface-variant/80 mb-2.5 text-[11px]">
                  <span>新增：<strong class="text-emerald-500 font-mono font-semibold">+${formattedAdditions}</strong></span>
                  <span>删除：<strong class="text-error font-mono font-semibold">-${formattedDeletions}</strong></span>
                </span>
                <span class="block pt-2 border-t border-outline-variant/20">
                  <a href="/article?slug=code_change_stats_howto" class="text-primary hover:underline flex items-center gap-0.5 font-semibold text-[11px] cursor-pointer">
                    本功能是如何实现的？
                    <span class="material-symbols-outlined text-[10px]">north_east</span>
                  </a>
                </span>
              </div>
            </uem-tooltip>
          `;
          statsSpan.style.display = 'inline';
        }
      }
    } catch (error) {
      console.error('加载项目代码提交统计数据失败:', error);
    }
  }

  /**
   * 绑定随机换一批按钮的事件监听器
   */
  private setupEventListeners(): void {
    const shuffleBtn = this.querySelector<HTMLButtonElement>('#projects-shuffle-btn');
    const container = this.querySelector<HTMLDivElement>('#project-cards-container');
    const icon = this.querySelector<HTMLSpanElement>('#shuffle-icon');

    shuffleBtn?.addEventListener('click', () => {
      // 1. 图标旋转动效
      if (icon) {
        icon.classList.add('rotate-180');
        setTimeout(() => icon.classList.remove('rotate-180'), 500);
      }

      // 2. 卡片渐隐动效
      if (container) {
        container.style.opacity = '0';
      }

      // 3. 洗牌并局部重新渲染卡片，然后渐显
      setTimeout(() => {
        this.shuffleProjects();
        const cardsHtml = this._displayedProjects
          .map((project) => this.generateCardHtml(project))
          .join('');

        if (container) {
          container.innerHTML = cardsHtml;
          container.style.opacity = '1';
        }
      }, 300);
    });

    // 绑定打开热力图弹窗事件
    const viewBtn = this.querySelector('#view-heatmap-btn');
    viewBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const heatmap = this.querySelector<any>('uem-contribution-heatmap');
      if (heatmap) {
        heatmap.open();
      }
    });
  }
}

customElements.define('uem-projects', UemProjects);
