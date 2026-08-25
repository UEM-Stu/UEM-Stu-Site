/**
 * 应用入口
 * 导入全局样式并注册所有 Web Components
 */

// 全局样式
import './styles/global.css';

// Web Components（导入即自动注册）
import './components/uem-header';
import './components/uem-float';
import './components/uem-lightbox';
import './components/uem-tooltip';
import './components/uem-select';
import './components/uem-hero';
import './components/uem-services';
import './components/uem-projects';
import './components/uem-contribution-heatmap';
import './components/uem-activity-calendar';
import './components/uem-labs';
import './components/uem-blog';
import './components/uem-article';
import './components/uem-footer';
import './components/uem-easter-egg';

// 开发环境提示
if (import.meta.env.DEV) {
    console.log('[UEM-Stu] 所有 Web Components 已注册');
}

// 禁用移动端双指缩放和双击缩放
if (typeof window !== 'undefined') {
    // 阻止双指手势缩放
    document.addEventListener('gesturestart', (event) => {
        event.preventDefault();
    });

    // 阻止多点触控（双指及以上触控）的默认缩放行为
    document.addEventListener('touchstart', (event) => {
        if (event.touches.length > 1) {
            event.preventDefault();
        }
    }, { passive: false });

    // 阻止双击缩放
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, { passive: false });
}
