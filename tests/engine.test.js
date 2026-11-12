"use strict";
process.env.TZ="America/New_York"; // 有夏令时的时区，用来验证日期运算
const test=require("node:test"), assert=require("node:assert/strict");
const E=require("../src/engine.js");
const {compute,pfError,addDays,diffDays,buildTpl,advise,dayOk,mid,MODES}=E;

test("compute：安全下限", ()=>{
  const r=compute({sex:"f",w:50,h:160,age:30,mode:"cut2",n:0,goal:""});
  assert.ok(r.avg>=1200); assert.equal(r.clamped,true);
  assert.ok(mid(r.train.k)>=1200);
  assert.equal(compute({sex:"m",w:80,h:180,age:30,mode:"keep",n:3,goal:""}).clamped,false);
});
test("compute：BMI>27 时蛋白按 BMI 27 的体重算", ()=>{
  const h=170, w27=27*Math.pow(h/100,2);
  const r=compute({sex:"m",w:120,h,age:35,mode:"cut1",n:3,goal:""});
  assert.equal(mid(r.train.p),Math.round(MODES.cut1.p*w27));
  const thin=compute({sex:"m",w:65,h,age:35,mode:"cut1",n:3,goal:""});
  assert.equal(mid(thin.train.p),Math.round(MODES.cut1.p*65));
});
test("compute：训练日/休息日的周均热量等于日均", ()=>{
  for(const sex of ["f","m"]) for(const mode of Object.keys(MODES)) for(let n=1;n<=6;n++){
    const r=compute({sex,w:70,h:170,age:30,mode,n,goal:""});
    assert.ok(Math.abs((r.kT*n+r.kR*(7-n))/7-r.avg)<=1,`${sex} ${mode} ${n}`);
    assert.ok(r.kT>r.kR);
  }
  for(const n of [0,7]){const r=compute({sex:"f",w:60,h:165,age:30,mode:"cut1",n,goal:""}); assert.equal(r.kT,r.kR)}
});
test("pfError：范围校验", ()=>{
  const ok={sex:"f",age:30,h:165,w:60,goal:""};
  assert.equal(pfError(ok),"");
  assert.equal(pfError({...ok,goal:null}),"");
  assert.ok(pfError({...ok,age:17}));
  assert.ok(pfError({...ok,h:119}));
  assert.ok(pfError({...ok,w:251}));
  assert.ok(pfError({...ok,goal:20}));
  assert.ok(pfError({...ok,sex:""}));
});
test("addDays / diffDays：跨月、跨年、跨夏令时", ()=>{
  assert.equal(addDays("2026-01-31",1),"2026-02-01");
  assert.equal(addDays("2024-02-28",1),"2024-02-29");
  assert.equal(addDays("2026-03-01",-1),"2026-02-28");
  assert.equal(addDays("2026-12-31",1),"2027-01-01");
  assert.equal(addDays("2027-01-01",-1),"2026-12-31");
  assert.equal(diffDays("2027-01-01","2026-12-31"),1);
  assert.equal(diffDays("2026-03-01","2026-02-01"),28);
  // 美东 2026-03-08 进入夏令时（当天 23 小时），2026-11-01 退出（当天 25 小时）
  assert.equal(addDays("2026-03-07",1),"2026-03-08");
  assert.equal(addDays("2026-03-08",1),"2026-03-09");
  assert.equal(diffDays("2026-03-09","2026-03-07"),2);
  assert.equal(addDays("2026-10-31",2),"2026-11-02");
  assert.equal(diffDays("2026-11-02","2026-10-31"),2);
  assert.equal(diffDays("2026-11-12","2026-03-01"),256);
  let d="2026-01-01"; for(let i=0;i<400;i++){const n=addDays(d,1); assert.equal(diffDays(n,d),1); d=n}
  assert.equal(d,"2027-02-05");
});
test("buildTpl：份数都是非负的半份倍数", ()=>{
  const tm=[690,900,1020,1140];
  for(const mode of Object.keys(MODES)) for(const sex of ["f","m"]) for(const w of [45,60,85,130]) for(const train of [true,false]){
    const r=compute({sex,w,h:sex==="m"?178:163,age:32,mode,n:3,goal:""});
    const tpl=buildTpl(train?r.train:r.rest,tm,train);
    assert.equal(tpl.length,4);
    for(const m of tpl){
      assert.match(m[0],/^\d\d:\d\d$/);
      for(const it of m[3]){
        assert.ok(E.FBY[it[0]],it[0]);
        assert.ok(Number.isFinite(it[1])&&it[1]>=0&&(it[1]*2)%1===0,`${mode} ${sex} ${w} ${train}: ${it[0]} ×${it[1]}`);
        assert.ok(!/NaN|undefined/.test(it[2]));
      }
    }
  }
});
test("dayOk：蛋白到下限且热量不超上限", ()=>{
  const t={p:[100,110],k:[1500,1600]};
  assert.equal(dayOk({p:100,k:1600},t),true);
  assert.equal(dayOk({p:99,k:1400},t),false);
  assert.equal(dayOk({p:120,k:1601},t),false);
});

