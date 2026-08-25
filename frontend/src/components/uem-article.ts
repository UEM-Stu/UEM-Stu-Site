/**
 * <uem-article> 技术博客文章阅读页组件
 *
 * 提供沉浸式的文章阅读体验：
 *   - 左侧固定目录导航（桌面端），带滚动高亮追踪
 *   - 顶部阅读进度条
 *   - Markdown 渲染 + 代码语法高亮（marked + highlight.js）
 *   - 移动端底部抽屉式目录
 *   - 回到顶部按钮
 */
import { marked } from 'marked';
import markedAlert from 'marked-alert';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import markdown from 'highlight.js/lib/languages/markdown';
import { ARTICLES, BlogArticle, TOCItem } from '@/config/article';
import { openLightbox } from './uem-lightbox';

// 按需注册常用语言
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);

// 配置 marked：启用 GFM + 代码高亮
marked.setOptions({
    gfm: true,
    breaks: false,
});

const renderer = new marked.Renderer();

// 为标题生成可锚定的 ID
renderer.heading = function ({ text, depth }: { text: string; depth: number }) {
    const id = text
        .toLowerCase()
        .replace(/<[^>]+>/g, '')
        .replace(/[^\w一-鿿]+/g, '-')
        .replace(/^-|-$/g, '');
    return `<h${depth} id="${id}">${text}</h${depth}>`;
};

// 简单的 HTML 转义函数，以安全输出未高亮的纯文本
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 代码块语法高亮 + mermaid 支持
renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    // mermaid 图表：渲染为 <div class="mermaid"> 由 mermaid.run() 处理
    if (lang === 'mermaid') {
        return `<div class="mermaid">${text}</div>`;
    }
    const canHighlight = lang && hljs.getLanguage(lang);
    let highlighted = '';
    const languageClass = canHighlight ? `language-${lang}` : 'language-plaintext';

    if (canHighlight) {
        try {
            highlighted = hljs.highlight(text, { language: lang }).value;
        } catch (e) {
            highlighted = escapeHtml(text);
        }
    } else {
        highlighted = escapeHtml(text);
    }

    // 语言标签 + 复制按钮
    const langLabel = lang ? `<span class="code-lang-label">${escapeHtml(lang)}</span>` : '';
    const copyBtn = `<button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.parentElement.querySelector('code').textContent).then(()=>{this.textContent='已复制';setTimeout(()=>{this.textContent='复制'},1500)})">复制</button>`;
    return `<div class="code-block-wrapper"><div class="code-block-header">${langLabel}${copyBtn}</div><pre><code class="hljs ${languageClass}">${highlighted}</code></pre></div>`;
};

/**
 * 图片路径改写：在 marked 渲染层统一处理，不依赖运行时 glob 字典或正则后处理。
 * - 外链（http/https）原样透传
 * - 其余路径：取文件名，改写为 /images/<filename> 绝对路径
 *   构建时 closeBundle() 已将 docs/articles/images/ 拷至 dist/images/
 *   开发时 Dev Server 中间件已拦截 /images/* 并从 docs/articles/images/ 实时读取
 */
renderer.image = function ({ href, title, text }: { href: string; title: string | null; text: string }): string {
    let resolvedSrc: string;
    if (/^https?:\/\//.test(href)) {
        // 外链直接透传
        resolvedSrc = href;
    } else {
        // 取文件名，映射到网站根路径 /images/<filename>
        const filename = href.split('/').pop() || href;
        resolvedSrc = `/images/${filename}`;
    }
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    return `<img src="${resolvedSrc}" alt="${escapeHtml(text)}"${titleAttr}>`;
};

marked.use(markedAlert());
marked.use({ renderer });

/** 将 Markdown 内容渲染为 HTML，图片路径由 renderer.image 统一改写 */
export function parseArticleContent(content: string): string {
    return marked.parse(content) as string;
}

