import os
import time
import requests
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor

# GitHub App 配置
APP_ID = os.environ.get("APP_ID", "") 
PRIVATE_KEY = os.environ.get("APP_PRIVATE_KEY", "")
# 如果 PRIVATE_KEY 为空，会尝试读取该文件
PRIVATE_KEY_PATH = ""

ORG = os.environ.get("ORG", "UEM-Stu")

# 计算默认的对比日期（东八区的昨天）
tz_bj = timezone(timedelta(hours=8))
yesterday_bj = datetime.now(tz_bj) - timedelta(days=1)
default_date = yesterday_bj.strftime("%Y-%m-%d")

DATE = os.environ.get("DATE", default_date)
TZ = os.environ.get("TZ", "+08:00")

# 尝试导入 PyJWT 库以生成 JWT 签名
try:
    import jwt
except ImportError:
    jwt = None

def get_bot_token():
    """
    使用 GitHub App (Bot) 的 APP_ID 和私钥生成临时 Access Token
    """
    # 优先从环境变量获取已存在的 TOKEN (如 GITHUB_TOKEN 或 TOKEN)
    env_token = os.environ.get("GITHUB_TOKEN") or os.environ.get("TOKEN")
    if env_token:
        return env_token

    # 检查 APP_ID
    app_id = APP_ID or os.environ.get("APP_ID")
    if not app_id:
        raise ValueError("未配置 APP_ID。请设置环境变量 APP_ID 或在脚本中配置。")

    # 检查 PRIVATE_KEY
    private_key = PRIVATE_KEY
    if not private_key:
        # 尝试从私钥文件读取
        if os.path.exists(PRIVATE_KEY_PATH):
            with open(PRIVATE_KEY_PATH, "r", encoding="utf-8") as f:
                private_key = f.read()
        else:
            raise ValueError(
                f"未配置私钥。请设置环境变量 APP_PRIVATE_KEY，或在脚本中配置，或在当前目录下放置 {PRIVATE_KEY_PATH} 文件。"
            )

    if not jwt:
        raise ImportError(
            "生成 Bot Token 需要 'pyjwt' 和 'cryptography' 库。\n"
            "请使用以下命令安装：\n"
            "pip install pyjwt cryptography"
        )

    # 1. 生成 JWT (JSON Web Token)
    now = int(time.time())
    payload = {
        "iat": now - 60,       # 签发时间，稍微提前一点防止时钟不同步
        "exp": now + 600,      # 过期时间（最多 10 分钟）
        "iss": str(app_id),    # GitHub App ID
    }
    jwt_token = jwt.encode(payload, private_key, algorithm="RS256")

    # 2. 获取 App 的安装列表，并找到对应组织的安装 ID (Installation ID)
    headers_jwt = {
        "Authorization": f"Bearer {jwt_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    
    installations_url = "https://api.github.com/app/installations"
    r = requests.get(installations_url, headers=headers_jwt)
    r.raise_for_status()
    installations = r.json()

    installation_id = None
    for inst in installations:
        account = inst.get("account", {})
        if account.get("login") == ORG:
            installation_id = inst.get("id")
            break

    if not installation_id:
        if len(installations) == 1:
            installation_id = installations[0].get("id")
        else:
            raise ValueError(f"未找到组织/用户 '{ORG}' 的 GitHub App 安装实例。请确认 App 已安装到该组织。")

    # 3. 请求临时安装访问 Token (Installation Access Token)
    access_token_url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
    r = requests.post(access_token_url, headers=headers_jwt)
    r.raise_for_status()
    
    return r.json()["token"]

TOKEN = get_bot_token()

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

def get(url, params=None):
    r = requests.get(url, headers=headers, params=params)
    r.raise_for_status()
    return r.json()

def get_commit_before(owner, repo, branch, time):
    url = f"https://api.github.com/repos/{owner}/{repo}/commits"
    data = get(url, {
        "sha": branch,
        "until": time,
        "per_page": 1,
    })
    return data[0]["sha"] if data else None

def get_first_commit(owner, repo, branch):
    """
    获取一个仓库的最早一次提交（第一笔提交）的 SHA
    """
    import re
    url = f"https://api.github.com/repos/{owner}/{repo}/commits"
    params = {"sha": branch, "per_page": 100}
    r = requests.get(url, headers=headers, params=params)
    r.raise_for_status()
    commits = r.json()
    if not commits:
        return None
        
    link = r.headers.get("Link")
    if link:
        match = re.search(r'<([^>]+)>;\s*rel="last"', link)
        if match:
            last_page_url = match.group(1)
            r_last = requests.get(last_page_url, headers=headers)
            r_last.raise_for_status()
            last_commits = r_last.json()
            if last_commits:
                return last_commits[-1]["sha"]
                
    return commits[-1]["sha"]

repos = get(f"https://api.github.com/orgs/{ORG}/repos", {
    "type": "all",
    "per_page": 100,
})

def process_repo(repo):
    """
    处理单个仓库，获取增删行数以及提交次数
    """
    name = repo["name"]
    branch = repo["default_branch"]
    additions = 0
    deletions = 0
    commit_count = 0

    try:
        # 尝试获取当天开始前的最后一次提交作为对比基准，以及当天结束前的最后一次提交
        start = get_commit_before(ORG, name, branch, f"{DATE}T00:00:00{TZ}")
        end = get_commit_before(ORG, name, branch, f"{DATE}T23:59:59{TZ}")

        if not start:
            # 如果当天开始前没有任何提交，说明这是一个在当天（或之后）新创建的仓库
            if not end:
                # 当天也没有任何提交，数据均为 0
                pass
            else:
                # 获取该仓库的第一个提交 (Root Commit)
                first_commit = get_first_commit(ORG, name, branch)
                if first_commit:
                    # 获取第一个提交本身的增删行数
                    first_commit_details = get(f"https://api.github.com/repos/{ORG}/{name}/commits/{first_commit}")
                    additions = first_commit_details["stats"]["additions"]
                    deletions = first_commit_details["stats"]["deletions"]
                    commit_count = 1
                    
                    # 如果第一个提交不是当天的最后一个提交，对比从第一个提交到最后一个提交的改动
                    if first_commit != end:
                        compare = get(f"https://api.github.com/repos/{ORG}/{name}/compare/{first_commit}...{end}")
                        additions += sum(f["additions"] for f in compare.get("files", []))
                        deletions += sum(f["deletions"] for f in compare.get("files", []))
                        commit_count += len(compare.get("commits", []))
        else:
            if not end or start == end:
                pass
            else:
                compare = get(f"https://api.github.com/repos/{ORG}/{name}/compare/{start}...{end}")
                additions = sum(f["additions"] for f in compare.get("files", []))
                deletions = sum(f["deletions"] for f in compare.get("files", []))
                commit_count = len(compare.get("commits", []))

        return name, additions, deletions, commit_count
    except Exception as e:
        print(f"获取仓库 {name} 数据失败: {e}")
        return name, 0, 0, 0

total_additions = 0
total_deletions = 0
total_commits = 0

# 使用 ThreadPoolExecutor 并发请求 GitHub API
# 最大工作线程设置为 10，可以根据实际情况进行调整
with ThreadPoolExecutor(max_workers=10) as executor:
    results = list(executor.map(process_repo, repos))

for name, additions, deletions, commit_count in results:
    total_additions += additions
    total_deletions += deletions
    total_commits += commit_count
    print(name, "additions:", additions, "deletions:", deletions, "commits:", commit_count)

print("组织新增行数:", total_additions)
print("组织删除行数:", total_deletions)
print("组织净增行数:", total_additions - total_deletions)
print("组织总提交数:", total_commits)

# 如果指定了输出 JSON 路径，则保存为历史记录
output_path = os.environ.get("OUTPUT_JSON_PATH")
if output_path:
    import json
    
    # 构造当前日期的数据点（包含原字段以向前兼容，同时新增 metrics 可扩展结构）
    day_data = {
        "date": DATE,
        "total_additions": total_additions,
        "total_deletions": total_deletions,
        "metrics": {
            "additions": total_additions,
            "deletions": total_deletions,
            "lines_changed": total_additions + total_deletions,
            "commits": total_commits
        },
        "repos": [
            {
                "name": name,
                "additions": add,
                "deletions": del_,
                "metrics": {
                    "additions": add,
                    "deletions": del_,
                    "lines_changed": add + del_,
                    "commits": c_count
                }
            }
            for name, add, del_, c_count in results
        ]
    }

    history = []
    if os.path.exists(output_path):
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                history = json.load(f)
                if not isinstance(history, list):
                    history = []
        except Exception as e:
            print(f"读取历史数据失败，将重新创建: {e}")
            history = []

    # 去重并追加新纪录
    history = [item for item in history if item.get("date") != DATE]
    history.append(day_data)
    
    # 按日期升序排序
    history.sort(key=lambda x: x.get("date", ""))

    # 确保保存的文件夹目录存在
    dir_name = os.path.dirname(output_path)
    if dir_name and not os.path.exists(dir_name):
        os.makedirs(dir_name, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)
    print(f"历史数据已更新并保存至: {output_path}")