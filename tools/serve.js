#!/usr/bin/env node
/* 零依赖静态服务器：node tools/serve.js <根目录> [端口]
   把根目录挂在 /on-a-cut/ 下（模拟 GitHub Pages 的子路径），/ 重定向到 /on-a-cut/。
   每次请求都从磁盘读文件，不做缓存，方便在运行中改文件、模拟发布新版本。 */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const BASE = "/on-a-cut/";
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8", ".png": "image/png", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
};
function start(root, port) {
  const dir = path.resolve(root);
  const server = http.createServer((req, res) => {
    const end = (code, body, head) => { res.writeHead(code, Object.assign({ "Cache-Control": "no-cache" }, head)); res.end(body); };
    let p;
    try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch (e) { return end(400, "bad request"); }
    if (p === "/" || p === BASE.slice(0, -1)) return end(302, "", { Location: BASE });
    if (!p.startsWith(BASE)) return end(404, "not found");
    let rel = p.slice(BASE.length); if (rel === "" || rel.endsWith("/")) rel += "index.html";
    const file = path.resolve(dir, rel);
    if (file !== dir && !file.startsWith(dir + path.sep)) return end(403, "forbidden");   // 不允许 .. 越出根目录
    fs.readFile(file, (err, buf) => {
      if (err) return end(404, "not found");
      end(200, req.method === "HEAD" ? "" : buf, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
    });
  });
  server.listen(port || 0, "127.0.0.1");
  return server;
}
module.exports = { start, BASE };
if (require.main === module) {
  const root = process.argv[2], port = +process.argv[3] || 8080;
  if (!root) { console.error("用法：node tools/serve.js <根目录> [端口]"); process.exit(1); }
  start(root, port).on("listening", () => console.log("serve: http://127.0.0.1:" + port + BASE + "  ←  " + path.resolve(root)));
}
