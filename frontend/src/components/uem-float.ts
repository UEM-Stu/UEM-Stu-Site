/**
 * <uem-float> 通用浮窗组件
 *
 * 属性：
 * - max-width: 浮窗的最大宽度（默认 max-w-2xl，例如 max-w-3xl, max-w-4xl 等）
 * - subtitle: 浮窗的小标题（可选，如 Feedback & Request）
 * - title: 浮窗的大标题（必选）
 *
 * 方法：
 * - showModal(): 打开浮窗（自动阻断背景滚动）
 * - close(): 关闭浮窗（自动恢复背景滚动）
 */

const UEM_FLOAT_STYLE_ID = 'uem-float-styles';

function ensureUemFloatStyles(): void {
  if (document.getElementById(UEM_FLOAT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = UEM_FLOAT_STYLE_ID;
  style.textContent = `
    /* fill: backwards（而非 both）——动画结束后回退到基础样式 transform: none（关键字），
       而不是 fill-forwards 残留的 matrix(1,0,0,1,0,0)。后者虽视觉等同 none，却会让 dialog
       成为 position:fixed 后代的包含块，导致弹窗内 fixed 定位的 tooltip 坐标整体偏移。 */
    uem-float dialog[open]:not([data-closing]) {
      animation: uem-float-enter 0.28s cubic-bezier(0.16, 1, 0.3, 1) backwards;
    }
    uem-float dialog[data-closing] {
      animation: uem-float-leave 0.14s ease-in both;
      pointer-events: none;
    }
    @keyframes uem-float-enter {
      from { opacity: 0; transform: scale(0.94) translateY(12px); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes uem-float-leave {
      from { opacity: 1; transform: none; }
      to   { opacity: 0; transform: scale(0.94) translateY(8px); }
    }
    uem-float dialog[open]::backdrop {
      background: rgba(0, 0, 0, 0.48);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }
    uem-float dialog[open]:not([data-closing])::backdrop {
      animation: uem-backdrop-enter 0.28s ease forwards;
    }
    uem-float dialog[data-closing]::backdrop {
      animation: uem-backdrop-leave 0.14s ease-in forwards;
    }
    @keyframes uem-backdrop-enter {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes uem-backdrop-leave {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

export class UemFloat extends HTMLElement {
  private _dialog: HTMLDialogElement | null = null;
  private _titleElement: HTMLElement | null = null;
  private _closing = false;
  private _closeTimer: ReturnType<typeof setTimeout> | null = null;

  static get observedAttributes() {
    return ['max-width', 'subtitle', 'title'];
  }

  attributeChangedCallback(_name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;
    this.update();
  }

  connectedCallback() {
    ensureUemFloatStyles();
    this.render();
  }

  // 方便外部动态读写大标题（例如校历组件需要根据学年更新标题）
  get titleText(): string {
    return this.getAttribute('title') || '';
  }

  set titleText(val: string) {
    this.setAttribute('title', val);
  }

  showModal() {
    if (!this._dialog) return;
    if (this._closing) {
      // 关闭动画进行中时重新打开：取消关闭，复用已打开的 dialog
      this._closing = false;
      if (this._closeTimer !== null) {
        clearTimeout(this._closeTimer);
        this._closeTimer = null;
      }
      delete this._dialog.dataset.closing;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return;
    }
    this._dialog.showModal();
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }

  close() {
    if (!this._dialog || !this._dialog.open || this._closing) return;
    this._closing = true;
    this._dialog.dataset.closing = '1';
    this._closeTimer = setTimeout(() => { // 160ms ≥ 动画时长 140ms，留 20ms 缓冲
      if (this._dialog) {
        this._dialog.close();
        delete this._dialog.dataset.closing;
      }
      this._closing = false;
      this._closeTimer = null;
    }, 160);
  }

  private update() {
    const titleAttr = this.getAttribute('title') || '';
    const subtitleAttr = this.getAttribute('subtitle') || '';
    const maxWidthAttr = this.getAttribute('max-width') || 'max-w-2xl';

    if (this._titleElement) {
      this._titleElement.textContent = titleAttr;
    }

    const subLabel = this.querySelector('.dialog-subtitle');
    if (subLabel) {
      subLabel.textContent = subtitleAttr;
      if (subtitleAttr) {
        subLabel.removeAttribute('style');
      } else {
        subLabel.setAttribute('style', 'display: none;');
      }
    }

    if (this._dialog) {
      this._dialog.className = `bg-[#f5f6f8] dark:bg-[#151718] text-on-surface p-0 shadow-2xl ${maxWidthAttr} w-[90%] md:w-full rounded-2xl border border-outline/10 dark:border-outline-variant/10 focus:outline-none overflow-hidden`;
    }
  }

  private render() {
    if (this._dialog) return;

    const titleAttr = this.getAttribute('title') || '';
    const subtitleAttr = this.getAttribute('subtitle') || '';
    const maxWidthAttr = this.getAttribute('max-width') || 'max-w-2xl';

    // 暂存用户在 HTML 中编写的子元素内容
    const originalChildren = Array.from(this.childNodes);
    this.innerHTML = '';

    // 创建底层的 <dialog> 元素
    const dialog = document.createElement('dialog');
    dialog.className = `bg-[#f5f6f8] dark:bg-[#151718] text-on-surface p-0 shadow-2xl ${maxWidthAttr} w-[90%] md:w-full rounded-2xl border border-outline/10 dark:border-outline-variant/10 focus:outline-none overflow-hidden`;
    dialog.dataset.uem = '1';
    this._dialog = dialog;

    // 1. 右上角通用关闭按钮（固定于浮窗右上角，不随内容滚动）
    const closeBtn = document.createElement('button');
    closeBtn.className = 'absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-full bg-surface-container-highest/50 hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-all duration-200 focus:outline-none z-10 cursor-pointer';
    closeBtn.setAttribute('aria-label', '关闭浮窗');
    closeBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">close</span>';
    closeBtn.addEventListener('click', () => this.close());
    dialog.appendChild(closeBtn);

    // 滚动容器：内容超出浮窗最大高度时可纵向滚动（移动端长内容仍可见）
    const scrollArea = document.createElement('div');
    scrollArea.className = 'max-h-[90dvh] w-full overflow-y-auto overscroll-contain';

    const wrapper = document.createElement('div');
    wrapper.className = 'relative p-6 md:p-8 flex flex-col items-center';

    // 2. 浮窗标题与小标题
    const header = document.createElement('div');
    header.className = 'text-center mb-8';

    const subLabel = document.createElement('span');
    subLabel.className = 'dialog-subtitle text-xs font-bold tracking-wider text-primary/70 dark:text-primary-fixed-dim/70 uppercase mb-1 block font-mono';
    subLabel.textContent = subtitleAttr;
    if (!subtitleAttr) {
      subLabel.style.display = 'none';
    }
    header.appendChild(subLabel);

    const titleLabel = document.createElement('h3');
    titleLabel.className = 'text-2xl font-extrabold text-on-surface tracking-tight';
    titleLabel.textContent = titleAttr;
    this._titleElement = titleLabel;
    header.appendChild(titleLabel);

    wrapper.appendChild(header);

    // 3. 浮窗内容容器（插入用户编写的内容）
    const content = document.createElement('div');
    content.className = 'w-full flex flex-col items-center';
    originalChildren.forEach(child => content.appendChild(child));
    wrapper.appendChild(content);

    // 4. 页脚团队标识
    const footer = document.createElement('div');
    footer.className = 'text-center w-full mt-6 pt-4 border-t border-outline-variant/10';
    footer.innerHTML = '<p class="text-[10px] text-on-surface-variant/60 font-mono">Powered by UEM-Stu 开源技术组织</p>';
    wrapper.appendChild(footer);

    scrollArea.appendChild(wrapper);
    dialog.appendChild(scrollArea);
    this.appendChild(dialog);

    // 监听 close 事件以复原背景滚动并分发事件
    dialog.addEventListener('close', () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      this.dispatchEvent(new CustomEvent('close'));
    });

    // 拦截 ESC 键默认关闭行为，改走带动画的 close()
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.close();
    });

    // 点击浮窗遮罩（外部）自动关闭浮窗
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        this.close();
      }
    });
  }
}

customElements.define('uem-float', UemFloat);
