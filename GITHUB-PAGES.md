# GitHub Pages 发布与 API Key 保密

适用于 2026-09-30 当前版本。按用户选择，仓库 [vashzwingli/cyber-offering](https://github.com/vashzwingli/cyber-offering) 已改为公开并启用 GitHub Pages，Cloudflare 后端已部署。

## 当前部署状态

- API：`https://cyber-offering-api.agrandwalk.workers.dev`
- Worker：`cyber-offering-api`；D1：`cyber-offering`，迁移已完成。
- 页面允许来源：`https://vashzwingli.github.io`；限流：每 IP 每 60 秒约 30 次。
- 已验证线上状态接口、D1 持久计数、相同请求去重、追偶像匹配原因、跨域预检和拒绝未允许的来源。
- DeepSeek Key 已配置；三条线上输入均返回 `engine=llm`、`model_status=ready`，模型响应约 1.8–2.5 秒。追偶像输入返回妈祖，并说明寄托旅途平安、相见如愿的心愿；面试原因已改为面试顺利、求职如愿。
- GitHub Actions 的 `VITE_API_BASE_URL` 已设为上述 API origin。GitHub Pages 已设为 GitHub Actions 发布，网页入口为 `https://vashzwingli.github.io/cyber-offering/`；每次推送 `main` 自动更新，构建状态见仓库 Actions。

本机 `wrangler.api.jsonc` 已写入真实账户与数据库配置，且被 Git 忽略。当前继续部署时不要再复制范本覆盖，也不要重复创建数据库。Key 已存入 Worker Secrets，无需再次输入或配置到 GitHub。

GitHub Pages 免费计划支持公开仓库；私有仓库需要相应付费计划。请先确认账号资格，再启用 Pages；仓库可保持私有并改用 Cloudflare 托管前端。参见 [GitHub Pages 可用范围](https://docs.github.com/en/pages/getting-started-with-github-pages)。

## 发布结构

```text
GitHub Pages（页面、图片、交互）
  → Cloudflare Worker（/api/match、解析、原因、限流）
    → DeepSeek（使用 Worker 中的秘密 Key）
    → Cloudflare D1（共享频率与请求去重）
```

[GitHub Pages 是静态托管](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)，不能执行当前的服务端 API。Key 应保存在 [Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)，不放进 GitHub 仓库或网页文件。GitHub Actions Secrets 仅保护构建和部署过程；如果构建把 Key 写入前端 JS，访客仍能读取。`VITE_` 变量会进入前端，只有公开的后端地址使用该前缀；不能设置 `VITE_LLM_API_KEY`。参见 [Vite 环境变量说明](https://vite.dev/guide/env-and-mode)。

## 1. 创建 GitHub 仓库并上传源码

创建一个空仓库，将当前 `site/` 的**内容**作为仓库根目录上传，根目录应直接包含 `package.json`、`github-pages/`、`worker/`、`.github/`。不要把整个知识库作为发布源码，也不要手动上传 `node_modules`、`.env.local`、`.dev.vars`、`.sites-runtime`、`.wrangler`、`dist`、`pages-dist` 或旧的打包文件。现有 `.gitignore` 已排除这些文件。

当前 `site/` 的 `origin` 已指向上述 GitHub 仓库。另行迁移项目时，可将源码包解压到新目录后初始化新仓库。GitHub Pages 发布配置默认监听 `main`；其他默认分支应修改 `.github/workflows/pages.yml`。

## 2. 创建 Cloudflare 后端及 D1

在源码根目录安装依赖并登录你自己的 Cloudflare 账户：

```powershell
npm ci
npx wrangler login
npx wrangler d1 create cyber-offering
Copy-Item wrangler.api.example.jsonc wrangler.api.jsonc
```

把创建命令返回的真实 `database_id` 填入 `wrangler.api.jsonc`；`database_name` 与创建的数据库一致。把 `ALLOWED_ORIGINS` 改成 `https://你的用户名.github.io`，**不包含仓库路径**。自定义域名则填写对应 HTTPS origin；多个来源用逗号分隔。`namespace_id` 是账户内的限流编号，如账户已使用该值应更换。

随后运行：

```powershell
npx wrangler d1 migrations apply DB --remote --config wrangler.api.jsonc
npx wrangler deploy --config wrangler.api.jsonc
npx wrangler secret put LLM_API_KEY --config wrangler.api.jsonc
```

最后一条命令出现提示时，在自己的终端输入 DeepSeek Key。命令将其存为后端秘密变量，不提交到 Git。也可在 Cloudflare 控制台 Worker 的 Settings → Variables and Secrets 中新增 **Secret**，变量名 `LLM_API_KEY`。接口部署命令返回的实际 `https://…workers.dev` 地址，供下一步使用。

后端源码是 `worker/api.ts`，复用当前匹配与 D1 服务；没有 Key 时使用本地兜底。配置范本启用了每 IP 每 60 秒约 30 次的限流；共享出口 IP 会共享额度。CORS 只允许指定页面 origin，但不是身份认证，外部脚本仍可能伪造 origin；公开规模扩大时可另加登录或验证码，并设置模型消费额度。不要在前端添加一个固定“代理密码”，它同样会被看到。

当前已有的私人 Sites 地址需要登录，也没有开放本方案的跨域 API，不能直接当作 GitHub Pages 的公开后端，更不能把其访问令牌写到前端。

## 3. 配置 GitHub Pages

仓库 Settings → Secrets and variables → Actions → **Variables** 新增：

```text
VITE_API_BASE_URL = 上一步部署返回的 HTTPS Worker origin
```

这里只配置公开地址，**不用添加 DeepSeek Key**。例如地址格式为 `https://你的实际后端.workers.dev`，不带 `/api/match`、查询参数或凭据。

仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。推送 `main` 或在 Actions 中手动运行 `Publish GitHub Pages` 即可。已提供工作流会安装依赖、构建并发布 `pages-dist/`；`configure-pages` 自动提供仓库子路径，神佛和仪轨图片跟随该路径。流程见 [GitHub 自定义 Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 本地构建与验收

```powershell
$env:GITHUB_PAGES_BASE_PATH = '/你的仓库名'
$env:VITE_API_BASE_URL = '部署返回的实际 HTTPS Worker origin'
npm run build:pages
```

根站点或自定义域名使用 `/`。输出 `pages-dist/` 只含静态文件，API 不在其中。未设置后端地址或后端暂不可用时，页面使用本地解析；这不会产生全站持久曝光统计，也不代表 DeepSeek 调用已连通。

可访问后端 `/api/match/status` 检查 `configured`、`database_ready`；正常连接时前者应为 true。页面成功调用返回 `model_status=ready`、`engine=llm` 才表明真实在线模型已完成解析。`GET /api/match/stats` 查看所有对象计数；匹配响应的 `reason` 是页面神名下方的一句原因。

本地已验证：追偶像语义及原因、旧模式、模型输出校验，共 16 项测试；独立 Worker 的跨域预检、允许／拒绝来源、D1 去重；仓库子路径构建及前端秘密标记扫描。Cloudflare 远程接口、真实 DeepSeek 调用及数据库已验证；重复线上请求返回相同对象且只增加一次计数。网页最终验收应确认 Actions 发布成功，并在上述网页入口检查图片和真实 API 调用。
