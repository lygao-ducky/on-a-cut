# 阶段性开发交接摘要

## 2026-11-13 · 批次 3：PWA 离线安装 + GitHub Pages + 施工规则 + 冒烟脚本（v9）

`src/engine.js`、`src/foods.js`、`tests/` 没有改动；`src/on-a-cut.html` 只改了任务单 2.6 指定的一行。没有新增任何 localStorage 键和持久化字段。

### 已完成改动

- **可安装、可离线的 GitHub Pages 版**（`index.html`）：
  - 新增 `src/shell-head.html` / `src/shell-tail.html`（外壳，原来写在 `build.sh` 的 printf 里）和 `src/sw.js`（service worker 模板）。
  - 第一次打开后断网也能用；发布新版本后页面底部出现“有新版本，点此刷新”横条，点了才刷新，任何情况下都不自动刷新。
  - 数字字体的 Google Fonts `<link>` 在 `index.html` 里改成不阻塞渲染，离线或字体请求卡住时用系统字体。
- **Artifact 版**（`dist/page.html`）：不注册 service worker、不引用 manifest。和 47dce36 相比只多了 2.6 那一处插入，已发布到原链接（Version 12，能力声明沿用 `db`、`user`、`sample`）。
- **`src/on-a-cut.html`**：首次设置第 1 步，在说明文字和表单之间加了一段读 `window.__onacutHomeNew` 的提示（iPhone 主屏幕版第一次打开时，告诉用户怎么从 Safari 迁移数据）。
- **`build.sh`**：生成 `dist/page.html` 的那一段没动；之后新增素材检查、主题色读取、字体行替换、拼 `index.html`、生成 `sw.js`、构建断言。最后一行输出带版本号。
- **图标与 manifest**：`tools/brand.json`（颜色）、`tools/make-icons.js`（零依赖，自带 PNG 编码）；生成并提交了 `icons/` 下 4 个 PNG 和 `manifest.webmanifest`。
- **工具**：`tools/serve.js`（零依赖静态服务器，挂在 `/on-a-cut/` 下）、`tools/smoke.js`（Playwright 冒烟脚本，7 项）、`tools/package.json` 和 `package-lock.json`。
- **其他新文件**：`.nojekyll`（空）、`.gitignore`（`tools/node_modules/`、`tools/out/`）。
- **文档**：`CLAUDE.md`（构建、图标、两个线上环境、走查方式、“冒烟脚本”和“施工规则”两节）、`README.md`（部署一节重写，新增“安装到手机 / 离线使用”和“iPhone 主屏幕版的数据是单独的”）、`docs/SPEC.md`（构建与外壳、PWA 小节、运行环境限制、变更记录 v9）。
- **验证**：
  - `node --test tests/` 44 组全部通过，数量不变。
  - `node tools/make-icons.js` 连续运行两次没有 diff；换色后图标和 manifest 的两个颜色字段都变，改回后工作区干净；颜色格式不对时报错退出。4 个 PNG 已目视检查。
  - `sh build.sh` 连续构建两次没有 diff（版本 2168733911）；改 `src/on-a-cut.html` 一个字后版本号变成 4136550087，还原后变回。
  - 构建断言自测：往 `dist/page.html` 塞 `serviceWorker`、改掉字体 link 行、拿走 manifest，三种情况都报错退出。
  - `node smoke.js` 7 项全部通过，退出码 0。
  - 400px 走查（通过 `serve.js`，浅色和深色各一遍）：四个页签没有横向溢出和控制台报错；横条出现后滚到底，最后一行在横条上方；横条和 toast 同时出现时 toast 在上、相隔 12px，“撤销”点得到；深色模式下横条是浅绿底深色字，清晰可读；`file://` 打开正常、不注册 service worker。
  - 红线自查：`git diff 47dce36 --stat` 里没有 `src/engine.js`、`src/foods.js`、`tests/`；`src/on-a-cut.html` 的 diff 只有 1 行；全仓没有新的 `localStorage.setItem`，新增代码里出现的键名只有 `onacut.v1`（外壳里只读）。

### 技术约束 / 结构变更（后续批次直接读取）

- **三个构建产物**：`dist/page.html`（Artifact）、`index.html`（Pages）、`sw.js`（Pages 的 service worker）。两个页面产物的差别只在外壳（`src/shell-head.html`、`src/shell-tail.html`）里处理，页面主体不判断自己在哪个产物里。
- **`window.__onacutHomeNew`**：由 `src/shell-head.html` 的内联脚本在页面脚本之前设置，值是 `navigator.standalone===true && localStorage.getItem("onacut.v1")===null`，出错时为 `false`。只读 localStorage。页面里**唯一**读取它的地方是首次引导第 1 步（`renderSheet()` 的 `step===0` 那一行）。Artifact 版里是 `undefined`。它在页面加载时算一次，之后不更新；没完成设置就关掉再打开，提示还在（引导完成前页面不写 `onacut.v1`）。
- **更新横条 `#upd` 和 `html.upd-on`**：
  - `#upd` 在 `src/shell-tail.html` 里，默认 `hidden`。里面两个按钮 `#upd-go`（“有新版本，点此刷新”）和 `#upd-x`（✕），都不带 `data-act` / `data-tab`。
  - 显示条件：有新版本装好在等（且页面已被旧版本控制）+ 这次打开没点过 ✕ + `#sheet` 处于 `hidden`。
  - 横条显示时 `<html>` 带 class `upd-on`，隐藏时去掉。
  - 层级：nav `z-index:20` < `#upd` 30 < `#sheet` 40 < `#toast` 50。
  - 位置：`#upd` 的 `bottom` 是 `72px + 安全区`（底部导航上方）；`html.upd-on #toast` 的 `bottom` 从 `92px` 改为 `124px + 安全区`（在横条上方）；`html.upd-on body` 的下内边距从 `84px` 改为 `136px + 安全区`。任务单给的起点数值实测可用，没有调整。
  - 抽屉打开时横条隐藏，靠 `MutationObserver` 监听 `#sheet` 的 `hidden` 属性。**所以开关抽屉必须继续通过 `#sheet` 的 `hidden` 属性**，改成别的方式（比如 class）横条就不会跟着藏。
  - ✕ 的状态、“待更新”的状态都是外壳脚本里的内存变量，不写存储。
- **页面主体不能占用 `#upd`、`#upd-go`、`#upd-x` 这三个 id。**
- **缓存名格式**：`onacut-<cksum>`。`<cksum>` 是 `cat index.html manifest.webmanifest icons/*.png src/sw.js | cksum` 的第一个字段，只和内容有关。新版本激活时只删其他 `onacut-` 开头的缓存。
- **service worker 行为**：只处理同源 GET；预缓存 7 项（`./`、`./index.html`、manifest、4 个图标）；导航请求一律返回缓存里的 `./index.html`；运行时不写缓存；安装后不自动接管，收到 `{type:"SKIP_WAITING"}` 才接管；文件里不能出现 `localStorage`。
- **颜色唯一来源**：`tools/brand.json` 的 `color`（`#RRGGBB`）。图标、manifest 的 `theme_color` / `background_color`、`<meta name="theme-color">` 都从它来。改颜色的流程：改 `brand.json` → `node tools/make-icons.js` → `sh build.sh`。`build.sh` 不生成图标，只从 `manifest.webmanifest` 读主题色。
- **字体 link 行**：`build.sh` 按整行精确匹配 `src/on-a-cut.html` 第 3 行的那个 `<link>`。以后改这一行（换字体、加参数）要同步改 `build.sh` 里的 `FONT_URL`，否则构建报“没找到字体 link 行”。
- **构建断言**：`index.html` 里 `serviceWorker.register` 这段文字必须恰好出现 1 次。外壳脚本里不要给 `navigator.serviceWorker` 起别名再调 `register`，注释里也不要写这个词。
- **冒烟脚本的选择器依赖**：`#cu-q`、`#sr .sr-i .pbtn`、`.entry [data-act="dec"]`、`#toast [data-act="undo"]`、`[data-act="profile"]`、`[data-act="shclose"]`、`[data-act="obnext"]`、`#dr-pf-age` / `#dr-pf-h` / `#dr-pf-w`、`[data-act="hzg"]` / `hz` / `hzq` / `hzadd`、`.hero .big`、`.verdict`、导航按钮文字。页面改了这些，`tools/smoke.js` 要跟着改。