const TRAIN={p:[100,110],pf:85,c:[165,180],f:[42,48],k:[1500,1600]};
test("advise：示例用例（蛋白已超，额度留给主食和油）", ()=>{
  const a=advise({T:{p:125,c:90,f:25,k:1085},t:TRAIN,mealsLeft:1,windowClosed:false,kOnly:false});
  assert.equal(a.palms,0);
  assert.ok(a.flags.includes("proteinOver"));
  assert.equal(a.nuts,1); assert.equal(a.oilTsp,2);
  // 任务单写的是 2 拳，但按 2.2 的算法，补完脂肪后只剩 235 kcal = 1.5 拳；吃 2 拳会到 1611 kcal，超出上限
  assert.equal(a.fists,1.5);
  assert.ok(a.after.k>=1500&&a.after.k<=1600,String(a.after.k));
  assert.equal(a.overK,0); assert.equal(a.spreadDays,0); assert.equal(a.perMeal,false);
});
test("advise：关窗、超额、只记热量", ()=>{
  let a=advise({T:{p:60,c:100,f:30,k:900},t:TRAIN,mealsLeft:1,windowClosed:true,kOnly:false});
  assert.deepEqual(a.flags,["closedLowP"]); assert.equal(a.whey,1); assert.equal(a.palms+a.fists+a.nuts+a.oilTsp+a.veg,0);
  a=advise({T:{p:90,c:100,f:30,k:900},t:TRAIN,mealsLeft:1,windowClosed:true,kOnly:false});
  assert.deepEqual(a.flags,["closed"]); assert.equal(a.whey,0); assert.equal(a.after.k,900);
  a=advise({T:{p:70,c:200,f:60,k:1800},t:TRAIN,mealsLeft:2,windowClosed:false,kOnly:true});
  assert.ok(a.flags.includes("overBudget")&&a.flags.includes("kOnly"));
  assert.equal(a.palms,1); assert.equal(a.fists,0); assert.equal(a.fatG,0); assert.equal(a.perMeal,true);
  assert.equal(a.overK,1800+147+44-1600); assert.equal(a.spreadDays,5);
  a=advise({T:{p:0,c:0,f:0,k:0},t:TRAIN,mealsLeft:3,windowClosed:false,kOnly:false});
  assert.equal(a.palms,3.5); assert.ok(a.fists>=0.5); assert.ok(a.after.k<=1600);
});
test("advise：500 组随机输入的不变量", ()=>{
  let s=20261112; const rnd=()=>{s|=0;s=s+0x6D2B79F5|0;let x=Math.imul(s^s>>>15,1|s);x=x+Math.imul(x^x>>>7,61|x)^x;return ((x^x>>>14)>>>0)/4294967296};
  const modes=Object.keys(MODES);
  for(let i=0;i<500;i++){
    const r=compute({sex:rnd()<0.5?"f":"m",w:40+rnd()*100,h:150+rnd()*45,age:18+Math.floor(rnd()*60),mode:modes[Math.floor(rnd()*4)],n:Math.floor(rnd()*8),goal:""});
    const t=rnd()<0.5?r.train:r.rest, frac=rnd()<0.2?0:rnd()*1.5;
    const T={p:Math.round(t.p[1]*frac*rnd()*13)/10,c:Math.round(t.c[1]*frac*rnd()*13)/10,f:Math.round(t.f[1]*frac*rnd()*13)/10};
    T.k=rnd()<0.2?Math.round(t.k[1]*rnd()*1.4):4*T.p+4*T.c+9*T.f;
    const inp={T,t,mealsLeft:1+Math.floor(rnd()*3),windowClosed:rnd()<0.1,kOnly:rnd()<0.1}, a=advise(inp), ctx=JSON.stringify(inp);
    const nums=[a.needP,a.overP,a.palms,a.whey,a.fatG,a.nuts,a.oilTsp,a.fists,a.veg,a.after.p,a.after.c,a.after.f,a.after.k,a.overK,a.spreadDays];
    for(const v of nums) assert.ok(Number.isFinite(v)&&v>=0,ctx);
    assert.ok(Number.isFinite(a.budget),ctx);
    assert.equal(a.budget,mid(t.k)-T.k);
    for(const v of [a.palms,a.fists]) assert.ok(v===0||(v>=0.5&&(v*2)%1===0),ctx);
    for(const v of [a.oilTsp,a.nuts]) assert.ok(Number.isInteger(v)&&v>=0,ctx);
    assert.ok(a.nuts<=1,ctx);
    if(a.overP>0) assert.equal(a.palms,0,ctx);
    if(!inp.windowClosed){
      const room=a.budget-a.palms*147-44, fatK=a.nuts*96+a.oilTsp*45;
      if(room>=0) assert.ok(a.after.k<=t.k[1]+10,ctx);
      if(room>0) assert.ok(fatK<=room*0.5+45+1e-6,ctx); else assert.equal(fatK,0,ctx);
      assert.equal(a.flags.includes("overBudget"),room<=0,ctx);
      assert.equal(a.flags.includes("proteinOver"),a.overP>0,ctx);
    } else assert.equal(a.palms+a.fists+a.nuts+a.oilTsp,0,ctx);
    assert.equal(a.spreadDays,a.overK>60?Math.min(5,Math.max(2,Math.ceil(a.overK/80))):0,ctx);
    assert.equal(a.perMeal,!inp.windowClosed&&inp.mealsLeft>=2,ctx);
    assert.equal(a.flags.includes("kOnly"),inp.kOnly,ctx);
  }
});

