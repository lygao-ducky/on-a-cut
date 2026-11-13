"use strict";
// 批次 1.1：超出热量自动摊平（carryOver / cutCap / shiftT / floorOf）
const test=require("node:test"), assert=require("node:assert/strict");
const E=require("../src/engine.js");
const {carryOver,cutCap,shiftT,floorOf,addDays,clone}=E;

const TR={p:[100,110],pf:85,c:[165,180],f:[42,48],k:[1500,1600]};
const baseOf=()=>TR, floor=1200;
const day=(...ks)=>({state:"A",entries:ks.map((k,i)=>({id:"e"+i,q:1,p:0,c:0,f:0,k,m:1})),water:0});
const run=(days,to,over)=>carryOver(days,baseOf,{floor,to,over});
const sum=a=>a.reduce((s,x)=>s+x.k,0);

test("floorOf", ()=>{
  assert.equal(floorOf("m"),1500); assert.equal(floorOf("f"),1200); assert.equal(floorOf(""),1200); assert.equal(floorOf(undefined),1200);
});

test("carryOver：单次超出", ()=>{
  const r=run({"2026-11-10":day(1800)},"2026-11-20");
  const a=r.days["2026-11-11"], b=r.days["2026-11-12"];
  assert.equal(a.cut,150); assert.deepEqual(a.t.k,[1350,1450]); assert.deepEqual(a.t.c,[127,142]);
  assert.deepEqual(a.t.p,TR.p); assert.equal(a.t.pf,TR.pf); assert.deepEqual(a.t.f,TR.f);
  assert.deepEqual(a.from,[{d:"2026-11-10",k:150}]);
  assert.equal(b.cut,50); assert.deepEqual(b.t.k,[1450,1550]);
  assert.equal(r.days["2026-11-13"],undefined);
  const s=r.src["2026-11-10"];
  assert.equal(s.over,200); assert.equal(sum(s.paid),200); assert.equal(s.lost,0); assert.equal(s.left,0);
});

test("carryOver：30 kcal 门槛", ()=>{
  const r1=run({"2026-11-10":day(1629)},"2026-11-20");
  assert.deepEqual(r1,{days:{},src:{}});
  const r2=run({"2026-11-10":day(1630)},"2026-11-20");
  assert.equal(r2.src["2026-11-10"].over,30);
  assert.equal(r2.days["2026-11-11"].cut,30);
  assert.deepEqual(Object.keys(r2.days),["2026-11-11"]);
});

test("carryOver：吃少了不产生额度", ()=>{
  const r=run({"2026-11-10":day(800),"2026-11-11":day(1500)},"2026-11-20");
  assert.deepEqual(r.days,{}); assert.deepEqual(r.src,{});
});

test("cutCap：安全下限", ()=>{
  assert.equal(cutCap({...TR,k:[1250,1350]},1200),50);
  assert.equal(cutCap({...TR,k:[1200,1300]},1200),0);
  assert.equal(cutCap(TR,1200),150);
  assert.equal(cutCap({...TR,k:[1550,1650]},1500),50);
});

test("cutCap：碳水下限", ()=>{
  assert.equal(cutCap({...TR,c:[60,70]},1200),40);
  assert.equal(cutCap({...TR,c:[40,50]},1200),0);
  assert.equal(cutCap({...TR,c:[50,60]},1200),0);
});

test("carryOver：过期作废", ()=>{
  const r=run({"2026-11-10":day(2600)},"2026-11-30");
  for(let i=1;i<=5;i++) assert.equal(r.days[addDays("2026-11-10",i)].cut,150);
  assert.equal(r.days["2026-11-16"],undefined);
  const s=r.src["2026-11-10"];
  assert.equal(s.over,1000); assert.equal(sum(s.paid),750); assert.equal(s.lost,250); assert.equal(s.left,0);
});

test("carryOver：没到期时余额记在 left", ()=>{
  const r=run({"2026-11-10":day(2600)},"2026-11-12");
  const s=r.src["2026-11-10"];
  assert.equal(sum(s.paid),300); assert.equal(s.left,700); assert.equal(s.lost,0);
});

