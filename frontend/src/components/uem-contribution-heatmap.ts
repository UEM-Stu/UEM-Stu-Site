/**
 * <uem-contribution-heatmap> 组织贡献热力图组件 (年度弹窗版 - 像素级美化)
 * 
 * 渲染一个原生的 HTML5 <dialog> 弹窗，其中包含完整自然年（53周）的组织活跃热力图。
 * 像素级还原 GitHub 官方热力图配色（0-4级亮暗色阶）与紧凑画幅（10px 方块，2px 间距）。
 * 未来的日子显示为 0 级格但不可交互，跨年补位格透明，使格网整齐划一。
 */
import './uem-tooltip';
import { UemFloat } from './uem-float';

interface MetricData {
  additions: number;
  deletions: number;
  lines_changed: number;
  commits?: number;
}

interface RepoData {
  name: string;
  additions: number;
  deletions: number;
  metrics?: MetricData;
}

interface DayStats {
  date: string;
  total_additions: number;
  total_deletions: number;
  metrics?: MetricData;
  repos: RepoData[];
}

export class UemContributionHeatmap extends HTMLElement {
  private _historyData: DayStats[] = [];
  private _dataLoaded: boolean = false;

  // 移动端长按拖动浏览（单一共享 tooltip 跟随手指在格子间切换）
  private _touchTip: HTMLDivElement | null = null;
  private _touchTipArrow: HTMLDivElement | null = null;
  private _touchTipBody: HTMLDivElement | null = null;
  private _touchScrubReady = false;

  connectedCallback(): void {
    this.renderBaseStructure();
    this.fetchStats();
  }

