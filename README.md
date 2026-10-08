# 高校资格证刷题 Sites 版

高校教师资格证刷题工具，当前版本使用 Vinext 构建 Cloudflare Worker，并绑定 Sites D1 数据库。导入题库后，登录用户的数据会按 ChatGPT 账号同步到云端，避免依赖本地文件位置。

## 在线地址

- Sites：[education-psychology-quiz-sites.zcq991029.chatgpt.site](https://education-psychology-quiz-sites.zcq991029.chatgpt.site/)
- GitHub：[zcq19991029/education-psychology-quiz](https://github.com/zcq19991029/education-psychology-quiz)

## 当前架构

- `app/`：Vinext 页面、布局和 Worker API 路由。
- `app/api/health`：检查 Worker 是否能访问 D1。
- `app/api/question-banks`：按账号读写题库的 GET/PUT API。
- `db/schema.ts`：D1/Drizzle 表结构，主键为 `user_id + subject`，不同账号互相隔离。
- `drizzle/`：由 Drizzle 生成并随 Sites 版本应用的迁移文件。
- `public/`：刷题前端、题库数据、PDF/DOCX 解析资源。
- `dist/server/` 和 `dist/client/`：Vinext Worker 构建产物。
- `.openai/hosting.json`：Sites 项目 ID 与逻辑 D1 绑定 `DB`。

## 导入同步行为

1. 已登录时，打开科目会优先读取当前账号的云端题库。
2. 导入完成后先保存本地缓存，再通过 Worker API 写入当前账号的 D1 记录。
3. 每个账号只能读写自己的 `question_banks` 记录，不会把一个账号的题库合并到另一个账号。
4. 未登录、离线或云端暂时不可用时，仍保留 IndexedDB 本地保存，并在界面提示同步状态。
5. 题库内容不会写入 GitHub，也不会因为删除本地导入文件而丢失已经同步的云端数据。

## 本地验证

```powershell
npm ci --no-audit --no-fund
npm run db:generate
npm run build
npx tsc --noEmit
```

启动本地 Worker：

```powershell
npm start -- --port 8787
```

访问 `http://127.0.0.1:8787/`；`/api/health` 应返回 `ok: true`，未登录调用题库 API 应返回 401。Windows 中文路径下，`scripts/run-framework.mjs` 会使用临时 ASCII junction，避免 Vite/Rolldown 的路径编码问题。

## Sites 发布约定

1. 保留 `.openai/hosting.json` 中的 `project_id` 和 D1 逻辑绑定 `DB`。
2. 修改数据库结构时先运行 `npm run db:generate`，只新增迁移，不改写已应用的迁移。
3. 使用 Sites 提供的 `site-workflow.mjs` 完成构建、源代码推送和归档，再保存并部署对应版本。
4. 发布后检查版本状态、线上地址和 D1 表；不要把未匹配当前提交的旧归档直接上传。


## 产品专用维护技能

[高校资格证刷题开发与维护](.agents/skills/quiz-pages-release/SKILL.md) 与产品源码一起维护，入口索引见 [skills/README.md](skills/README.md)。本机共享安装目录链接到这份原件，修改说明文档不触发产品发布。
