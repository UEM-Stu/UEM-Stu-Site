/**
 * 校园活动「运行时数据源」
 *
 * 数据与展示分离：站点是纯静态的，活动内容不随主站构建发布。
 * - 生产环境：运行时从 jsDelivr CDN 拉取 stats-data 分支上的 activities.json
 *   （该文件由 GitHub Action `sync_activities.yml` 从飞书多维表格定时生成并推送）。
 * - 本地开发：直接用内置的演示数据作 fixture——离线可用、确定性，且不依赖已发布数据。
 *
 * 注意：CDN 数据视为「不可信输入」，逐条 sanitize 后再交给组件；
 * 渲染到 innerHTML 时仍需在组件内做 HTML 转义（防 XSS，纵深防御）。
 */
import {
  ACTIVITIES,
  CATEGORY_ORDER,
  type Activity,
  type ActivityCategory,
  type ActivityLevel,
} from './activity';

/** 活动数据 JSON（运行时拉取） */
export const ACTIVITIES_JSON_URL =
  'https://cdn.jsdelivr.net/gh/UEM-Stu/UEM-Stu-Site@stats-data/activities.json';

/** 订阅源 .ics（Apple / Google / Outlook 长期订阅，自动回源刷新） */
export const ACTIVITIES_ICS_WEBCAL =
  'webcal://cdn.jsdelivr.net/gh/UEM-Stu/UEM-Stu-Site@stats-data/activities.ics';

const CATEGORY_SET = new Set<string>(CATEGORY_ORDER);
const LEVEL_SET = new Set<string>(['campus', 'college']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * 清洗 / 校验单条记录。任何必填项缺失或非法都返回 null，
 * 这样线上一条脏数据不会拖垮整个日历。
 */
function sanitize(raw: unknown): Activity | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const id = asStr(r.id);
  const title = asStr(r.title);
  const category = asStr(r.category);
  const level = asStr(r.level);
  const date = asStr(r.date);
  const start = asStr(r.start);
  const location = asStr(r.location);

  if (!id || !title || !location) return null;
  if (!CATEGORY_SET.has(category)) return null;
  if (!LEVEL_SET.has(level)) return null;
  if (!DATE_RE.test(date)) return null;
  if (!TIME_RE.test(start)) return null;

  const activity: Activity = {
    id,
    title,
    category: category as ActivityCategory,
    level: level as ActivityLevel,
    date,
    start,
    location,
  };

  const end = asStr(r.end);
  if (end && TIME_RE.test(end)) activity.end = end;
  const organizer = asStr(r.organizer);
  if (organizer) activity.organizer = organizer;
  const description = asStr(r.description);
  if (description) activity.description = description;

  return activity;
}

/**
 * 加载活动数据。
 * DEV 走内置 fixture；PROD 走 CDN fetch——失败时抛出，由组件呈现错误态 + 重试，
 * 绝不静默回退到内置数组（否则 CDN 故障会被误判为「成功但暂无活动」）。
 */
export async function loadActivities(): Promise<Activity[]> {
  if (import.meta.env.DEV) {
    return ACTIVITIES;
  }

  const res = await fetch(ACTIVITIES_JSON_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error('数据格式错误：应为数组');

  const out: Activity[] = [];
  for (const row of data) {
    const a = sanitize(row);
    if (a) out.push(a);
  }
  return out;
}
