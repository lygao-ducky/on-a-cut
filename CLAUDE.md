# On a Cut 刷脂助手 — 协作说明

每次修改前先读 `docs/SPEC.md`（需求、规则、功能模块、数据结构），改完后同步更新它。

- 源码三个文件：`src/foods.js`（食物库，只有数据）、`src/engine.js`（计算引擎，纯函数，依赖 foods.js）和 `src/on-a-cut.html`（页面主体，不含 `<html>/<head>/<body>`）。foods.js 和 engine.js 都不能出现 `</script>`。原生 JS，无依赖。
- 构建：`sh build.sh`（无参数），生成 `dist/page.html`、`index.html` 和 `sw.js`。三个都是生成物，要提交，不要手改。`index.html` 的外壳在 `src/shell-head.html` / `src/shell-tail.html`，service worker 模板在 `src/sw.js`。
- 图标与 manifest：改颜色只改 `tools/brand.json`，然后运行 `node tools/make-icons.js` 和 `sh build.sh`。生成的 `icons/*.png` 和 `manifest.webmanifest` 要提交，不要手改。
- 提交前必须运行 `node --test tests/` 并全部通过。
- 线上环境有两个：
  - GitHub Pages https://lygao-ducky.github.io/on-a-cut/ 是主运行环境（离线可用、可安装），推送到 `main` 后自动发布 `index.html`。
  - Claude Artifact https://claude.ai/artifact/MT6SV255xgb8Y2Jm42kJS3 是 AI 增强版（云端同步、AI 估算），用 `dist/page.html` 发布到这个 URL（保持同一链接），能力声明为 `db`、`user`、`sample`。
  - `dist/page.html` 里不能有 service worker 和 manifest，`build.sh` 会检查。
- 改完用 Playwright 在 400px 宽度下走一遍受影响的流程，确认无报错、无横向溢出，再发布和提交。涉及 service worker、离线、更新的改动必须通过 `node tools/serve.js . 8080` 用 http 打开（`http://127.0.0.1:8080/on-a-cut/`）；`file://` 下 service worker 不会注册。
- 页面主体不能占用 `#upd`、`#upd-go`、`#upd-x` 这三个 id（外壳的更新横条在用）。
- 界面与回复都用简体中文。

## 冒烟脚本

```
sh build.sh
cd tools && npm install && npx playwright install chromium
node smoke.js
```

`npm run smoke` 等价于 `node smoke.js`。脚本把构建产物复制到临时目录，用 `tools/serve.js` 挂在 `/on-a-cut/` 下，在 400×800 的无头 Chromium 里跑，截图存到 `tools/out/`（不提交）。有失败时退出码为 1。

它不进入 `node --test tests/`：`tests/` 保持零依赖，冒烟脚本依赖 Playwright，只装在 `tools/` 里。

7 项各覆盖什么：

0. **静态检查**：`dist/page.html` 里没有 service worker 和 manifest；`index.html` 里各恰好 1 处；`sw.js` 的版本占位符已替换。
1. **新用户引导**：普通浏览器第 1 步没有 Safari 迁移提示；`navigator.standalone===true` 时有；走完 4 步后数据已保存。
2. **搜索记一样食物**：搜“鸡胸”，点第一条结果的第一个份量，记录出现、剩余热量变化。
3. **撤销**：份量减到 0 删除，点 toast 里的“撤销”恢复，数据和删除前一致。
4. **对冲页选甜点**：分组标签切换、选甜点后出现份量行和结论、记入后多一条记录。
5. **离线刷新**：service worker 控制页面后断网刷新，页面和数据都在；字体请求挂起时页面 3 秒内渲染完。
6. **更新横条**：发布新版本后横条出现；和 toast 不重叠、“撤销”点得到；抽屉打开时隐藏；✕ 只关本次；点横条只刷新一次，数据不变，旧缓存清掉。

## 施工规则

1. 每个批次是一个新的 Claude Code 会话，基于 `main` 最新代码施工。
2. 先做任务单 ① 里的“开工前确认”，任何一项不满足就停下报告，不要开工。
3. 任务单与仓库实际代码冲突时，以代码为准、按最小改动实现，并把差异写进 `PROGRESS.md` 的遗留问题。
4. 不扩大范围：任务单没写的不做，发现的问题记进遗留问题。
5. 完成任务单 ③ 的每一项验收后，再执行 ④ 的收尾。
6. `PROGRESS.md` 在文件顶部（标题下方第一节）追加本批次摘要，严格分三段：已完成改动、技术约束 / 结构变更、遗留问题 / 注意事项。
7. 回复的最后一行写 `已合并到 main：<提交号>` 或 `待合并分支：<分支名>`。

以后任务单的开头只写一句：“这是一个新的 Claude Code 会话，先读 CLAUDE.md 的施工规则，再按下面的任务单施工。”