export class UemArticle extends HTMLElement {
    private _toc: TOCItem[] = [];
    private _activeId: string = '';
    private _article: BlogArticle | null = null;
    /** 缓存已渲染的文章 HTML，供 render() 插入和 _buildTOC() 提取标题复用，避免二次 parse */
    private _renderedHtml: string = '';

    private _scrollHandler: (() => void) | null = null;
    private _headingOffsets: { id: string; top: number }[] = [];

    connectedCallback(): void {
        const params = new URLSearchParams(window.location.search);
        const slug = params.get('slug') || window.location.hash.replace('#/', '');
        this._article = ARTICLES.find(a => a.slug === slug) || ARTICLES[0] || null;

        try {
            this.render();
            if (this._article) {
                this._buildTOC();
                this._cloneTOCToDrawer();
                this._setupScrollTracking();
                this._setupMobileDrawer();
            }
        } catch (error) {
            console.error('[uem-article] Error in connectedCallback:', error);
        }
    }

    disconnectedCallback(): void {
        if (this._scrollHandler) {
            window.removeEventListener('scroll', this._scrollHandler);
        }
    }

    // ──────────────────── TOC 构建 ────────────────────

    private _buildTOC(): void {
        const container = this.querySelector('#article-toc-list');
        if (!container || !this._article) return;

        // 直接从已渲染并插入 DOM 的 #article-body 中提取标题，无需重复 parse Markdown
        const articleBody = this.querySelector('#article-body');
        if (!articleBody) return;

        this._toc = [];
        articleBody.querySelectorAll('h2, h3').forEach((el) => {
            const id = el.getAttribute('id') || '';
            this._toc.push({
                id,
                text: el.textContent || '',
                level: el.tagName === 'H2' ? 2 : 3,
            });
        });

        container.innerHTML = this._toc
            .map((item, i) => {
                const indent = item.level === 3 ? 'pl-4' : '';
                const activeClass = i === 0 ? 'toc-active' : 'toc-inactive';
                return `
          <a href="#${item.id}"
             data-toc-id="${item.id}"
             class="toc-item ${activeClass} block py-1.5 text-sm rounded-lg transition-all duration-200 ${indent}">
            ${item.text}
          </a>
        `;
            })
            .join('');
    }

    // ──────────────────── 统一滚动追踪（目录高亮 + 进度条） ────────────────────

    private _setupScrollTracking(): void {
        const articleBody = this.querySelector('#article-body');
        const progressBar = this.querySelector<HTMLDivElement>('#article-progress-bar');
        const tocNav = this.querySelector('#article-toc-list');
        if (!articleBody) return;

        // 缓存所有标题的 offsetTop（相对于 article-body）
        this._cacheHeadingOffsets();

        // 缓存 TOC 链接元素
        const tocLinks = tocNav
            ? Array.from(tocNav.querySelectorAll<HTMLAnchorElement>('.toc-item'))
            : [];

        this._scrollHandler = () => {
            // ── 1. 进度条 ──
            if (progressBar) {
                const container = this.querySelector('#article-container');
                if (container) {
                    const rect = container.getBoundingClientRect();
                    const total = container.scrollHeight - window.innerHeight;
                    const pct = Math.min(100, Math.max(0, (-rect.top / total) * 100));
                    progressBar.style.width = `${pct}%`;
                }
            }

            // ── 2. TOC 高亮 ──
            const scrollY = window.scrollY + 100; // 偏移量：标题进入视口 100px 时切换
            let currentId = this._toc[0]?.id || '';

            for (const heading of this._headingOffsets) {
                if (heading.top <= scrollY) {
                    currentId = heading.id;
                } else {
                    break;
                }
            }

            if (currentId !== this._activeId) {
                this._activeId = currentId;
                tocLinks.forEach((link) => {
                    const isActive = link.dataset.tocId === currentId;
                    if (isActive) {
                        link.classList.remove('toc-inactive');
                        link.classList.add('toc-active');
                    } else {
                        link.classList.remove('toc-active');
                        link.classList.add('toc-inactive');
                    }
                });
            }
        };

        window.addEventListener('scroll', this._scrollHandler, { passive: true });

        // 初始触发一次，设置正确的高亮状态
        this._scrollHandler();
    }

