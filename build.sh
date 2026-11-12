#!/bin/sh
# 构建：sh build.sh（无参数）
#   1. 把 src/foods.js 和 src/engine.js（foods 在前）内联到 src/on-a-cut.html 的 <!--ENGINE--> 占位行 → dist/page.html（Artifact 发布用，不含 html/head/body）
#   2. 用独立网页的外壳包住 dist/page.html → index.html（GitHub Pages 用）
set -e
cd "$(dirname "$0")"
SRC=src/on-a-cut.html ENG=src/engine.js FDS=src/foods.js
for f in "$FDS" "$ENG"; do if grep -qi '</script' "$f"; then echo "build: $f 里不能出现 </script>" >&2; exit 1; fi; done
if [ "$(grep -c '^<!--ENGINE-->$' "$SRC")" != 1 ]; then echo "build: $SRC 里需要恰好一行 <!--ENGINE-->" >&2; exit 1; fi
mkdir -p dist
awk -v fds="$FDS" -v eng="$ENG" '$0=="<!--ENGINE-->"{print "<script>";while((getline l < fds)>0)print l;close(fds);while((getline l < eng)>0)print l;close(eng);print "</script>";next}{print}' "$SRC" > dist/page.html
{ printf '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>\n</head>\n<body>\n'; cat dist/page.html; printf '</body>\n</html>\n'; } > index.html
echo "build: dist/page.html + index.html"
