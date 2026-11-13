"use strict";
const test=require("node:test"), assert=require("node:assert/strict");
const FD=require("../src/foods.js"), E=require("../src/engine.js");
const {FOODS,GROUPS,TAGS,CATS}=FD, {FBY}=E;
const OLD="lean beef salmon whey egg milk lmilk soy yog tofu rice yam bag3 bag2 toast oat noodle banana fruit veg oil nuts avo flan crois pac cookie cake ice tea".split(" ");
/* v6 engine.js 里的食物表，原样抄下来：[显示名, 蛋白, 碳水, 脂肪]。v6 的条目都没有 k。 */
const V6={
 lean:["瘦肉 1 掌",30,0,3], beef:["瘦牛肉 1 掌",30,0,8], salmon:["三文鱼 1 掌",25,0,15], whey:["蛋白粉 1 大勺",23,2,2],
 egg:["鸡蛋 1 个",6.5,0.5,5], milk:["全脂牛奶 250ml",8,12,9], lmilk:["低脂牛奶 250ml",8.5,12.5,4], soy:["无糖豆浆粉 1 袋",6,3,3],
 yog:["无糖希腊酸奶 150g",13,6,3], tofu:["豆腐 半盒",12,3,7], rice:["米饭/杂粮饭 1 拳",3,33,0.5], yam:["紫薯/红薯 1 拳",2,30,0],
 bag3:["法棍 1/3 根",7,45,1], bag2:["法棍 半根",11,70,1.5], toast:["吐司 1 片",3,14,1], oat:["燕麦 20g",2.5,13,1.5],
 noodle:["面条 1 拳",4,30,0.5], banana:["香蕉 半根",0.5,12,0], fruit:["水果 1 拳",0.5,15,0], veg:["蔬菜 两捧",3,8,0],
 oil:["烹调油 1 茶匙",0,0,5], nuts:["坚果 1 小把",3,3,8], avo:["牛油果 半个",1.5,2,11], flan:["Flan 1 块",5,38,12],
 crois:["黄油可颂 1 个",5,26,14], pac:["巧克力可颂 1 个",6,32,17], cookie:["曲奇 1 大块",2.5,28,11], cake:["蛋糕 1 片",4,40,16],
 ice:["冰淇淋 1 球",2,16,7], tea:["奶茶 1 杯",3,45,8]};

