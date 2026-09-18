<div align="center">

# 高校资格证刷题zcq版

**教育心理学 460 题 · 教育学 488 题 · 两套教育学真题卷**

答题 → 看红绿反馈和针对性解析 → 已记住的划走，还不会的进入下一轮。

[**在线开始刷题 ↗**](https://zcq19991029.github.io/education-psychology-quiz/)

</div>

<p align="center"><img src="docs/images/desktop.png" alt="高校资格证刷题zcq版桌面端：科目切换、题型选择、题目卡片与学习统计" width="960" /></p>

## 一眼看懂

| 刷题 | 题库与 AI | 个人进度 |
| --- | --- | --- |
| 心理学：单选 135、多选 85、判断 240；教育学：单选 317、多选 84、判断 87 | 上传 PDF、DOCX、TXT、MD 或 JSON；可粘贴文字 | 本地学习账号分别保存进度 |
| 顺序或随机；待掌握、错题、未做、已刷回看 | DeepSeek、硅基流动预设与自定义模型 ID | 教育心理学与教育学分别统计 |
| 答错标红，正确项标绿；上一题可撤回误点的“已记住” | 接入自己的 API Key 后，按作答实时生成针对性解析 | 已刷／总题、未刷和待掌握数量刷新后保留 |

<table>
  <tr>
    <td align="center" valign="top" width="50%"><strong>手机刷题</strong><br /><img src="docs/images/mobile.png" alt="移动端的科目切换、单选卡片和复习按钮" width="300" /></td>
    <td align="center" valign="top" width="50%"><strong>答案反馈</strong><br /><img src="docs/images/feedback.png" alt="错选 C 标红，正确 D 标绿，并解释为什么 D 符合题意" width="300" /></td>
  </tr>
</table>

答题卡上的**上一题／下一题**用于回退或暂时跳过；回退会撤销刚才误点的“已记住”。刷新页面会恢复当前题和出题队列。学习概览列出已刷题目，点击可看上次作答；练习范围中的“已刷题回看”可连续复习并重新作答。

页面顶部的**使用公告**说明刷题流程、进度保存方式和 AI Key 的用途。不配置 Key 也能直接使用公开题库、查看标准答案和题目已有解析。

## 资料导入

选择侧边栏的**教育学**或**教育心理学**，再点**导入资料**。JSON 题库可以直接预览和导入；PDF、DOCX、TXT、MD、粘贴文字会调用你在 **AI 设置** 中配置的模型，识别单选、多选、判断和答案。预览中可以改题型、答案，或删除识别错误的题目。网站会比较本次资料、当前题库中的相似题，逐题展示答案并让你选择**删除重复**或**保留**，答案冲突会单独标出。

<p align="center"><img src="docs/images/import.png" alt="导入资料页面，支持选择文件、粘贴资料并预览识别结果" width="760" /></p>

**网页导入的题目先保存在当前浏览器。**要让所有访问者刷到你后来导入的新题，点“导出当前科目题库 JSON”，核对后把下载的 `education.json` 或 `questions.json` 更新到仓库的 [教育学公共题库](data/education.json) 或 [心理学公共题库](data/questions.json)。这一步需要仓库维护者提交并推送。扫描版 PDF 需要先做 OCR；旧版 `.doc` 请另存为 `.docx`。

## 教育学资料

四份教育学 Word 已整理上线：三份题库去重后有 **478 道客观题**，两套真题卷另有 **10 道单选题**纳入刷题模块，共 **488 题**。名词解释、材料分析和论述题可从侧边栏的**教育学真题卷**展开阅读。客观题来源为 [data/education.json](data/education.json)，真题卷参考资料见 [data/education-papers.json](data/education-papers.json)，提取及去重记录见 [data/education-import-report.json](data/education-import-report.json)。原多选第 29、30 题内容和答案完全相同，发布时保留一题。

<p align="center"><img src="docs/images/education.png" alt="教育学题库与单选、多选、判断题数量" width="760" /></p>
<p align="center"><img src="docs/images/papers.png" alt="两套教育学真题卷的客观题与主观题资料" width="760" /></p>

## AI 解析与模型

到 **AI 设置** 选择服务商，填写 API Key，使用预设模型或输入自定义模型 ID。预设包含 DeepSeek 的 `deepseek-flash`、`deepseek-v4-pro`，以及硅基流动的 `deepseek-ai/DeepSeek-V4-Flash`、`Pro/deepseek-ai/DeepSeek-V4`、`Qwen/Qwen3.6-27B`。优先推荐 DeepSeek 的 `deepseek-flash`：官方将其定位为更快的 Flash 模型；本站会对 DeepSeek 请求关闭深度思考以缩短等待。模型切换会自动保存，“测试连接”会显示实际请求的模型。也可以读取服务商当前可用模型列表。自定义接口使用 OpenAI 兼容的 `/chat/completions` 和 `/models` 路径。

<p align="center"><img src="docs/images/settings.png" alt="AI 设置页面：服务商、模型、接口地址和 API Key" width="760" /></p>

答题后先显示即时红绿判题；配置自己的 Key 后，AI 会**流式显示**正在生成的文字，完成后对 **A、B、C、D 四个选项逐项解释**，判断题则解释两个判断项。题库原文没有解析时，网站不会把通用提示冒充知识点解析。第 1 道心理学单选题已有人工补充的四项辨析，无需 Key 即可查看。AI 内容可出错，复习时请核对原教材。
如果硅基流动账号已经欠费，换成代金券适用模型后仍可能被平台限制调用；请核对欠费状态、代金券有效期和适用范围。本站会显示服务商返回的原始错误以及实际请求的模型，无法绕过服务商的账号计费限制。

Key 按**本地学习账号**分别保存在当前浏览器，默认只保存到当前浏览器会话；勾选后才长期保存在此浏览器。请求由浏览器直连服务商，本站没有收取 Key 的服务器。你在自己电脑输入的 Key 不会随 GitHub Pages 分享给其他设备；同一浏览器的本地账号没有密码保护，公共电脑不要长期保存，使用后点“清除本账号 Key”。模型会更新，预设可能变化；可使用“读取可用模型”或手动填写服务商公布的模型 ID。参考：[DeepSeek 官方 API 文档](https://api-docs.deepseek.com/)、[硅基流动 Chat Completions 文档](https://docs.siliconflow.cn/docs/api/chat-completions-post)。

## 学习账号与设备

网站中的“学习账号”是**本地学习档案**：同一浏览器中切换名字，各自的作答与已记住状态互不影响；不同浏览器和设备天然各有本地数据。它不需要注册，也**不提供跨设备登录同步或密码保护**。公开发布的题库对所有人相同，但一个人的刷题结果不会写回 GitHub，也不会自动变成其他人的进度。

如果以后需要同一人在手机和电脑之间同步，可在下一阶段接入云端认证与数据库。

## 本地运行与代码

需要 Node.js 18+，在项目目录运行：

```powershell
npm start
```

打开 <http://127.0.0.1:8000>。网页为静态页面，部署到 GitHub Pages 不依赖服务器。PDF 和 DOCX 读取库已放在 `vendor/`，许可证一并保留；本地运行无须执行 `npm install`。

原教育心理学题库共有单选 135、多选 85、判断 240 道，合计 **460 道**。原判断题编号有跳号，不能据末题编号推算总数。原始 Word/PDF 文件及提取中间文件未公开上传。题卡统一标注**题目来源：ZCQ**。