### 遗留问题 / 注意事项

- **和任务单不一致的地方**：
  - **GitHub Pages 没有用 `gh` 开启**：这台机器没装 `gh`（`command not found`），按任务单没有重试。用公开接口查到仓库 `has_pages: true`，线上地址在施工前就返回 200，说明 Pages 之前已经开启。线上验证结果见本节最后一条。
  - **`.gitignore` 多了一行 `tools/out/`**（任务单 2.7 只写了 `tools/node_modules/`，2.8 要求截图目录也忽略，合在一起写了）。
  - **冒烟第 3 项“数据和撤销前一致”的比较方式**：比的是“删除前那一刻”和“撤销后”的 localStorage，去掉了 `updatedAt` 字段（每次改动都会更新的时间戳，撤销后必然不同）。第 6 项“点刷新前后一致”是整串原样比较。
  - **冒烟脚本不把字体请求失败算作控制台报错**：离线时 `fonts.googleapis.com` 请求必然失败并在控制台留一条 error，这是预期行为。其他 console error 和 pageerror 照常判失败。
  - **冒烟第 2、3 项共用一个流程，第 5、6 项共用一个环境**（任务单写的是“每个流程用全新的 context”，同时又要求 3 在 2 的基础上、6 在 5 的环境里）。其余每项各用新的 context。
  - **Artifact 发布后的线上确认没有在真实页面里做**：这个会话打不开需要登录的 claude.ai 页面。替代做法：确认了发布内容和线上旧版本只差 2.6 那一行；另外在本地用 `window.claude` 的桩加载 `dist/page.html`，“云端已同步”、搜不到时的“AI 估算”按钮、引导第 1 步没有 Safari 提示（即使 `navigator.standalone===true`）都正常，没有 service worker 注册。**请在真实 Artifact 链接里再看一眼这三点。**
- **已知限制**：
  - **Pages 上直接访问 `…/on-a-cut/dist/page.html`，在 service worker 接管后会得到 `index.html`**：任务单规定导航请求一律返回缓存的 `./index.html`。`dist/page.html` 本来只用来发布 Artifact，没人直接访问，没有处理。
  - **`<meta name="theme-color">` 是固定的品牌色**，深色模式下浏览器顶栏仍是深绿色，不跟随页面的深色配色。
  - **点过 ✕ 之后，这次打开期间不会再提示**，即使后面又发布了更新的版本；重新打开页面才会再出现。
  - **多个标签页**：在一个标签页点了刷新，其他标签页不会自动刷新（按任务单），它们继续显示旧页面；那些页面上的横条如果已经显示，点一下会直接重新加载。
  - **Artifact 发布时平台有一条警告**：页面里有脚本触发的文件下载，而 Artifact 查看器不允许下载。这是原有的 `exportData`（47dce36 就有），在 `window.claude` 存在时走的是复制文本，不会触发下载，功能不受影响。没有改动。
- **线上验证结果（推送 d9ab8d4 之后，2026-11-13）**：通过，不需要用户手动开启 Pages。
  - `https://lygao-ducky.github.io/on-a-cut/`、`sw.js`、`manifest.webmanifest`（Content-Type 是 `application/manifest+json`）、`icons/icon-192.png` 都返回 200。
  - 线上 `sw.js` 第一行是 `const VERSION="2168733911";`，和本地一致，推送后约半分钟生效。这也说明 Pages 的来源就是 `main` 分支根目录。
  - Playwright 打开线上地址：service worker 控制页面，缓存只有 `onacut-2168733911`；记一条食物后断网刷新，今天页和记录都在，没有报错和横向溢出。
  - 没验证的一点：Pages 的来源设置没有通过接口直接读（需要 `gh` 或令牌），是从上面“推送后线上内容随之更新”推出来的。
- **没覆盖的边界（交给“真机验证”环节）**：
  - iPhone 主屏幕安装、图标和启动外观、`navigator.standalone` 下的迁移提示、Safari 与主屏幕版的数据隔离。
  - Android Chrome 的安装提示和 maskable 图标裁切。
  - iOS 上 service worker 的更新时机（回到前台时检查、60 分钟检查一次）和横条在刘海 / 底部安全区机型上的位置。
  - 冒烟脚本只跑了无头 Chromium，没有跑 WebKit / Firefox。
- **留给后续批次**：
  - 视觉改版（部门 6）改颜色时只改 `tools/brand.json`，见上面的流程。页面里的 `--accent` 是另一处定义（`src/on-a-cut.html` 的 CSS 变量），目前和 `brand.json` 数值相同，但没有联动。
  - 引导抽屉仍然没有恢复入口（任务单 2.6 的背景），这次只加了提示文字。
  - 之前批次的遗留都没有处理：`fav` 里指向已删除食物的 id 不清理；`settings` 多设备同时修改整体覆盖；抽屉打开时云端拉到新数据不自动刷新；组合只能在整理模式里编辑；TAGS 过滤没做。

## 2026-11-13 · 批次 2B.1：对冲页甜点分组、交接档案文案、两处交互修补（v8.3）

只改了 `src/on-a-cut.html` 和文档；`src/engine.js`、`src/foods.js`、`tests/` 没有改动，没有新增任何持久化字段。

### 已完成改动

- **`src/on-a-cut.html`**：
  - **对冲页甜点分组**：甜点选择区上方加了一排小标签“甜点 18 / 饮品零食 14 / 我的 N”（数量是实际个数），默认“甜点”，格子只显示当前组。切换组只改 `hzg`，不动 `hz`：已选中的甜点、份量行、两个按钮、三张卡片和结论条都不变。
  - **`hide` 过滤**：分类格子（`catChips`）和对冲页甜点列表都加了 `!f.hide`。全文搜索过，页面里直接遍历 `FOODS` 的只有这两处（另一处是开头从 `E` 解构），没有别的要补。
  - **AI 交接档案**：`aiBrief` 里“甜点对冲：”一行改为随 `settings.spread` 两种写法（文字照任务单）；其余各行没动，目标数字仍是 `S.settings.t` 的原目标。
  - **失焦不丢点击**：份量 / 时间输入框失焦时只保存数据，重绘推迟 350ms。
  - **回车保存组合**：`cbsave` 的逻辑抽成 `cbSave()`，“存为组合”的名称框按回车也会保存。
- **文档**：`docs/SPEC.md`（对冲页分组、交接档案两种文案、“页面遍历 `FOODS` 时一律过滤 `hide`”、份量输入的失焦说明、组合名称回车、变更记录 v8.3）；`README.md` 对冲一行补了分组。
- **生成物**：重新构建 `dist/page.html`、`index.html`。
- **验证与发布**：
  - `node --test tests/` 44 组全部通过，数量不变。
  - Playwright 在 400px 宽走查 56 项全部通过，没有控制台报错和横向溢出，覆盖任务单 ③ 的每一项。对冲一致性实测：黄焖鸡 ×2 + 炒饭后预演全糖奶茶，结论条“仍超 755 kcal → 接下来 5 天每天少 150 kcal，另有 5 kcal 摊不完，不再追”，记入后之后 5 天每天实际扣 150、第 6 天为 0。
  - 把 2B 的走查脚本（129 项）适配分组后重跑：126 项通过；3 项不过，都是旧脚本在失焦后**立刻**断言“输入框已消失 / 标题已更新”，现在按设计要等 350ms，对应的数据断言都通过。
  - 红线自查：localStorage 键名没变；`defaults()`、`migrate()`、`hzPill`、`tgtOf`、`spreadOf`、`spreadText`、`overNote`、`calcLED` 都不在 diff 里。
  - 已发布到原 Artifact 链接，能力声明沿用 `db`、`user`、`sample`。

### 技术约束 / 结构变更（后续批次直接读取）

