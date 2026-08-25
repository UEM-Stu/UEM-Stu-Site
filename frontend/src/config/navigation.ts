/**
 * 导航与链接配置
 */

/** 导航链接配置 */
export const NAV_LINKS = [
  { label: '首页', href: '#', active: true },
  { label: '技术博客', href: '/blog', active: false },
] as const satisfies readonly { label: string; href: string; active: boolean }[];

/**
 * 独立页面配置（首页、技术博客之外的页面）
 *
 * - `path`：用于匹配当前 URL 是否属于该页面（pathname.includes(path)）
 * - `href`：跳转地址
 * - `label`：顶栏 / 菜单中显示的名称
 *
 * 新增独立页面时只需在此处追加一条即可：
 * 1. 会自动出现在「更多」下拉菜单中可供跳转
 * 2. 处于该页面时，顶栏会在「更多」与「技术博客」之间出现高亮的当前页面按钮
 */
export const STANDALONE_PAGES = [
  { label: '校园活动', path: '/activity', href: '/activity' },
] as const satisfies readonly { label: string; path: string; href: string }[];

/** 本站实现的博客文章链接 */
export const WEBSITE_BLOG_URL = 'https://github.com/UEM-Stu/UEM-Stu-Site';

/** 页脚链接配置 */
export const FOOTER_LINKS = {
  related: [
    { label: '学校官网', href: 'https://www.ncist.edu.cn/' },
    { label: '教务系统', href: 'https://jwc.ncist.edu.cn/' },
    { label: '图书馆', href: 'https://lib.ncist.edu.cn/' },
  ],
  bottom: [
    { label: '想知道此网站是如何实现的？点击查看文章', href: WEBSITE_BLOG_URL, underline: true },
  ] as readonly { readonly label: string; readonly href: string; readonly underline?: boolean }[],
} as const;
