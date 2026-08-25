/**
 * <uem-blog> 技术博客展示组件
 *
 * 渲染“技术博客”区域，支持搜索、分类过滤以及平滑淡入淡出的分页。
 * 设计语言与 <uem-projects>、<uem-labs> 保持统一：
 *   - 相同的 section padding
 *   - 统一的标题栏布局（英文 subtitle + 中文 h2）
 *   - 相同的 hover 交互与微动效
 *   - 使用 Tailwind 配合自定义 CSS 样式渲染
 */
import { BLOG_POSTS, BlogPost } from '@/config/blog';

export class UemBlog extends HTMLElement {
    /** 当前选中的分类 */
    private _currentCategory: string = '全部';
    /** 搜索关键词 */
    private _searchQuery: string = '';
    /** 当前页码 */
    private _currentPage: number = 1;
    /** 每页展示的文章数量 */
    private readonly _postsPerPage: number = 4;

    /** 分类候选列表 */
    private readonly _categories = ['全部', '后端开发', '前端架构', 'AI/ML', '应急科技', '开源治理'];

    /** 搜索输入框事件处理器引用 */
    private _searchHandler: (() => void) | null = null;
    private _searchInput: HTMLInputElement | null = null;

    connectedCallback(): void {
        this.render();
        this.setupEventListeners();
    }

    disconnectedCallback(): void {
        if (this._searchHandler && this._searchInput) {
            this._searchInput.removeEventListener('input', this._searchHandler);
        }
    }

    /**
     * 获取过滤后的文章列表
     */
    private getFilteredPosts(): BlogPost[] {
        return BLOG_POSTS.filter(post => {
            // 1. 分类过滤
            const matchesCategory = this._currentCategory === '全部' || post.category === this._currentCategory;
            // 2. 检索词过滤（忽略大小写，匹配标题与摘要）
            const query = this._searchQuery.trim().toLowerCase();
            const matchesSearch = !query ||
                post.title.toLowerCase().includes(query) ||
                post.excerpt.toLowerCase().includes(query);
            return matchesCategory && matchesSearch;
        });
    }

    /**
     * 生成单个博客文章卡片的 HTML
     */
    private generatePostHtml(post: BlogPost): string {
        return `
      <a 
        href="${post.href}" 
        class="block group border-b border-outline-variant/15 py-8 transition-all duration-300"
      >
        <!-- 卡片头部：分类标签与英文标签，以及右侧细长箭头 -->
        <div class="flex items-center justify-between mb-3.5">
          <div class="flex items-center gap-3">
            <span class="inline-block text-xs font-semibold px-2.5 py-0.5 rounded bg-primary/5 text-primary border border-primary/10 dark:bg-primary-fixed-dim/10 dark:text-primary-fixed-dim dark:border-primary-fixed-dim/20 transition-all duration-300">
              ${post.category}
            </span>
            <span class="text-xs text-on-surface-variant/60 dark:text-surface-variant/60 font-mono font-medium">${post.subCategory}</span>
          </div>
          
          <!-- 向右的小箭头，悬停时向右侧偏移 -->
          <span class="material-symbols-outlined text-[20px] text-on-surface-variant/40 group-hover:text-primary dark:group-hover:text-primary-fixed-dim group-hover:translate-x-1.5 transition-all duration-300 shrink-0">
            arrow_forward
          </span>
        </div>

        <!-- 标题 -->
        <h3 class="text-xl md:text-2xl font-extrabold text-on-surface group-hover:text-primary dark:group-hover:text-primary-fixed-dim transition-colors duration-300 mb-3 leading-snug tracking-tight">
          ${post.title}
        </h3>

        <!-- 文章简介 -->
        <p class="text-on-surface-variant/80 dark:text-surface-variant/80 text-sm md:text-base leading-relaxed mb-4 line-clamp-2">
          ${post.excerpt}
        </p>

        <!-- 底部元数据栏 -->
        <div class="flex items-center gap-6 text-xs md:text-sm text-on-surface-variant/60 dark:text-surface-variant/60 font-mono">
          <!-- 作者 -->
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-full bg-primary/10 text-primary dark:bg-primary-fixed-dim/10 dark:text-primary-fixed-dim flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
              ${post.authorAvatar}
            </div>
            <span class="font-medium">${post.author}</span>
          </div>
          
          <!-- 发表日期 -->
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px] shrink-0">calendar_today</span>
            <span>${post.date}</span>
          </div>

          <!-- 阅读耗时 -->
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px] shrink-0">schedule</span>
            <span>${post.readTime}</span>
          </div>
        </div>
      </a>
    `;
    }