- **`hzg`**：对冲页当前的甜点分组，取值 `"sweet" | "snack" | "my"`，初始 `"sweet"`，和 `hz` 声明在一起。**只在内存中**，不写 localStorage，刷新页面回到“甜点”。`viewHedge()` 里如果 `hzg` 不合法，或者是 `"my"` 而“我的”为空，会设回 `"sweet"`。
- **甜点分组规则**（都在 `viewHedge()` 的 `grp` 里）：
  - 甜点：`FOODS` 中 `cat==="sweet" && !hide && g==="sweet"`；
  - 饮品零食：`FOODS` 中 `cat==="sweet" && !hide && g!=="sweet"`（兜底：`g` 不是 `"sweet"` 的都归这里，不会漏）；
  - 我的：`settings.my` 中 `cat==="sweet"`，为空时不显示标签。
  - 点击分支 `hzg` 只做 `hzg=v`；`hz` / `hzq` / `hzclear` / `hzadd` 没改，记入后停在原来的分组。
- **页面遍历 `FOODS` 一律过滤 `hide`**：以后新增任何 `FOODS.filter / forEach / map` 都要带 `!f.hide`。按 id 查找（`findFood`、`FBY`、`favFood`）不过滤，历史记录、最近、常吃里的 `bag2` 照常显示、照常能记录。
- **`laterRender()` / `rT`**：`rT` 是待执行重绘的定时器 id（0 表示没有）。`laterRender()` 安排 350ms 后 `render()`，重复调用会重新计时。**`render()` 第一行会 `clearTimeout(rT); rT=0`**，所以任何立即重绘都会取消待执行的那次。只用在“失焦后收尾”这种不急的重绘上；需要马上看到结果的地方仍然直接 `render()`。
- **`commitQ(el, later)`**：保存逻辑不变；`later` 为真时最后调 `laterRender()`，否则 `render()`。回车路径传一个参数（立刻重绘），`focusout` 路径传 `true`。`focusout` 里时间框分支是 `tEdit=null; laterRender()`，时间仍在 `change` 监听里保存。
- **`cbSave()`**：存为组合的全部逻辑，不负责重绘。两个调用方：点击分支 `cbsave`（之后走统一的 `render()`）和 `keydown` 里 `cb-n` 的回车（之后显式 `render()`）。组字中的回车由 `ev.isComposing` 挡掉。

### 遗留问题 / 注意事项

- **和任务单不一致的地方**：
  - **名称为空时点“保存”现在也会重绘一次**。原来的 `cbsave` 分支在空名时直接 `return`、不重绘；按任务单改成“调用 `cbSave()`，然后照常 `render()`”之后会重绘，名称框失去焦点（内容不丢，因为 `cbDraft.n` 一直在同步）。回车路径同样。
  - `viewHedge()` 里多了一句对 `hzg` 非法值的兜底（任务单只要求“我的”为空时回到“甜点”）。
- **已知限制**：
  - 按住按钮超过 350ms 才松开，这次点击仍可能丢失（任务单已接受）。
  - 失焦后的 350ms 内，页面上还留着旧的输入框，数据已经保存；这段时间里如果没有别的点击，到点才收起。
  - 改完份量后直接点**搜索框**并开始打字：350ms 后那次重绘会让搜索框失去焦点（已输入的字不丢）。以前是失焦时立刻重绘，搜索框根本点不进去，所以不算变差，但没有修好。点的是带 `data-act` 的按钮就没有这个问题。
  - 对冲页切换分组后，已选中的甜点如果不在当前组，格子里看不到选中态，只有下面的份量行提示选的是什么。
- **没覆盖的边界**：
  - 触屏真机（iOS / Android）上 `focusout` → 点击的时序没有验证，只在桌面 Chromium 里用 Playwright 跑过。
  - 剪贴板内容是在无头浏览器里授权后读到的；Artifact 内复制失败时走 `#io2` 文本框的路径没有单独再验。
  - Playwright 走查脚本仍然没有放进仓库。
- **留给后续批次**：
  - **`fav` 中指向已删除食物的 id 不清理**（2B 遗留，本批次没有处理）：显示时跳过，数组里一直留着。
  - 2B 的其余遗留：`settings` 多设备同时修改时整体覆盖不合并；抽屉打开时云端拉到新数据不自动刷新；组合只能在整理模式里编辑。
  - 1.1 的遗留：是否把“本周饮食”的日均热量和调整后的目标做对比。
  - TAGS 过滤（饮食偏好）还没做。

## 2026-11-13 · 批次 2A.1：食物数据清理（v8.2）

只改了食物数据和 `searchFoods`，页面（`src/on-a-cut.html`）没有改动。规则见 `docs/SPEC.md` 第 5 节“食物库”里的“默认格子”“甜点分类的分组”“隐藏条目”三条。

### 已完成改动

- **`src/foods.js`**：
  - **重选默认格子**：先去掉全部 `top`，再按名单加回。各分类最终的数量和名单（也是页面上的显示顺序）：
    - 蛋白质 12：`chicken chleg egg lean beef fish shrimp tofu soymilk milk yog whey`
    - 主食 12：`rice noodle mifen mantou baozi jiaozi porridge corn yam potato oat toast`
    - 蔬果 11：`veg stirveg broccoli tomato cucumber apple banana orange watermelon grape fruit`
    - 油脂 10：`oil peanut zmj wuhua pb cheese avo nuts guazi walnut`（集合和任务单一致，顺序不同，原因见遗留问题）
    - 甜点 12：`mtfull mthalf cola juice beer chips choc cake ice popsicle eggtart cookie`
  - 移出默认格子、仍能搜到的：`bag3 wwbread flan crois pac tea lmilk soy salmon blueberry xfq butter`；`bag2` 移出且搜不到。
  - **奶茶改组**：`tea` 的 `g` 从 `"sweet"` 改成 `"snack"`，条目移到“零食饮品”分段、紧跟 `mtzero`。现在 `cat="sweet"` 共 32 种：`g="sweet"`（甜点）18 种，`g="snack"`（饮品零食）14 种。按场景分组的总数变为：家常 69、西式轻食 24、外卖外食 39、零食饮品 34、甜点 18。
  - **法棍去重**：`bag3` 末尾追加“半根”（x 1.5）和“1 根”（x 3）；`bag2` 加 `hide:1`。`FBY` 从 274 个 id 变为 276 个。
  - 每个分段里，带 `top` 的条目移到了分段最前面（按显示顺序排），其余条目的相对顺序不变，没有条目跨分段（`tea` 除外）。文件顶部注释补了 `hide`、甜点分组、排序三条约定。
- **`src/engine.js`**：生成 `FOODS` 时复制 `hide`；`searchFoods` 遍历内置食物时跳过 `hide` 的条目；两处注释更新。`recentFoods`、`portionsOf`、`baseId`、`guessCat` 没有改。
- **测试**：只追加，已有断言没改。`tests/foods.test.js` 加 4 组（top 名单、甜点分类的 g、hide 标记、法棍份量），`tests/engine.test.js` 加 1 组（隐藏条目不出现）。共 **44 组**（39 + 5），全部通过。
  - **Node 22 实跑**：`v22.23.5`（本机没装，用 `npx -y node@22 --test tests/`），44 组全部通过，`sort | uniq -d` 检查没有重复执行的组。
  - 本机 Node `v26.13.1` 下同样是 44 组、各一次。
- **文档**：`docs/SPEC.md` 第 5 节（`hide`、甜点分类的 `g`、top 挑选原则、`FOODS` 形状、`searchFoods` 说明）和变更记录 v8.2。`CLAUDE.md` 里没有食物库字段的描述，没改。
- **生成物**：重新构建 `dist/page.html`、`index.html`，都含 `hide:1` 和 `bag3`，没有 `<!--ENGINE-->`。
- **验证与发布**：
  - Playwright 在 400px 宽走查 43 项全部通过，没有控制台报错和横向溢出。覆盖：五个分类的格子数和名单、搜“法棍”只有 1 条且份量为 1/3 根 / 半根 / 1 根、点“半根”记入 10.5 / 67.5、搜“奶茶”四条都在、注入昨天的 `bag2` 记录后“最近”里能看到并照常记入（`fid==="bag2"`）、对冲页 32 种且选中奶茶后三张卡片正常。
  - 红线自查：把新旧 `foods.js` 逐条逐字段比较，除 `top` 外只有三处变动：`bag3.u`、`bag2.hide`、`tea.g`。`src/on-a-cut.html` 不在 diff 里；localStorage 键名没变。
  - 已发布到原 Artifact 链接（版本 10），能力声明沿用 `db`、`user`、`sample`。发布前核对过线上版本和仓库里 v8.1 的 `dist/page.html` 逐行一致。

