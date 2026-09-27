# 高校资格证刷题 Sites版

高校教师资格证教育心理学、教育学刷题工具。当前 Sites 版本使用 Vinext 生成 Cloudflare Worker，并绑定 Sites D1；题库导入同步将在此统一后端上继续接入。

## 在线站点与源码

- 在线站点：[education-psychology-quiz-sites.zcq991029.chatgpt.site](https://education-psychology-quiz-sites.zcq991029.chatgpt.site/)
- GitHub：[zcq19991029/education-psychology-quiz](https://github.com/zcq19991029/education-psychology-quiz)

## 当前架构

- `app/`：Vinext 页面、布局和 Worker API 路由。
- `app/api/health`：D1 连通性检查。
- `app/api/question-banks`：按 ChatGPT 账号隔离题库的 GET/PUT API；账号身份来自 Sites 注入的 `oai-authenticated-user-*` 请求头。
- `db/schema.ts`：D1/Drizzle 表结构。题库主键为 `user_id + subject`，不会把不同账号的数据混在一起。
- `drizzle/`：迁移文件，发布前由 Sites 工作流携带并应用。
- `public/`：现有刷题前端、题库数据、PDF/DOCX 解析资源。
- `dist/server/` 与 `dist/client/`：Vinext Worker 构建产物。
- `.openai/hosting.json`：Sites 项目 ID 和逻辑 D1 绑定 `DB`；Worker 版本不再使用静态站配置。

## 本地验证

```powershell
npm ci --no-audit --no-fund
npm run db:generate
npm run build
npx tsc --noEmit
```

Windows 项目路径包含中文时，`scripts/run-framework.mjs` 会自动通过临时 ASCII junction 运行 Vite/Rolldown，避免原生构建器崩溃；输出仍写回当前仓库的 `dist/`。构建完成后可用：

```powershell
npm start -- --port 8787
```

然后访问 `http://127.0.0.1:8787/`。未登录请求题库 API 会返回 401，这是账号隔离保护；`/api/health` 可用于确认 Worker 与本地 D1 已启动。

## Sites 发布约定

1. 修改 `.openai/hosting.json` 时保留已有 `project_id`，D1 逻辑绑定保持为 `DB`。
2. 修改表结构后先运行 `npm run db:generate`，只追加新的迁移，不改写已经发布的迁移。
3. 运行 Sites 提供的 `site-workflow.mjs` 完成构建、源代码推送和归档，再调用 Sites 保存版本并部署；不要手工上传未构建的源码目录。
4. 发布后检查 Sites 版本状态和线上 URL，再继续接入导入同步。

## 后续导入同步

导入流程将以 D1 为云端源：登录账号只能读写自己的 `question_banks` 记录；浏览器 IndexedDB 仅作为离线缓存和失败回退。导入确认后先写入云端，返回成功后更新本地缓存，避免因本地文件移动或浏览器缓存导致题库丢失。
