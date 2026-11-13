const VERSION="__BUILD__";
/* On a Cut 的 service worker 模板。构建时 build.sh 把上面的占位符换成内容校验和，写到根目录 sw.js（生成物，不要手改）。
   只缓存同源文件；运行时不往缓存写东西；新版本装好后等页面发 SKIP_WAITING 才接管。 */
const CACHE="onacut-"+VERSION;
const ASSETS=["./","./index.html","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./icons/apple-touch-icon.png"];

self.addEventListener("install",ev=>{
  /* cache:"reload" 绕过 HTTP 缓存（GitHub Pages 有 10 分钟），否则新版本可能把旧的 index.html 存进去 */
  ev.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(u=>new Request(u,{cache:"reload"})))));
});

self.addEventListener("activate",ev=>{
  ev.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith("onacut-")&&k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});

self.addEventListener("message",ev=>{ if(ev.data&&ev.data.type==="SKIP_WAITING") self.skipWaiting() });

self.addEventListener("fetch",ev=>{
  const req=ev.request;
  if(req.method!=="GET"||new URL(req.url).origin!==location.origin) return;   // 跨域请求（字体等）交给浏览器
  if(req.mode==="navigate"){
    ev.respondWith(caches.open(CACHE).then(cache=>cache.match("./index.html")).then(hit=>hit||fetch(req)));
    return;
  }
  ev.respondWith(caches.match(req,{ignoreSearch:true}).then(hit=>hit||fetch(req)));
});