### 技术约束 / 结构变更（批次 2B.1 直接使用）

- **饮品和甜点的区分方式**：字段是 `g`，`"sweet"` 为甜点，`"snack"` 为饮品零食，只在 `cat==="sweet"` 时用来分组。内置条目由测试保证只有这两种值，两组都不少于 10 种。自定义食物（`settings.my`）没有 `g`，对冲页需要单独成组（例如“我的”）。两组记录时都是 `s=1`。
- **`hide` 字段**：`FOODS` 里可能有 `hide===1` 的条目，目前只有 `bag2`。
  - `searchFoods` 已经跳过它们；`FBY`、`portionsOf`、`recentFoods` 不受影响。
  - 页面上**凡是直接遍历 `FOODS` 的地方**（分类格子、对冲页甜点列表），今后都应加 `!f.hide`。目前隐藏的条目既不是 `top` 也不是 `sweet`，所以页面暂时不受影响。
  - 有 `hide` 的条目不能同时有 `top`（测试会查）。变体对象上不带 `hide`。
- **`bag3` 新增的变体 id**：`bag3@half`（法棍 半根，10.5 / 67.5 / 1.5）、`bag3@one`（法棍 1 根，21 / 135 / 3），都没有 `k`。
- **top 名单由测试写死**（`tests/foods.test.js` 里的 `TOP82`）：以后调整默认格子，要同时改这份名单。
- **分类格子的显示顺序 = `FOODS` 的数组顺序**：先按场景分段（家常 → 西式轻食 → 外卖外食 → 零食饮品 → 甜点），分段内 `top` 条目在最前。想让某个分类按别的顺序显示，要么在页面里排序，要么调整 foods.js 的分段内顺序。

### 遗留问题 / 注意事项

- **和任务单不一致的地方**：
  - **油脂分类的显示顺序和表格不同**。表格是 `oil nuts peanut guazi walnut zmj pb cheese avo wuhua`，实际是 `oil peanut zmj wuhua pb cheese avo nuts guazi walnut`。原因：这 10 个食物分在家常、西式轻食、零食饮品三个分段里，表格顺序在分段之间来回穿插，而任务单要求不把条目移出原分段。其余四个分类的顺序和表格完全一致。
  - **分段内 `top` 条目整体移到了最前面**，所以 `src/foods.js` 的 diff 行数比较多（大部分是整行移动）。内容有没有变，以逐字段比较的结果为准。
  - 测试里多加了几条任务单没列的断言：每个分类的 top 数量在 10–12 之间、`E.FOODS` 里隐藏的 id 恰好是 `bag2`、搜 `fg` 时 `bag3` 仍在。
- **数值差异**：`bag3@half`（10.5 / 67.5 / 1.5）和旧的 `bag2`（11 / 70 / 1.5）相差约 3%，显示名都是“法棍 半根”。历史记录里存的是当时的数值，不受影响。
- **`recentFoods` 仍然把 `bag2` 和 `bag3@half` 当作两种食物**：两种都记过的用户，“最近”里会出现两个“法棍 半根”。同理，把 `bag2` 加进过常吃的用户，常吃里那一格还在（`findFood` 能找到），但搜索结果里不会再显示它的收藏状态。
- **没覆盖的边界**：页面视图层仍然没有自动化测试；Playwright 走查脚本没有放进仓库。
- **留给 2B.1**：
  - 对冲页按 `g` 分组（甜点 / 饮品零食 / 我的）；
  - 给直接遍历 `FOODS` 的地方（分类格子、对冲页甜点列表）加 `!f.hide`。

## 2026-11-13 · 批次 1.1：超出热量自动摊平（v8.1）

某天吃超了，之后几天的热量和碳水目标会自动降低，页面会说明降了多少、在还哪天的账。原来 `advise.spreadDays` 那句“之后 N 天每天少半拳主食”从来没兑现，这次改成真的执行。完整规则见 `docs/SPEC.md` 第 2.1 节。

### 已完成改动

- **`src/engine.js`**：新增并导出 4 个纯函数 `floorOf`、`cutCap`、`shiftT`、`carryOver`。`advise`、`buildTpl`、`compute`、`dayOk`、`mealNote` 的函数体没有改，diff 里只多了新函数和导出行。
- **`src/on-a-cut.html`**：
  - 设置与迁移：`defaults()` 加 `spread:true`；`migrate()` 末尾加一行 `if(typeof s.spread!=="boolean") s.spread=true;`。
  - 统一取目标的入口（放在 `targets` 后面）：`floorNow`、`LED`、`calcLED()`、`tgtOf(date)`、`cutOf(date)`、`spreadOf(date,k)`、`spreadText(s)`、`md(date)`。`render()` 第一行先调 `calcLED()`。
  - 改用调整后目标的地方：今天页的热量大数字、目标区间、三条进度条、建议卡片；参考餐单（`tplOf` 改成按日期取，`tplCard` 和“照这份填入”同步改）；对冲页；记录页的 30 天日历。
  - 新的文案：
    - 今天页顶部卡片：“今天 / 预计这一天 / 这一天少 X kcal（碳水 −Yg），在摊还 M/D 超出的部分”。
    - 热量用完时的说明：抽成函数 `overNote()`。
    - 对冲页的结论 pill：抽成函数 `hzPill()`。
    - 设置抽屉的“目标”一节末尾：加了开关 `#dr-spread` 和一行说明。
    - 准则页：“甜点对冲规则”里那条旧承诺换掉了，“什么时候调整”末尾加了一条。
- **测试**：新建 `tests/carry.test.js`，15 组，覆盖任务单要求的 13 种用例，另加 `floorOf` 和“没到期时余额记在 left”两组。`tests/run-all.js` 末尾只加了一行 `require`。现在一共 39 组，全部通过。`engine.test.js`、`foods.test.js` 没有改动。
- **文档**：`docs/SPEC.md`：
  - 新增第 2.1 节（规则、函数签名、页面怎么接入）；
  - 第 4 节的今天、对冲、实时建议、记录、准则、档案抽屉都同步更新，并注明 `spreadDays` 已弃用；
  - 第 5 节加上 `settings.spread` 和对应的迁移；
  - 第 6 节的函数列表和测试说明更新；
  - 变更记录加了 v8.1。
- **生成物**：重新构建了 `dist/page.html` 和 `index.html`，两个文件里都能找到 `carryOver`。
- **验证与发布**：
  - 用 Playwright 在 400px 宽、`page.clock` 固定时间的条件下走查 64 项，全部通过，没有控制台报错，也没有横向溢出。覆盖了任务单 ③ 的全部 11 个场景，另外加了男性安全下限 1500 的一项。
  - 已发布到原 Artifact 链接（版本 9），能力声明沿用 `db`、`user`、`sample`。

### 技术约束 / 结构变更（后续批次直接读取）

- **唯一的结构变更是 `settings.spread`**（布尔，默认 `true`）。旧数据、云端拉下来的数据、恢复的旧备份都经过 `migrate()`，没有这个字段时自动补成 `true`。**没有新增任何按天存的字段**，摊平结果每次 `render()` 时实时算。localStorage 的键名都没变。
- **`carryOver(days, baseOf, {floor, to, over?})` 的返回值**：
  - `days[date] = {cut, from:[{d,k}], t}`：只包含 `cut > 0` 的日期。`t` 是调整后的完整目标，和 `targets()` 的形状一样。
  - `src[超出日] = {over, paid:[{d,k}], lost, left}`：每笔都满足 `Σpaid + lost + left = over`。
- **页面里要取“这一天的目标”时，一律用 `tgtOf(date)`**，不要再写 `targets(stOf(...))`。
  - 例外（这几处故意用原目标）：本周“蛋白达标天数”、准则页的额度表、设置抽屉和引导、体重变化后重新计算、AI 交接档案。
  - 后续如果做分析面板、周报，要先想清楚该用原目标还是调整后的目标。
