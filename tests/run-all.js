"use strict";
// node --test tests/ 的统一入口：Node 22 不扫描目录，靠 package.json 的 main 指到这里。
// 文件名故意不带 .test.，这样会扫描目录的新版 Node 不会把每个用例跑两遍。新增测试文件要在这里登记。
require("./engine.test.js");
require("./foods.test.js");
