/**
 * <uem-select> 通用单选下拉框组件
 *
 * 原生 Web Component，无依赖、风格与站点其它 uem-* 组件一致（Tailwind + 主题色 token）。
 * 适合做「从一组选项里选一个，可清除」的轻量筛选下拉，避免选项过多时平铺占满工具栏。
 *
 * 属性（HTML attribute，可响应式更新）：
 * - placeholder: 未选中时触发器显示的占位文案（默认「请选择」）
 * - clearable: 存在该属性时，选中后触发器右侧出现「✕」可一键清除（恢复未选中）
 * - aria-label: 透传到触发按钮，便于无障碍
 *
 * 编程式 API：
 * - options: string[] —— 直接赋值选项数组（getter / setter）
 * - value: string | null —— 当前选中值（getter / setter，设为 null 表示清空）
 *
 * 事件：
 * - 'uem-select-change': CustomEvent<{ value: string | null }>
 *   选中、切换或清除时派发，detail.value 为最新选中值（null 表示已清除）。
 *
 * 用法：
 *   const sel = document.createElement('uem-select') as UemSelect;
 *   sel.setAttribute('placeholder', '全部学院');
 *   sel.setAttribute('clearable', '');
 *   sel.options = ['计算机科学与工程学院', '安全工程学院'];
 *   sel.addEventListener('uem-select-change', (e) => console.log(e.detail.value));
 */