- **`LED` 只在 `render()` 里算**：
  - 只重画局部的函数（`renderSR`、`renderSheet`）不会重算。它们现在都不显示目标，所以没问题。
  - 以后如果加了“不经过 `render()`、又要显示目标”的局部重绘，要先调 `calcLED()`。
- **`spreadOf(date, k)` 的 k 一律用“已记录的热量”**：今天页传 `T.k`；对冲页传已记录的热量加上正在预演的甜点。这样说明里写的数和记入后之后几天实际扣的一致。
- **计算量**：每次重绘从第一条有记录的日期一路推到 `max(今天+7, 正在看的日期+6)`，每天算一次 `totals`。今天页和对冲页还会各多算一次 `spreadOf`。一年的数据大约 370 天，目前不用缓存。

### 遗留问题 / 注意事项

- **和任务单不一致的地方**：
  - **超额说明改用已记录热量，不用 `a.after.k`**：
    - 原因：任务单 C.5 / C.6 写的是 `spreadOf(date, a.after.k)`。但 `a.after.k` 包含“照建议再吃两捧蔬菜（44 kcal），有时还要加瘦肉”。点“吃了，记入”之后，之后几天按实际记录扣，会比 pill 上写的少。比如 pill 写每天 150 / 94，实际是 150 / 50，验收 ③ 的一致性检查过不了。
    - 处理：施工中问过发起人，确认改用已记录热量：今天页传 `T.k`，对冲页传 `T.k` 加上甜点。
    - 连带的兜底文案：没有欠账、但照建议吃完会超的时候（`a.overK > 0`），超出不到 30 kcal 照任务单写“不到 30 kcal 不用管”或“略超 X kcal，不用管”；超出 30 kcal 以上是任务单没覆盖的情况，写“吃完预计超出 X kcal，记下后会自动摊到之后几天”，对冲页写“吃完预计超 X kcal → 记下后自动摊到之后几天”。开关关闭时照任务单写。
  - **验收“修改历史 → 撤销后说明恢复”改用“清空这一天”来验证**：v8 的份量直接输入（`×q` 输入框）本来就不走撤销，代码没改。走查流程：先把份量改成 ×0.5，说明消失；改回 ×1，说明恢复；再点“清空”，说明消失；点“撤销”，说明恢复。
  - **AI 交接档案里那句“之后 2–5 天各少半拳主食摊平”没有改**：任务单要求交接档案保持原样，所以文字还是旧的承诺。可以在后续批次改成新规则。
- **已知限制**：
  - 搜索框输入时只重画 `#sr`，不重算摊平；但记录、改份量都会走 `render()`，会重算。
  - 摊平只追到 `to` 为止（今天 +7）。说明里的“接下来 N 天”是完整推算的结果，但日历和今天页只显示到 `to`。
  - 修改很久以前的记录会连锁影响之后的日子，这是规则本身的结果；不过窗口只有 5 天，所以影响最多传 5 天，除非之后几天又产生了新的欠账。
  - 训练日 / 休息日切换时，`baseOf` 用的是这一天当下的状态。过去某天的状态改了，之后几天的扣减也会跟着变。
  - Artifact 发布时平台提示页面里有文件下载链接：那是 `exportData()` 在独立网页里的下载分支。Artifact 里有 `window.claude`，会走“复制文本”，下载不会触发，所以没改。
- **没覆盖的边界**：
  - 云端同步：两台设备的记录合并之后，摊平会按合并后的数据重算。只在本地验证过，没在真机上试过多设备。
  - 本机只有 Node 26（会自动扫描目录），39 组每组各跑一次；Node 22 下没有实际跑过，靠 `run-all.js` 的 `require` 登记来保证会执行。
  - Playwright 走查脚本仍然没有放进仓库（在会话的临时目录里）。
- **留给后续批次**：
  - AI 交接档案里的对冲文案；
  - 是否把“本周饮食”的日均热量和调整后的目标做对比；
  - 2B 遗留的对冲页甜点列表分组。

## 2026-11-12 · 批次 2B：记录交互、我的食物库与组合（v8）

只改了 `src/on-a-cut.html` 和文档；`src/engine.js`、`src/foods.js`、`tests/` 没有改动。完整说明见 `docs/SPEC.md` 第 4 节“今天”和第 5 节。

### 已完成改动

- **修改 `src/on-a-cut.html`**：
  - **搜索**：“记一口”改为 餐次标签 → 搜索框 → 结果区 `#sr` / 分类区 `#catarea` / 自定义表单（三者互斥）。输入时只重画 `#sr`（`renderSR()`），输入框不失焦；输入法组字中不搜。每条结果有分组小标签、☆ 收藏、最多 4 个份量按钮；末尾“都不是？AI 估算 / 手动填”。
  - **分类区**：标签为 最近 → 常吃 → 五个分类，默认“最近”，没有就“蛋白质”。五个分类里 `top` 内置食物之后跟我的食物库里同分类的食物（带“我的”小标）。末尾“更多食物请在上方搜索 · 手动填 · 管理我的食物（N）”。
  - **自定义表单**：分类必选（五选一）、“加入常吃”勾选框、表单内错误文字、“记录 / 取消”；去掉“算甜点”勾选框。AI 估算的提示词改为返回 `cat`。
  - **组合**：一餐 ≥ 2 条时出现“存为组合”；常吃标签里一键记入（可撤销）；整理模式里删除或进入编辑抽屉。
  - **份量输入**：条目的 `×q` 是按钮，点开后直接输入倍数。
  - **进食时间**：条目可选字段 `t`；每餐标题显示“第 N 餐 · HH:MM”，可改可清空。
  - **两个新抽屉**：`openSheet("combo", id)`、`openSheet("foods")`。
  - **迁移和撤销**：`defaults()` / `migrate()` 增加 `fav`、`combos` 和旧常吃迁移；`withUndo("settings")` 的快照改为 `{my, fav, combos}`。
- **文档**：`docs/SPEC.md`（记一口、两个抽屉、对冲页甜点来源、撤销范围、数据结构、迁移、v8 记录）、`README.md`（功能列表）。
- **生成物**：`dist/page.html`、`index.html` 重新构建。
- **验证与发布**：`node --test tests/` 24 组通过（数量与 2A 后一致）；Playwright 在 400px 宽走查 129 项全部通过（搜索、组字、自定义食物、我的食物抽屉、收藏、组合、份量输入、进食时间、迁移、备份恢复、对冲页、超长名称），无控制台报错、无横向溢出；另用假的 `sample` 能力跑通了 AI 估算预填分类。`dist/page.html` 已发布到原 Artifact 链接。

### 技术约束 / 结构变更（后续批次直接读取）

- **`settings.my`（我的食物库）**：`{id:"my-"+uid(), n, p, c, f, k?, cat:"pro|carb|veg|fat|sweet", s}`，`s = cat==="sweet" ? 1 : 0`。新的 `unshift` 在最前；按名称（截到 40 字）去重，同名再记一次是更新。上限 300（`capMy()`）：从数组末尾往前找第一个不在 `fav` 里的删掉，全收藏了就删最后一个。
- **`settings.fav`（常吃）**：`[id…]`。内置食物存**基准 id**（搜索结果里的 `food.id`，不带 `@`），自定义食物存 `my-` id。新收藏在最前，不重复。指向已删除食物的 id 显示时跳过，不自动清理（删除我的食物时会顺手移除）。
- **`settings.combos`（组合）**：`[{id:"cb-"+uid(), n, items:[{fid?, n, q, p, c, f, k?, s}]}]`，最多 20 个，新的在最前。`items` 是快照，不含 `id`、`m`、`t`。记入时 `fid` 缺失的项用临时 id `"cbi-"+uid()` 作为条目的 `fid`。
- **条目的 `t`（进食时间，分析面板要读）**：
  - 含义：当天 0 点起的分钟数，整数 0–1439。**字段不存在 = 不知道时间**，不要当成 0。同一餐的条目 `t` 可以不同（各自记录的时刻）；“这一餐的时间”取本餐条目里最小的 `t`。
  - 自动写入规则（`addFood(f,q,m,{live:true})`）：`cur===today()` 且 `ORD[m] >= ORD[autoMeal()]` 时写 `t = 当前时刻`，其中 `ORD={1:0,2:1,4:2,3:3}`（餐次的时间顺序 1 → 2 → 加餐 → 3）。也就是所选餐次**不早于当前时段**才写；晚上补记早餐不写。合并进已有条目（同 fid、同餐次）时原来的 `t` 不变。
  - 写的入口：搜索结果份量按钮、最近 / 常吃 / 分类格子（`add`）、组合（`cbadd`）、自定义表单（`custom`）、对冲页“吃了，记入”（`hzadd`）。
  - 不写的入口：参考餐单填入（`tpl`）；整天复制前一天（`copyy`，还会删掉原条目上的 `t`）。
  - 手动修改（`mtime`）：把这一餐**所有条目**的 `t` 设为同一个值；清空则全部删除。任何日期都能改，不走撤销。
