/**
 * <uem-tooltip> 通用气泡提示组件
 * 
 * 属性：
 * - text: 简短的提示文本（可选，若不需要复杂的富文本，可以直接设置此属性）
 * - manual-touch: 存在时禁用内置触摸显示，触屏设备上完全交由外部控制（用于热力图长按拖动浏览）
 *
 * 插槽：
 * - 默认插槽：放置触发提示的元素（如图标、文字等）
 * - content: 放置气泡中的复杂 HTML 内容（可选，当不设置 text 属性时生效）
 */

// 触屏点按后浏览器会延迟派发一组合成 mouse 事件（mousemove/mouseenter/click），间隔通常在
// 300ms 内。记录最近一次 touch 时间，供 manual-touch 的 tooltip 判定并跳过这些合成事件，
// 避免「点一下格子气泡就弹出并卡住不消失」。touchmove/touchend 同样刷新时间戳，确保长按拖动
// 浏览期间保持新鲜，松手后的合成事件仍落在抑制窗口内。
export let lastTouchTime = 0;
if (typeof window !== 'undefined') {
  const markTouch = () => { lastTouchTime = Date.now(); };
  window.addEventListener('touchstart', markTouch, { capture: true, passive: true });
  window.addEventListener('touchmove', markTouch, { capture: true, passive: true });
  window.addEventListener('touchend', markTouch, { capture: true, passive: true });
}

export class UemTooltip extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  private render() {
    // 1. 获取内容元素（带有 slot="content" 的子元素）
    const contentEl = this.querySelector('[slot="content"]');
    
    // 2. 获取其他所有触发元素（子节点）
    const triggerNodes = Array.from(this.childNodes).filter(node => node !== contentEl);
    
    // 清空当前内容以便重新拼装
    this.innerHTML = '';
    
    // 设置宿主元素的显示类型为行内块，如果外部未定义则设置默认值
    if (!this.style.display) {
      this.style.display = 'inline-block';
    }
    if (!this.style.verticalAlign) {
      this.style.verticalAlign = 'middle';
    }
    
    // 3. 创建内部结构包裹器，增加 relative 定位与 group 触发器
    const wrapper = document.createElement('div');
    wrapper.className = 'relative inline-flex items-center group/tooltip';
    
    // 4. 将触发元素追加到包裹器
    triggerNodes.forEach(node => wrapper.appendChild(node));
    
    // 5. 创建气泡本体并增加最大宽度限制，防止在窄屏下溢出
    // 默认加入 invisible 类 (visibility: hidden)，确保其在初始未定位时绝对不可见，杜绝闪跳
    const balloon = document.createElement('div');
    balloon.className = 'fixed p-3 bg-white dark:bg-[#1e2124] text-on-surface border border-outline-variant/30 dark:border-[#2f3336] rounded-xl shadow-lg invisible opacity-0 pointer-events-none transition-opacity duration-200 z-50 min-w-[260px] max-w-[calc(100vw-24px)] text-left text-xs whitespace-normal font-sans normal-case after:content-[\'\'] after:absolute after:top-full after:left-0 after:w-full after:h-2';
    
    // 向下的三角形指示物
    const arrow = document.createElement('div');
    arrow.className = 'absolute top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white dark:border-t-[#1e2124]';
    balloon.appendChild(arrow);
    
    // 6. 追加内容
    if (contentEl) {
      contentEl.removeAttribute('slot');
      balloon.appendChild(contentEl);
    } else {
      const textAttr = this.getAttribute('text') || '';
      const textSpan = document.createElement('span');
      textSpan.textContent = textAttr;
      balloon.appendChild(textSpan);
    }
    
    wrapper.appendChild(balloon);
    this.appendChild(wrapper);

    // 闭包内维护 hover 状态，防止双重 requestAnimationFrame 异步回调时鼠标已移出而导致状态不同步
    let isHovered = false;

