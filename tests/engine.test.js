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