- **迁移（`migrate()`，加载、`pull()`、`adopt()` 之后都会执行）**：`fav` 不是数组 → `[]`，并去重；`combos` 不是数组 → `[]`，并丢掉没有 `items` 数组的项；`my` 中 `cat` 不在五个合法 id 里的项（旧值 `"my"` 或缺失）→ `cat = E.guessCat(item)`，`s` 按新 cat 重算，id 加进 `fav`。可重复执行。`migrate()` 本身不落盘，下一次 `touch()` 时写入。
- **抽屉**：`openSheet(kind, arg)`，`kind` 为 `onb` / `prof` / `combo` / `foods`。只有 `onb` / `prof` 初始化 `dr`；`combo` 初始化 `cdr = clone(组合)`（找不到组合时不打开）；`foods` 初始化 `fq=""`、`fe=null`。`closeSheet()` 清空 `dr`、`cdr`、`fe`，关闭 `combo` / `foods` 后会 `render()`。`renderSheet()` 四个分支；`combo` / `foods` 重画时保留滚动位置；`foods` 没有底部按钮栏。
- **新增状态变量**：`cat`（`null` = 自动；`"recent" | "fav" | 五个分类 id`）、`favEdit`（原 `myEdit`）、`recentCache`、`recentCnt`（`{fid: 次数}`，今天之前 14 天）、`qEdit`（正在改份量的条目 id）、`tEdit`（正在改时间的餐次）、`cbDraft`（`{m, n}`）、`cdr`（组合草稿）、`fq`（我的食物过滤文字）、`fe`（我的食物编辑草稿 `{id,n,p,c,f,k,cat,err}`）。`cu` 去掉 `s`，增加 `cat`、`fav`、`err`。
- **新增函数**：`refreshRecent()`（每次 `viewToday()` 开头调用）、`catHTML()` / `catChips()`、`srHTML()` / `renderSR()` / `searchNow()`、`toggleFav()`、`capMy()`、`openManual()`、`commitQ()`、`comboBody()`、`flHTML()`。`findFood(id)` 依次查 `FBY` → `settings.my` → `recentCache`。
- **`withUndo("settings", …)`**：快照是 `{my, fav, combos}` 的深拷贝，撤销时三者一起写回再 `touch("settings")`。
- **新增事件监听**：`compositionend`（搜索框）、`focusout`（份量和时间输入框结束编辑）、`mousedown`（点搜索结果里的 ☆ 时阻止输入框失焦）。

### 遗留问题 / 注意事项

- **和任务单不一致的地方**：
  - **验收里“12:05 选第 1 餐不写 `t`”按默认设置不成立**。现有的 `autoMeal()` 在不限时进食的默认档案下，12:15 之前都算第 1 餐时段（第 2 餐参考时间 13:00，提前 45 分钟切换），所以 12:05 记第 1 餐会写 `t`，这符合任务单给的规则 `ORD[m] >= ORD[autoMeal()]`。规则没有改，走查改为：12:05 记第 2 餐 → `t===725`；把时钟拨到 13:00 再记第 1 餐 → 没有 `t`。
  - **提示条的层级从 30 提到 50**（`#toast` 的 `z-index`）。原来低于抽屉（40），在“我的食物”抽屉里删除后，“撤销”按钮被遮罩挡住点不到。附带效果：档案抽屉里的提示（如“已读取文件”）也不再被遮罩压暗。
  - **搜索里收藏后清空搜索框**：`renderSR()` 在从结果区回到分类区时会重画 `#catarea`，否则刚收藏的食物不会出现“常吃”标签。任务单只说切换 `hidden`。
  - `openManual()` 把名称截到 40 字；我的食物抽屉保存时除了名称和重名，还检查了分类合法。
  - 组合抽屉保存时，倍数为空或非数字的按 0.1 处理（任务单写“按 0.1–20 夹紧”）。
  - `capMy()` 不会删刚加进去的第 0 项（否则 300 项全收藏时，新建的未收藏食物会立刻被删）；删掉的项同时移出 `fav`。
- **已知限制**：
  - 份量和时间输入框失焦时整页重绘，这一次点到别处的点击可能不生效（任务单已接受）。
  - “不早于当前时段”只看餐次顺序，不看具体钟点：下午记“加餐”会写当前时间，但晚餐时段（`autoMeal()===3`）补记加餐不写。
  - 最近标签里没有 `fid` 的旧条目，再记一次时条目的 `fid` 是 `"rc-"+名称`；组合里没有 `fid` 的项每次记入都是新的 `cbi-` id，不会和已有条目合并。
  - 组合只能在常吃标签的整理模式里编辑和删除，平时点格子就是记入。
  - `fav` 里指向已删除食物的 id 不清理（撤销删除后能自动恢复收藏状态）；从云端拉到别的设备删过的食物时也只是跳过。
  - 两台设备同时改 `settings`（收藏、组合、我的食物）时，仍是整个 `settings` 按 `updatedAt` 新者覆盖，不做合并。
  - 在组合 / 我的食物抽屉打开时云端拉到新数据：组合抽屉保存时找不到原组合会提示“这个组合已经不存在了”；我的食物抽屉不会自动刷新，下一次点击时才重画。
  - 搜索框里的回车没有接到“存为组合”的名称输入框，那里只能点“保存”。
- **没覆盖的边界**：AI 估算只用假的 `sample` 能力在本地跑过，没有在线上 Artifact 里实测模型返回的 `cat`；真实输入法（iOS 拼音九宫格）下的组字行为只用合成事件验证过；`<input type="time">` 在 iOS 上的 `change` / 失焦时机没有真机验证。Playwright 走查脚本仍然没有进仓库。
- **留给后续批次**：
  - 分析面板读取 `t` 时要处理“没有 `t`”的条目（旧数据、餐单填入、整天复制、补记都没有）。
  - 2A 遗留的“对冲页甜点列表偏长、没有分组”没有处理（任务单要求对冲页其余不动）；现在还会加上自定义甜点。
  - 2A 遗留的“重新挑 `top`”没有处理（不改 foods.js）。
  - TAGS 过滤（饮食偏好）、批次 1.1 都还没做。

## 2026-11-12 · 批次 2A：食物数据与搜索算法（v7）

只做了数据和算法层，页面只有三处最小适配。完整结构见 `docs/SPEC.md` 第 5 节“食物库”和“引擎里的食物表和查找函数”。

### 已完成改动

- **新建 `src/foods.js`**：食物库从 30 种扩到 **184 种**，每种带纯名称、别名、拼音首字母、多个份量、饮食标签。
  - 按场景分组：家常 69、西式轻食 24、外卖外食 39、零食饮品 33、甜点 19。
  - 按营养分类：蛋白质 53、主食 62、蔬果 22、油脂 15、甜点 32；默认格子（`top`）分别是 12 / 12 / 11 / 9 / 12 个。
  - 加上份量变体，`FBY` 共 274 个可记录的 id。
  - 30 个旧 id 全部保留，显示名和 p/c/f 与 v6 逐个一致（测试里写死了 v6 的表）。
