/**
 * <uem-activity-calendar> 校园活动日历组件
 *
 * 提供月 / 周 / 日三种视图浏览校园活动：
 * - 桌面默认月视图，移动端默认周视图
 * - 日期格子展示当天前若干个活动，超出显示"还有 N 个活动"
 * - 点击某天，在右侧（移动端为下方）以纵向时间轴展示当天全部活动
 * - 活动分类用不同颜色区分，密度越高的日期背景越深，今天高亮
 * - 支持按学院筛选（选中某学院只看该学院的学院级活动，可一键清除恢复全部）与分类筛选
 * - 支持导出 iCal(.ics)，可导入 Apple / Google / Outlook 日历
 */
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  CLUBS,
  COLLEGES,
  LEVEL_META,
  type Activity,
  type ActivityCategory,
} from '@/config/activity';
import { buildICS } from '@/config/activity-ics';
import { ACTIVITIES_ICS_WEBCAL, loadActivities } from '@/config/activity-data';
import { UemFloat } from './uem-float';
import { UemSelect } from './uem-select';

type ViewMode = 'month' | 'week' | 'day';
type DataState = 'loading' | 'ready' | 'error';

const STYLE_ID = 'uem-activity-calendar-styles';
const WEEKDAY_FULL = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAY_HEAD = ['一', '二', '三', '四', '五', '六', '日']; // 周一为起始
const MONTH_MAX_VISIBLE = 2;
const WEEK_MAX_VISIBLE = 4;

/* —— 纯日期工具（均按本地时间，不做时区偏移） —— */
const pad = (n: number): string => String(n).padStart(2, '0');
const ymd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s: string): Date => {
  const [y, m, dd] = s.split('-').map(Number);
  return new Date(y, m - 1, dd);
};
const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const addMonths = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};
/** 取所在周的周一 */
const startOfWeek = (d: Date): Date => {
  const x = new Date(d);
  const offset = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - offset);
  return x;
};

/**
 * HTML 转义。活动数据来自飞书多维表格（运行时 CDN 拉取），视为不可信输入，
 * 凡是要插进 innerHTML 的自由文本字段（标题/地点/主办方/简介）都先经此转义，防 XSS。
 */
