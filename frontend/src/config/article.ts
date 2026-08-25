/**
 * 博客文章数据模型与示例数据
 */

export interface BlogArticle {
    /** 文章唯一标识（URL slug） */
    slug: string;
    /** 文章标题 */
    title: string;
    /** 文章摘要 */
    excerpt: string;
    /** 分类 */
    category: string;
    /** 子分类 */
    subCategory: string;
    /** 作者名 */
    author: string;
    /** 作者头像首字母 */
    authorAvatar: string;
    /** 发布日期 */
    date: string;
    /** 预估阅读时间 */
    readTime: string;
    /** Markdown 正文内容 */
    content: string;
    /** 源文件路径（用于解析相对图片路径） */
    filePath: string;
}

export interface TOCItem {
    id: string;
    text: string;
    level: number;
}

/**
 * UEM 主站 article.ts 用手写 YAML 解析，date 通常是 string；
 * 与 gray-matter 站点保持一致，兼容 Date / 带时间后缀的字符串。
 */
function normalizeFrontmatterDate(raw: unknown): string {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === 'string') {
    const match = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * UEM 主站文章路由为 /article?slug=，兼容个人站 /blog/ 写法
 */
function normalizeBlogInternalLinksForUem(content: string): string {
  return content.replace(
    /\]\(\/blog\/([a-z0-9-]+)\)/gi,
    '](/article?slug=$1)',
  );
}

/**
 * 解析 Markdown 及其 Frontmatter 的辅助函数
 */
function parseMarkdown(filePath: string, rawContent: string): BlogArticle {
  const slug = filePath.split('/').pop()?.replace('.md', '') || 'untitled';
  
  // 匹配 YAML Frontmatter (例如以 --- 开头和结尾的头部区块)
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  
  const metadata: Record<string, string> = {};
  let content = rawContent;
  
  if (match) {
    const yaml = match[1];
    content = match[2];
    
    yaml.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) return;
      const colonIndex = trimmedLine.indexOf(':');
      if (colonIndex !== -1) {
        const key = trimmedLine.slice(0, colonIndex).trim();
        let value = trimmedLine.slice(colonIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        metadata[key] = value;
      }
    });
  }
  
  // 查找文章中第一个出现的 # 一阶标题，支持前面可能有空白
  const titleMatch = content.match(/^\s*#\s+(.+)$/m);
  let finalTitle = metadata.title;
  
  if (titleMatch) {
    if (!finalTitle) {
      finalTitle = titleMatch[1].trim();
    }
    // 移除正文中的第一个一阶标题行
    content = content.replace(/^\s*#\s+.+$/m, '').trim();
  }
  
  if (!finalTitle) {
    finalTitle = slug;
  }

  const getExcerpt = (text: string) => {
    return text
      .slice(0, 300)
      .replace(/[#*`~_\-]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 150) + '...';
  };

  const finalExcerpt = metadata.excerpt || getExcerpt(content);

  content = normalizeBlogInternalLinksForUem(content);
  
  return {
    slug: metadata.slug || slug,
    title: finalTitle,
    excerpt: finalExcerpt,
    category: metadata.category || '技术沉淀',
    subCategory: metadata.subCategory || 'General',
    author: metadata.author || 'Anonymous',
    authorAvatar: metadata.authorAvatar || (metadata.author ? metadata.author[0].toUpperCase() : 'A'),
    date: normalizeFrontmatterDate(metadata.date),
    readTime: metadata.readTime || `${Math.max(1, Math.ceil(content.length / 500))} min`,
    content: content,
    filePath: filePath,
  };
}

// 动态载入 docs/articles 文件夹下的所有 markdown 文章
// (docs/ 由构建前的 scripts/fetch-docs.mjs 从 UEM-Stu-Blog 仓库拉取,文章统一放在子目录 articles/ 下)
const markdownModules = import.meta.glob('../../docs/articles/*.md', { query: '?raw', eager: true });

const parsedMarkdownArticles: BlogArticle[] = [];

for (const path in markdownModules) {
  try {
    const module = markdownModules[path];
    let rawContent = '';
    if (typeof module === 'string') {
      rawContent = module;
    } else if (module && typeof (module as any).default === 'string') {
      rawContent = (module as any).default;
    } else {
      console.warn(`[article.ts] Failed to load raw content for ${path}:`, module);
      continue;
    }
    
    const article = parseMarkdown(path, rawContent);
    parsedMarkdownArticles.push(article);
  } catch (err) {
    console.error(`[article.ts] Error parsing markdown article at ${path}:`, err);
  }
}

// 按日期降序排列
export const ARTICLES: BlogArticle[] = [...parsedMarkdownArticles].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
);
