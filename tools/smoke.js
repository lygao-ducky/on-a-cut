#!/usr/bin/env node
/* Playwright 冒烟脚本（7 项）。不属于 node --test tests/（tests/ 保持零依赖）。
   运行：
     sh build.sh
     cd tools && npm install && npx playwright install chromium
     node smoke.js
   做法：把仓库根目录的 index.html、sw.js、manifest.webmanifest、icons/ 复制到临时目录，用 serve.js 挂在 /on-a-cut/ 下，
   Chromium 无头、400×800，每个流程用全新的 context。截图存到 tools/out/。 */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { chromium } = require("playwright");
const { start, BASE } = require("./serve.js");

const ROOT = path.join(__dirname, ".."), OUT = path.join(__dirname, "out");
const W = 400, H = 800;
const HOME_HINT = "如果之前在 Safari 里用过";
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const count = (s, w) => s.split(w).length - 1;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 结果记录 ---------- */
const results = [];
let cur = null;
function ok(cond, desc) { cur.subs.push([!!cond, desc]); console.log("    " + (cond ? "✓" : "✗") + " " + desc); return !!cond; }
async function item(name, fn) {
  cur = { name, subs: [] }; console.log("\n" + name);
  try { await fn(); } catch (e) { ok(false, "流程中断：" + String(e && e.message || e).split("\n")[0]); }
  const pass = cur.subs.length > 0 && cur.subs.every(s => s[0]);
  results.push([pass, name]); console.log((pass ? "✓ " : "✗ ") + name);
}

/* ---------- 浏览器小工具 ---------- */
let browser, URL0;
/* 新开一个隔离的 context + page，收集 pageerror 和 console error。
   字体请求（fonts.googleapis.com / fonts.gstatic.com）失败不算报错：离线和沙箱里它本来就会失败，页面会落到系统字体。 */
async function open(opts) {
  opts = opts || {};
  const context = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: opts.dark ? "dark" : "light" });
  if (opts.init) await context.addInitScript(opts.init);
  const errors = [];
  const watch = page => {
    page.on("pageerror", e => errors.push("pageerror: " + e.message));
    page.on("console", m => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)\.com/.test((m.location() || {}).url || "")) errors.push("console: " + m.text()); });
  };
  context.on("page", watch);
  const page = await context.newPage();
  await page.goto(URL0);
  return { context, page, errors };
}
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth).then(w => w <= W);
async function endFlow(f, label) {
  ok(await noOverflow(f.page), label + "：没有横向溢出");
  ok(f.errors.length === 0, label + "：没有控制台报错" + (f.errors.length ? "（" + f.errors[0] + "）" : ""));
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + ".png") });
/* localStorage 里的全部数据；norm 去掉 updatedAt（每次改动都会变的时间戳），用来比较“内容是否一致” */
const lsRaw = page => page.evaluate(() => localStorage.getItem("onacut.v1"));
const norm = raw => JSON.stringify(JSON.parse(raw), (k, v) => k === "updatedAt" ? undefined : v);
const lsNorm = async page => norm(await lsRaw(page));
const entryCount = page => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("onacut.v1") || "{}"); let n = 0; Object.values(s.days || {}).forEach(d => { n += (d.entries || []).length; }); return n; });
const visible = (page, sel) => page.locator(sel).first().isVisible();
async function until(fn, ms) { const t0 = Date.now(); for (;;) { try { if (await fn()) return true; } catch (e) {} if (Date.now() - t0 > (ms || 5000)) return false; await sleep(50); } }

/* 走完首次设置 4 步 */
async function onboard(page) {
  await page.click('#sheet [data-k="pf.sex"][data-v="f"]');
  await page.fill("#dr-pf-age", "30"); await page.fill("#dr-pf-h", "165");
  await page.click('#sheet [data-act="obnext"]');
  await page.fill("#dr-pf-w", "60");
  await page.click('#sheet [data-act="obnext"]');
  await page.click('#sheet [data-act="obnext"]');
  await page.click('#sheet button:has-text("开始使用")');
  await page.waitForSelector("#sheet", { state: "hidden" });
}
/* 搜索并点第一条结果的第一个份量按钮 */
async function addFood(page, q) {
  await page.fill("#cu-q", q);
  await page.locator("#sr .sr-i").first().locator(".pbtn").first().click();
}
/* 把第一条记录一直点“−”减到删除，直到出现带“撤销”的 toast。
   返回最后一次点击之前（也就是删除前那一刻）的 localStorage 内容；没等到 toast 返回 null */