- **修改 `src/engine.js`**：删掉内置的食物字面量，改为从 foods.js 展开出 `FOODS` / `FBY` / `CATS`；新增并导出 `baseId`、`portionsOf`、`guessCat`、`searchFoods`、`recentFoods`；`mealNote` 判断蔬菜改用 `baseId(e.fid)==="veg"`。`advise` 的份量常量和 `buildTpl` 没动。
- **修改 `build.sh`**：`<!--ENGINE-->` 处输出一个 `<script>`，里面先 foods.js 后 engine.js；两个文件都检查 `</script`。
- **修改 `src/on-a-cut.html`**（共 3 行）：分类格子只显示 `top` 食物，末尾加灰字“更多食物下一版可搜索”；对冲页的内置甜点是全部 `cat==="sweet"`，名称改从 `f.base.n` 取（原来用正则去掉“ 1 块”，对新份量不适用）。
- **测试**：新建 `tests/foods.test.js`（8 组）；`tests/engine.test.js` 末尾追加 6 组新函数用例，批次 1 的 10 组一字未改。共 24 组，Node 22 和 Node 26 下都实跑通过。
- **文档**：`docs/SPEC.md`（食物库结构、变体规则、TAGS、新函数、工程结构、v7 记录）、`CLAUDE.md`（源码三个文件）。
- **验证与发布**：Playwright 在 400px 宽走查 51 项全部通过（新用户引导、五个分类点选记录、照餐单填入、对冲页全部甜点与三张卡片、注入 v6 旧数据含 `bag3` / `flan` / `veg` / `my-xxx`），无控制台报错、无横向溢出；`dist/page.html` 已发布到原 Artifact 链接。

### 技术约束 / 结构变更（批次 2B 直接调用）

- **foods.js 的条目**：`{id, cat, g, n, a[], py, u[{k,l,x}], p, c, f, k?, top?, tags[]}`。`n` 是纯名称；`u[0]` 是基准份量，`x` 必须为 1；p/c/f 是基准份量的克数，保留到 0.5。导出 `{FOODS, GROUPS, TAGS, CATS}`，浏览器里是 `self.OnACutFoods`。
- **份量变体 id**：`<基准 id>@<份量 k>`，如 `rice@bowl`。变体显示名 = `n + " " + l`，p/c/f/k 乘以 `x` 后保留 1 位小数；基准没有 `k` 的变体也没有 `k`。**条目的 `fid` 今后可能带 `@`**，凡是按 fid 判断食物种类的地方都要先过 `baseId()`。
- **engine 的表**：
  - `FOODS`：只含基准份量，`{id, cat, n:显示名, p, c, f, k?, top?, g, tags, base}`，`base` 是 foods.js 的原始对象（取纯名称用 `f.base.n`，取别名用 `f.base.a`）。
  - `FBY[id]`：基准对象 + 变体 `{id, cat, n, p, c, f, k?, g, tags, baseOf}`。页面现有的 `findFood(id)` 和 `addFood(f,q,m)` 传变体对象即可直接记录，不用改。
- **新函数签名**：
  - `baseId(fid) → string`：`"rice@bowl"` → `"rice"`，`undefined` → `""`。
  - `portionsOf(id) → FBY 对象[]`：基准在前；id 不存在或传入的是变体 id 时返回 `[]`。
  - `guessCat({p,c,f,s}) → "sweet"|"pro"|"fat"|"carb"`：不会返回 `veg`。
  - `searchFoods(q, {my:[], fav:[], recent:{}, limit:8}) → [{food, score}]`：`my` 是 `settings.my`（按 `n` 匹配），`fav` 是基准 id 或自定义 id 的数组，`recent` 是 `{fid: 次数}`（内部按 `baseId` 合并）。`food` 对内置食物是 `FOODS` 里的基准对象，对自定义食物是传入的原对象。打分规则见 SPEC。
  - `recentFoods(days, todayStr, n=8) → [{id, n, p, c, f, k?, s, cat:"recent"}]`：`days` 就是 `S.days`。快照可以直接传给 `addFood`；没有 fid 的条目 id 是 `"rc-"+名称`。
- **测试入口**：`tests/package.json` 的 `main` 现在指向 `tests/run-all.js`，它依次 `require` 两个测试文件。命令仍是 `node --test tests/`。新增测试文件要在 `run-all.js` 里登记。
- **构建**：foods.js 必须排在 engine.js 前面；engine 找不到 `OnACutFoods` 会直接抛错。

### 遗留问题 / 注意事项

- **和任务单不一致的地方**：
  - 测试入口叫 `run-all.js` 而不是任务单建议的 `all.test.js`。原因：本机是 Node 26，它会扫描目录，带 `.test.` 的入口会让每个用例跑两遍（实测 48 个）；换成不带 `.test.` 的名字后，Node 22（走 `main`）和 Node 26（走扫描）都是 24 个各跑一遍。
  - `rice` 的名称保留为“米饭/杂粮饭”（任务单示例写的是“米饭”），因为红线要求显示名不变；拼音首字母是 `mfzlf`，搜 `mf` 时排在“米粉”之后、第 2 位。
  - 全脂牛奶没有加“牛奶”这个别名：加了之后搜“牛奶”时它的别名相等分（75）会压过收藏加分，任务单要求的“收藏低脂牛奶后搜牛奶排第一”就不成立。
  - 无糖可乐的 `k` 是 0（任务单要求 k 与三大营养素相差 ≤15%，0 满足）；判断有没有 `k` 要用 `k!=null`，不能用真值判断。
- **30 个旧食物全部标了 `top`**，包括法棍、Flan、可颂这些个人口味的。原因是 2B 的搜索上线之前，不在默认格子里的食物没有任何入口，去掉会让发起人记不了平时吃的东西。2B 有了搜索和“最近吃过”之后可以重新挑 `top`。
- **`cat="sweet"` 现在包含零食饮品**（奶茶、可乐、果汁、酒、薯片、巧克力、饼干），共 32 种，对冲页全部列出、没有分组，偏长。2B 可以考虑按 `g` 分组或接入搜索。啤酒 / 红酒 / 白酒也归在这里，记录时会带 `s=1`。
- **营养值都是估算**，参考公开的食物成分数据换算到常见份量，外卖类误差最大（同一道菜不同店差别可达 30% 以上）。没有逐条核对来源。
- **拼音首字母是手写的**，测试只能检查长度和字符集，查不出写错的字母；多音字按常见读法（如“烹调油”= `pty`）。
- **没覆盖的边界**：
  - `searchFoods` 不做模糊匹配和错别字容忍；别名不参与拼音匹配；搜索只返回基准食物，份量要再调 `portionsOf`。
  - `recentFoods` 按 fid 原样分组，`rice` 和 `rice@bowl` 算两种；同一种自定义食物改名后，按最近一次的名称显示。
  - 两条“法棍”（`bag3` 1/3 根、`bag2` 半根）是两个独立的基准食物，搜索会出现两条同名结果；合并成一个食物的两个份量会改变旧 id 的含义，这次没动。
  - 页面视图层仍然没有自动化测试，Playwright 走查脚本没有进仓库。
- **留给 2B**：搜索框和结果列表、份量选择、收藏（`fav` 存在哪里需要定，会动 `settings` 结构，要同步 `migrate()`）、最近吃过、常吃组合、我的食物库；用 `guessCat` 给自定义食物归类；把“更多食物下一版可搜索”那行换成真正的入口。TAGS 的过滤留给之后的“饮食偏好”批次。

## 2026-11-12 · 从个人工具到通用版（v1–v5）

完整的需求、计算规则和数据结构见 `docs/SPEC.md`；协作流程见 `CLAUDE.md`。本摘要只记录这一阶段的结论和待办。

### 1. 已完成的功能与改动

涉及文件：`src/on-a-cut.html`（唯一源码）、`index.html`（生成物）、`build.sh`、`docs/SPEC.md`、`CLAUDE.md`、`README.md`。

- **四个页面**：今天（记录）、对冲（甜点预演）、记录（训练与体重）、准则（规则说明）。
- **实物单位记录**：按掌、拳、勺、茶匙点一下记 1 份，可 ±半份；分 4 个餐次，每餐一行规则评价。
- **自定义食物**：一句话描述由 Claude 估算，或手动填克数 / 只填热量；记录后存入“常吃”，可重复点选。
- **对冲页**：由整页文字改为三张数字卡片（主食几拳、蛋白几掌、蔬菜两捧）加一行结论。
- **参考餐单**：按当天目标自动配出用餐时间和份数，可一键填入；可提前排 7 天。
- **通用化（v5）**：
  - Mifflin-St Jeor 计算引擎，四种模式（温和刷脂、激进刷脂、维持、增肌），训练日 / 休息日热量区分，可切换为手动目标。
  - 首次访问四步引导；右上角“身体档案与设置”抽屉。
  - JSON 备份导出与恢复（二次确认后覆盖）。
  - 首屏改为剩余热量大数字；自动选餐次；整天复制前一天；本周饮食统计；目标体重进度条；体重偏离 1 kg 提示重新计算；备份提醒点；最近 30 天滚动打卡。