const STYLE_ID = 'uem-select-styles';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes uem-select-pop {
      from { opacity: 0; transform: translateY(-6px) scale(0.98); }
      to   { opacity: 1; transform: none; }
    }
    uem-select [data-panel] { animation: uem-select-pop 0.16s cubic-bezier(0.16, 1, 0.3, 1) backwards; transform-origin: top; }
    uem-select [data-list]::-webkit-scrollbar { width: 6px; }
    uem-select [data-list]::-webkit-scrollbar-thumb { background: rgba(116,119,130,0.30); border-radius: 9999px; }
    uem-select [data-list]::-webkit-scrollbar-track { background: transparent; }
  `;
  document.head.appendChild(style);
}

/** HTML 转义，防止选项文本被当作标记注入。 */
const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export class UemSelect extends HTMLElement {
  private _options: string[] = [];
  private _value: string | null = null;
  private _open = false;

  /** 点击组件外部时关闭面板（连接时绑定、断开时解绑，避免泄漏） */
  private _onDocClick = (e: MouseEvent): void => {
    if (!this.contains(e.target as Node)) this.closePanel();
  };
  private _onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this._open) {
      this.closePanel();
      this.querySelector<HTMLButtonElement>('[data-trigger]')?.focus();
    }
  };

  static get observedAttributes(): string[] {
    return ['placeholder', 'clearable', 'aria-label'];
  }

  connectedCallback(): void {
    ensureStyles();
    this.render();
    this.bindEvents();
    document.addEventListener('click', this._onDocClick);
    document.addEventListener('keydown', this._onKeydown);
  }

  disconnectedCallback(): void {
    document.removeEventListener('click', this._onDocClick);
    document.removeEventListener('keydown', this._onKeydown);
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  /* —— 公开 API —— */
  get options(): string[] {
    return this._options;
  }
  set options(list: string[]) {
    this._options = Array.isArray(list) ? list.slice() : [];
    // 选项变化后，若当前值已不在列表内则清空
    if (this._value && !this._options.includes(this._value)) this._value = null;
    if (this.isConnected) this.render();
  }

  get value(): string | null {
    return this._value;
  }
  set value(v: string | null) {
    const next = v && this._options.includes(v) ? v : null;
    if (next === this._value) return;
    this._value = next;
    if (this.isConnected) this.render();
  }

  private get clearable(): boolean {
    return this.hasAttribute('clearable');
  }
  private get placeholder(): string {
    return this.getAttribute('placeholder') || '请选择';
  }

  /* —— 内部行为 —— */
  private emitChange(): void {
    this.dispatchEvent(
      new CustomEvent<{ value: string | null }>('uem-select-change', {
        detail: { value: this._value },
        bubbles: true,
      }),
    );
  }

  private openPanel(): void {
    if (this._open) return;
    // 关闭页面上所有其他 uem-select 的面板，避免多面板重叠
    document.querySelectorAll<UemSelect>('uem-select').forEach((el) => {
      if (el !== this && el._open) el._open = false;
    });
    this._open = true;
    // 全部关闭后统一重渲染一次（比逐个 render 更高效）
    document.querySelectorAll<UemSelect>('uem-select').forEach((el) => el.render());
  }
  private closePanel(): void {
    if (!this._open) return;
    this._open = false;
    this.render();
  }
  private togglePanel(): void {
    this._open ? this.closePanel() : this.openPanel();
  }

  private selectOption(v: string): void {
    this._value = this._value === v ? null : v; // 再次点选同一项 = 取消选择
    this._open = false;
    this.render();
    this.emitChange();
  }

  private clearValue(): void {
    if (this._value === null) return;
    this._value = null;
    this.render();
    this.emitChange();
  }

  /* —— 事件绑定（委托） —— */
  private bindEvents(): void {
    this.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;

      // render() 会重建内部 DOM，使本次点击的 target 脱离 this 子树；若让事件继续冒泡到
      // document 上的外部点击监听，会因 this.contains(target)=false 而误判为「点了外部」立即收起面板。
      // 故组件内部的交互一律在此截断冒泡。
      e.stopPropagation();

      if (t.closest('[data-clear]')) {
        this.clearValue();
        return;
      }
      if (t.closest('[data-trigger]')) {
        this.togglePanel();
        return;
      }
      const opt = t.closest('[data-option]') as HTMLElement | null;
      if (opt) {
        this.selectOption(opt.getAttribute('data-option')!);
        return;
      }
    });
  }

  /* —— 渲染 —— */
  private render(): void {
    const hasValue = this._value !== null;
    const label = hasValue ? this._value! : this.placeholder;
    const ariaLabel = this.getAttribute('aria-label') || this.placeholder;

    const triggerCls = hasValue
      ? 'border-primary/40 text-on-surface dark:border-primary-fixed-dim/40'
      : 'border-outline-variant/60 text-on-surface-variant/80 hover:text-on-surface hover:border-primary/30';

    // 右侧图标区：未选中显示下箭头；选中且可清除时，箭头替换为可点击的「✕」清除图标（不再显示箭头）。
    // 注意不能用嵌套 <button>（HTML 不允许 button 嵌套 button，浏览器会把内层按钮提到外层之外，
    // 导致图标跑到边框外）。这里统一用 <span> + data 属性，点击行为交由组件事件委托处理。
    const trailing =
      this.clearable && hasValue
        ? `<span data-clear role="button" tabindex="0" aria-label="清除选择" title="清除选择"
            class="material-symbols-outlined text-[18px] shrink-0 text-on-surface-variant/55 hover:text-error transition-colors cursor-pointer">close</span>`
        : `<span aria-hidden="true" class="material-symbols-outlined text-[18px] shrink-0 text-on-surface-variant/60 transition-transform duration-200 ${
            this._open ? 'rotate-180' : ''
          }">expand_more</span>`;

    const panel = this._open ? this.panelHTML() : '';

    this.innerHTML = `
      <div class="relative inline-block text-left">
        <button data-trigger type="button" aria-haspopup="listbox" aria-expanded="${this._open}" aria-label="${esc(ariaLabel)}"
          class="inline-flex items-center gap-1.5 h-9 pl-3 pr-2.5 rounded-full border bg-surface-container-lowest text-xs font-semibold transition-all cursor-pointer ${triggerCls}">
          <span class="truncate max-w-[10rem] md:max-w-[14rem]">${esc(label)}</span>
          ${trailing}
        </button>
        ${panel}
      </div>
    `;
  }

  private panelHTML(): string {
    if (this._options.length === 0) {
      return `<div data-panel class="absolute left-0 z-40 mt-1.5 min-w-[12rem] rounded-xl border border-outline-variant/60 bg-surface-container-lowest dark:bg-[#1e2124] shadow-lg p-2">
        <p class="px-2 py-3 text-xs text-on-surface-variant/55 text-center">暂无选项</p>
      </div>`;
    }
    const items = this._options
      .map((opt) => {
        const on = opt === this._value;
        const cls = on
          ? 'bg-primary/10 text-primary dark:bg-primary-fixed-dim/15 dark:text-primary-fixed-dim font-semibold'
          : 'text-on-surface/85 hover:bg-on-surface-variant/[0.06]';
        const check = on
          ? '<span class="material-symbols-outlined text-[16px] shrink-0">check</span>'
          : '<span class="w-4 shrink-0"></span>';
        return `<button data-option="${esc(opt)}" role="option" aria-selected="${on}" type="button"
          class="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${cls}">
          ${check}<span class="truncate">${esc(opt)}</span>
        </button>`;
      })
      .join('');

    return `<div data-panel role="listbox" class="absolute left-0 z-40 mt-1.5 min-w-[13rem] max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-outline-variant/60 bg-surface-container-lowest dark:bg-[#1e2124] shadow-lg p-1.5">
      <div data-list class="flex flex-col gap-0.5 max-h-72 overflow-y-auto">${items}</div>
    </div>`;
  }
}

customElements.define('uem-select', UemSelect);
