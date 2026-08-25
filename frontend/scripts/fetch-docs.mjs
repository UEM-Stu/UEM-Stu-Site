// 构建 / 开发前自动拉取文档仓库 UEM-Stu-Blog 到 frontend/docs。
// 文档不随主仓库提交(.gitignore 已忽略 frontend/docs),每次构建现拉最新。
// 由 package.json 的 predev / prebuild 钩子自动调用,本地与 CI 行为一致。
import { existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const REPO = 'https://github.com/UEM-Stu/UEM-Stu-Blog.git';
const BRANCH = 'main';
const DIR = 'docs';

// 用 execFileSync + 参数数组,不经过 shell,避免命令注入
const git = (args, opts = {}) => execFileSync('git', args, { stdio: 'inherit', ...opts });

try {
  if (existsSync(`${DIR}/.git`)) {
    console.log(`[fetch-docs] 已存在 ${DIR}/，拉取最新 ${BRANCH} …`);
    git(['fetch', '--depth', '1', 'origin', BRANCH], { cwd: DIR });
    git(['reset', '--hard', `origin/${BRANCH}`], { cwd: DIR });
  } else {
    console.log(`[fetch-docs] 克隆 ${REPO} → ${DIR}/ …`);
    rmSync(DIR, { recursive: true, force: true });
    git(['clone', '--depth', '1', '--branch', BRANCH, REPO, DIR]);
  }
  console.log('[fetch-docs] 完成 ✓');
} catch (err) {
  console.error('[fetch-docs] 失败:', err.message);
  process.exit(1);
}