- **旧数据迁移**：发起人原有记录和手动目标保留，不弹引导，三种状态 A / B / C 保留。
- **发布**：代码在分支 `claude/personal-fat-loss-diet-training-dlxt77`；线上页面为 Claude Artifact（链接见 `CLAUDE.md`）。

### 2. 当前遇到的瓶颈 / 遗留问题

- **未在真机验证**：云端同步（Artifact 的 `db`）和真实的 AI 估算只做过模拟测试；所有流程只在桌面 Chromium 的 400px 宽度下跑过。
- **GitHub Pages 尚未开启**：需要在仓库 Settings → Pages 手动选择分支；分支也还没合并到默认分支。
- **两个运行环境能力不一致**：AI 估算和云端同步只在 Artifact 里可用；文件下载只在 GitHub Pages 可用（Artifact 内改为复制文本）。
- **食物库偏个人口味**：只有 30 种左右，含法棍、Flan、可颂等；没有搜索；营养值均为估算。
- **计算系数是经验值**：活动系数、各模式的蛋白 / 脂肪系数未经校准；不含体脂率（没有 Katch-McArdle 选项）。
- **参考餐单较粗糙**：骨架固定（蛋白粉 + 牛奶 / 鸡蛋 + 酸奶），不考虑饮食偏好（素食、乳糖不耐、不用蛋白粉），取整后合计可能偏离目标几十 kcal。
- **旧数据的三状态是特例**：`multi()` 分支里的 A / B 文案写死为发起人的作息，新用户无法创建第三种状态。
- **单文件约 800 行**：视图用字符串拼接、整页重绘，没有自动化测试，继续加功能会越来越难维护。
- **缺少撤销**：删除条目、复制前一天、恢复备份都不能撤回；没有“清空某一天”。
- **无离线与安装支持**：没有 manifest 和 service worker，只能靠浏览器“添加到主屏幕”。

### 3. 技术约束与关键数据结构

- **架构**：纯前端单文件，原生 JS，无依赖、无构建工具、无后端。`index.html` 只能由 `build.sh` 生成，不手改。
- **存储**：`localStorage["onacut.v1"] = {settings, days}`；另有 `onacut.v1.tab`（上次标签）和 `onacut.v1.bk`（上次导出时间）。**键名不能改**，否则现有用户数据丢失。
- **`settings`**：
  - `profile{sex, age, h, w, goal, n, mode, custom, done}`：身体档案；`custom=true` 表示手动目标，`done` 决定是否弹引导。
  - `t{train, rest}`，每个含 `p[下限,上限], pf(蛋白底线), c[], f[], k[]`：所有页面都从这里读目标。
  - `plan[7]`（周日到周六的默认状态）、`states[]`、`fast`、`win{A,B,C}`、`start`、`weight0`、`my[]`（常吃食物）、`updatedAt`。
- **每天**（键为 `YYYY-MM-DD`）：`state, entries[], water, lift, cardio, note, weight, waist, updatedAt`。
- **条目**：`{id, fid?, n, q, p, c, f, k?, m(餐次 1–4), s(是否甜点)}`。
- **不能轻易改的基础逻辑**：
  - 营养值在记录时拷贝进条目，改食物库不影响历史记录。
  - 热量规则：有 `k` 用 `k`，否则 4·蛋白 + 4·碳水 + 9·脂肪（`kcalOf`）。
  - 状态键 `A` = 训练日、`C` = 休息日、`B` 仅旧数据使用；`normState` 负责兜底。
  - `migrate()` 负责旧数据升级，改 `settings` 结构时必须同步更新它。
  - 云端同步按 `updatedAt` 新者覆盖，所有写入必须经过 `touch()`。
  - 备份格式 `{app, v, exportedAt, settings, days}`，恢复时只校验 `settings` 和 `days` 存在。
- **Artifact 平台限制**：没有 `confirm/alert`，不能下载文件，外链脚本只能来自白名单 CDN。

### 4. 下一步待讨论的改进方向

1. **食物库与录入效率**：扩充通用食物（按中餐 / 西餐 / 外食分组）、加搜索和“最近吃过”，并支持把几样食物存成一个“常吃组合”。这是通用用户每天接触最多的地方，也是目前最弱的一环。
2. **确定主运行环境并补齐短板**：在 GitHub Pages（公开、可离线安装、无 AI）和 Claude Artifact（有 AI 估算与同步、需 Claude 账号）之间定主次。若以 Pages 为主，需要做可安装的离线版，并决定 AI 估算用什么替代（内置食物数据库或用户自带 API key）。
3. **个性化与反馈闭环**：引导里加入饮食偏好和体脂率选项，让参考餐单和计算更贴合个人；再用实际体重趋势反推真实消耗，每 2 周自动建议调整热量，而不是只在体重变 1 kg 时提醒。

附带的工程议题：是否把单文件拆成数据、计算、视图几个模块并给计算引擎加单元测试。

## 2026-11-12 · 批次 1：稳定性 + 建议引擎（v6）

### 1. 已完成

- **工程拆分**：计算逻辑搬到 `src/engine.js`（纯函数，浏览器和 Node 共用）；`sh build.sh` 把它内联进页面，产出 `dist/page.html`（Artifact）和 `index.html`（Pages）；`tests/engine.test.js` 共 10 组测试，`node --test tests/` 运行。
- **建议引擎 `advise`**：今天页的“下一餐怎么吃”和对冲页共用，统一给出 主食 / 蛋白 / 油脂 三张卡片。分配顺序：蛋白下限 → 蔬菜 → 脂肪下限（最多占余量一半）→ 碳水。原来的两套提示逻辑已删除。
- **撤销**：减到 0 删除、整天复制、填入餐单、对冲记入、删除常吃、清空这一天，都带 5 秒“撤销”；恢复备份前自动存快照（`onacut.v1.undo`），设置里可“撤销上次恢复”。
- **漏洞修复**：跨午夜自动换日；自定义食物可标甜点并出现在对冲页；30 天日历和周统计统一用 `dayOk` 口径（去掉 +50 余量）；已有记录时参考餐单不再提供追加按钮；恢复备份时把多出来的日期写成空白日，避免云端旧数据回流；自动选餐次只对今天生效。

### 2. 与任务单不一致、需要知道的地方

- **示例用例的主食是 1.5 拳，不是任务单写的 2 拳**。按 2.2 的算法，补完脂肪（坚果 1 + 油 2 茶匙 = 186 kcal）后只剩 235 kcal，够 1.5 拳；吃 2 拳会到 1611 kcal，反而不满足“after.k 在 1500–1600 之间”。测试按算法写成 1.5，并在用例里注明。
- **开发分支是 `claude/modest-tesla-sl92zd`**：任务单写的 `claude/personal-fat-loss-diet-training-dlxt77` 在远端不存在（之前的内容已在 `main`）。
- `advise` 的输出多了一个 `whey` 字段（关窗且蛋白低于底线时为 1），关窗时 `veg` 为 0。
- `compute` 的返回值多了 `kT`、`kR`（取整前的训练日 / 休息日热量），供测试使用。
- “今天还剩几餐”的算法：按当前时间落在第几顿正餐，数出之后还没有记录的正餐数，最少 1。
- Node 22 下 `node --test tests/` 不会自动扫描目录，所以加了 `tests/package.json` 把入口指向测试文件。

### 3. 仍未解决

- 云端同步、AI 估算（含新的 `sweet` 字段）仍只做过模拟，没有真机验证。
- 撤销快照是整天级别的：5 秒内又做了别的修改再点撤销，会一起退回。
- 页面视图层没有自动化测试，目前靠 Playwright 脚本手动走查。
