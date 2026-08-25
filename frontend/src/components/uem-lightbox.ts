/**
 * <uem-lightbox> 全局图片查看器（单例）
 *
 * 点击放大任意图片，支持：
 *  - 双指捏合缩放（聚焦两指中点）
 *  - 单指拖动平移（缩放后）
 *  - 双击放大 / 还原
 *  - 桌面端滚轮、触控板捏合缩放
 *
 * 基于原生 <dialog> 顶层（top layer）渲染，可覆盖其它 <dialog> 弹窗（如校历浮窗）。
 *
 * 用法：
 *   import { openLightbox } from './uem-lightbox';
 *   openLightbox(img.src, img.alt);
 */

const STYLE_ID = 'uem-lightbox-styles';

function ensureStyles(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .uem-lightbox-dialog {
        padding: 0;
        margin: 0;
        border: none;
        background: transparent;
        width: 100vw;
        height: 100dvh;
        max-width: 100vw;
        max-height: 100dvh;
        overflow: hidden;
        opacity: 0;
        /* 关闭时用较快的淡出 */
        transition: opacity 0.15s ease-in, overlay 0.3s allow-discrete, display 0.3s allow-discrete;
      }
      .uem-lightbox-dialog[open] {
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 1;
        /* 开启时用柔和的 spring 曲线 */
        transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), overlay 0.3s allow-discrete, display 0.3s allow-discrete;
      }
      @starting-style {
        .uem-lightbox-dialog[open] { opacity: 0; }
      }
      .uem-lightbox-dialog::backdrop {
        background: rgba(0, 0, 0, 0.78);
        -webkit-backdrop-filter: blur(8px);
        backdrop-filter: blur(8px);
        opacity: 0;
        transition: opacity 0.15s ease-in, overlay 0.3s allow-discrete, display 0.3s allow-discrete;
      }
      .uem-lightbox-dialog[open]::backdrop {
        opacity: 1;
        transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), overlay 0.3s allow-discrete, display 0.3s allow-discrete;
      }
      @starting-style {
        .uem-lightbox-dialog[open]::backdrop { opacity: 0; }
      }
      .uem-lightbox-img-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        transform: scale(0.88);
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .uem-lightbox-dialog[open] .uem-lightbox-img-wrap {
        transform: scale(1);
      }
      @starting-style {
        .uem-lightbox-dialog[open] .uem-lightbox-img-wrap { transform: scale(0.88); }
      }
      .uem-lightbox-img {
        max-width: 92vw;
        max-height: 92dvh;
        width: auto;
        height: auto;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 8px 40px rgba(0, 0, 0, 0.45);
        touch-action: none;
        -webkit-user-select: none;
        user-select: none;
        -webkit-user-drag: none;
        will-change: transform;
        cursor: default;
      }
      .uem-lightbox-close {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.15);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease;
        z-index: 1;
      }
      .uem-lightbox-close:hover { background: rgba(255, 255, 255, 0.3); }
    `;
    document.head.appendChild(style);
}

export class UemLightbox extends HTMLElement {
    private _open: (src: string, alt: string) => void = () => {};
    private _close: () => void = () => {};

    connectedCallback(): void {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        ensureStyles();
        this._build();
    }

    open(src: string, alt = ''): void {
        this._open(src, alt);
    }

    close(): void {
        this._close();
    }

    private _build(): void {
        // 宿主元素不占据布局，由内部 dialog 接管顶层渲染
        this.style.display = 'contents';

        const dialog = document.createElement('dialog');
        dialog.className = 'uem-lightbox-dialog';
        dialog.dataset.uem = '1';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'uem-lightbox-close';
        closeBtn.setAttribute('aria-label', '关闭图片预览');
        closeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:28px;">close</span>';

        const imgWrap = document.createElement('div');
        imgWrap.className = 'uem-lightbox-img-wrap';

        const img = document.createElement('img');
        img.className = 'uem-lightbox-img';
        img.alt = '';

        imgWrap.appendChild(img);
        dialog.appendChild(closeBtn);
        dialog.appendChild(imgWrap);
        this.appendChild(dialog);

        // ── 缩放 / 拖动状态 ──
        const MAX_SCALE = 5;
        let scale = 1, tx = 0, ty = 0;
        let mode: 'none' | 'pan' | 'pinch' = 'none';
        let prevDist = 0, prevMidX = 0, prevMidY = 0, prevX = 0, prevY = 0;
        let startX = 0, startY = 0, moved = false;
        let lastTapTime = 0, lastTapX = 0, lastTapY = 0;
        let prevBodyOverflow = '';
        let prevHtmlOverflow = '';

        const applyTransform = (animate = false) => {
            img.style.transition = animate ? 'transform 0.25s ease' : 'none';
            img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
        };

        // 限制拖动范围，避免把图片完全拖出视口
        const clampPan = () => {
            const maxX = Math.max(0, (img.clientWidth * scale - window.innerWidth) / 2);
            const maxY = Math.max(0, (img.clientHeight * scale - window.innerHeight) / 2);
            tx = Math.min(maxX, Math.max(-maxX, tx));
            ty = Math.min(maxY, Math.max(-maxY, ty));
        };

        const resetZoom = () => {
            scale = 1; tx = 0; ty = 0; mode = 'none';
            img.style.transition = '';
            img.style.transform = '';
        };

        // 以焦点（双指中点 / 双击点 / 指针）为中心缩放。图片始终居中于视口，
        // 故视口中心 = 图片变换原点，可用该公式保持焦点位置不变。
        const zoomTo = (fx: number, fy: number, next: number, animate = false) => {
            const target = Math.min(MAX_SCALE, Math.max(1, next));
            const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
            const ratio = target / scale;
            tx = (fx - cx) * (1 - ratio) + ratio * tx;
            ty = (fy - cy) * (1 - ratio) + ratio * ty;
            scale = target;
            if (scale <= 1.001) { scale = 1; tx = 0; ty = 0; }
            clampPan();
            applyTransform(animate);
        };

        this._open = (src, alt) => {
            img.src = src;
            img.alt = alt || '';
            resetZoom();
            if (!dialog.open) {
                // 记录并锁定背景滚动；关闭时恢复原值，避免与下层弹窗的锁定冲突
                prevBodyOverflow = document.body.style.overflow;
                prevHtmlOverflow = document.documentElement.style.overflow;
                document.body.style.overflow = 'hidden';
                document.documentElement.style.overflow = 'hidden';
                dialog.showModal();
            }
        };

        this._close = () => {
            if (dialog.open) dialog.close();
        };

        // close 事件覆盖关闭按钮、遮罩点击与 ESC（原生 dialog 自带 ESC）
        dialog.addEventListener('close', () => {
            document.body.style.overflow = prevBodyOverflow;
            document.documentElement.style.overflow = prevHtmlOverflow;
            resetZoom();
        });

        closeBtn.addEventListener('click', () => this._close());

        // 点击图片之外的遮罩区域关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) this._close();
        });

        // ── 触摸手势：双指捏合缩放 + 单指拖动 + 双击放大/还原 ──
        img.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                mode = 'pinch';
                moved = true;
                const a = e.touches[0], b = e.touches[1];
                prevDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
                prevMidX = (a.clientX + b.clientX) / 2;
                prevMidY = (a.clientY + b.clientY) / 2;
                e.preventDefault();
            } else if (e.touches.length === 1) {
                const t = e.touches[0];
                startX = prevX = t.clientX;
                startY = prevY = t.clientY;
                moved = false;
                mode = scale > 1 ? 'pan' : 'none';
            }
        }, { passive: false });

        img.addEventListener('touchmove', (e) => {
            if (mode === 'pinch' && e.touches.length >= 2) {
                const a = e.touches[0], b = e.touches[1];
                const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
                const midX = (a.clientX + b.clientX) / 2;
                const midY = (a.clientY + b.clientY) / 2;
                // 双指整体平移
                tx += midX - prevMidX;
                ty += midY - prevMidY;
                // 以中点为焦点缩放
                const next = Math.min(MAX_SCALE, Math.max(1, scale * dist / prevDist));
                const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
                const ratio = next / scale;
                tx = (midX - cx) * (1 - ratio) + ratio * tx;
                ty = (midY - cy) * (1 - ratio) + ratio * ty;
                scale = next;
                prevDist = dist; prevMidX = midX; prevMidY = midY;
                clampPan();
                applyTransform(false);
                e.preventDefault();
            } else if (mode === 'pan' && e.touches.length === 1) {
                const t = e.touches[0];
                tx += t.clientX - prevX;
                ty += t.clientY - prevY;
                prevX = t.clientX; prevY = t.clientY;
                if (Math.abs(t.clientX - startX) > 6 || Math.abs(t.clientY - startY) > 6) moved = true;
                clampPan();
                applyTransform(false);
                e.preventDefault();
            }
        }, { passive: false });

        img.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                const wasPinch = mode === 'pinch';
                mode = 'none';
                // 双击放大 / 还原（仅在未拖动的单指轻点时判定）
                if (!wasPinch && !moved) {
                    const now = Date.now();
                    const t = e.changedTouches[0];
                    if (now - lastTapTime < 300 &&
                        Math.abs(t.clientX - lastTapX) < 30 &&
                        Math.abs(t.clientY - lastTapY) < 30) {
                        if (scale > 1) resetZoom();
                        else zoomTo(t.clientX, t.clientY, 2.5, true);
                        lastTapTime = 0;
                        return;
                    }
                    lastTapTime = now; lastTapX = t.clientX; lastTapY = t.clientY;
                }
                if (scale <= 1.001) resetZoom();
                else { clampPan(); applyTransform(true); }
            } else if (e.touches.length === 1) {
                // 由双指过渡到单指：切换为拖动
                const t = e.touches[0];
                startX = prevX = t.clientX;
                startY = prevY = t.clientY;
                mode = scale > 1 ? 'pan' : 'none';
            }
        }, { passive: false });

        // ── 桌面端：滚轮 / 触控板捏合缩放 ──
        img.addEventListener('wheel', (e) => {
            e.preventDefault();
            const factor = Math.exp(-e.deltaY * 0.0015);
            zoomTo(e.clientX, e.clientY, scale * factor, false);
        }, { passive: false });
    }
}

customElements.define('uem-lightbox', UemLightbox);

let _instance: UemLightbox | null = null;

/** 打开全局图片查看器（懒加载单例） */
export function openLightbox(src: string, alt = ''): void {
    if (!_instance || !_instance.isConnected) {
        _instance = document.createElement('uem-lightbox') as UemLightbox;
        document.body.appendChild(_instance);
    }
    _instance.open(src, alt);
}