    /** 缓存所有 h2/h3 标题相对于 article-body 的 offsetTop */
    private _cacheHeadingOffsets(): void {
        const articleBody = this.querySelector('#article-body');
        if (!articleBody) return;

        this._headingOffsets = [];
        articleBody.querySelectorAll('h2, h3').forEach((heading) => {
            this._headingOffsets.push({
                id: heading.id,
                top: heading.getBoundingClientRect().top + window.scrollY,
            });
        });
    }

    // ──────────────────── 移动端目录抽屉 ────────────────────

    private _setupMobileDrawer(): void {
        const toggleBtn = this.querySelector('#toc-toggle-btn');
        const drawer = this.querySelector('#toc-drawer');
        const overlay = this.querySelector('#toc-drawer-overlay');
        const closeBtn = this.querySelector('#toc-drawer-close');

        if (!toggleBtn || !drawer || !overlay) return;

        const open = () => {
            drawer.classList.remove('translate-y-full');
            overlay.classList.remove('opacity-0', 'pointer-events-none');
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        };

        const close = () => {
            drawer.classList.add('translate-y-full');
            overlay.classList.add('opacity-0', 'pointer-events-none');
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };

        toggleBtn.addEventListener('click', open);
        closeBtn?.addEventListener('click', close);
        overlay.addEventListener('click', close);

        // 点击目录项：先关闭抽屉恢复 body overflow，再手动滚动到目标
        drawer.addEventListener('click', (e) => {
            const link = (e.target as HTMLElement).closest('.toc-item') as HTMLAnchorElement | null;
            if (!link) return;
            e.preventDefault();
            const href = link.getAttribute('href');
            close();
            if (href) {
                requestAnimationFrame(() => {
                    const target = document.querySelector(href);
                    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            }
        });
    }

    // ──────────────────── 图片 Lightbox ────────────────────

    private _setupImageLightbox(): void {
        const articleBody = this.querySelector('#article-body');
        if (!articleBody) return;

        // 点击文章图片，调用全局查看器放大（支持捏合缩放/拖动/双击）
        articleBody.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'IMG' && target.closest('.article-prose')) {
                const img = target as HTMLImageElement;
                openLightbox(img.src, img.alt);
            }
        });
    }

    // ──────────────────── 渲染 ────────────────────

    private render(): void {
        if (!this._article) {
            this.innerHTML = `
        <section class="py-20 px-margin-mobile md:px-margin-desktop">
            <div class="max-w-container-max mx-auto text-center">
                <span class="material-symbols-outlined text-[48px] text-on-surface-variant/30 mb-4 block">article</span>
                <p class="text-on-surface-variant/50 text-base">暂无文章内容</p>
            </div>
        </section>`;
            return;
        }

        // 渲染一次并缓存，_buildTOC 直接从 DOM 读取，不再重复 parse
        this._renderedHtml = parseArticleContent(this._article.content);
        const rawContent = this._renderedHtml;

        this.innerHTML = `
      <style>${this._getStyles()}</style>

      <!-- 阅读进度条 -->
      <div class="fixed top-0 left-0 w-full h-[3px] z-[60] bg-transparent">
        <div id="article-progress-bar"
             class="h-full bg-gradient-to-r from-primary to-primary-container dark:from-primary-fixed-dim dark:to-primary-fixed rounded-r-full transition-[width] duration-100 ease-out"
             style="width: 0%">
        </div>
      </div>

      <section class="pt-8 pb-20 px-margin-mobile md:px-margin-desktop relative" id="article-container">
        <div class="max-w-[1100px] mx-auto">

          <!-- 返回按钮 -->
          <a href="/blog"
             class="inline-flex items-center gap-1.5 text-sm text-on-surface-variant/60 dark:text-surface-variant/60 hover:text-primary dark:hover:text-primary-fixed-dim transition-colors duration-200 mb-8 group">
            <span class="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform duration-200">arrow_back</span>
            返回博客列表
          </a>

          <!-- 文章头部 -->
          <header class="mb-10 pb-8 border-b border-outline-variant/15">
            <div class="flex items-center gap-3 mb-4">
              <span class="inline-block text-xs font-semibold px-2.5 py-0.5 rounded bg-primary/5 text-primary border border-primary/10 dark:bg-primary-fixed-dim/10 dark:text-primary-fixed-dim dark:border-primary-fixed-dim/20">
                ${this._article.category}
              </span>
              <span class="text-xs text-on-surface-variant/50 dark:text-surface-variant/50 font-mono">${this._article.subCategory}</span>
            </div>

            <h1 class="font-headline-xl text-3xl md:text-[2.75rem] font-bold text-on-surface dark:text-surface leading-tight tracking-tight mb-5">
              ${this._article.title}
            </h1>


            <div class="flex flex-wrap items-center gap-5 text-sm text-on-surface-variant/60 dark:text-surface-variant/60 font-mono">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full bg-primary/10 text-primary dark:bg-primary-fixed-dim/10 dark:text-primary-fixed-dim flex items-center justify-center font-bold text-[11px] uppercase">
                  ${this._article.authorAvatar}
                </div>
                <span class="font-medium text-on-surface-variant/80 dark:text-surface-variant/80">${this._article.author}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">calendar_today</span>
                <span>${this._article.date}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">schedule</span>
                <span>${this._article.readTime}</span>
              </div>
            </div>
          </header>

          <!-- 主体布局：TOC + 内容 -->
          <div class="flex gap-12 relative">

            <!-- 左侧目录（桌面端） -->
            <aside class="hidden lg:block w-56 shrink-0">
              <div class="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-none flex flex-col justify-between gap-8">
                <div>
                  <h4 class="text-xs font-bold tracking-widest uppercase text-on-surface-variant/40 dark:text-surface-variant/40 mb-4 font-mono">
                    On this page
                  </h4>
                  <nav id="article-toc-list" class="space-y-0.5 border-l border-outline-variant/15 pl-4">
                    <!-- TOC 由 JS 动态填充 -->
                  </nav>
                </div>

                <!-- 投稿引导 -->
                <div class="pt-6 border-t border-outline-variant/15 text-xs text-on-surface-variant/60 dark:text-surface-variant/60">
                  <p class="mb-2 leading-relaxed">想要分享你的研究成果或技术实战？欢迎投稿！</p>
                  <a
                    href="https://github.com/UEM-Stu/UEM-Stu-Blog"
                    target="_blank"
                    class="inline-flex items-center gap-1 text-primary dark:text-primary-fixed-dim hover:underline font-semibold"
                  >
                    前往博客仓库投稿
                    <span class="material-symbols-outlined text-[14px]">north_east</span>
                  </a>
                </div>
              </div>
            </aside>

            <!-- 文章正文 -->
            <article id="article-body" class="article-prose flex-1 min-w-0">
              ${rawContent}
            </article>
          </div>

        </div>
      </section>

      <!-- 移动端目录按钮 -->
      <button id="toc-toggle-btn"
              class="lg:hidden fixed bottom-6 right-5 z-40 w-11 h-11 rounded-full bg-primary text-on-primary shadow-lg flex items-center justify-center active:scale-95 transition-transform dark:bg-primary-fixed dark:text-on-primary-fixed"
              aria-label="打开目录"
              aria-expanded="false">
        <span class="material-symbols-outlined text-[20px]">toc</span>
      </button>

      <!-- 移动端目录抽屉遮罩 -->
      <div id="toc-drawer-overlay"
           class="lg:hidden fixed inset-0 z-40 bg-black/40 opacity-0 pointer-events-none transition-opacity duration-300">
      </div>

      <!-- 移动端目录抽屉 -->
      <div id="toc-drawer"
           class="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest dark:bg-surface-container rounded-t-2xl shadow-2xl max-h-[60vh] overflow-y-auto translate-y-full transition-transform duration-300 ease-out">
        <div class="sticky top-0 bg-surface-container-lowest dark:bg-surface-container rounded-t-2xl border-b border-outline-variant/10 px-5 py-4 flex items-center justify-between">
          <h4 class="text-sm font-bold text-on-surface dark:text-surface font-mono tracking-wide">目录</h4>
          <button id="toc-drawer-close" class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-high transition-colors" aria-label="关闭目录">
            <span class="material-symbols-outlined text-[20px] text-on-surface-variant">close</span>
          </button>
        </div>
        <nav class="p-5 space-y-1" id="toc-drawer-list">
          <!-- 克隆桌面端 TOC -->
        </nav>
      </div>
    `;

        // 渲染 mermaid 图表
        this._renderMermaid();

        // 图片点击放大
        this._setupImageLightbox();
    }

    private async _renderMermaid(): Promise<void> {
        const mermaidEls = this.querySelectorAll<HTMLElement>('.mermaid');
        if (mermaidEls.length === 0) return;

        try {
            const { default: mermaid } = await import('mermaid');
            mermaid.initialize({
                startOnLoad: false,
                theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
                securityLevel: 'loose',
                fontFamily: "'Hanken Grotesk', sans-serif",
            });
            await mermaid.run({ nodes: mermaidEls });
        } catch (e) {
            console.warn('[uem-article] mermaid render error:', e);
        }
    }

    private _cloneTOCToDrawer(): void {
        const desktopTOC = this.querySelector('#article-toc-list');
        const drawerList = this.querySelector('#toc-drawer-list');
        if (desktopTOC && drawerList) {
            drawerList.innerHTML = desktopTOC.innerHTML;
        }
    }

    // ──────────────────── 文章排版样式 ────────────────────

    private _getStyles(): string {
        return `
      /* ── 文章正文排版 ── */
      .article-prose h2 {
        font-family: 'Hanken Grotesk', sans-serif;
        font-size: 1.625rem;
        font-weight: 700;
        line-height: 1.3;
        margin-top: 3rem;
        margin-bottom: 1rem;
        color: var(--color-on-surface);
        letter-spacing: -0.01em;
        scroll-margin-top: 6rem;
      }
      .article-prose h3 {
        font-family: 'Hanken Grotesk', sans-serif;
        font-size: 1.25rem;
        font-weight: 600;
        line-height: 1.4;
        margin-top: 2.25rem;
        margin-bottom: 0.75rem;
        color: var(--color-on-surface);
        scroll-margin-top: 6rem;
      }
      .article-prose p {
        font-size: 1.0625rem;
        line-height: 1.8;
        margin-bottom: 1.25rem;
        color: var(--color-on-surface-variant);
      }
      .dark .article-prose h2,
      .dark .article-prose h3 {
        color: var(--color-surface);
      }
      .dark .article-prose p {
        color: var(--color-surface-variant);
      }

      /* ── 链接 ── */
      .article-prose a {
        color: var(--color-primary);
        text-decoration: underline;
        text-underline-offset: 3px;
        text-decoration-thickness: 1px;
        text-decoration-color: rgba(0,31,84,0.3);
        transition: all 0.2s;
      }
      .article-prose a:hover {
        text-decoration-color: var(--color-primary);
      }
      .dark .article-prose a {
        color: var(--color-primary-fixed-dim);
        text-decoration-color: rgba(177,197,255,0.3);
      }
      .dark .article-prose a:hover {
        text-decoration-color: var(--color-primary-fixed-dim);
      }

      /* ── 图片 ── */
      .article-prose img {
        max-width: 100%;
        height: auto;
        margin: 1.75rem 0;
        border-radius: 12px;
        border: 1px solid var(--color-outline-variant);
        cursor: zoom-in;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .article-prose img:hover {
        transform: scale(1.01);
        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      }
      .dark .article-prose img {
        border-color: rgba(255,255,255,0.06);
      }
      .dark .article-prose img:hover {
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      }

      /* ── 加粗 ── */
      .article-prose strong {
        font-weight: 700;
        color: var(--color-on-surface);
      }
      .dark .article-prose strong {
        color: var(--color-surface);
      }

      /* ── 引用块 ── */
      .article-prose blockquote {
        margin: 1.75rem 0;
        padding: 1.25rem 1.5rem;
        border-left: 3px solid var(--color-primary);
        background: linear-gradient(135deg, rgba(0,31,84,0.04), rgba(0,51,128,0.02));
        border-radius: 0 12px 12px 0;
        font-style: normal;
      }
      .article-prose blockquote p {
        margin-bottom: 0;
        color: var(--color-on-surface-variant);
        font-style: italic;
      }
      .dark .article-prose blockquote {
        background: linear-gradient(135deg, rgba(177,197,255,0.06), rgba(218,226,255,0.03));
        border-left-color: var(--color-primary-fixed-dim);
      }
      .dark .article-prose blockquote p {
        color: var(--color-surface-variant);
      }

      /* ── 行内代码 ── */
      .article-prose :not(pre) > code {
        font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
        font-size: 0.875em;
        padding: 0.15em 0.4em;
        border-radius: 6px;
        background: var(--color-surface-container-high);
        color: var(--color-primary);
        font-weight: 500;
      }
      .dark .article-prose :not(pre) > code {
        background: rgba(177,197,255,0.12);
        color: var(--color-primary-fixed-dim);
      }

      /* ── 代码块 ── */
      .code-block-wrapper {
        position: relative;
        margin: 1.75rem 0;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid var(--color-outline-variant);
      }
      .code-block-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.4rem 0.75rem;
        background: var(--color-surface-container);
        border-bottom: 1px solid var(--color-outline-variant);
      }
      .code-lang-label {
        font-family: 'Work Sans', sans-serif;
        font-size: 0.7rem;
        font-weight: 600;
        color: var(--color-on-surface-variant);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.65;
      }
      .dark .code-lang-label {
        color: var(--color-surface-variant);
      }
      .code-copy-btn {
        font-family: 'Work Sans', sans-serif;
        font-size: 0.7rem;
        font-weight: 600;
        padding: 0.2rem 0.6rem;
        border-radius: 6px;
        border: 1px solid var(--color-outline-variant);
        background: var(--color-surface-container-lowest);
        color: var(--color-on-surface-variant);
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s;
      }
      .code-block-wrapper:hover .code-copy-btn {
        opacity: 1;
      }
      .code-copy-btn:hover {
        background: var(--color-surface-container-high);
        color: var(--color-on-surface);
      }
      .article-prose .code-block-wrapper pre {
        margin: 0;
        border: none;
        border-radius: 0;
      }
      .article-prose pre code {
        display: block;
        padding: 1.25rem 1.5rem;
        font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
        font-size: 0.875rem;
        line-height: 1.7;
        overflow-x: auto;
        background: var(--color-surface-container-low);
      }
      .dark .article-prose pre {
        border-color: rgba(255,255,255,0.06);
      }
      .dark .article-prose pre code {
        background: rgba(25,28,29,0.6);
      }
      .dark .code-block-wrapper {
        border-color: rgba(255,255,255,0.06);
      }
      .dark .code-block-header {
        background: rgba(255,255,255,0.03);
        border-bottom-color: rgba(255,255,255,0.06);
      }

      /* ── 暗色模式 code token 覆盖 ── */
      .dark .article-prose code.hljs {
        color: #c9d1d9;
      }
      .dark .article-prose .hljs-keyword,
      .dark .article-prose .hljs-selector-tag,
      .dark .article-prose .hljs-literal { color: #ff7b72; }
      .dark .article-prose .hljs-string,
      .dark .article-prose .hljs-title,
      .dark .article-prose .hljs-name,
      .dark .article-prose .hljs-type,
      .dark .article-prose .hljs-attribute { color: #a5d6ff; }
      .dark .article-prose .hljs-comment,
      .dark .article-prose .hljs-quote { color: #8b949e; }
      .dark .article-prose .hljs-number,
      .dark .article-prose .hljs-regexp,
      .dark .article-prose .hljs-params { color: #ffa657; }
      .dark .article-prose .hljs-built_in { color: #79c0ff; }
      .dark .article-prose .hljs-title.function_ { color: #d2a8ff; }
      .dark .article-prose .hljs-variable { color: #ffa657; }
      .dark .article-prose .hljs-symbol { color: #7ee787; }

      /* ── GitHub Alerts (marked-alert) ── */
      .markdown-alert {
        margin: 1.75rem 0;
        padding: 1rem 1.25rem;
        border-radius: 10px;
        border: 1px solid;
        border-left-width: 4px;
      }
      .markdown-alert-title {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-weight: 700;
        font-size: 0.875rem;
        margin-bottom: 0.5rem;
      }
      .markdown-alert-title svg {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }
      .markdown-alert > p {
        font-size: 0.9375rem;
        line-height: 1.7;
        color: var(--color-on-surface-variant);
      }
      .markdown-alert > p:last-child { margin-bottom: 0; }

      .markdown-alert-note      { background: rgba(9,105,218,0.06);  border-color: rgba(9,105,218,0.3); }
      .markdown-alert-tip       { background: rgba(9,105,218,0.06);  border-color: rgba(9,105,218,0.3); }
      .markdown-alert-important { background: rgba(130,80,223,0.06); border-color: rgba(130,80,223,0.3); }
      .markdown-alert-warning   { background: rgba(210,153,34,0.08); border-color: rgba(210,153,34,0.4); }
      .markdown-alert-caution   { background: rgba(218,54,51,0.06);  border-color: rgba(218,54,51,0.3); }

      .markdown-alert-note .markdown-alert-title      { color: #0969da; }
      .markdown-alert-tip .markdown-alert-title       { color: #0969da; }
      .markdown-alert-important .markdown-alert-title  { color: #8250df; }
      .markdown-alert-warning .markdown-alert-title    { color: #9a6700; }
      .markdown-alert-caution .markdown-alert-title    { color: #cf222e; }

      .dark .markdown-alert-note      { background: rgba(56,139,253,0.1);  border-color: rgba(56,139,253,0.25); }
      .dark .markdown-alert-tip       { background: rgba(56,139,253,0.1);  border-color: rgba(56,139,253,0.25); }
      .dark .markdown-alert-important { background: rgba(163,113,247,0.1); border-color: rgba(163,113,247,0.25); }
      .dark .markdown-alert-warning   { background: rgba(210,153,34,0.1);  border-color: rgba(210,153,34,0.25); }
      .dark .markdown-alert-caution   { background: rgba(248,81,73,0.1);   border-color: rgba(248,81,73,0.25); }

      .dark .markdown-alert-note .markdown-alert-title      { color: #58a6ff; }
      .dark .markdown-alert-tip .markdown-alert-title       { color: #58a6ff; }
      .dark .markdown-alert-important .markdown-alert-title  { color: #bc8cff; }
      .dark .markdown-alert-warning .markdown-alert-title    { color: #e3b341; }
      .dark .markdown-alert-caution .markdown-alert-title    { color: #ff7b72; }
      .dark .markdown-alert > p { color: var(--color-surface-variant); }

      /* ── Mermaid 图表 ── */
      .mermaid {
        display: block;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        text-align: center;
        margin: 2rem 0;
        padding: 1.5rem;
        border-radius: 12px;
        background: var(--color-surface-container-lowest);
        border: 1px solid var(--color-outline-variant);
      }
      .dark .mermaid {
        background: rgba(25,28,29,0.4);
        border-color: rgba(255,255,255,0.06);
      }
      .mermaid svg {
        display: inline-block;
        max-width: 100%;
        height: auto;
      }

      /* ── 列表 ── */
      .article-prose ul {
        list-style-type: disc;
      }
      .article-prose ol {
        list-style-type: decimal;
      }
      .article-prose ul, .article-prose ol {
        margin: 1rem 0 1.25rem 1.5rem;
        color: var(--color-on-surface-variant);
      }
      .article-prose li {
        margin-bottom: 0.5rem;
        line-height: 1.75;
        padding-left: 0.25rem;
      }
      .article-prose li::marker {
        color: var(--color-primary);
      }
      .dark .article-prose ul,
      .dark .article-prose ol {
        color: var(--color-surface-variant);
      }
      .dark .article-prose li::marker {
        color: var(--color-primary-fixed-dim);
      }

      /* ── 表格 ── */
      .article-prose table {
        width: 100%;
        margin: 1.75rem 0;
        border-collapse: separate;
        border-spacing: 0;
        border: 1px solid var(--color-outline-variant);
        border-radius: 12px;
        overflow: hidden;
        font-size: 0.9375rem;
      }
      .article-prose thead {
        background: var(--color-surface-container);
      }
      .article-prose th {
        padding: 0.75rem 1rem;
        text-align: left;
        font-weight: 600;
        color: var(--color-on-surface);
        border-bottom: 1px solid var(--color-outline-variant);
      }
      .article-prose td {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--color-outline-variant);
        color: var(--color-on-surface-variant);
      }
      .article-prose tr:last-child td {
        border-bottom: none;
      }
      .dark .article-prose table {
        border-color: rgba(255,255,255,0.06);
      }
      .dark .article-prose thead {
        background: rgba(255,255,255,0.03);
      }
      .dark .article-prose th {
        color: var(--color-surface);
        border-bottom-color: rgba(255,255,255,0.06);
      }
      .dark .article-prose td {
        color: var(--color-surface-variant);
        border-bottom-color: rgba(255,255,255,0.06);
      }

      /* ── 分隔线 ── */
      .article-prose hr {
        margin: 2.5rem 0;
        border: none;
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--color-outline-variant), transparent);
      }

      /* ── 滚动条美化 ── */
      .article-prose ::-webkit-scrollbar {
        height: 6px;
      }
      .article-prose ::-webkit-scrollbar-track {
        background: transparent;
      }
      .article-prose ::-webkit-scrollbar-thumb {
        background: var(--color-outline-variant);
        border-radius: 3px;
      }

      /* ── TOC 目录项状态 ── */
      .toc-item {
        color: var(--color-on-surface-variant);
        opacity: 0.5;
        font-weight: 400;
        border-left: 2px solid transparent;
        margin-left: -17px;
        padding-left: 14px;
      }
      .toc-item:hover {
        opacity: 0.8;
        color: var(--color-primary);
        background: rgba(0,31,84,0.04);
      }
      .toc-item.toc-active {
        color: var(--color-primary);
        opacity: 1;
        font-weight: 600;
        border-left-color: var(--color-primary);
        background: rgba(0,31,84,0.06);
      }
      .dark .toc-item {
        color: var(--color-surface-variant);
        opacity: 0.45;
      }
      .dark .toc-item:hover {
        opacity: 0.75;
        color: var(--color-primary-fixed-dim);
        background: rgba(177,197,255,0.05);
      }
      .dark .toc-item.toc-active {
        color: var(--color-primary-fixed-dim);
        opacity: 1;
        border-left-color: var(--color-primary-fixed-dim);
        background: rgba(177,197,255,0.08);
      }
    `;
    }
}

customElements.define('uem-article', UemArticle);
