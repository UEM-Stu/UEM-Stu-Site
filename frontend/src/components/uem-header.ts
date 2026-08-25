/**
 * <uem-header> 顶部导航栏组件
 *
 * 包含品牌 Logo、导航链接、CTA 按钮和移动端菜单
 */
import { LOGO_URL, UEM_STU_NAME, GITHUB_SVG_PATH } from '@/config/theme';
import { NAV_LINKS, STANDALONE_PAGES } from '@/config/navigation';

export class UemHeader extends HTMLElement {
  /** 移动端菜单是否展开 */
  private _menuOpen = false;

  connectedCallback(): void {
    this.classList.add('sticky', 'top-0', 'z-50', 'block', 'w-full');
    this.render();
    this.setupEventListeners();
  }

  /** 渲染导航栏 HTML */
  private render(): void {
    const pathname = window.location.pathname;
    const isBlogPage = pathname.includes('/blog') || pathname.includes('/article');

    // 当前是否处于某个独立页面（首页、技术博客之外的页面，如校园活动）
    const currentStandalonePage =
      STANDALONE_PAGES.find((page) => pathname.includes(page.path)) ?? null;

    // 是否处于「非首页」状态：技术博客页或任意独立页面
    const isSubPage = isBlogPage || currentStandalonePage !== null;

    // 动态计算在当前页面下，各个导航链接的 href 和高亮状态
    const dynamicLinks = NAV_LINKS.map(link => {
      let href: string = link.href;
      let active = link.active;

      if (link.label === '首页') {
        // 首页在子页面时跳转回 /，仅在首页本身时高亮
        href = isSubPage ? '/' : '#';
        active = !isSubPage;
      } else if (link.label === '技术博客') {
        href = isBlogPage ? '#' : '/blog';
        active = isBlogPage;
      }

      return { label: link.label, href, active };
    });

    // 拆分出「首页」和「技术博客」，以便在两者之间插入当前独立页面按钮
    const homeLink = dynamicLinks.find((l) => l.label === '首页');
    const blogLink = dynamicLinks.find((l) => l.label === '技术博客');

    // 锚点链接前缀：处于子页面时需带上 / 回到首页对应锚点
    const anchorPrefix = isSubPage ? '/' : '';

    // 当前独立页面按钮（位于「更多」与「技术博客」之间）
    const currentPageLinkHtml = currentStandalonePage
      ? `
      <a
        class="pb-1 border-b-2 font-label-md text-label-md transition-all duration-200 text-primary dark:text-primary-fixed-dim border-primary dark:border-primary-fixed-dim"
        href="${currentStandalonePage.href}"
      >${currentStandalonePage.label}</a>
    `
      : '';

    const renderDesktopLink = (link: { label: string; href: string; active: boolean }) => `
      <a
        class="pb-1 border-b-2 font-label-md text-label-md transition-all duration-200 ${
          link.active
            ? 'text-primary dark:text-primary-fixed-dim border-primary dark:border-primary-fixed-dim'
            : 'text-on-surface-variant dark:text-surface-variant border-transparent hover:text-primary dark:hover:text-primary-fixed hover:border-primary/30 dark:hover:border-primary-fixed/30'
        }"
        href="${link.href}"
      >${link.label}</a>
    `;

    const renderMobileLink = (link: { label: string; href: string; active: boolean }) => `
      <a
        class="${
          link.active
            ? 'text-primary font-bold border-l-4 border-primary pl-4'
            : 'text-on-surface-variant hover:text-primary transition-colors duration-200 pl-5'
        } font-label-md text-label-md block py-3"
        href="${link.href}"
      >${link.label}</a>
    `;

    const navLinksHtml = (homeLink ? renderDesktopLink(homeLink) : '') + (blogLink ? renderDesktopLink(blogLink) : '');

    // 移动端当前独立页面按钮
    const currentPageMobileLinkHtml = currentStandalonePage
      ? `
      <a
        class="text-primary font-bold border-l-4 border-primary pl-4 font-label-md text-label-md block py-3"
        href="${currentStandalonePage.href}"
      >${currentStandalonePage.label}</a>
    `
      : '';

    const mobileNavLinksHtml =
      (homeLink ? renderMobileLink(homeLink) : '') +
      currentPageMobileLinkHtml +
      (blogLink ? renderMobileLink(blogLink) : '');

    // 「更多」下拉菜单中所有独立页面的入口（当前所在页面不重复展示）
    const standalonePageMenuHtml = STANDALONE_PAGES
      .filter((page) => page.path !== currentStandalonePage?.path)
      .map(
        (page) => `
                  <a href="${page.href}" class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-200">
                    <span class="material-symbols-outlined text-[18px]">event</span>
                    <span>${page.label}</span>
                  </a>
                  <div class="border-t border-outline-variant/20 my-1 mx-1"></div>
      `
      )
      .join('');

    // 移动端「更多」中所有独立页面入口
    const standalonePageMobileMenuHtml = STANDALONE_PAGES
      .filter((page) => page.path !== currentStandalonePage?.path)
      .map(
        (page) => `
              <a href="${page.href}" class="flex items-center gap-2 py-2 text-sm text-on-surface-variant hover:text-primary transition-colors">
                <span class="material-symbols-outlined text-[16px] text-primary">event</span>
                <span>${page.label}</span>
              </a>
      `
      )
      .join('');

    // 点击 Logo 的行为：首页内平滑滚动到顶部，子页面跳转回首页
    const logoOnClick = isSubPage
      ? `window.location.href='/'`
      : `window.scrollTo({top: 0, behavior: 'smooth'})`;

    this.innerHTML = `
      <header
        class="glass-panel w-full transition-all duration-300 shadow-sm"
        id="site-header"
      >
        <div class="flex justify-between items-center h-20 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <!-- 品牌 -->
          <div class="flex items-center gap-3 cursor-pointer" onclick="${logoOnClick}">
            <img
              alt="UEM-Stu Logo"
              class="h-12 w-auto object-contain transition-transform duration-300 hover:rotate-12"
              src="${LOGO_URL}"
            >
            <span class="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed-dim tracking-tight">
              ${UEM_STU_NAME}
            </span>
          </div>
 
          <!-- 桌面端导航链接 -->
          <nav class="hidden md:flex items-center gap-8" aria-label="主导航">
            ${navLinksHtml}
            ${currentPageLinkHtml}
            <!-- 更多下拉菜单 -->
            <div class="relative group py-2">
              <button class="flex items-center gap-0.5 text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed pb-1 border-b-2 border-transparent hover:border-primary/30 dark:hover:border-primary-fixed/30 transition-all duration-200 font-label-md text-label-md cursor-pointer">
                <span>更多</span>
                <span class="material-symbols-outlined text-[16px] transition-transform duration-300 group-hover:rotate-180">keyboard_arrow_down</span>
              </button>
              <!-- 下拉菜单卡片 -->
              <div class="absolute right-0 top-full pt-2 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300 z-50 w-44">
                <div class="bg-white dark:bg-[#191c1d] border border-outline-variant/30 rounded-2xl p-1.5 shadow-lg">
                  ${standalonePageMenuHtml}
                  <a href="${anchorPrefix}#services-section" class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-200">
                    <span class="material-symbols-outlined text-[18px]">grid_view</span>
                    <span>校园服务</span>
                  </a>
                  <div class="border-t border-outline-variant/20 my-1 mx-1"></div>
                  <a href="${anchorPrefix}#projects-section" class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-200">
                    <span class="material-symbols-outlined text-[18px]">terminal</span>
                    <span>开源项目</span>
                  </a>
                  <div class="border-t border-outline-variant/20 my-1 mx-1"></div>
                  <!-- TODO：不跳转页面，直接弹窗-->
                  <a href="${anchorPrefix}#news-section" class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-200">
                    <span class="material-symbols-outlined text-[18px]">campaign</span>
                    <span>开源交流群</span>
                  </a>
                </div>
              </div>
            </div>
          </nav>
 
          <!-- 操作按钮 -->
          <div class="flex items-center gap-4">
            <a
              href="https://github.com/UEM-Stu"
              target="_blank"
              class="flex bg-gradient-to-r from-primary to-[#003380] hover:from-[#003380] hover:to-primary text-on-primary font-label-md text-label-md p-2.5 md:px-5 md:py-2.5 rounded-xl transition-all duration-300 transform hover:scale-[1.03] shadow-md hover:shadow-lg items-center gap-2"
              id="header-github-btn"
              aria-label="GitHub"
            >
              <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="${GITHUB_SVG_PATH}"/>
              </svg>
              <span class="hidden md:inline">GitHub</span>
            </a>
            <button
              class="md:hidden text-on-surface p-2 rounded-lg hover:bg-surface-container-high transition-colors"
              id="mobile-menu-toggle"
              aria-label="打开菜单"
              aria-expanded="false"
            >
              <span class="material-symbols-outlined">menu</span>
            </button>
          </div>
        </div>
 
        <!-- 移动端菜单 -->
        <div
          class="md:hidden overflow-hidden transition-all duration-300 ease-in-out max-h-0 opacity-0 border-t border-outline-variant/30"
          id="mobile-menu"
        >
          <nav class="py-4 px-margin-mobile bg-surface-container-lowest/90 backdrop-blur-md" aria-label="移动端导航">
            ${mobileNavLinksHtml}
            
            <!-- 移动端“更多”子导航 -->
            <div class="pl-5 py-2 border-l border-outline-variant/20 ml-2 mt-1 space-y-1">
              <span class="text-xs text-on-surface-variant/40 font-bold tracking-wider uppercase block mb-1">更多</span>
              ${standalonePageMobileMenuHtml}
              <a href="${anchorPrefix}#services-section" class="flex items-center gap-2 py-2 text-sm text-on-surface-variant hover:text-primary transition-colors">
                <span class="material-symbols-outlined text-[16px] text-primary">grid_view</span>
                <span>校园服务</span>
              </a>
              <a href="${anchorPrefix}#projects-section" class="flex items-center gap-2 py-2 text-sm text-on-surface-variant hover:text-primary transition-colors">
                <span class="material-symbols-outlined text-[16px] text-primary">terminal</span>
                <span>开源项目</span>
              </a>
              <a href="${anchorPrefix}#news-section" class="flex items-center gap-2 py-2 text-sm text-on-surface-variant hover:text-primary transition-colors">
                <span class="material-symbols-outlined text-[16px] text-primary">campaign</span>
                <span>新闻活动</span>
              </a>
            </div>

            <div class="pt-4 mt-2 border-t border-outline-variant/30">
              <a
                href="https://github.com/UEM-Stu"
                target="_blank"
                class="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-primary to-[#003380] text-on-primary font-label-md text-label-md px-6 py-3 rounded-xl transition-all shadow-md"
                id="mobile-header-github-btn"
              >
                <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="${GITHUB_SVG_PATH}"/>
                </svg>
                前往 GitHub
              </a>
            </div>
          </nav>
        </div>
      </header>
    `;
  }

  /** 绑定移动端菜单切换事件 */
  private setupEventListeners(): void {
    const toggleBtn = this.querySelector<HTMLButtonElement>('#mobile-menu-toggle');
    const mobileMenu = this.querySelector<HTMLDivElement>('#mobile-menu');

    toggleBtn?.addEventListener('click', () => {
      this._menuOpen = !this._menuOpen;
      const icon = toggleBtn.querySelector('.material-symbols-outlined');

      if (this._menuOpen) {
        mobileMenu?.classList.remove('max-h-0', 'opacity-0');
        mobileMenu?.classList.add('max-h-[500px]', 'opacity-100');
        if (icon) icon.textContent = 'close';
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.setAttribute('aria-label', '关闭菜单');
      } else {
        mobileMenu?.classList.add('max-h-0', 'opacity-0');
        mobileMenu?.classList.remove('max-h-[500px]', 'opacity-100');
        if (icon) icon.textContent = 'menu';
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.setAttribute('aria-label', '打开菜单');
      }
    });
  }
}

customElements.define('uem-header', UemHeader);