  /**
   * 异步抓取历史统计数据 stats.json
   */
  private async fetchStats(): Promise<void> {
    try {
      const response = await fetch('https://cdn.jsdelivr.net/gh/UEM-Stu/UEM-Stu-Site@stats-data/stats.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Data format error: expected an array');
      }
      this._historyData = data;
      this._dataLoaded = true;
    } catch (e) {
      console.error('加载组织活跃度统计失败:', e);
    }
  }

  /**
   * 渲染弹窗底层结构，使用 uem-float 统一弹窗组件
   * 弹窗最大宽度设为 max-w-3xl (768px)，搭配 20px 格网在大屏下可不发生滚动完整铺满
   */
  private renderBaseStructure(): void {
    this.innerHTML = `
      <uem-float title="组织活跃热力图" subtitle="Org Contribution Heatmap" max-width="max-w-3xl">

        <!-- 控制栏（包含统计口径与时间范围说明） -->
        <div class="w-full flex items-center justify-between mb-5 select-none text-xs">
          <span class="text-[11px] text-on-surface-variant/60 font-medium">统计口径：开源仓库代码变更行数 (+/-)</span>
          <span id="current-year-display" class="font-mono text-on-surface-variant/60 text-[11px]">数据范围：2025-05-01 至 今日</span>
        </div>

        <!-- 滚动热力图区：移除 pl padding，将其分配到 sticky Y 轴以保证滚动时完美剪裁遮挡 -->
        <div class="w-full relative overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-outline-variant/30 scrollbar-track-transparent mb-6 border border-outline-variant/20 dark:border-[#2f3336] rounded-xl py-4 pr-4 pl-0 bg-surface-container-low/20">

          <div class="flex items-start w-max">
            <!-- 左侧冻结列：sticky left-0，实色背景遮挡水平滚动进入的元素 -->
            <div class="sticky left-0 z-20 bg-[#f5f6f8] dark:bg-[#151718] pl-4 pr-1.5 flex flex-col flex-shrink-0 select-none">
              <div class="h-[24px]"></div>
              <div class="flex flex-col gap-[2px] text-[9px] text-on-surface-variant/50 font-mono text-right w-8">
                <div class="h-[20px] flex items-center justify-end"></div>
                <div class="h-[20px] flex items-center justify-end">周一</div>
                <div class="h-[20px] flex items-center justify-end"></div>
                <div class="h-[20px] flex items-center justify-end">周三</div>
                <div class="h-[20px] flex items-center justify-end"></div>
                <div class="h-[20px] flex items-center justify-end">周五</div>
                <div class="h-[20px] flex items-center justify-end"></div>
              </div>
            </div>

            <!-- 右侧滚动内容区 -->
            <div class="flex flex-col flex-shrink-0">
              <div id="dialog-heatmap-months" class="relative h-4 mb-1"></div>
              <div id="dialog-heatmap-grid" class="flex gap-[2px] pt-1"></div>
            </div>
          </div>

        </div>

        <!-- 底部数据简报 -->
        <div class="w-full bg-surface-container-low/50 rounded-xl p-4 mb-5 text-[11px] text-on-surface-variant leading-relaxed select-none">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="flex justify-between sm:flex-col sm:justify-start gap-1 pb-2 sm:pb-0 border-b sm:border-b-0 sm:border-r border-outline-variant/10">
              <span class="text-on-surface-variant/70">累计代码变更：</span>
              <strong id="year-total-lines" class="text-primary font-mono text-sm sm:mt-1">-- 行</strong>
            </div>
            <div class="flex justify-between sm:flex-col sm:justify-start gap-1 pb-2 sm:pb-0 border-b sm:border-b-0 sm:border-r border-outline-variant/10">
              <span class="text-on-surface-variant/70">活跃开发天数：</span>
              <strong id="year-active-days" class="text-on-surface font-mono text-sm sm:mt-1">-- 天</strong>
            </div>
            <div class="flex justify-between sm:flex-col sm:justify-start gap-1">
              <span class="text-on-surface-variant/70">单日最高变更：</span>
              <strong id="year-max-lines" class="text-on-surface font-mono text-sm sm:mt-1">-- 行</strong>
            </div>
          </div>
        </div>

        <!-- 底部图例 -->
        <div class="w-full flex justify-end items-center gap-1.5 text-[10px] text-on-surface-variant/70 font-mono select-none">
          <span>少</span>
          <div class="flex gap-[2px]">
            <div class="w-[20px] h-[20px] rounded-[2px] bg-[#ebedf0] dark:bg-[#161b22]"></div>
            <div class="w-[20px] h-[20px] rounded-[2px] bg-[#9be9a8] dark:bg-[#0e4429]"></div>
            <div class="w-[20px] h-[20px] rounded-[2px] bg-[#40c463] dark:bg-[#006d32]"></div>
            <div class="w-[20px] h-[20px] rounded-[2px] bg-[#30a14e] dark:bg-[#26a641]"></div>
            <div class="w-[20px] h-[20px] rounded-[2px] bg-[#216e39] dark:bg-[#39d353]"></div>
          </div>
          <span>多</span>
        </div>

      </uem-float>
    `;
  }

  /**
   * 打开弹窗并渲染热力图
   */
  public open(): void {
    const floatEl = this.querySelector<UemFloat>('uem-float');
    if (!floatEl) return;
    floatEl.showModal();
    this.renderHeatmap();
    this.setupTouchScrub();
    this.scrollToLatest();
  }

  /**
   * 关闭弹窗
   */
  public close(): void {
    const floatEl = this.querySelector<UemFloat>('uem-float');
    floatEl?.close();
  }

  /**
   * 生成单个格子 tooltip 的内容 HTML（桌面端 uem-tooltip 与移动端长按浮窗共用）
   */
  private cellTooltipHTML(dateStr: string): string {
    const { val, additions, deletions, commits, commitsTracked, dateTracked } = this.getDayVal(dateStr);
    const formattedVal = val.toLocaleString();
    // 提交次数：数据源中有 commits 字段则显示数值，否则为未统计
    const commitsDisplay = commitsTracked
      ? `<strong>${commits}</strong> 次`
      : `<span style="opacity:0.45;font-style:italic;">未统计</span>`;
    // 代码变更：该天存在于数据源即显示真实值（哪怕为 0），否则未统计
    const codeDisplay = dateTracked
      ? `<strong>${formattedVal}</strong> 行${val > 0 ? ` (新增 +${additions.toLocaleString()} / 删除 -${deletions.toLocaleString()})` : ''}`
      : `<span style="opacity:0.45;font-style:italic;">未统计</span>`;
    const detailText = `提交次数：${commitsDisplay}<br/>变更代码：${codeDisplay}`;
    return (
      `<span class="block font-bold text-on-surface mb-1.5 font-mono text-[11px]">${dateStr}</span>` +
      `<span class="block text-on-surface-variant/90 text-[11px] leading-relaxed">${detailText}</span>`
    );
  }

  /**
   * 移动端长按拖动浏览：在热力图网格上长按唤起 tooltip，手指上下左右滑动即切换显示不同格子。
   * 桌面端（具备 hover）不受影响，仍用 uem-tooltip 悬停显示。
   */
  private setupTouchScrub(): void {
    if (this._touchScrubReady) return;
    const grid = this.querySelector<HTMLElement>('#dialog-heatmap-grid');
    if (!grid) return;
    this._touchScrubReady = true;

    const LONG_PRESS_MS = 320; // 长按触发阈值
    const MOVE_CANCEL_PX = 12; // 触发前移动超过此距离视为滚动，取消长按
    const SYNTH_WINDOW_MS = 500; // 合成 mouse 事件抑制窗口（触屏点按后浏览器通常在 300ms 内派发合成 mouse 事件）
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let scrubbing = false;
    let startX = 0;
    let startY = 0;
    let activeCell: Element | null = null;

    const clearPress = () => {
      if (pressTimer !== null) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    // 命中测试：手指坐标下的格子（tooltip 自身 pointer-events:none，不会遮挡命中）
    const cellAt = (x: number, y: number): HTMLElement | null => {
      const el = document.elementFromPoint(x, y);
      const cell = el?.closest('[data-date]') as HTMLElement | null;
      return cell && grid.contains(cell) ? cell : null;
    };

    // 切换到新格子才更新；命中空隙（返回 null）时保持当前不闪烁
    const showFor = (cell: HTMLElement | null) => {
      if (!cell || cell === activeCell) return;
      activeCell = cell;
      this.showTouchTip(cell);
    };

    grid.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        scrubbing = false;
        activeCell = null;
        clearPress();
        pressTimer = setTimeout(() => {
          scrubbing = true;
          pressTimer = null;
          if (navigator.vibrate) navigator.vibrate(10); // 轻微震动反馈（iOS 不支持时静默）
          showFor(cellAt(startX, startY));
        }, LONG_PRESS_MS);
      },
      { passive: true }
    );

    grid.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        const t = e.touches[0];
        if (!t) return;
        if (!scrubbing) {
          // 长按尚未触发：移动过大说明用户在滚动，取消长按
          if (Math.hypot(t.clientX - startX, t.clientY - startY) > MOVE_CANCEL_PX) clearPress();
          return;
        }
        // 已进入浏览模式：锁定滚动，tooltip 跟随手指切换格子
        e.preventDefault();
        showFor(cellAt(t.clientX, t.clientY));
      },
      { passive: false }
    );

    const end = () => {
      clearPress();
      if (scrubbing) {
        scrubbing = false;
        activeCell = null;
        this.hideTouchTip();
      }
    };
    grid.addEventListener('touchend', end);
    grid.addEventListener('touchcancel', end);

    // —— 阻止触屏点击后的合成 mouseenter 触发 uem-tooltip ——
    // mouseenter 不冒泡也不参与捕获阶段传播，无法在 grid 层面直接拦截子元素
    // 的 mouseenter 事件。因此改用 CSS pointer-events 方案：触屏操作后给 grid
    // 添加 [data-touch-suppress] 属性，该属性通过 CSS 使内部所有 uem-tooltip
    // 的 wrapper 的 pointer-events 变为 none，合成 mouse 事件到达时 wrapper
    // 不响应，mouseenter 不会触发。500ms 后自动移除属性恢复桌面端 hover。
    let suppressTimer: ReturnType<typeof setTimeout> | null = null;
    const suppressHover = () => {
      grid.setAttribute('data-touch-suppress', '');
      if (suppressTimer) clearTimeout(suppressTimer);
      suppressTimer = setTimeout(() => {
        grid.removeAttribute('data-touch-suppress');
        suppressTimer = null;
      }, SYNTH_WINDOW_MS);
    };

    // 注入抑制样式（仅一次，挂在 document.head 上）
    if (!document.getElementById('heatmap-touch-suppress-style')) {
      const style = document.createElement('style');
      style.id = 'heatmap-touch-suppress-style';
      // 当 grid 带有 data-touch-suppress 属性时，内部 uem-tooltip 的
      // group/tooltip 包裹 div 的 pointer-events 设为 none，阻止合成
      // mouseenter 触发 tooltip 显示。格子本身的 pointer-events 不受
      // 影响，长按拖动的 touchstart/touchmove 仍然正常命中。
      style.textContent = `
        [data-touch-suppress] uem-tooltip > .group\\/tooltip {
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    // 在现有的 touchstart/touchmove/touchend 回调中追加 suppressHover 调用
    grid.addEventListener('touchstart', suppressHover, { capture: true, passive: true });
    grid.addEventListener('touchend', suppressHover, { capture: true, passive: true });
  }

  /**
   * 懒创建共享 tooltip 节点（挂在弹窗 dialog 内，确保渲染在 modal 顶层之上）
   */
  private ensureTouchTip(): HTMLDivElement {
    if (this._touchTip) return this._touchTip;

    const tip = document.createElement('div');
    tip.className =
      'fixed p-3 bg-white dark:bg-[#1e2124] text-on-surface border border-outline-variant/30 dark:border-[#2f3336] rounded-xl shadow-lg invisible opacity-0 pointer-events-none transition-opacity duration-150 z-50 text-left text-xs whitespace-normal font-sans normal-case';
    tip.style.minWidth = '180px';
    tip.style.maxWidth = 'calc(100vw - 24px)';

    const arrow = document.createElement('div');
    arrow.className =
      'absolute top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white dark:border-t-[#1e2124]';
    tip.appendChild(arrow);

    const body = document.createElement('div');
    body.className = 'p-0.5 select-none';
    tip.appendChild(body);

    const dialog = this.querySelector('uem-float dialog') || this;
    dialog.appendChild(tip);

    this._touchTip = tip;
    this._touchTipArrow = arrow;
    this._touchTipBody = body;
    return tip;
  }

  /**
   * 将共享 tooltip 定位到目标格子上方并填充内容（复用桌面端同款内容与避让逻辑）
   */
  private showTouchTip(cell: HTMLElement): void {
    const dateStr = cell.getAttribute('data-date');
    if (!dateStr) return;

    const tip = this.ensureTouchTip();
    this._touchTipBody!.innerHTML = this.cellTooltipHTML(dateStr);

    // 先隐形移出屏幕以测量固有宽高
    tip.style.visibility = 'hidden';
    tip.style.left = '-9999px';
    tip.style.top = '-9999px';

    const cellRect = cell.getBoundingClientRect();
    const r = tip.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;

    // 水平居中于格子，并保留左右 12px 视口间隙
    const idealLeft = cellRect.left + (cellRect.width - r.width) / 2;
    let left = Math.max(12, idealLeft);
    if (left + r.width > vw - 12) left = vw - 12 - r.width;
    const top = cellRect.top - r.height - 8;

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;

    // 箭头对准格子中心，限制不超出气泡圆角
    const center = cellRect.left + cellRect.width / 2;
    const arrowX = Math.max(16, Math.min(r.width - 16, center - left));
    this._touchTipArrow!.style.left = `${arrowX}px`;
    this._touchTipArrow!.style.transform = 'translateX(-50%)';

    tip.style.visibility = 'visible';
    tip.style.opacity = '1';
  }

  private hideTouchTip(): void {
    if (!this._touchTip) return;
    this._touchTip.style.opacity = '0';
    this._touchTip.style.visibility = 'hidden';
  }

  /**
   * 将滚动条自动滑到最右侧（最新提交日期处）
   */
  private scrollToLatest(): void {
    setTimeout(() => {
      const scrollContainer = this.querySelector('.overflow-x-auto');
      if (scrollContainer) {
        scrollContainer.scrollLeft = scrollContainer.scrollWidth;
      }
    }, 50);
  }

  /**
   * 获取某一日期的代码变更行数
   */
  private getDayVal(dateStr: string): { val: number; additions: number; deletions: number; commits: number; commitsTracked: boolean; dateTracked: boolean; score: number } {
    const day = this._historyData.find((d) => d.date === dateStr);
    if (!day) {
      // 数据源中没有该天的记录，完全未统计
      return { val: 0, additions: 0, deletions: 0, commits: 0, commitsTracked: false, dateTracked: false, score: 0 };
    }

    const additions = day.metrics?.additions ?? day.total_additions ?? 0;
    const deletions = day.metrics?.deletions ?? day.total_deletions ?? 0;
    // 变更行数 = 增加数 + 删除数绝对值
    const val = day.metrics?.lines_changed ?? (additions + deletions);
    
    // 获取提交次数，并判断数据源中是否真实记录了 commits 字段
    // 注意：数据存在但值为 0 是有效数据（该天没有活动），不等于未统计
    let commits = 0;
    let commitsTracked = false;

    if (typeof day.metrics?.commits === 'number') {
      // metrics 层有明确的 commits 字段，即使值为 0 也算已统计
      commits = day.metrics.commits;
      commitsTracked = true;
    } else if (day.repos) {
      // 尝试从各 repo.metrics.commits 汇总，只要有一个 repo 有该字段即视为已统计
      const anyRepoTracked = day.repos.some((repo) => typeof repo.metrics?.commits === 'number');
      if (anyRepoTracked) {
        commits = day.repos.reduce((acc, repo) => acc + (repo.metrics?.commits ?? 0), 0);
        commitsTracked = true;
      }
      // 若 repos 存在但没有任何 commits 字段，保持 commitsTracked = false（该字段在此数据批次中未统计）
    }

    // 对数平滑加权得分算法（后台默默评估着色）
    const score = commits * 20 + Math.log2(val + 1) * 10;

    return { val, additions, deletions, commits, commitsTracked, dateTracked: true, score };
  }

  /**
   * 计算指定年份数据的分位数阈值
   */
  private calculateYearQuantiles(validDates: string[]): { q25: number; q50: number; q75: number } {
    const nonZeroValues: number[] = [];
    validDates.forEach((dateStr) => {
      const { score } = this.getDayVal(dateStr);
      if (score > 0) {
        nonZeroValues.push(score);
      }
    });

    if (nonZeroValues.length === 0) {
      return { q25: 1, q50: 2, q75: 3 };
    }

    nonZeroValues.sort((a, b) => a - b);
    
    const getPercentile = (p: number) => {
      const idx = Math.floor(nonZeroValues.length * p);
      return nonZeroValues[Math.min(idx, nonZeroValues.length - 1)];
    };

    return {
      q25: getPercentile(0.25),
      q50: getPercentile(0.50),
      q75: getPercentile(0.75)
    };
  }

  /**
   * 渲染年度热力图
   */
  /**
   * 渲染热力图（2025-05-01 至今的长滚动无翻页网格）
   */
  private renderHeatmap(): void {
    if (!this._dataLoaded) {
      const gridContainer = this.querySelector('#dialog-heatmap-grid');
      if (gridContainer) {
        gridContainer.innerHTML = `<span class="text-xs text-on-surface-variant/70 py-6">正在加载活跃度数据...</span>`;
      }
      return;
    }

    // 1. 获取北京时间 (UTC+8) 的今天日期
    const bjOffset = 8 * 60 * 60 * 1000;
    const now = new Date();
    const today = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + bjOffset);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 2. 确定时间范围的起止日期：从固定的 2025-05-01 开始，截止到今天所在的星期六
    const startDate = new Date(2025, 4, 1); // 5月1日
    const endDate = today;
    
    const startDayOfWeek = startDate.getDay(); // 0(周日) - 6(周六)
    const gridStartDate = new Date(startDate.getTime() - startDayOfWeek * 24 * 60 * 60 * 1000);
    
    const endDayOfWeek = endDate.getDay();
    const gridEndDate = new Date(endDate.getTime() + (6 - endDayOfWeek) * 24 * 60 * 60 * 1000);

    // 时区安全地生成指定日期区间内的连续天数数组，避免夏令时漂移导致的日期重复与缺失
    const dates: string[] = [];
    let current = new Date(gridStartDate);
    while (current <= gridEndDate) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }

    const totalDays = dates.length;
    const weeksCount = totalDays / 7;

    // 3. 统计 2025-05-01 至今 Rarer（处于 2025-05-01 与今天之间）的有效数据
    const startDateStr = '2025-05-01';
    const validDates = dates.filter((dateStr) => {
      return dateStr >= startDateStr && dateStr <= todayStr;
    });

    let totalYearLines = 0;
    let totalYearCommits = 0;
    let activeDays = 0;
    let maxLines = 0;
    let maxLinesDate = '';

    validDates.forEach((dateStr) => {
      const { val, commits } = this.getDayVal(dateStr);
      if (val > 0 || commits > 0) {
        totalYearLines += val;
        totalYearCommits += commits;
        activeDays++;
        if (val > maxLines) {
          maxLines = val;
          maxLinesDate = dateStr;
        }
      }
    });

    const quantiles = this.calculateYearQuantiles(validDates);

    // 4. 重组为 7 行 × weeksCount 列矩阵
    const columns: string[][] = [];
    for (let col = 0; col < weeksCount; col++) {
      const columnDates: string[] = [];
      for (let row = 0; row < 7; row++) {
        columnDates.push(dates[col * 7 + row]);
      }
      columns.push(columnDates);
    }

    // 5. 生成月份定位行 (根据方块 14px 和间距 2px 做精确水平定位)
    let monthLabelsHtml = '';
    let lastMonthColIdx = -10;
    let lastMonth = '';
    columns.forEach((colDates, colIdx) => {
      const midDay = new Date(colDates[3]);
      const monthName = `${midDay.getMonth() + 1}月`;
      
      if (monthName !== lastMonth) {
        // 限制间距在 3 列以上才渲染，避免相邻月份发生错乱重合
        if (colIdx - lastMonthColIdx >= 3 && colIdx < weeksCount - 1) {
          monthLabelsHtml += `<div class="absolute text-[10px] text-on-surface-variant/50 font-mono select-none whitespace-nowrap" style="left: calc(${colIdx} * (20px + 2px));">${monthName}</div>`;
          lastMonth = monthName;
          lastMonthColIdx = colIdx;
        }
      }
    });

    // 6. 生成日历格子网格
    let gridHtml = '';
    columns.forEach((colDates) => {
      let colCellsHtml = '';
      colDates.forEach((dateStr) => {
        const isFuture = dateStr > todayStr;
        const isBeforeStart = dateStr < '2025-05-01';
        
        if (isBeforeStart || isFuture) {
          // 超出统计时间范围的日期（前推补齐或今天以后的本周未来的剩余格子）：渲染为完全透明占位符，保证最后一列对齐且今天为最后一格
          colCellsHtml += `
            <div class="w-[20px] h-[20px] relative flex-shrink-0">
              <div class="w-[20px] h-[20px] rounded-[2px] bg-transparent pointer-events-none"></div>
            </div>
          `;
        } else {
          // 已经发生的日期，读取活跃度并分档着色
          const { score } = this.getDayVal(dateStr);
          
          let level = 0;
          if (score > 0) {
            if (score <= quantiles.q25) level = 1;
            else if (score <= quantiles.q50) level = 2;
            else if (score <= quantiles.q75) level = 3;
            else level = 4;
          }

          // 像素级还原 GitHub 绿阶配色
          const bgClasses = [
            'bg-[#ebedf0] dark:bg-[#161b22] hover:scale-125 hover:z-10',
            'bg-[#9be9a8] dark:bg-[#0e4429] hover:scale-125 hover:z-10',
            'bg-[#40c463] dark:bg-[#006d32] hover:scale-125 hover:z-10',
            'bg-[#30a14e] dark:bg-[#26a641] hover:scale-125 hover:z-10',
            'bg-[#216e39] dark:bg-[#39d353] hover:scale-125 hover:z-10'
          ];

          // manual-touch：桌面端保留 hover 气泡；移动端禁用内置触摸，改由下方长按拖动控制器统一驱动
          colCellsHtml += `
            <div class="w-[20px] h-[20px] relative flex-shrink-0 flex items-center justify-center">
              <uem-tooltip manual-touch style="display: flex; width: 20px; height: 20px; align-items: center; justify-content: center;">
                <div
                  class="w-[20px] h-[20px] rounded-[2px] ${bgClasses[level]} cursor-pointer transition-all duration-200"
                  data-date="${dateStr}"
                ></div>
                <div slot="content" class="min-w-[180px] p-0.5 select-none">
                  ${this.cellTooltipHTML(dateStr)}
                </div>
              </uem-tooltip>
            </div>
          `;
        }
      });
      gridHtml += `<div class="flex flex-col gap-[2px]">${colCellsHtml}</div>`;
    });

    // 7. 更新 DOM 渲染与定位
    const monthsContainer = this.querySelector('#dialog-heatmap-months');
    if (monthsContainer) {
      monthsContainer.innerHTML = monthLabelsHtml;
    }

    const gridContainer = this.querySelector('#dialog-heatmap-grid');
    if (gridContainer) {
      gridContainer.innerHTML = gridHtml;
    }

    // 8. 更新底部简报数据
    const totalLinesEl = this.querySelector('#year-total-lines');
    if (totalLinesEl) {
      totalLinesEl.textContent = `${totalYearLines.toLocaleString()} 行`;
    }

    const totalCommitsEl = this.querySelector('#year-total-commits');
    if (totalCommitsEl) {
      totalCommitsEl.textContent = `${totalYearCommits.toLocaleString()} 次`;
    }

    const activeDaysEl = this.querySelector('#year-active-days');
    if (activeDaysEl) {
      activeDaysEl.textContent = `${activeDays} 天`;
    }

    const maxLinesEl = this.querySelector('#year-max-lines');
    if (maxLinesEl) {
      maxLinesEl.textContent = `${maxLines.toLocaleString()} 行${maxLinesDate ? ` (${maxLinesDate})` : ''}`;
    }
  }
}

customElements.define('uem-contribution-heatmap', UemContributionHeatmap);
