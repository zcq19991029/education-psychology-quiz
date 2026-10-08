---
name: quiz-pages-release
description: 开发和维护高校资格证刷题产品，处理题库导入、练习交互、AI解析、学习数据保护与Sites Worker/D1发布验证。
---

# 高校资格证刷题产品开发与维护

本技能随 education-psychology-quiz 产品仓库维护。先读仓库 README.md、项目交接.md、package.json 与 .openai/hosting.json，核对当前源码、线上版本和实际绑定，路径均以产品仓库根目录为基准。

## 产品开发

修改题库导入、练习交互、AI解析、离线版或缓存机制前，按需阅读 [产品开发经验](references/qualification-quiz-playbook.md)。当前正式产品是 Sites 托管的 Worker + React/Vinext，D1 的 question_banks 按 user_id 与 subject 隔离；浏览器 IndexedDB/localStorage 用于离线及设备级回退。旧 GitHub Pages 实现仅为历史版本，不能默认将它作为当前发布目标。

导入先提供可编辑预览，保留来源和答案证据；AI结果由使用者确认，不直接覆盖标准答案。更新、切换主题和修复缓存必须保留题库、进度及用户设置。不得提交学生资料、浏览器密钥、凭据或本地 source-materials。

## 发布与验收

- 仅修改技能或说明文档时，检查内容和Git差异并提交；无需修改产品版本、构建或部署应用。
- 产品功能变更按 package.json 的真实脚本完成类型检查和构建，核对 Worker 发布产物及 D1 绑定。涉及数据写入时比较修改前后的用户隔离、题库数量和学习记录。
- 实际发布时从电脑读取准确本地时间，按现有版本机制同步界面版本与缓存键；只有仓库确实存在并适用于当前实现的 stamp-release 脚本才运行，不能照搬历史 app.js/index.html 的位置。
- Sites 发布使用同一个完整Git SHA生成归档、保存版本并部署。若可用，遵循 sites-app-maintainer 的同SHA发布流程。超时后先查发布状态，不盲目重复部署。
- 验证正式URL的可见版本、Worker API、D1绑定与关键用户流程；GitHub源码提交或Pages工作流成功不代表Sites产品已更新。
- 只有明确维护历史Pages版本时才检查Pages工作流、静态资产缓存键和该版本入口。

报告源码提交、是否实际部署、版本及已经验证的结果。形成可复用且已验证的产品经验时，更新本仓库的技能参考文档。