    // 7. 边界避让动态计算逻辑（基于视口 fixed 定位，彻底避开 overflow-x-auto 截断）
    const adjustPosition = () => {
      isHovered = true;

      // 锁定触发的格子元素而非 wrapper，防止 wrapper 宽度在 hover 时被气泡撑大而导致 X 轴计算偏右
      const trigger = wrapper.firstElementChild || wrapper;
      const triggerRect = trigger.getBoundingClientRect();
      
      // 立即将气泡设为不可见，并关闭 transition 效果，防止在计算与移动位置的瞬间被用户察觉
      balloon.style.visibility = 'hidden';
      balloon.style.transition = 'none';
      
      // 临时移出屏幕以获取固有宽高
      balloon.style.position = 'fixed';
      balloon.style.left = '-9999px';
      balloon.style.top = '-9999px';
      balloon.style.transform = 'none';
      
      const rect = balloon.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

      // 理想定位：气泡底边缘对准 trigger 顶边缘并留 8px 间距，水平居中
      const idealLeft = triggerRect.left + (triggerRect.width - rect.width) / 2;
      const idealTop = triggerRect.top - rect.height - 8;

      // 视口溢出限制：保留左右 12px 间隙
      let actualLeft = Math.max(12, idealLeft);
      if (actualLeft + rect.width > viewportWidth - 12) {
        actualLeft = viewportWidth - 12 - rect.width;
      }

      balloon.style.left = `${actualLeft}px`;
      balloon.style.top = `${idealTop}px`;

      // 计算箭头在底部的位置，使其对准 trigger 中心
      const triggerCenterX = triggerRect.left + triggerRect.width / 2;
      const arrowOffsetX = triggerCenterX - actualLeft;
      // 限制箭头位置不偏出气泡圆角边缘（保留 16px）
      const minArrowX = 16;
      const maxArrowX = rect.width - 16;
      const finalArrowX = Math.max(minArrowX, Math.min(maxArrowX, arrowOffsetX));
      
      arrow.style.left = `${finalArrowX}px`;
      arrow.style.transform = 'translateX(-50%)';

      // 8. 双重 requestAnimationFrame 确保浏览器在渲染可见状态之前，已经把最新的 left/top 布局应用到了页面上
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (isHovered) {
            balloon.style.transition = ''; // 恢复由 CSS 类控制的 transition-opacity 效果
            balloon.style.visibility = 'visible';
            balloon.style.opacity = '1';
            balloon.style.pointerEvents = 'auto';
          }
        });
      });
    };

    const resetPosition = () => {
      isHovered = false;
      balloon.style.transition = ''; // 恢复由 CSS 类控制的 transition-opacity 效果
      balloon.style.opacity = '0';
      balloon.style.pointerEvents = 'none';
      
      // 在淡出动画结束后（200ms），将气泡设为 invisible，防止透明但占据渲染图层导致的其他问题
      setTimeout(() => {
        if (!isHovered) {
          balloon.style.visibility = 'hidden';
        }
      }, 200);
    };

    // manual-touch：将触屏交互交由外部控制（如热力图的长按拖动浏览）。
    // 触屏设备上点按会派发合成 mouse 事件，若仍绑定 mouseenter 会导致多个气泡卡住不消失，
    // 故在「无 hover 能力」的触屏设备上连同 mouse 事件一并跳过，仅保留桌面端 hover。
    const manualTouch = this.hasAttribute('manual-touch');
    const hoverCapable =
      typeof window.matchMedia === 'function' ? window.matchMedia('(hover: hover)').matches : true;

    if (!(manualTouch && !hoverCapable)) {
      wrapper.addEventListener('mouseenter', adjustPosition);
      wrapper.addEventListener('mouseleave', resetPosition);
    }
    if (!manualTouch) {
      wrapper.addEventListener('touchstart', adjustPosition, { passive: true });
    }
  }
}

customElements.define('uem-tooltip', UemTooltip);