    /**
     * 动态生成分类过滤标签按钮
     */
    private generateTabsHtml(): string {
        return this._categories.map(cat => {
            const isActive = cat === this._currentCategory;
            return `
        <button
          data-category="${cat}"
          role="tab"
          aria-selected="${isActive}"
          class="category-tab px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${isActive
                    ? 'bg-primary text-on-primary shadow-sm dark:bg-primary-fixed dark:text-on-primary-fixed'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant dark:text-surface-variant dark:bg-surface-container/30 dark:hover:bg-surface-container/50'
                }"
        >
          ${cat}
        </button>
      `;
        }).join('');
    }

    /**
     * 生成分页控制按钮
     */
    private generatePaginationHtml(totalPages: number): string {
        if (totalPages <= 1) return '';

        let pagesHtml = '';

        // 上一页按钮
        const prevDisabled = this._currentPage === 1;
        pagesHtml += `
      <button
        id="blog-prev-btn"
        class="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant/20 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100"
        ${prevDisabled ? 'disabled' : ''}
        aria-label="上一页"
      >
        <span class="material-symbols-outlined text-[18px]">chevron_left</span>
      </button>
    `;

        // 页码按钮（展示简单分页逻辑，比如 1 2 3 ... N，为了简便和美观，我们计算所有页码）
        for (let i = 1; i <= totalPages; i++) {
            const isCurrent = i === this._currentPage;
            pagesHtml += `
        <button
          data-page="${i}"
          class="page-num-btn w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 ${isCurrent
                    ? 'bg-primary text-on-primary shadow-md dark:bg-primary-fixed dark:text-on-primary-fixed'
                    : 'border border-outline-variant/20 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'
                }"
        >
          ${i}
        </button>
      `;
        }

        // 下一页按钮
        const nextDisabled = this._currentPage === totalPages;
        pagesHtml += `
      <button
        id="blog-next-btn"
        class="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant/20 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100"
        ${nextDisabled ? 'disabled' : ''}
        aria-label="下一页"
      >
        <span class="material-symbols-outlined text-[18px]">chevron_right</span>
      </button>
    `;

        return `
      <div class="flex items-center justify-center gap-2 mt-12">
        ${pagesHtml}
      </div>
    `;
    }