test("carryOver：叠加，旧账先还", ()=>{
  const r=run({"2026-11-10":day(1800),"2026-11-11":day(1650)},"2026-11-25");
  assert.equal(r.src["2026-11-11"].over,200);
  assert.equal(r.days["2026-11-11"].cut,150);
  assert.deepEqual(r.days["2026-11-11"].from,[{d:"2026-11-10",k:150}]);
  assert.equal(r.days["2026-11-12"].cut,150);
  assert.deepEqual(r.days["2026-11-12"].from,[{d:"2026-11-10",k:50},{d:"2026-11-11",k:100}]);
  assert.equal(r.days["2026-11-13"].cut,100);
  Object.keys(r.days).forEach(d=>assert.ok(r.days[d].cut<=cutCap(TR,floor)));
  assert.equal(sum(r.src["2026-11-10"].paid),200); assert.equal(sum(r.src["2026-11-11"].paid),200);
});

test("carryOver：连锁（按调整后的上限判断）", ()=>{
  const r=run({"2026-11-10":day(1700),"2026-11-11":day(1540)},"2026-11-25");
  assert.equal(r.days["2026-11-11"].cut,100);
  assert.equal(r.days["2026-11-11"].t.k[1],1500);
  assert.equal(r.src["2026-11-11"].over,40);
  assert.equal(r.days["2026-11-12"].cut,40);
});

test("carryOver：空白日照扣", ()=>{
  const r=run({"2026-11-10":day(1900)},"2026-11-20");
  assert.equal(r.days["2026-11-11"].cut,150);
  assert.equal(r.days["2026-11-12"].cut,150);
});

test("carryOver：跨月跨年", ()=>{
  const r=run({"2026-12-31":day(1800)},"2027-01-10");
  assert.deepEqual(Object.keys(r.days),["2027-01-01","2027-01-02"]);
  assert.equal(r.days["2027-01-01"].cut,150); assert.equal(r.days["2027-01-02"].cut,50);
});

test("carryOver：预演与真实写入结果相同", ()=>{
  const hist={"2026-11-08":day(1700)};
  const a=run(hist,"2026-11-20",{date:"2026-11-10",k:1800});
  const b=run({...hist,"2026-11-10":day(1800)},"2026-11-20");
  assert.deepEqual(a,b);
  // 预演覆盖已有记录
  const c=run({...hist,"2026-11-10":day(500)},"2026-11-20",{date:"2026-11-10",k:1800});
  assert.deepEqual(c,b);
  // 没有任何记录也没有预演
  assert.deepEqual(run({},"2026-11-20"),{days:{},src:{}});
});

test("shiftT：返回新对象，不改入参", ()=>{
  const before=clone(TR), r=shiftT(TR,150);
  assert.deepEqual(TR,before);
  assert.notEqual(r.k,TR.k); assert.notEqual(r.p,TR.p);
  assert.deepEqual(r,{p:[100,110],pf:85,c:[127,142],f:[42,48],k:[1350,1450]});
  assert.deepEqual(shiftT(TR,0),TR);
});

test("carryOver：300 组随机历史的不变量", ()=>{
  let seed=7; const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
  const REST={p:[100,110],pf:85,c:[125,140],f:[42,48],k:[1350,1450]};
  for(let n=0;n<300;n++){
    const fl=rnd()<0.5?1200:1500, start="2026-11-01", days={}, base={};
    for(let i=0;i<20;i++){
      const d=addDays(start,i), st=rnd()<0.5?"A":"C"; base[d]=st==="A"?TR:REST;
      if(rnd()<0.75){ const x=day(Math.round(rnd()*2400)); x.state=st; days[d]=x }
    }
    const bo=d=>base[d]||TR, to=addDays(start,27);
    const r=carryOver(days,bo,{floor:fl,to});
    Object.keys(r.days).forEach(d=>{
      const x=r.days[d], b=bo(d);
      assert.ok(Number.isInteger(x.cut)&&x.cut>0&&x.cut<=cutCap(b,fl), d+" cut "+x.cut);
      assert.ok(x.t.k[0]>=fl, "k 下限 "+x.t.k[0]);
      assert.ok(x.t.c[0]>=50, "c 下限 "+x.t.c[0]);
      assert.equal(sum(x.from),x.cut);
      [x.t.k[0],x.t.k[1],x.t.c[0],x.t.c[1]].forEach(v=>assert.ok(Number.isFinite(v)));
    });
    Object.keys(r.src).forEach(d=>{
      const s=r.src[d];
      assert.ok(Number.isInteger(s.over)&&s.over>=30);
      assert.equal(sum(s.paid)+s.lost+s.left,s.over);
      assert.equal(s.left,0);   // to 比最后一天晚 7 天，全部结算完
      s.paid.forEach(p=>{const g=E.diffDays(p.d,d); assert.ok(g>=1&&g<=5, d+"→"+p.d); assert.ok(Number.isInteger(p.k)&&p.k>0)});
    });
  }
});