const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** 密度分档背景（叠加在面板之上，浅/深色各一套） */
const DENSITY_BG = [
  '',
  'bg-primary/[0.04] dark:bg-primary-fixed-dim/[0.05]',
  'bg-primary/[0.07] dark:bg-primary-fixed-dim/[0.10]',
  'bg-primary/[0.11] dark:bg-primary-fixed-dim/[0.15]',
  'bg-primary/[0.16] dark:bg-primary-fixed-dim/[0.22]',
];
const densityLevel = (n: number): number => {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n <= 4) return 3;
  return 4;
};

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes eac-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    .eac-in { animation: eac-fade-up 0.42s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
    .eac-day { transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease; }
    .eac-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .eac-scroll::-webkit-scrollbar-thumb { background: rgba(116,119,130,0.30); border-radius: 9999px; }
    .eac-scroll::-webkit-scrollbar-track { background: transparent; }
  `;
  document.head.appendChild(style);
}

export class UemActivityCalendar extends HTMLElement {
  private view: ViewMode = 'month';
  private current: Date = new Date();
  private selected: string = ymd(new Date());
  /** 选中的学院（null 表示不筛选，展示全部活动） */
  private selectedCollege: string | null = null;
  /** 选中的社团（null 表示不筛选；与学院互斥，同时只生效一个） */
  private selectedClub: string | null = null;
  private active: Set<ActivityCategory> = new Set(CATEGORY_ORDER);
  private todayStr: string = ymd(new Date());

  /** 运行时拉取的活动数据与加载状态（数据/展示分离，内容不随主站构建发布） */
  private activities: Activity[] = [];
  private dataState: DataState = 'loading';

  connectedCallback(): void {
    ensureStyles();
    // 移动端默认周视图：仅在确实测得窄视口时切换。
    // 宽度为 0 通常是元素在布局完成前就已连接，应按桌面默认（月视图）处理，避免误判为移动端。
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    if (vw > 0 && vw <= 767) {
      this.view = 'week';
    }
    this.renderShell();
    this.bindEvents();
    void this.loadData();
  }

  /* —— 运行时数据加载 ——
   * loading → 骨架屏；error → 错误态 + 重试；ready → 正常渲染。
   * 失败绝不静默回退（错误态必须可见，区别于「加载成功但当天暂无活动」）。 */
  private async loadData(): Promise<void> {
    this.dataState = 'loading';
    this.renderAll();
    try {
      this.activities = await loadActivities();
      this.dataState = 'ready';
    } catch (e) {
      console.error('加载校园活动失败:', e);
      this.dataState = 'error';
    }
    this.renderAll();
  }

  /* —— 数据筛选 —— */
  private passesFilter(a: Activity): boolean {
    // 学院/社团互斥，同时最多一个生效
    if (this.selectedCollege) {
      if (a.level !== 'college') return false;
      if (!(a.organizer ?? '').includes(this.selectedCollege)) return false;
    }
    if (this.selectedClub) {
      if (a.category !== 'club') return false;
      if (!(a.organizer ?? '').includes(this.selectedClub)) return false;
    }
    if (!this.active.has(a.category)) return false;
    return true;
  }

  private activitiesOn(dateStr: string): Activity[] {
    return this.activities
      .filter((a) => a.date === dateStr && this.passesFilter(a))
      .sort((x, y) => x.start.localeCompare(y.start));
  }

  /* —— 静态外壳 —— */
  private renderShell(): void {
    // 订阅源走 jsDelivr CDN 上 stats-data 分支的 .ics（由飞书同步 Action 定时生成）。
    // webcal:// 在 Apple 设备上点击即唤起「日历」订阅；同一链接 Google / Outlook 亦可用。
    const webcalUrl = ACTIVITIES_ICS_WEBCAL;
    this.innerHTML = `
      <section class="py-12 md:py-20 px-margin-mobile md:px-margin-desktop relative" id="activity-container">
        <div class="absolute top-0 right-[8%] w-[480px] h-[480px] rounded-full bg-primary/5 dark:bg-primary-fixed-dim/5 blur-3xl pointer-events-none"></div>

        <div class="max-w-container-max mx-auto relative z-10">
          <!-- 标题区 -->
          <div class="mb-8 md:mb-10">
            <span class="text-xs md:text-sm font-bold tracking-wider text-primary/70 dark:text-primary-fixed-dim/70 uppercase mb-2 block font-mono">
              Campus Activities
            </span>
            <h2 class="font-headline-lg text-3xl md:text-5xl font-extrabold text-on-surface tracking-tight leading-none mb-3">
              校园活动
            </h2>
            <p class="text-sm md:text-base text-on-surface-variant/80 leading-relaxed max-w-2xl">
              篮球赛、讲座、社团例会、招聘会、志愿活动、考试……校园里每天都在发生精彩。按天、周、月查看活动安排，点击某天即可展开当日议程。
            </p>
          </div>

          <!-- 工具栏：时间导航 + 视图切换 + 订阅 -->
          <div class="flex flex-col gap-3 md:gap-4 mb-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-1.5 md:gap-2">
                <button id="nav-prev" aria-label="上一段" class="flex items-center justify-center w-9 h-9 rounded-full bg-surface-container-lowest border border-outline-variant/60 text-on-surface-variant hover:text-primary hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                  <span class="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <h3 id="period-title" class="font-headline-md text-lg md:text-2xl font-bold text-on-surface tracking-tight text-center px-1 whitespace-nowrap"></h3>
                <button id="nav-next" aria-label="下一段" class="flex items-center justify-center w-9 h-9 rounded-full bg-surface-container-lowest border border-outline-variant/60 text-on-surface-variant hover:text-primary hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                  <span class="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
                <button id="nav-today" class="hidden sm:inline-flex items-center gap-1 px-3 h-9 rounded-full bg-surface-container-lowest border border-outline-variant/60 text-xs font-semibold text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all cursor-pointer">
                  <span class="material-symbols-outlined text-[16px]">today</span>今天
                </button>
              </div>

              <div class="flex items-center gap-2">
                <div id="view-switch" class="flex rounded-full bg-[#e8eaed] dark:bg-[#25282a] p-1 border border-outline/10 select-none"></div>
                <button id="subscribe-btn" class="inline-flex items-center gap-1.5 px-3 md:px-4 h-9 rounded-full bg-primary text-on-primary dark:bg-primary-fixed dark:text-on-primary-fixed hover:shadow-md transition-all cursor-pointer text-xs font-bold">
                  <span class="material-symbols-outlined text-[18px]">calendar_add_on</span>
                  <span class="hidden sm:inline">订阅日历</span>
                </button>
              </div>
            </div>

            <!-- 筛选：学院 + 社团 + 分类图例 -->
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex flex-wrap items-center gap-2 min-w-0">
                <span class="text-[11px] font-semibold text-on-surface-variant/60 uppercase tracking-wider hidden md:inline shrink-0">学院</span>
                <uem-select id="college-select" placeholder="全部学院" clearable aria-label="按学院筛选活动"></uem-select>
                <span class="text-[11px] font-semibold text-on-surface-variant/60 uppercase tracking-wider hidden md:inline shrink-0 ml-1">社团</span>
                <uem-select id="club-select" placeholder="全部社团" clearable aria-label="按社团筛选活动"></uem-select>
              </div>
              <div id="legend" class="flex flex-wrap items-center gap-1.5"></div>
            </div>
          </div>

          <!-- 主体：日历 + 议程 -->
          <div id="cal-layout" class="grid grid-cols-1 gap-5 lg:gap-6 items-start">
            <div id="calendar-pane" class="min-w-0"></div>
            <aside id="agenda-pane" class="lg:sticky lg:top-24 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest/70 dark:bg-[#1b1d1e]/50 backdrop-blur-sm shadow-sm overflow-hidden"></aside>
          </div>
        </div>

        <!-- 订阅日历浮窗 -->
        <uem-float title="订阅校园活动日历" subtitle="Subscribe" max-width="max-w-lg">
          <div class="w-full flex flex-col gap-5 text-left">
            <p class="text-sm text-on-surface-variant/80 leading-relaxed">
              订阅后，校园活动会自动出现在你的日历 App 里，后续新增或调整也会自动同步，无需重复导入。
            </p>

            <!-- 订阅链接 + 复制 -->
            <div class="flex flex-col gap-1.5">
              <span class="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/55 font-mono">订阅链接</span>
              <div class="flex items-center gap-2 rounded-xl border border-outline-variant/60 bg-surface-container-lowest/80 dark:bg-[#1b1d1e]/60 p-1.5 pl-3">
                <span class="material-symbols-outlined text-[18px] text-primary/70 dark:text-primary-fixed-dim/70 shrink-0">link</span>
                <input id="sub-url" readonly value="${webcalUrl}" aria-label="订阅链接" class="flex-1 min-w-0 bg-transparent text-xs md:text-sm font-mono text-on-surface/85 outline-none truncate" />
                <button data-copy-sub type="button" class="shrink-0 inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-primary text-on-primary dark:bg-primary-fixed dark:text-on-primary-fixed text-xs font-bold hover:shadow-md transition-all cursor-pointer">
                  <span class="material-symbols-outlined text-[16px]">content_copy</span><span class="copy-label">复制</span>
                </button>
              </div>
            </div>

            <!-- 一键在 Apple 日历订阅 -->
            <a href="${webcalUrl}" class="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-primary text-on-primary dark:bg-primary-fixed dark:text-on-primary-fixed font-bold text-sm hover:shadow-lg transition-all cursor-pointer">
              <span class="material-symbols-outlined text-[20px]">event_available</span>
              在 Apple 日历中订阅
            </a>

            <!-- 手动订阅指引 -->
            <div class="rounded-xl border border-outline-variant/50 bg-surface-container-low/40 dark:bg-[#1b1d1e]/40 p-4 flex flex-col gap-3">
              <span class="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px] text-primary/70 dark:text-primary-fixed-dim/70">help</span>无法自动跳转？手动订阅
              </span>
              <div class="flex flex-col gap-2.5 text-[12px] text-on-surface-variant/80 leading-relaxed">
                <div><span class="font-semibold text-on-surface/85">Mac</span>：打开「日历」App → 顶部「文件」→「新建日历订阅」→ 粘贴上方链接 → 「订阅」。</div>
                <div><span class="font-semibold text-on-surface/85">iPhone / iPad</span>：「设置」→「日历」→「账户」→「添加账户」→「其他」→「添加已订阅的日历」→ 粘贴链接。</div>
              </div>
            </div>

            <!-- 其他日历 / 下载兜底 -->
            <div class="flex items-center justify-between gap-3 pt-1">
              <span class="text-[11px] text-on-surface-variant/55 leading-snug">Google / Outlook 同样可用此链接添加</span>
              <button data-download-ics type="button" class="shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-outline-variant/60 text-on-surface-variant hover:text-primary hover:border-primary/30 text-xs font-semibold transition-all cursor-pointer">
                <span class="material-symbols-outlined text-[16px]">download</span><span class="dl-label">下载 .ics</span>
              </button>
            </div>
          </div>
        </uem-float>
      </section>
    `;
  }

  /* —— 事件绑定（统一委托） —— */
  private bindEvents(): void {
    this.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;

      const gotoDay = t.closest('[data-goto-day]') as HTMLElement | null;
      if (gotoDay) {
        const d = gotoDay.getAttribute('data-goto-day')!;
        this.selected = d;
        this.current = parseYmd(d);
        this.view = 'day';
        this.renderAll();
        return;
      }

      const viewBtn = t.closest('[data-view]') as HTMLElement | null;
      if (viewBtn) {
        this.view = viewBtn.getAttribute('data-view') as ViewMode;
        this.renderAll();
        return;
      }

      const catBtn = t.closest('[data-cat]') as HTMLElement | null;
      if (catBtn) {
        const cat = catBtn.getAttribute('data-cat') as ActivityCategory;
        if (this.active.has(cat)) this.active.delete(cat);
        else this.active.add(cat);
        if (this.active.size === 0) this.active = new Set(CATEGORY_ORDER); // 不允许全部关闭
        this.renderAll();
        return;
      }

      const dayCell = t.closest('[data-day]') as HTMLElement | null;
      if (dayCell) {
        // 点选任意日期（含跨月的占位日）只刷新右侧时间轴，保持当前月份网格不变且不重播动画；
        // 月份切换仅由上方「上一月 / 下一月」导航按钮触发。
        this.selected = dayCell.getAttribute('data-day')!;
        this.renderAll(false);
        return;
      }

      if (t.closest('#nav-prev')) return this.navigate(-1);
      if (t.closest('#nav-next')) return this.navigate(1);
      if (t.closest('#nav-today')) {
        this.current = new Date();
        this.selected = this.todayStr;
        return this.renderAll();
      }
      if (t.closest('[data-retry]')) return void this.loadData();
      if (t.closest('#subscribe-btn')) return this.openSubscribe();
      if (t.closest('[data-copy-sub]')) return this.copySubscribeUrl();
      if (t.closest('[data-download-ics]')) return this.downloadICS();
    });

    // 键盘可达性：日期格子支持 Enter / 空格
    this.addEventListener('keydown', (e) => {
      const cell = (e.target as HTMLElement).closest('[data-day]') as HTMLElement | null;
      if (cell && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        cell.click();
      }
    });

    // 学院下拉框：一次性灌入选项，并监听选择变化（学院列表固定，故只设置一次 options）
    const collegeSelect = this.querySelector<UemSelect>('#college-select');
    if (collegeSelect) {
      collegeSelect.options = [...COLLEGES];
      collegeSelect.addEventListener('uem-select-change', (e) => {
        const val = (e as CustomEvent<{ value: string | null }>).detail.value;
        this.selectedCollege = val;
        // 互斥：选了学院就清空社团
        if (val) {
          this.selectedClub = null;
          this.syncSelects();
        }
        this.renderAll();
      });
    }

    // 社团下拉框：同理
    const clubSelect = this.querySelector<UemSelect>('#club-select');
    if (clubSelect) {
      clubSelect.options = [...CLUBS];
      clubSelect.addEventListener('uem-select-change', (e) => {
        const val = (e as CustomEvent<{ value: string | null }>).detail.value;
        this.selectedClub = val;
        // 互斥：选了社团就清空学院
        if (val) {
          this.selectedCollege = null;
          this.syncSelects();
        }
        this.renderAll();
      });
    }
  }

  private navigate(dir: number): void {
    if (this.view === 'month') this.current = addMonths(this.current, dir);
    else if (this.view === 'week') this.current = addDays(this.current, dir * 7);
    else {
      this.current = addDays(this.current, dir);
      this.selected = ymd(this.current);
    }
    this.renderAll();
  }

  /* —— 顶部控件渲染 —— */
  private renderControls(): void {
    const seg = (active: boolean, attr: string, val: string, label: string): string => {
      const base = 'px-3 md:px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer';
      const on = 'bg-white dark:bg-[#323639] text-primary dark:text-primary-fixed-dim shadow-sm';
      const off = 'text-on-surface-variant/80 hover:text-on-surface';
      return `<button data-${attr}="${val}" class="${base} ${active ? on : off}">${label}</button>`;
    };

    const viewSwitch = this.querySelector('#view-switch');
    if (viewSwitch) {
      viewSwitch.innerHTML =
        seg(this.view === 'month', 'view', 'month', '月') +
        seg(this.view === 'week', 'view', 'week', '周') +
        seg(this.view === 'day', 'view', 'day', '日');
    }

    this.syncSelects();

    const legend = this.querySelector('#legend');
    if (legend) {
      legend.innerHTML = CATEGORY_ORDER.map((key) => {
        const m = CATEGORY_META[key];
        const on = this.active.has(key);
        const cls = on
          ? `${m.chipBg} ${m.chipBorder} ${m.text}`
          : 'bg-transparent border-outline-variant/40 text-on-surface-variant/45';
        const dot = on ? m.dot : 'bg-on-surface-variant/30';
        return `<button data-cat="${key}" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all cursor-pointer ${cls}">
          <span class="w-2 h-2 rounded-full ${dot}"></span>${m.label}
        </button>`;
      }).join('');
    }
  }

  /** 让学院/社团下拉框的选中态与内部状态保持一致（互斥场景下程序化清除对方后调用） */
  private syncSelects(): void {
    const cs = this.querySelector<UemSelect>('#college-select');
    if (cs && cs.value !== this.selectedCollege) cs.value = this.selectedCollege;
    const cl = this.querySelector<UemSelect>('#club-select');
    if (cl && cl.value !== this.selectedClub) cl.value = this.selectedClub;
  }

  private renderPeriodTitle(): void {
    const el = this.querySelector('#period-title');
    if (!el) return;
    const d = this.current;
    if (this.view === 'month') {
      el.textContent = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    } else if (this.view === 'week') {
      const s = startOfWeek(d);
      const e = addDays(s, 6);
      const sameYear = s.getFullYear() === e.getFullYear();
      el.textContent = `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日 - ${
        sameYear ? '' : `${e.getFullYear()}年`
      }${e.getMonth() + 1}月${e.getDate()}日`;
    } else {
      el.textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 周${WEEKDAY_FULL[d.getDay()]}`;
    }
  }

  /* —— 主渲染 ——
   * animateCalendar=false：只刷新内容、不重播日历入场动画。用于「点选某天」——
   * 此时仅希望右侧时间轴刷新，左侧日历保持静止（议程始终重渲染，其条目自带入场动画）。 */
  private renderAll(animateCalendar = true): void {
    this.renderControls();
    this.renderPeriodTitle();

    // 数据未就绪：统一呈现骨架屏 / 错误态，避免渲染出空日历误导用户。
    if (this.dataState === 'loading') return this.renderLoading();
    if (this.dataState === 'error') return this.renderError();

    const layout = this.querySelector('#cal-layout');
    const agenda = this.querySelector('#agenda-pane') as HTMLElement | null;
    const pane = this.querySelector('#calendar-pane') as HTMLElement | null;
    if (!layout || !agenda || !pane) return;

    if (this.view === 'day') {
      // 日视图：日历区整块呈现纵向时间轴，隐藏右侧议程
      layout.className = 'grid grid-cols-1 gap-5 lg:gap-6 items-start';
      agenda.classList.add('hidden');
      pane.innerHTML = this.renderDayBoard(this.selected, animateCalendar);
    } else {
      layout.className =
        'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] gap-5 lg:gap-6 items-start';
      agenda.classList.remove('hidden');
      pane.innerHTML =
        this.view === 'month' ? this.renderMonth(animateCalendar) : this.renderWeek(animateCalendar);
      agenda.innerHTML = this.renderAgenda(this.selected);
    }
  }

  /* —— 加载骨架屏 —— */
  private renderLoading(): void {
    const layout = this.querySelector('#cal-layout');
    const agenda = this.querySelector('#agenda-pane') as HTMLElement | null;
    const pane = this.querySelector('#calendar-pane') as HTMLElement | null;
    if (!layout || !agenda || !pane) return;

    layout.className =
      'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] gap-5 lg:gap-6 items-start';
    agenda.classList.remove('hidden');

    const head = WEEKDAY_HEAD.map(
      () => '<div class="h-3 w-6 mx-auto rounded bg-on-surface-variant/10"></div>',
    ).join('');
    const cells = Array.from(
      { length: 42 },
      () =>
        '<div class="min-h-[68px] md:min-h-[116px] rounded-xl bg-on-surface-variant/[0.06] dark:bg-on-surface-variant/[0.08]"></div>',
    ).join('');
    pane.innerHTML = `<div class="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest/70 dark:bg-[#1b1d1e]/50 backdrop-blur-sm shadow-sm p-2.5 md:p-4 animate-pulse">
      <div class="grid grid-cols-7 gap-1.5 md:gap-2 mb-1.5 md:mb-2">${head}</div>
      <div class="grid grid-cols-7 gap-1.5 md:gap-2">${cells}</div>
    </div>`;

    const rows = Array.from(
      { length: 4 },
      () => `<div class="rounded-xl border border-outline-variant/50 p-3">
        <div class="h-3 w-1/3 rounded bg-on-surface-variant/10 mb-2"></div>
        <div class="h-4 w-2/3 rounded bg-on-surface-variant/10 mb-2"></div>
        <div class="h-2.5 w-1/2 rounded bg-on-surface-variant/10"></div>
      </div>`,
    ).join('');
    agenda.innerHTML = `<div class="p-4 flex flex-col gap-3 animate-pulse">
      <div class="h-5 w-1/2 rounded bg-on-surface-variant/10 mb-1"></div>
      ${rows}
    </div>`;
  }

  /* —— 加载失败错误态（区别于「当天暂无活动」的空态） —— */
  private renderError(): void {
    const layout = this.querySelector('#cal-layout');
    const agenda = this.querySelector('#agenda-pane') as HTMLElement | null;
    const pane = this.querySelector('#calendar-pane') as HTMLElement | null;
    if (!layout || !agenda || !pane) return;

    layout.className = 'grid grid-cols-1 gap-5 lg:gap-6 items-start';
    agenda.classList.add('hidden');
    pane.innerHTML = `<div class="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest/70 dark:bg-[#1b1d1e]/50 backdrop-blur-sm shadow-sm">
      <div class="flex flex-col items-center justify-center text-center py-16 md:py-24 px-6">
        <span class="material-symbols-outlined text-[48px] text-on-surface-variant/40 mb-3">cloud_off</span>
        <h3 class="text-base font-bold text-on-surface mb-1">活动数据加载失败</h3>
        <p class="text-sm text-on-surface-variant/70 max-w-xs leading-relaxed mb-5">可能是网络波动或数据源暂时不可用，请稍后重试。</p>
        <button data-retry type="button" class="inline-flex items-center gap-1.5 px-4 h-10 rounded-full bg-primary text-on-primary dark:bg-primary-fixed dark:text-on-primary-fixed text-sm font-bold hover:shadow-md transition-all cursor-pointer">
          <span class="material-symbols-outlined text-[18px]">refresh</span>重试
        </button>
      </div>
    </div>`;
  }

  /* —— 视觉片段 —— */
  private chipHTML(a: Activity): string {
    const m = CATEGORY_META[a.category];
    // 标题独占一行（占满格子宽度后再截断），时间作次行——避免时间前缀挤占标题，
    // 让"09:00 校园篮球赛总决赛"能看清是什么活动而非只剩一个字。
    return `<div class="flex items-stretch gap-1.5 px-1.5 py-1 rounded-md border ${m.chipBg} ${m.chipBorder} overflow-hidden">
      <span class="w-[3px] self-stretch rounded-full ${m.dot} shrink-0"></span>
      <div class="min-w-0 leading-tight">
        <div class="text-[11px] font-semibold text-on-surface/90 truncate">${esc(a.title)}</div>
        <div class="font-mono text-[9px] ${m.text} truncate">${a.start}</div>
      </div>
    </div>`;
  }

  /** 移动端紧凑格子用的分类圆点 */
  private dotsHTML(list: Activity[]): string {
    const dots = list
      .slice(0, 4)
      .map((a) => `<span class="w-1.5 h-1.5 rounded-full ${CATEGORY_META[a.category].dot}"></span>`)
      .join('');
    const more = list.length > 4 ? `<span class="text-[9px] leading-none text-on-surface-variant/60">+${list.length - 4}</span>` : '';
    return `<div class="flex items-center gap-0.5 flex-wrap justify-center min-h-[6px]">${dots}${more}</div>`;
  }

  private dayNumberHTML(d: Date, dim = false): string {
    const dateStr = ymd(d);
    const isToday = dateStr === this.todayStr;
    if (isToday) {
      return `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white dark:bg-primary-fixed-dim dark:text-[#001a3d] text-xs font-bold shadow-[0_2px_6px_rgba(0,31,84,0.25)] dark:shadow-[0_2px_8px_rgba(177,197,255,0.28)]">${d.getDate()}</span>`;
    }
    const color = dim ? 'text-on-surface-variant/40' : 'text-on-surface/80';
    return `<span class="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold ${color}">${d.getDate()}</span>`;
  }

  /** 单个月/周日期格子（含密度、今天、选中、桌面 chip + 移动 dots） */
  private dayCellHTML(d: Date, opts: { dim?: boolean; minH: string }): string {
    const dateStr = ymd(d);
    const list = this.activitiesOn(dateStr);
    const isSelected = dateStr === this.selected;
    const isToday = dateStr === this.todayStr;
    const dens = DENSITY_BG[densityLevel(list.length)];

    const ring = isSelected
      ? 'border-primary/70 dark:border-primary-fixed-dim/70 shadow-[0_0_0_2px_rgba(0,31,84,0.12)] dark:shadow-[0_0_0_2px_rgba(177,197,255,0.18)]'
      : isToday
        ? 'border-outline-variant/50 hover:border-primary/30 border-t-[3px] border-t-primary dark:border-t-primary-fixed-dim'
        : 'border-outline-variant/50 hover:border-primary/30';

    const visible = list.slice(0, MONTH_MAX_VISIBLE).map((a) => this.chipHTML(a)).join('');
    const overflow =
      list.length > MONTH_MAX_VISIBLE
        ? `<div class="text-[10px] font-medium text-on-surface-variant/60 px-1.5">还有 ${list.length - MONTH_MAX_VISIBLE} 个活动</div>`
        : '';

    return `<div data-day="${dateStr}" role="button" tabindex="0" aria-label="${dateStr} 共 ${list.length} 个活动"
      class="eac-day group ${opts.minH} flex flex-col gap-1 p-1.5 md:p-2 rounded-xl border ${ring} ${dens} cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
      <div class="flex items-center justify-between">
        ${this.dayNumberHTML(d, opts.dim)}
        ${list.length > 0 ? `<span class="hidden md:inline text-[10px] font-mono text-on-surface-variant/45">${list.length}</span>` : ''}
      </div>
      <!-- 桌面端：文字 chip -->
      <div class="hidden md:flex flex-col gap-1 min-w-0">${visible}${overflow}</div>
      <!-- 移动端：分类圆点 -->
      <div class="flex md:hidden mt-auto">${this.dotsHTML(list)}</div>
    </div>`;
  }

  private weekdayHeaderHTML(): string {
    return `<div class="grid grid-cols-7 gap-1.5 md:gap-2 mb-1.5 md:mb-2">
      ${WEEKDAY_HEAD.map(
        (w, i) =>
          `<div class="text-center text-[11px] md:text-xs font-semibold ${
            i >= 5 ? 'text-primary/60 dark:text-primary-fixed-dim/60' : 'text-on-surface-variant/60'
          }">周${w}</div>`,
      ).join('')}
    </div>`;
  }

  private paneWrap(inner: string, animate = true): string {
    return `<div class="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest/70 dark:bg-[#1b1d1e]/50 backdrop-blur-sm shadow-sm p-2.5 md:p-4${animate ? ' eac-in' : ''}">${inner}</div>`;
  }

  /* —— 月视图 —— */
  private renderMonth(animate = true): string {
    const first = new Date(this.current.getFullYear(), this.current.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const month = this.current.getMonth();

    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = addDays(gridStart, i);
      cells += this.dayCellHTML(d, { dim: d.getMonth() !== month, minH: 'min-h-[68px] md:min-h-[116px]' });
    }

    return this.paneWrap(
      `
      ${this.weekdayHeaderHTML()}
      <div class="grid grid-cols-7 gap-1.5 md:gap-2">${cells}</div>
    `,
      animate,
    );
  }

  /* —— 周视图 —— */
  private renderWeek(animate = true): string {
    const s = startOfWeek(this.current);
    const days = Array.from({ length: 7 }, (_, i) => addDays(s, i));

    // 移动端：紧凑一行（日期 + 圆点）
    const compact = days.map((d) => this.dayCellHTML(d, { minH: 'min-h-[76px]' })).join('');

    // 桌面端：7 列，每列展示更多 chip
    const columns = days
      .map((d) => {
        const dateStr = ymd(d);
        const list = this.activitiesOn(dateStr);
        const isSelected = dateStr === this.selected;
        const isToday = dateStr === this.todayStr;
        const head = `
          <div class="flex flex-col items-center gap-1 pb-2 mb-2 border-b border-outline-variant/40">
            <span class="text-[11px] font-semibold ${d.getDay() === 0 || d.getDay() === 6 ? 'text-primary/60 dark:text-primary-fixed-dim/60' : 'text-on-surface-variant/60'}">周${WEEKDAY_FULL[d.getDay()]}</span>
            ${this.dayNumberHTML(d)}
          </div>`;
        const visible = list.slice(0, WEEK_MAX_VISIBLE).map((a) => this.chipHTML(a)).join('');
        const overflow =
          list.length > WEEK_MAX_VISIBLE
            ? `<div class="text-[10px] font-medium text-on-surface-variant/60 px-1.5">还有 ${list.length - WEEK_MAX_VISIBLE} 个活动</div>`
            : '';
        const empty = list.length === 0 ? `<div class="text-[10px] text-on-surface-variant/35 text-center py-3">—</div>` : '';
        const ring = isSelected
          ? 'border-primary/70 dark:border-primary-fixed-dim/70'
          : isToday
            ? 'border-outline-variant/40 hover:border-primary/30 border-t-[3px] border-t-primary dark:border-t-primary-fixed-dim'
            : 'border-outline-variant/40 hover:border-primary/30';
        return `<div data-day="${dateStr}" role="button" tabindex="0"
          class="eac-day flex flex-col gap-1 p-2 rounded-xl border ${ring} ${DENSITY_BG[densityLevel(list.length)]} min-h-[180px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          ${head}
          <div class="flex flex-col gap-1 min-w-0">${visible}${overflow}${empty}</div>
        </div>`;
      })
      .join('');

    return (
      this.paneWrap(
        `
        <div class="grid grid-cols-7 gap-1.5 md:hidden">${compact}</div>
        <div class="hidden md:grid md:grid-cols-7 gap-2">${columns}</div>
      `,
        animate,
      ) +
      `<p class="md:hidden text-[11px] text-on-surface-variant/55 mt-2 px-1">点击某天查看下方当日议程</p>`
    );
  }

  /* —— 议程纵向时间轴（右侧 / 移动端下方） —— */
  private timelineHTML(list: Activity[]): string {
    if (list.length === 0) {
      return `<div class="flex flex-col items-center justify-center text-center py-12 px-4 text-on-surface-variant/50">
        <span class="material-symbols-outlined text-[40px] mb-2 opacity-50">event_busy</span>
        <p class="text-sm">这一天暂无活动</p>
        <p class="text-[11px] mt-1 opacity-70">换个日期或调整筛选试试</p>
      </div>`;
    }
    const items = list
      .map((a, i) => {
        const m = CATEGORY_META[a.category];
        const lv = LEVEL_META[a.level];
        const timeRange = a.end ? `${a.start} – ${a.end}` : a.start;
        return `<li class="relative pl-7 pb-4 last:pb-0 eac-in" style="animation-delay:${i * 45}ms">
          <span class="absolute left-[6px] top-[6px] w-3 h-3 rounded-full ${m.dot} ring-2 ring-surface-container-lowest dark:ring-[#1b1d1e] z-10"></span>
          <div class="rounded-xl border ${m.chipBorder} ${m.chipBg} p-3">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="font-mono text-xs font-bold ${m.text}">${timeRange}</span>
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ${lv.badge} shrink-0">${lv.label}</span>
            </div>
            <h4 class="text-sm font-bold text-on-surface leading-snug mb-1.5">${esc(a.title)}</h4>
            <div class="flex items-center gap-1 text-[11px] text-on-surface-variant/75 mb-0.5">
              <span class="material-symbols-outlined text-[14px]">location_on</span>
              <span class="truncate">${esc(a.location)}</span>
            </div>
            ${a.organizer ? `<div class="flex items-center gap-1 text-[11px] text-on-surface-variant/75">
              <span class="material-symbols-outlined text-[14px]">group</span>
              <span class="truncate">${esc(a.organizer)}</span>
            </div>` : ''}
            ${a.description ? `<p class="text-[11px] text-on-surface-variant/65 leading-relaxed mt-1.5 line-clamp-2">${esc(a.description)}</p>` : ''}
            <div class="mt-2 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full ${m.dot}"></span>
              <span class="text-[10px] font-medium ${m.text}">${m.label}</span>
            </div>
          </div>
        </li>`;
      })
      .join('');
    return `<ol class="relative ml-1 before:content-[''] before:absolute before:left-[11px] before:top-1.5 before:bottom-2 before:w-px before:bg-outline-variant/50">${items}</ol>`;
  }

  private agendaHeaderHTML(dateStr: string, count: number, large: boolean): string {
    const d = parseYmd(dateStr);
    const isToday = dateStr === this.todayStr;
    const weekday = `周${WEEKDAY_FULL[d.getDay()]}`;
    const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日`;
    const todayTag = isToday
      ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-on-primary dark:bg-primary-fixed-dim dark:text-[#001a3d]">今天</span>`
      : '';
    if (large) {
      return `<div class="flex items-center justify-between gap-3 mb-5">
        <div class="flex items-baseline gap-2 flex-wrap">
          <span class="font-headline-md text-2xl md:text-3xl font-extrabold text-on-surface">${d.getFullYear()}年${dateLabel}</span>
          <span class="text-sm font-semibold text-on-surface-variant/70">${weekday}</span>
          ${todayTag}
        </div>
        <span class="text-xs font-mono text-on-surface-variant/60 shrink-0">${count} 个活动</span>
      </div>`;
    }
    return `<div class="flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-outline-variant/40">
      <div class="flex items-center gap-2">
        <div class="flex flex-col">
          <span class="text-base font-bold text-on-surface leading-tight">${dateLabel} <span class="text-xs font-medium text-on-surface-variant/70">${weekday}</span></span>
          <span class="text-[11px] text-on-surface-variant/55 font-mono">${count} 个活动</span>
        </div>
        ${todayTag}
      </div>
      <button data-goto-day="${dateStr}" class="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary dark:text-primary-fixed-dim hover:underline cursor-pointer">
        日视图<span class="material-symbols-outlined text-[15px]">chevron_right</span>
      </button>
    </div>`;
  }

  /** 右侧议程面板（月/周视图） */
  private renderAgenda(dateStr: string): string {
    const list = this.activitiesOn(dateStr);
    return `${this.agendaHeaderHTML(dateStr, list.length, false)}
      <div class="eac-scroll p-4 lg:max-h-[calc(100vh-13rem)] overflow-y-auto">${this.timelineHTML(list)}</div>`;
  }

  /** 日视图整块面板 */
  private renderDayBoard(dateStr: string, animate = true): string {
    const list = this.activitiesOn(dateStr);
    return this.paneWrap(
      `
      <div class="max-w-2xl mx-auto px-1 md:px-2 py-1">
        ${this.agendaHeaderHTML(dateStr, list.length, true)}
        ${this.timelineHTML(list)}
      </div>
    `,
      animate,
    );
  }

  /* —— 订阅 / 导出 —— */
  private openSubscribe(): void {
    this.querySelector<UemFloat>('uem-float')?.showModal();
  }

  /** 复制订阅链接到剪贴板，并短暂反馈 */
  private copySubscribeUrl(): void {
    const input = this.querySelector<HTMLInputElement>('#sub-url');
    const url = input?.value ?? ACTIVITIES_ICS_WEBCAL;
    const label = this.querySelector('[data-copy-sub] .copy-label');
    const feedback = () => {
      if (!label) return;
      const prev = label.textContent;
      label.textContent = '已复制';
      setTimeout(() => {
        label.textContent = prev;
      }, 1600);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(feedback, () => {
        input?.select();
        document.execCommand('copy');
        feedback();
      });
    } else if (input) {
      input.select();
      document.execCommand('copy');
      feedback();
    }
  }

  /** 下载完整 .ics（一次性导入兜底，基于当前运行时拉取到的全量活动数据） */
  private downloadICS(): void {
    const blob = new Blob([buildICS(this.activities)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '校园活动.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const label = this.querySelector('[data-download-ics] .dl-label');
    if (label) {
      const prev = label.textContent;
      label.textContent = '已下载';
      setTimeout(() => {
        label.textContent = prev;
      }, 1600);
    }
  }
}

customElements.define('uem-activity-calendar', UemActivityCalendar);