    /**
     * 渲染组件核心 DOM
     */
    private render(): void {
        const filtered = this.getFilteredPosts();
        const totalPages = Math.ceil(filtered.length / this._postsPerPage);

        // 如果过滤后页码越界，重置为第一页
        if (this._currentPage > totalPages && totalPages > 0) {
            this._currentPage = 1;
        }

        // 截取当前页要展示的文章
        const startIndex = (this._currentPage - 1) * this._postsPerPage;
        const paginatedPosts = filtered.slice(startIndex, startIndex + this._postsPerPage);

        // 生成文章列表 HTML
        let postsListHtml = '';
        if (paginatedPosts.length > 0) {
            postsListHtml = paginatedPosts.map(post => this.generatePostHtml(post)).join('');
        } else {
            postsListHtml = `
        <div class="flex flex-col items-center justify-center py-20 text-center text-on-surface-variant/50 dark:text-surface-variant/50">
          <span class="material-symbols-outlined text-[48px] mb-4">search_off</span>
          <p class="text-base font-semibold">没有找到相关的技术博客文章</p>
          <p class="text-xs mt-1 text-on-surface-variant/40 dark:text-surface-variant/40">尝试更换搜索词或选择其他分类标签</p>
        </div>
      `;
        }

        this.innerHTML = `
      <style>
        /* 页面切换的过渡淡入淡出动画 */
        .blog-list-container {
          transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
      </style>

      <section class="py-20 px-margin-mobile md:px-margin-desktop relative" id="blog-container">
        <div class="max-w-container-max mx-auto">
          
          <!-- 头部标题栏 -->
          <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <span class="text-xs md:text-sm font-bold tracking-wider text-primary/70 dark:text-primary-fixed-dim/70 uppercase mb-2 block font-mono">
                Research Blog
              </span>
              <h2 class="font-headline-lg text-3xl md:text-5xl font-extrabold text-on-surface tracking-tight leading-none mb-2">
                技术博客
              </h2>
            </div>
            
            <div class="flex flex-col items-start md:items-end">
              <p class="text-xs md:text-sm text-on-surface-variant/80 dark:text-surface-variant/80 leading-relaxed text-left md:text-right max-w-md">
                记录 UEM-Stu 的技术沉淀与研究心得，分享来自校园开源社区的第一手实战案例。
              </p>
            </div>
          </div>

          <!-- 工具栏：分类标签与搜索框 -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <!-- 分类标签按钮 -->
            <div class="flex items-center gap-2 flex-wrap overflow-x-auto pb-1 md:pb-0 scrollbar-none" id="blog-category-tabs" role="tablist" aria-label="文章分类">
              ${this.generateTabsHtml()}
            </div>
            
            <!-- 搜索框 -->
            <div class="relative w-full md:w-80 shrink-0">
              <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 dark:text-surface-variant/50 text-[20px]">
                search
              </span>
              <input
                type="text"
                id="blog-search-input"
                placeholder="在博客中搜索..."
                aria-label="搜索博客文章"
                value="${this._searchQuery}"
                class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low dark:bg-surface-container/20 focus:bg-surface-container-lowest dark:focus:bg-surface-container-lowest/10 focus:border-primary dark:focus:border-primary-fixed-dim outline-none text-sm text-on-surface transition-all duration-300 placeholder:text-on-surface-variant/40 dark:placeholder:text-surface-variant/40"
              />
            </div>
          </div>

          <!-- 文章列表容器 -->
          <div class="blog-list-container" id="blog-posts-list">
            ${postsListHtml}
          </div>

          <!-- 分页器 -->
          <div id="blog-pagination-container">
            ${this.generatePaginationHtml(totalPages)}
          </div>

          <!-- 投稿引导 Banner (列表底部) -->
          <div class="mt-16 p-8 rounded-2xl border border-outline-variant/20 bg-surface-container-low dark:bg-surface-container/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div class="space-y-1">
              <h3 class="text-lg md:text-xl font-extrabold text-on-surface">欢迎分享你的文章</h3>
              <p class="text-sm text-on-surface-variant/80 dark:text-surface-variant/80 leading-relaxed max-w-2xl">
                无论是在日常开发中折腾出的实战记录、比赛科研的避坑指南，还是对开源的想法，都欢迎向 UEM-Stu 投稿，把你的干货经验分享给更多小伙伴！
              </p>
            </div>
            <a
              href="https://github.com/UEM-Stu/UEM-Stu-Blog"
              target="_blank"
              class="flex-shrink-0 flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-bold text-sm px-6 py-3 rounded-xl transition-all duration-300 transform active:scale-95 shadow-sm hover:shadow-md cursor-pointer font-mono"
            >
              前往仓库投稿
              <span class="material-symbols-outlined text-[18px]">north_east</span>
            </a>
          </div>

        </div>
      </section>
    `;
    }

