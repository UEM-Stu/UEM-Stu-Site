/**
 * 校园活动 iCal(.ics) 生成
 *
 * 纯数据转换（无 DOM、无内置数据），同一份逻辑供两处复用：
 * - 组件内「下载 .ics」：传入运行时拉取到的活动数据
 * - GitHub Action `sync_activities.yml`：传入飞书多维表格拉取到的数据，生成订阅源
 *
 * 因此本模块也能在 Node / 脚本中安全导入。
 */
import { CATEGORY_META, LEVEL_META, type Activity } from './activity';

const pad = (n: number): string => String(n).padStart(2, '0');

/** 转义 iCal 文本字段中的特殊字符（RFC 5545） */
function escapeICS(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** 本地浮动时间（不带 Z），配合 X-WR-TIMEZONE 表示北京时间 */
function dtLocal(dateStr: string, time: string): string {
  return `${dateStr.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

/**
 * 生成 VCALENDAR 文本。传入的应是「全量」活动（订阅源不应受界面筛选影响）。
 * 含 REFRESH-INTERVAL / X-PUBLISHED-TTL，提示订阅端每 12 小时自动刷新。
 */
export function buildICS(activities: Activity[]): string {
  const list = [...activities].sort((x, y) =>
    `${x.date}${x.start}`.localeCompare(`${y.date}${y.start}`),
  );

  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(
    now.getUTCHours(),
  )}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UEM-Stu//Campus Activity//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:校园活动',
    'X-WR-CALDESC:UEM-Stu 校园活动日历订阅',
    'X-WR-TIMEZONE:Asia/Shanghai',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
  ];

  for (const a of list) {
    const endTime = a.end ?? a.start;
    const meta = `分类：${CATEGORY_META[a.category].label} / 级别：${LEVEL_META[a.level].label}${
      a.organizer ? ` / 主办：${a.organizer}` : ''
    }`;
    const desc = a.description ? `${a.description}\n${meta}` : meta;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${a.id}@uem-stu`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dtLocal(a.date, a.start)}`,
      `DTEND:${dtLocal(a.date, endTime)}`,
      `SUMMARY:${escapeICS(a.title)}`,
      `LOCATION:${escapeICS(a.location)}`,
      `DESCRIPTION:${escapeICS(desc)}`,
      `CATEGORIES:${escapeICS(CATEGORY_META[a.category].label)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