async function decToUndo(page) {
  for (let i = 0; i < 45; i++) {
    const before = await lsNorm(page);
    await page.locator('.entry [data-act="dec"]').first().click();
    if (await visible(page, '#toast [data-act="undo"]')) return before;
  }
  return null;
}
const boxesApart = (a, b) => !a || !b ? false : (a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);

/* ---------- 检查项 ---------- */
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "onacut-smoke-"));
  for (const f of ["index.html", "sw.js", "manifest.webmanifest"]) fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
  fs.cpSync(path.join(ROOT, "icons"), path.join(tmp, "icons"), { recursive: true });
  const server = start(tmp, 0);
  await new Promise(r => server.on("listening", r));
  URL0 = "http://127.0.0.1:" + server.address().port + BASE;
  browser = await chromium.launch();
  console.log("smoke: " + URL0 + "  ←  " + tmp);

  await item("0. 静态检查", async () => {
    const page = read("dist/page.html"), index = read("index.html"), sw = read("sw.js");
    for (const w of ["serviceWorker.register", 'rel="manifest"', "manifest.webmanifest"]) ok(count(page, w) === 0, "dist/page.html 里没有 " + w);
    ok(count(index, "serviceWorker.register") === 1, "index.html 里 serviceWorker.register 出现 1 次");
    ok(count(index, 'rel="manifest"') === 1, 'index.html 里 rel="manifest" 出现 1 次');
    ok(count(sw, "__BUILD__") === 0, "sw.js 里没有 __BUILD__");
  });

  await item("1. 新用户引导", async () => {
    const a = await open();
    await a.page.waitForSelector("#sheet:not([hidden])");
    ok(await a.page.locator('#sheet [aria-label="首次设置"]').count() === 1, "普通浏览器：打开就是首次设置");
    ok(!(await a.page.locator("#sheet").innerText()).includes(HOME_HINT), "普通浏览器：第 1 步不出现 Safari 迁移提示");
    await endFlow(a, "普通浏览器"); await a.context.close();

    const b = await open({ init: () => { Object.defineProperty(Navigator.prototype, "standalone", { get: () => true, configurable: true }); } });
    await b.page.waitForSelector("#sheet:not([hidden])");
    ok((await b.page.locator("#sheet .hint").first().innerText()).includes(HOME_HINT), "主屏幕版（navigator.standalone=true）：第 1 步出现 Safari 迁移提示");
    await shot(b.page, "1-onboarding-standalone");
    ok(await noOverflow(b.page), "带提示的第 1 步没有横向溢出");
    await onboard(b.page);
    ok(await visible(b.page, ".hero"), "走完 4 步点“开始使用”后看到今天页");
    const s = JSON.parse(await lsRaw(b.page) || "null");
    ok(!!s && s.settings && s.settings.profile && s.settings.profile.done === true, "localStorage 已保存，settings.profile.done===true");
    await shot(b.page, "1-today");
    await endFlow(b, "主屏幕版"); await b.context.close();
  });

  /* 2 和 3 共用一个流程，各自计分 */
  const f23 = await open(); await onboard(f23.page);
  await item("2. 搜索记一样食物", async () => {
    const page = f23.page, left0 = await page.locator(".hero .big").first().innerText();
    await page.fill("#cu-q", "鸡胸");
    ok(await page.locator("#sr .sr-i").count() > 0, "搜“鸡胸”有结果");
    await page.locator("#sr .sr-i").first().locator(".pbtn").first().click();
    ok(await until(() => page.locator(".entry").count().then(n => n === 1)), "今天页记录区出现这条食物");
    ok((await page.locator(".entry .e-n").first().innerText()).includes("鸡胸"), "记录的名称含“鸡胸”");
    ok(await page.locator(".hero .big").first().innerText() !== left0, "剩余热量随之变化");
    ok(await entryCount(page) === 1, "localStorage 里多了 1 条");
    await shot(page, "2-logged");
    await endFlow(f23, "记录后");
  });
  await item("3. 撤销", async () => {
    const page = f23.page, before = await decToUndo(page);
    ok(!!before, "份量减到 0 时弹出带“撤销”的 toast");
    ok(await page.locator(".entry").count() === 0 && await entryCount(page) === 0, "这条记录已删除");
    await shot(page, "3-deleted-toast");
    await page.click('#toast [data-act="undo"]');
    ok(await until(() => page.locator(".entry").count().then(n => n === 1)), "点“撤销”后记录恢复");
    ok(await lsNorm(page) === before, "localStorage 里的数据和删除前一致（不比较 updatedAt 时间戳）");
    await endFlow(f23, "撤销后");
  });
  await f23.context.close();

  await item("4. 对冲页选甜点", async () => {
    const f = await open(), page = f.page; await onboard(page);
    await page.click('nav button:has-text("对冲")');
    const tabs = page.locator('[aria-label="甜点分组"] button');
    const names = await tabs.allInnerTexts();
    ok(names.some(t => /^甜点/.test(t)) && names.some(t => /^饮品零食/.test(t)), "有“甜点 / 饮品零食”分组标签");
    await page.click('[data-act="hzg"][data-v="snack"]');
    ok(await page.getAttribute('[data-act="hzg"][data-v="snack"]', "aria-pressed") === "true", "点“饮品零食”后切到该组");
    await page.click('[data-act="hzg"][data-v="sweet"]');
    ok(await page.getAttribute('[data-act="hzg"][data-v="sweet"]', "aria-pressed") === "true", "点回“甜点”");
    await page.locator('.chip[data-act="hz"]').first().click();
    ok(await visible(page, '[data-act="hzq"]') && await visible(page, '[data-act="hzadd"]'), "选一个甜点后出现份量行");
    ok(await visible(page, ".verdict"), "结论卡片出现");
    await shot(page, "4-hedge");
    const n0 = await entryCount(page);
    await page.click('[data-act="hzadd"]');
    ok(await visible(page, "#toast"), "点记入按钮后 toast 出现");
    ok(await until(() => entryCount(page).then(n => n === n0 + 1)), "今天的记录多了一条");
    await endFlow(f, "对冲页"); await f.context.close();
  });

  /* 5 和 6 共用一个环境：SW 已控制页面、有数据 */
  const f56 = await open();
  let ready56 = false;
  await item("5. 离线刷新", async () => {
    const { context, page } = f56;
    await onboard(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await until(() => page.evaluate(() => !!navigator.serviceWorker.controller), 3000))) await page.reload();
    ok(await until(() => page.evaluate(() => !!navigator.serviceWorker.controller)), "service worker 已控制页面");
    ok(!(await visible(page, "#upd")), "第一次安装不显示更新横条");
    await addFood(page, "鸡胸");
    ok(await until(() => page.locator(".entry").count().then(n => n === 1)), "先记一条食物");
    await context.setOffline(true);
    await page.reload();
    ok(await visible(page, ".hero"), "离线刷新后今天页正常渲染");
    ok(await page.locator(".entry").count() === 1 && (await page.locator(".entry .e-n").first().innerText()).includes("鸡胸"), "之前记的食物还在");
    ok(await page.evaluate(() => fetch("manifest.webmanifest").then(r => r.ok, () => false)), "离线时 manifest 也能从缓存取到");
    await shot(page, "5-offline");
    await endFlow(f56, "离线");
    await context.setOffline(false);

    /* 字体请求永不响应：页面不能被它卡住 */
    await context.route(/fonts\.googleapis\.com/, () => {});
    const p2 = await context.newPage(), t0 = Date.now();
    await p2.goto(URL0, { waitUntil: "commit" });
    const shown = await p2.waitForSelector(".hero", { timeout: 3000 }).then(() => true, () => false);
    ok(shown, "字体请求挂起时，3 秒内今天页已渲染（用时 " + (Date.now() - t0) + " ms）");
    await p2.close(); await context.unroute(/fonts\.googleapis\.com/);
    ready56 = true;
  });

  await item("6. 更新横条", async () => {
    if (!ready56) throw new Error("第 5 项没有准备好环境");
    const { page } = f56;
    await page.goto(URL0);
    const swFile = path.join(tmp, "sw.js");
    fs.writeFileSync(swFile, fs.readFileSync(swFile, "utf8").replace(/^const VERSION="[^"]*";/, 'const VERSION="smoke2";'));
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
    ok(await until(() => visible(page, "#upd"), 10000), "发布新版本后横条出现");
    ok((await page.locator("#upd-go").innerText()).trim() === "有新版本，点此刷新", "横条文字是“有新版本，点此刷新”");
    ok(await page.evaluate(() => document.documentElement.classList.contains("upd-on")), "<html> 带 upd-on");
    await shot(page, "6-bar");

    /* 和 toast 不重叠 */
    const n0 = await page.locator(".entry").count();
    ok(!!(await decToUndo(page)), "横条显示时触发带“撤销”的 toast");
    const bu = await page.locator("#upd").boundingBox(), bt = await page.locator("#toast").boundingBox();
    ok(boxesApart(bu, bt), "横条和 toast 不相交");
    ok(!!bu && !!bt && bt.y + bt.height <= bu.y, "toast 在横条上方");
    ok(await page.evaluate(() => { const b = document.querySelector('#toast [data-act="undo"]'), r = b.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b; }), "“撤销”按钮中心点没有被挡住");
    await shot(page, "6-bar-and-toast");
    await page.click('#toast [data-act="undo"]');
    ok(await until(() => page.locator(".entry").count().then(n => n === n0)), "点“撤销”能撤销成功");

    /* 抽屉打开时隐藏 */
    await page.click('[data-act="profile"]');
    await page.waitForSelector("#sheet:not([hidden])");
    ok(await until(() => visible(page, "#upd").then(v => !v)) && !(await page.evaluate(() => document.documentElement.classList.contains("upd-on"))), "打开“身体档案与设置”时横条隐藏");
    await page.click('#sheet [data-act="shclose"]');
    ok(await until(() => visible(page, "#upd")), "关闭抽屉后横条重新出现");

    /* ✕ 只关本次 */
    await page.click("#upd-x");
    ok(!(await visible(page, "#upd")) && !(await page.evaluate(() => document.documentElement.classList.contains("upd-on"))), "点 ✕ 后横条隐藏，<html> 没有 upd-on");
    await page.reload();
    ok(await until(() => visible(page, "#upd")), "重新打开页面，横条再次出现");

    /* 点了才刷新，而且只刷新一次 */
    await sleep(2000);   // 等上面那个 toast 的 5 秒计时走完一部分，避免它影响截图；也确认这期间页面没有自己刷新
    const before = await lsRaw(page);
    let loads = 0; page.on("load", () => { loads++; });
    await page.click("#upd-go");
    ok(await until(() => loads >= 1, 10000), "点“有新版本，点此刷新”后页面刷新");
    await sleep(2500);
    ok(loads === 1, "只刷新一次（实际 " + loads + " 次）");
    ok(await visible(page, ".hero") && !(await visible(page, "#upd")), "刷新后横条隐藏，今天页正常");
    ok(await lsRaw(page) === before, "localStorage 里的数据和点之前一致");
    const keys = await page.evaluate(() => caches.keys());
    ok(keys.filter(k => k.startsWith("onacut-")).join(",") === "onacut-smoke2", "只剩新版本的缓存（" + keys.join(",") + "）");
    await shot(page, "6-after-refresh");
    await endFlow(f56, "更新后");
  });
  await f56.context.close();

  await browser.close(); server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  const pass = results.filter(r => r[0]).length;
  console.log("\n——————————");
  results.forEach(r => console.log((r[0] ? "✓ " : "✗ ") + r[1]));
  console.log("通过 " + pass + " / " + results.length);
  process.exit(pass === results.length ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
