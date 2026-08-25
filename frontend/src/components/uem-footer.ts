/**
 * <uem-footer> 页脚组件
 *
 * 包含品牌信息、链接列表、社交图标和版权信息
 */
import { LOGO_URL, UEM_STU_NAME, UEM_STU_NAME_CN, UEM_STU_SLOGAN } from '@/config/theme';
import { FOOTER_LINKS } from '@/config/navigation';

export class UemFooter extends HTMLElement {
    connectedCallback(): void {
        this.render();
    }

    private render(): void {
        // 渲染"相关链接"
        const relatedLinksHtml = FOOTER_LINKS.related
            .map(
                (link) => `
        <li>
          <a class="text-sm text-on-surface-variant hover:text-primary transition-colors" href="${link.href}" target="_blank" rel="noopener noreferrer">
            ${link.label}
          </a>
        </li>
      `
            )
            .join('');

        // 渲染底部导航链接
        const bottomLinksHtml = FOOTER_LINKS.bottom
            .map(
                (link) => {
                    // 根据配置动态添加下划线样式类
                    const underlineClass = link.underline
                        ? 'underline decoration-1 underline-offset-4 decoration-on-surface-variant/30 hover:decoration-primary'
                        : '';
                    return `
            <a class="font-body-sm text-sm text-on-surface-variant hover:text-primary transition-all duration-300 ${underlineClass}" href="${link.href}" target="_blank" rel="noopener noreferrer">
              ${link.label}
            </a>
          `;
                }
            )
            .join('');

        this.innerHTML = `
      <footer class="bg-surface-container-low dark:bg-surface-dim border-t border-outline-variant/30 w-full" id="site-footer">
        <div class="py-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
 
          <!-- 上半部分：品牌 + 链接 -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12 border-b border-outline-variant/30 pb-12">
 
            <!-- 品牌信息 -->
            <div class="md:col-span-2">
              <div class="flex items-center gap-3 mb-4">
                <img
                  alt="UEM-Stu Logo"
                  class="h-8 w-auto object-contain opacity-60 dark:opacity-80 transition-opacity hover:opacity-100"
                  src="${LOGO_URL}"
                >
                <span class="font-headline-md text-lg font-bold text-on-surface dark:text-surface-bright tracking-tight">
                  ${UEM_STU_NAME}
                </span>
              </div>
              <p class="font-body-md text-sm text-on-surface-variant dark:text-surface-variant max-w-sm mb-6 leading-relaxed">
                ${UEM_STU_NAME_CN}<br>${UEM_STU_SLOGAN}
              </p>
              <div class="flex gap-4">
                <a
                  class="w-10 h-10 rounded-xl bg-surface-container-high dark:bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:bg-primary hover:text-on-primary dark:hover:bg-primary-fixed dark:hover:text-on-primary-fixed transform hover:scale-105 transition-all duration-300"
                  href="https://www.ncist.edu.cn/"
                  target="_blank"
                  aria-label="官网"
                >
                  <span class="material-symbols-outlined text-[20px]">public</span>
                </a>
                <a
                  class="w-10 h-10 rounded-xl bg-surface-container-high dark:bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:bg-primary hover:text-on-primary dark:hover:bg-primary-fixed dark:hover:text-on-primary-fixed transform hover:scale-105 transition-all duration-300"
                  href="https://github.com/UEM-Stu"
                  target="_blank"
                  aria-label="GitHub"
                >
                  <span class="material-symbols-outlined text-[20px]">forum</span>
                </a>
                <a
                  class="w-10 h-10 rounded-xl bg-surface-container-high dark:bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:bg-primary hover:text-on-primary dark:hover:bg-primary-fixed dark:hover:text-on-primary-fixed transform hover:scale-105 transition-all duration-300"
                  href="https://github.com/UEM-Stu/UEM-Stu-Site"
                  target="_blank"
                  aria-label="分享"
                >
                  <span class="material-symbols-outlined text-[20px]">share</span>
                </a>
              </div>
            </div>
 
            <!-- 相关链接 -->
            <div class="text-left md:text-right">
              <h4 class="font-headline-md text-base text-on-surface dark:text-surface-bright mb-5 font-bold">相关链接</h4>
              <ul class="space-y-3">
                ${relatedLinksHtml}
              </ul>
            </div>
          </div>
 
          <!-- 下半部分：版权 + 底部导航 -->
          <div class="flex flex-col md:flex-row justify-between items-center gap-6">
            <p class="font-body-sm text-sm text-on-surface-variant dark:text-surface-variant">
              © ${new Date().getFullYear()} ${UEM_STU_NAME_CN}.
            </p>
            <nav class="flex flex-wrap justify-center gap-6" aria-label="页脚导航">
              ${bottomLinksHtml}
            </nav>
          </div>
        </div>
      </footer>
    `;
    }
}

customElements.define('uem-footer', UemFooter);