test("foods：导出的常量", ()=>{
  assert.deepEqual(CATS,[["pro","蛋白质"],["carb","主食"],["veg","蔬果"],["fat","油脂"],["sweet","甜点"]]);
  assert.deepEqual(GROUPS,[["home","家常"],["west","西式轻食"],["out","外卖外食"],["snack","零食饮品"],["sweet","甜点"]]);
  assert.deepEqual(Object.keys(TAGS).sort(),"meat pork beef poultry fish seafood egg dairy whey soy gluten nut alcohol".split(" ").sort());
  assert.equal(E.CATS,CATS);
});
test("foods：每条的结构", ()=>{
  const ids=new Set(), cats=CATS.map(c=>c[0]), groups=GROUPS.map(g=>g[0]);
  for(const f of FOODS){
    assert.match(f.id,/^[a-z0-9]+$/,f.id);
    assert.ok(!ids.has(f.id),"id 重复 "+f.id); ids.add(f.id);
    assert.ok(cats.includes(f.cat),f.id+" cat"); assert.ok(groups.includes(f.g),f.id+" g");
    assert.ok(f.n&&!/\s\d|\d\s/.test(f.n),f.id+" n");
    assert.ok(Array.isArray(f.a)&&f.a.every(x=>x&&x!==f.n),f.id+" a");
    assert.match(f.py,/^[a-z]+$/,f.id+" py");
    // py 的长度 = 名称里的汉字数 + 英文字母数
    assert.equal(f.py.length,(f.n.match(/[一-鿿]|[A-Za-z]/g)||[]).length,f.id+" py 长度");
    assert.ok(Array.isArray(f.u)&&f.u.length>0,f.id+" u");
    assert.equal(f.u[0].x,1,f.id+" 基准份量 x");
    const ks=new Set();
    for(const u of f.u){ assert.match(u.k,/^[a-z0-9]+$/,f.id+" "+u.k); assert.ok(!ks.has(u.k),f.id+" 份量 k 重复"); ks.add(u.k); assert.ok(u.l&&u.x>0,f.id+" "+u.k) }
    for(const key of ["p","c","f"]) assert.ok(Number.isFinite(f[key])&&f[key]>=0&&(f[key]*2)%1===0,f.id+" "+key+" 保留到 0.5");
    assert.ok(Array.isArray(f.tags)&&f.tags.every(t=>t in TAGS),f.id+" tags");
    if(f.tags.some(t=>["pork","beef","poultry"].includes(t))) assert.ok(f.tags.includes("meat"),f.id+" 缺 meat");
    if(f.g==="out"||f.tags.includes("alcohol")) assert.ok(f.k!=null,f.id+" 必须填 k");
  }
});
test("foods：变体 id 不和基准 id 冲突", ()=>{
  const base=new Set(FOODS.map(f=>f.id)), all=new Set();
  for(const f of FOODS) for(const u of f.u.slice(1)){
    const id=f.id+"@"+u.k;
    assert.ok(!base.has(id)&&!all.has(id),id); all.add(id);
    assert.equal(FBY[id].baseOf,f.id); assert.equal(FBY[id].n,f.n+" "+u.l);
  }
  assert.equal(Object.keys(FBY).length,base.size+all.size);
});
test("foods：k 和 4p+4c+9f 相差不超过 15%（含酒精的除外）", ()=>{
  for(const f of FOODS){
    if(f.k==null||f.tags.includes("alcohol")) continue;
    assert.ok(Math.abs(f.k-(4*f.p+4*f.c+9*f.f))<=0.15*f.k,`${f.id} k=${f.k} 三大营养素=${4*f.p+4*f.c+9*f.f}`);
  }
});
test("foods：30 个旧 id 都在，显示名和数值与 v6 完全一致", ()=>{
  assert.equal(OLD.length,30);
  for(const id of OLD){
    const f=FBY[id], v=V6[id];
    assert.ok(f,id);
    assert.equal(f.n,v[0],id); assert.equal(f.p,v[1],id); assert.equal(f.c,v[2],id); assert.equal(f.f,v[3],id);
    assert.equal(f.k,undefined,id+" 不应有 k");
    assert.equal(f.cat,{lean:"pro",rice:"carb",veg:"veg",oil:"fat",nuts:"fat",flan:"sweet"}[id]||f.cat);
  }
  // 任务单点名的 11 个：再写死一遍，防止上面的表被一起改掉
  const must={lean:["瘦肉 1 掌",30,0,3],rice:["米饭/杂粮饭 1 拳",3,33,0.5],veg:["蔬菜 两捧",3,8,0],oil:["烹调油 1 茶匙",0,0,5],nuts:["坚果 1 小把",3,3,8],
    whey:["蛋白粉 1 大勺",23,2,2],milk:["全脂牛奶 250ml",8,12,9],banana:["香蕉 半根",0.5,12,0],egg:["鸡蛋 1 个",6.5,0.5,5],yog:["无糖希腊酸奶 150g",13,6,3],fruit:["水果 1 拳",0.5,15,0]};
  for(const id in must) assert.deepEqual([FBY[id].n,FBY[id].p,FBY[id].c,FBY[id].f],must[id],id);
});
test("foods：必须追加的份量", ()=>{
  for(const id of ["milk","lmilk"]){
    const b=FBY[id], v=FBY[id+"@ml100"];
    assert.ok(v,id); assert.equal(v.n,b.base.n+" 100ml");
    for(const k of ["p","c","f"]) assert.equal(v[k],E.r1(b[k]*0.4),id+" "+k);
  }
  assert.deepEqual([FBY["milk@ml100"].p,FBY["milk@ml100"].c,FBY["milk@ml100"].f],[3.2,4.8,3.6]);
  assert.deepEqual([FBY["oat@g10"].n,FBY["oat@g10"].c],["燕麦 10g",6.5]);
  assert.deepEqual([FBY["oat@g40"].n,FBY["oat@g40"].p,FBY["oat@g40"].c,FBY["oat@g40"].f],["燕麦 40g",5,26,3]);
  assert.equal(FBY["rice@bowl"].n,"米饭/杂粮饭 1 碗"); assert.equal(FBY["rice@g100"].n,"米饭/杂粮饭 100g");
  assert.deepEqual([FBY["egg@two"].n,FBY["egg@two"].p,FBY["egg@two"].c,FBY["egg@two"].f],["鸡蛋 2 个",13,1,10]);
  // 原来没有 k 的变体不生成 k；有 k 的按倍数换算
  assert.equal("k" in FBY["rice@bowl"],false);
  assert.equal(FBY["hmj@half"].k,E.r1(FBY.hmj.k*0.5));
});
test("foods：数量下限和 top 数量", ()=>{
  assert.ok(FOODS.length>=150&&FOODS.length<=200,String(FOODS.length));
  const n=g=>FOODS.filter(f=>f.g===g).length;
  assert.ok(n("home")>=60,"home "+n("home")); assert.ok(n("out")>=35,"out "+n("out")); assert.ok(n("west")>=20,"west "+n("west"));
  assert.ok(n("snack")>=25,"snack "+n("snack")); assert.ok(n("sweet")>=12,"sweet "+n("sweet"));
  for(const c of CATS){const t=FOODS.filter(f=>f.cat===c[0]&&f.top).length; assert.ok(t>=8&&t<=12,c[0]+" top "+t)}
});
test("engine.FOODS：只含基准份量，形状固定", ()=>{
  assert.equal(E.FOODS.length,FOODS.length);
  E.FOODS.forEach((f,i)=>{
    const b=FOODS[i];
    assert.equal(f.base,b); assert.equal(FBY[f.id],f); assert.equal(f.n,b.n+" "+b.u[0].l);
    assert.deepEqual([f.id,f.cat,f.g,f.p,f.c,f.f,f.k,f.top,f.tags],[b.id,b.cat,b.g,b.p,b.c,b.f,b.k,b.top,b.tags]);
  });
});