/* ---------- 批次 2A：食物搜索、最近吃过、份量、分类猜测 ---------- */
const {searchFoods,recentFoods,portionsOf,guessCat,baseId,FBY,mealNote}=E;
const ids=r=>r.map(x=>x.food.id);
test("searchFoods：名称、别名、拼音首字母", ()=>{
  assert.equal(searchFoods("米饭")[0].food,FBY.rice);
  assert.equal(searchFoods(" 米 饭 ")[0].food.id,"rice");
  assert.ok(ids(searchFoods("mf")).slice(0,3).includes("rice"));
  assert.equal(searchFoods("jxr")[0].food.id,"chicken");
  assert.equal(searchFoods("JXR")[0].food.id,"chicken");
  assert.ok(ids(searchFoods("黄焖")).includes("hmj"));
  assert.deepEqual(searchFoods(""),[]); assert.deepEqual(searchFoods("   "),[]); assert.deepEqual(searchFoods(undefined),[]);
  const x=searchFoods("x",{limit:50});
  assert.ok(x.length>0); for(const r of x) assert.ok(r.food.base.py.startsWith("x"),r.food.n);
  assert.equal(searchFoods("西红柿")[0].food.id,"tomato");            // 别名完全相等
  assert.equal(searchFoods("flan")[0].food.id,"flan");               // 名称里的英文
  assert.deepEqual(searchFoods("没有这种东西"),[]);
});
test("searchFoods：排序、条数、加分", ()=>{
  const all=searchFoods("j",{limit:50});
  assert.equal(searchFoods("j").length,8); assert.equal(searchFoods("j",{limit:3}).length,3);
  for(let i=1;i<all.length;i++) assert.ok(all[i-1].score>all[i].score||(all[i-1].score===all[i].score&&all[i-1].food.base.n.length<=all[i].food.base.n.length));
  const r=ids(searchFoods("j",{recent:{egg:5},limit:50}));
  assert.equal(r[0],"egg"); assert.ok(r.includes("chicken")&&r.indexOf("egg")<r.indexOf("chicken"));
  // recent 按基准 id 合并，每次 +3，最多 +15
  const plain=searchFoods("鸡蛋")[0].score;
  assert.equal(searchFoods("鸡蛋",{recent:{egg:1,"egg@two":2}})[0].score,plain+9);
  assert.equal(searchFoods("鸡蛋",{recent:{egg:40}})[0].score,plain+15);
  assert.equal(searchFoods("牛奶",{fav:["lmilk"]})[0].food.id,"lmilk");
  assert.equal(searchFoods("牛奶")[0].food.id,"milk");
});
test("searchFoods：自定义食物", ()=>{
  const my=[{id:"my-1",n:"我的蛋白粉"},{id:"my-2",n:"Bulk 乳清"}];
  const r=searchFoods("蛋白粉",{my});
  assert.equal(r[0].food.id,"whey");
  const hit=r.find(x=>x.food===my[0]); assert.ok(hit); assert.equal(hit.score,65);   // 名称包含 60 + 自定义 5
  assert.equal(searchFoods("蛋白粉",{my,fav:["my-1"],recent:{"my-1":2}}).find(x=>x.food===my[0]).score,79);
  assert.equal(searchFoods("bulk",{my})[0].food,my[1]);              // 名称里的英文字母参与匹配
  assert.equal(searchFoods("bu",{my})[0].food,my[1]);
});
test("recentFoods：14 天内、不含当天、快照取自条目", ()=>{
  const e=(fid,n,x)=>Object.assign({id:"e"+Math.random(),n,q:1,p:1,c:2,f:3,m:1,s:0},fid?{fid}:{},x||{});
  const days={
    "2026-11-12":{entries:[e("today","今天吃的")]},
    "2026-11-11":{entries:[e("my-gone","已删除的自定义",{p:20,c:5,f:1,k:111,s:1}),e("rice","米饭/杂粮饭 1 拳"),e(null,"手输的东西")]},
    "2026-11-10":{entries:[e("rice","米饭/杂粮饭 1 拳"),e("egg","鸡蛋 1 个")]},
    "2026-11-05":{entries:[e("my-gone","旧名字",{p:9}),e("egg","鸡蛋 1 个")]},
    "2026-10-29":{entries:[e("edge","刚好第 14 天")]},
    "2026-10-28":{entries:[e("old","太久以前")]},
    "2026-11-13":{entries:[e("future","明天排的")]},
    "2026-11-01":{}
  };
  const r=recentFoods(days,"2026-11-12");
  const by=Object.fromEntries(r.map(f=>[f.id,f]));
  assert.ok(!by.today&&!by.old&&!by.future); assert.ok(by.edge);
  // 已不在食物库的也能返回，数值取最近一次的条目
  assert.deepEqual(by["my-gone"],{id:"my-gone",n:"已删除的自定义",p:20,c:5,f:1,s:1,cat:"recent",k:111});
  assert.deepEqual(by["rc-手输的东西"],{id:"rc-手输的东西",n:"手输的东西",p:1,c:2,f:3,s:0,cat:"recent"});
  assert.equal("k" in by.rice,false);
  // 三个都出现 2 次：最近日期新的在前（my-gone 和 rice 同为 11-11，egg 是 11-10）
  assert.deepEqual(r.slice(0,3).map(f=>f.id).sort(),["egg","my-gone","rice"]);
  assert.equal(r[2].id,"egg");
  assert.equal(r.length,5);
  assert.equal(recentFoods(days,"2026-11-12",2).length,2);
  assert.deepEqual(recentFoods({},"2026-11-12"),[]);
});
test("portionsOf / baseId / guessCat", ()=>{
  const ps=portionsOf("rice");
  assert.equal(ps[0],FBY.rice); assert.deepEqual(ps.map(f=>f.id),["rice","rice@bowl","rice@g100"]);
  assert.deepEqual(portionsOf("不存在"),[]); assert.deepEqual(portionsOf("rice@bowl"),[]);
  assert.equal(baseId("rice@bowl"),"rice"); assert.equal(baseId("rice"),"rice"); assert.equal(baseId(undefined),"");
  assert.equal(guessCat({p:22,c:3,f:2}),"pro");
  assert.equal(guessCat({p:3,c:3,f:15}),"fat");
  assert.equal(guessCat({p:2,c:40,f:5}),"carb");
  assert.equal(guessCat({p:0,c:0,f:0,k:200}),"carb");
  assert.equal(guessCat({p:5,c:40,f:10,s:1}),"sweet");
});
test("mealNote：蔬菜的份量变体也算有蔬菜", ()=>{
  const mt={p:30,c:40,f:10,k:370};
  assert.match(mealNote("A",2,mt,[{fid:"lean",s:0}])[1],/缺蔬菜/);
  assert.doesNotMatch(mealNote("A",2,mt,[{fid:"veg",s:0}])[1],/缺蔬菜/);
  assert.doesNotMatch(mealNote("A",2,mt,[{fid:"veg@one",s:0}])[1],/缺蔬菜/);
});