    /**
     * 刷新文章列表和分页器（带渐变动画）
     */
    private refreshList(): void {
        const listContainer = this.querySelector<HTMLDivElement>('#blog-posts-list');
        const paginationContainer = this.querySelector<HTMLDivElement>('#blog-pagination-container');
        const filtered = this.getFilteredPosts();
        const totalPages = Math.ceil(filtered.length / this._postsPerPage);

        if (this._currentPage > totalPages && totalPages > 0) {
            this._currentPage = 1;
        }

        const startIndex = (this._currentPage - 1) * this._postsPerPage;
        const paginatedPosts = filtered.slice(startIndex, startIndex + this._postsPerPage);

        // 执行渐隐动画
        if (listContainer) {
            listContainer.style.opacity = '0';
        }

        setTimeout(() => {
            // 更新文章列表
            if (listContainer) {
                if (paginatedPosts.length > 0) {
                    listContainer.innerHTML = paginatedPosts.map(post => this.generatePostHtml(post)).join('');
                } else {
                    listContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-center text-on-surface-variant/50 dark:text-surface-variant/50">
              <span class="material-symbols-outlined text-[48px] mb-4">search_off</span>
              <p class="text-base font-semibold">没有找到相关的技术博客文章</p>
              <p class="text-xs mt-1 text-on-surface-variant/40 dark:text-surface-variant/40">尝试更换搜索词或选择其他分类标签</p>
            </div>
          `;
                }
                listContainer.style.opacity = '1';
            }

            // 更新分页
            if (paginationContainer) {
                paginationContainer.innerHTML = this.generatePaginationHtml(totalPages);
                this.setupPaginationListeners();
            }
        }, 200);
    }

    /**
     * 绑定分类和搜索监听器
     */
    private setupEventListeners(): void {
        // 1. 分类标签点击
        this.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const tabButton = target.closest('.category-tab') as HTMLButtonElement | null;
            if (tabButton) {
                const selectedCat = tabButton.dataset.category || '全部';
                if (this._currentCategory !== selectedCat) {
                    this._currentCategory = selectedCat;
                    this._currentPage = 1; // 重置页码

                    // 视觉上立即更新高亮 tab
                    const tabs = this.querySelectorAll('.category-tab');
                    tabs.forEach(tab => {
                        tab.className = 'category-tab px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-300 bg-surface-container hover:bg-surface-container-high text-on-surface-variant dark:text-surface-variant dark:bg-surface-container/30 dark:hover:bg-surface-container/50';
                        tab.setAttribute('aria-selected', 'false');
                    });
                    tabButton.className = 'category-tab px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-300 bg-primary text-on-primary shadow-sm dark:bg-primary-fixed dark:text-on-primary-fixed';
                    tabButton.setAttribute('aria-selected', 'true');

                    this.refreshList();
                }
            }
        });

        // 2. 搜索框实时输入检索
        this._searchInput = this.querySelector<HTMLInputElement>('#blog-search-input');
        this._searchHandler = () => {
            if (this._searchInput) {
                this._searchQuery = this._searchInput.value;
                this._currentPage = 1; // 搜索时重置回第一页
                this.refreshList();
            }
        };
        this._searchInput?.addEventListener('input', this._searchHandler);

        // 3. 绑定分页监听
        this.setupPaginationListeners();
    }

    /**
     * 绑定分页专属的事件监听
     */
    private setupPaginationListeners(): void {
        // 上一页
        const prevBtn = this.querySelector<HTMLButtonElement>('#blog-prev-btn');
        prevBtn?.addEventListener('click', () => {
            if (this._currentPage > 1) {
                this._currentPage--;
                this.refreshList();
                this.scrollToTop();
            }
        });

        // 下一页
        const nextBtn = this.querySelector<HTMLButtonElement>('#blog-next-btn');
        nextBtn?.addEventListener('click', () => {
            const filtered = this.getFilteredPosts();
            const totalPages = Math.ceil(filtered.length / this._postsPerPage);
            if (this._currentPage < totalPages) {
                this._currentPage++;
                this.refreshList();
                this.scrollToTop();
            }
        });

        // 页码数字按钮
        const pageNumBtns = this.querySelectorAll<HTMLButtonElement>('.page-num-btn');
        pageNumBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPage = parseInt(btn.dataset.page || '1', 10);
                if (this._currentPage !== targetPage) {
                    this._currentPage = targetPage;
                    this.refreshList();
                    this.scrollToTop();
                }
            });
        });
    }

    /**
     * 翻页时平滑滚动到博客顶部
     */
    private scrollToTop(): void {
        const container = this.querySelector('#blog-container');
        if (container) {
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

customElements.define('uem-blog', UemBlog);