/* ---------- 批次 2A.1：top 名单、甜点分组、hide、法棍份量 ---------- */
const TOP82={
  pro:"chicken chleg egg lean beef fish shrimp tofu soymilk milk yog whey",
  carb:"rice noodle mifen mantou baozi jiaozi porridge corn yam potato oat toast",
  veg:"veg stirveg broccoli tomato cucumber apple banana orange watermelon grape fruit",
  fat:"oil nuts peanut guazi walnut zmj pb cheese avo wuhua",
  sweet:"mtfull mthalf cola juice beer chips choc cake ice popsicle eggtart cookie"};
test("foods：top 名单（v8.2）", ()=>{
  for(const c of CATS){
    const want=TOP82[c[0]].split(" ").sort(), got=FOODS.filter(f=>f.cat===c[0]&&f.top).map(f=>f.id).sort();
    assert.deepEqual(got,want,c[0]);
    assert.ok(got.length>=10&&got.length<=12,c[0]+" "+got.length);
  }
  const by=Object.fromEntries(FOODS.map(f=>[f.id,f]));
  for(const id of "bag3 bag2 wwbread flan crois pac tea lmilk soy salmon blueberry xfq butter".split(" ")){
    assert.ok(by[id],id); assert.equal("top" in by[id],false,id+" 不应有 top");
  }
});
test("foods：甜点分类的 g 只有甜点 / 饮品零食", ()=>{
  const sw=FOODS.filter(f=>f.cat==="sweet");
  for(const f of sw) assert.ok(["sweet","snack"].includes(f.g),f.id+" g="+f.g);
  assert.equal(FOODS.find(f=>f.id==="tea").g,"snack");
  assert.ok(sw.filter(f=>f.g==="sweet").length>=10); assert.ok(sw.filter(f=>f.g==="snack").length>=10);
});
test("foods：hide 标记", ()=>{
  const hidden=FOODS.filter(f=>"hide" in f);
  for(const f of hidden){ assert.equal(f.hide,1,f.id); assert.equal("top" in f,false,f.id+" 不能同时有 top") }
  assert.deepEqual(hidden.map(f=>f.id),["bag2"]);
  assert.equal(E.FOODS.find(f=>f.id==="bag2").hide,1);
  assert.deepEqual(E.FOODS.filter(f=>f.hide).map(f=>f.id),["bag2"]);
});
test("foods：法棍份量", ()=>{
  assert.deepEqual(E.portionsOf("bag3").map(f=>f.id),["bag3","bag3@half","bag3@one"]);
  const h=FBY["bag3@half"], o=FBY["bag3@one"];
  assert.deepEqual([h.n,h.p,h.c,h.f],["法棍 半根",10.5,67.5,1.5]); assert.equal("k" in h,false);
  assert.deepEqual([o.n,o.p,o.c,o.f],["法棍 1 根",21,135,3]); assert.equal("k" in o,false);
  assert.deepEqual([FBY.bag2.n,FBY.bag2.p,FBY.bag2.c,FBY.bag2.f],["法棍 半根",11,70,1.5]);
  assert.deepEqual(E.portionsOf("bag2").map(f=>f.id),["bag2"]);
});
