#!/usr/bin/env node
/* 生成 PWA 图标和 manifest.webmanifest。零依赖，仓库根目录运行：node tools/make-icons.js
   颜色唯一来源是 tools/brand.json 的 color（#RRGGBB）。输出是确定的：同一个颜色每次生成的字节完全一样。
   生成物（icons/*.png、manifest.webmanifest）要提交；build.sh 不会重新生成它们，只读取。 */
"use strict";
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const ROOT = path.join(__dirname, "..");

const brand = JSON.parse(fs.readFileSync(path.join(__dirname, "brand.json"), "utf8"));
const C = brand && brand.color;
if (typeof C !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(C)) {
  console.error("make-icons: tools/brand.json 的 color 必须是 #RRGGBB，读到的是 " + JSON.stringify(C));
  process.exit(1);
}
const RGB = [1, 3, 5].map(i => parseInt(C.slice(i, i + 2), 16));
const WHITE = [255, 255, 255];

/* ---------- PNG 编码：IHDR / IDAT / IEND，RGBA 8 位 ---------- */
const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; }
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(S, rgba) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((S * 4 + 1) * S);
  for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; rgba.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------- 图案：卷尺刻度（坐标都是边长 S 的比例，左上角为原点） ---------- */
function inRR(x, y, x0, y0, x1, y1, r) {   // 点是否在圆角矩形内
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x, cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  const dx = x - cx, dy = y - cy; return dx * dx + dy * dy <= r * r;
}
const BODY = { x0: 0.18, y0: 0.39, x1: 0.82, y1: 0.61, r: 0.04 };            // 尺身：中心 (0.5,0.5)，宽 0.64，高 0.22
const TICKS = []; for (let i = 0; i < 9; i++) TICKS.push({ x: 0.22 + 0.07 * i, len: i % 4 === 0 ? 0.12 : 0.07 });   // 第 1、5、9 条是长刻度
const TW = 0.02;
function sample(u, v, rounded) {             // 返回 [r,g,b] 或 null（透明）
  if (inRR(u, v, BODY.x0, BODY.y0, BODY.x1, BODY.y1, BODY.r)) {
    for (const t of TICKS) if (u >= t.x - TW / 2 && u <= t.x + TW / 2 && v <= BODY.y0 + t.len) return RGB;
    return WHITE;
  }
  if (!rounded || inRR(u, v, 0, 0, 1, 1, 0.22)) return RGB;
  return null;
}
function draw(S, rounded) {
  const out = Buffer.alloc(S * S * 4), N = 4;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
      const c = sample((x + (sx + 0.5) / N) / S, (y + (sy + 0.5) / N) / S, rounded);
      if (c) { r += c[0]; g += c[1]; b += c[2]; n++; }
    }
    const o = (y * S + x) * 4;
    if (n) { out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n); out[o + 2] = Math.round(b / n); out[o + 3] = Math.round(n * 255 / (N * N)); }
  }
  return out;
}

const FILES = [
  ["icons/icon-192.png", 192, true],
  ["icons/icon-512.png", 512, true],
  ["icons/icon-maskable-512.png", 512, false],
  ["icons/apple-touch-icon.png", 180, false],
];
fs.mkdirSync(path.join(ROOT, "icons"), { recursive: true });
const done = [];
for (const [name, S, rounded] of FILES) { fs.writeFileSync(path.join(ROOT, name), png(S, draw(S, rounded))); done.push(name + "（" + S + "×" + S + "）"); }

const manifest = `{
  "id": "./",
  "name": "On a Cut 刷脂助手",
  "short_name": "On a Cut",
  "lang": "zh-CN",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "theme_color": "${C}",
  "background_color": "${C}",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
`;
JSON.parse(manifest);
fs.writeFileSync(path.join(ROOT, "manifest.webmanifest"), manifest);
done.push("manifest.webmanifest");
console.log("make-icons: 颜色 " + C + "，已生成：\n  " + done.join("\n  "));
