# On a Cut 刷脂助手 — 协作说明

每次修改前先读 `docs/SPEC.md`（需求、规则、功能模块、数据结构），改完后同步更新它。

- 源码只有一个文件：`src/on-a-cut.html`（页面主体，不含 `<html>/<head>/<body>`，原生 JS，无依赖、无构建工具）。
- `index.html` 是生成物：运行 `sh build.sh src/on-a-cut.html index.html`，不要手改。
- 线上页面是 Claude Artifact：https://claude.ai/artifact/MT6SV255xgb8Y2Jm42kJS3 ，用 `src/on-a-cut.html` 发布到这个 URL（保持同一链接），能力声明为 `db`、`user`、`sample`。
- 改完用 Playwright 在 400px 宽度下打开 `index.html` 走一遍受影响的流程，确认无报错、无横向溢出，再发布和提交。
- 界面与回复都用简体中文。
