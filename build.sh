#!/bin/sh
# 构建：sh build.sh（无参数）。三个产物都要提交，不要手改：
#   1. dist/page.html：把 src/foods.js 和 src/engine.js（foods 在前）内联到 src/on-a-cut.html 的 <!--ENGINE--> 占位行。
#      Artifact 发布用，不含 html/head/body，不注册 service worker、不引用 manifest。
#   2. index.html：src/shell-head.html + dist/page.html（字体 link 改成不阻塞渲染）+ src/shell-tail.html。
#      GitHub Pages 用，带 manifest、图标、service worker 注册和“有新版本”横条。
#   3. sw.js：src/sw.js 里的版本占位符换成内容校验和（index.html + manifest + 图标 + src/sw.js），同样的输入版本号不变。
# 图标（icons/*.png）和 manifest.webmanifest 不在这里生成：改 tools/brand.json 后运行 node tools/make-icons.js，再运行本脚本。
set -e
cd "$(dirname "$0")"
SRC=src/on-a-cut.html ENG=src/engine.js FDS=src/foods.js
for f in "$FDS" "$ENG"; do if grep -qi '</script' "$f"; then echo "build: $f 里不能出现 </script>" >&2; exit 1; fi; done
if [ "$(grep -c '^<!--ENGINE-->$' "$SRC")" != 1 ]; then echo "build: $SRC 里需要恰好一行 <!--ENGINE-->" >&2; exit 1; fi
mkdir -p dist
awk -v fds="$FDS" -v eng="$ENG" '$0=="<!--ENGINE-->"{print "<script>";while((getline l < fds)>0)print l;close(fds);while((getline l < eng)>0)print l;close(eng);print "</script>";next}{print}' "$SRC" > dist/page.html

die(){ echo "build: $1" >&2; exit 1; }
count(){ grep -oF -e "$1" "$2" | grep -c . || true; }   # 某段文字在文件里出现的次数

# PWA 素材（由 tools/make-icons.js 生成并提交）
for f in manifest.webmanifest icons/icon-192.png icons/icon-512.png icons/icon-maskable-512.png icons/apple-touch-icon.png; do
  [ -f "$f" ] || die "缺少图标或 manifest，先运行 node tools/make-icons.js"
done
THEME=$(sed -n 's/.*"theme_color": *"\(#[0-9A-Fa-f]\{6\}\)".*/\1/p' manifest.webmanifest)
case "$THEME" in '#'??????) ;; *) die "manifest.webmanifest 里取不到 theme_color";; esac

# 字体：只在 index.html 里改成不阻塞渲染（离线或加载失败时数字用系统字体）；dist/page.html 保持原样
FONT_URL='https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&display=swap'
FONT_OLD="<link rel=\"stylesheet\" href=\"$FONT_URL\">"
FONT_NEW="<link rel=\"stylesheet\" href=\"$FONT_URL\" media=\"print\" onload=\"this.media='all'\">"
[ "$(grep -cxF -e "$FONT_OLD" dist/page.html || true)" = 1 ] || die "没找到字体 link 行"
export FONT_OLD FONT_NEW

{ sed "s/__THEME__/$THEME/g" src/shell-head.html
  awk '$0==ENVIRON["FONT_OLD"]{print ENVIRON["FONT_NEW"];next}{print}' dist/page.html
  cat src/shell-tail.html; } > index.html

VER=$(cat index.html manifest.webmanifest icons/*.png src/sw.js | cksum | cut -d' ' -f1)
sed "s/__BUILD__/$VER/g" src/sw.js > sw.js

# 断言：Artifact 版不能带 SW / manifest；Pages 版必须恰好各一处
for w in 'serviceWorker' 'rel="manifest"' 'manifest.webmanifest'; do
  if grep -qF -e "$w" dist/page.html; then die "dist/page.html 里不能出现 $w"; fi
done
[ "$(count 'serviceWorker.register' index.html)" = 1 ] || die "index.html 里 serviceWorker.register 应恰好出现 1 次"
[ "$(count 'rel="manifest"' index.html)" = 1 ] || die "index.html 里 rel=\"manifest\" 应恰好出现 1 次"
grep -qF -e 'media="print" onload=' index.html || die "index.html 里字体 link 没有改成不阻塞加载"
if grep -qF -e '__THEME__' index.html; then die "index.html 里还有 __THEME__"; fi
if grep -qF -e '__BUILD__' sw.js; then die "sw.js 里还有 __BUILD__"; fi
if grep -qF -e 'localStorage' sw.js; then die "sw.js 里不能出现 localStorage"; fi

echo "build: dist/page.html + index.html + sw.js（版本 ${VER}）"
