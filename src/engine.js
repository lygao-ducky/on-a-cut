/* On a Cut 计算引擎：纯函数，无 DOM、无存储。食物数据来自 src/foods.js（要先加载）。浏览器里挂在 window.OnACutEngine，Node 里走 module.exports。 */
(function(root){
"use strict";
/* ---------- helpers ---------- */
const z=n=>String(n).padStart(2,"0");
const ymd=d=>d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate());
const parseD=s=>{const a=s.split("-").map(Number);return new Date(a[0],a[1]-1,a[2])};
const addDays=(s,n)=>{const d=parseD(s);d.setDate(d.getDate()+n);return ymd(d)};
const diffDays=(a,b)=>Math.round((parseD(a)-parseD(b))/864e5);
const r0=n=>Math.round(n), r1=n=>Math.round(n*10)/10, half=n=>Math.round(n*2)/2;
const kcalOf=o=>o.k!=null?o.k:4*o.p+4*o.c+9*o.f;
const clone=o=>JSON.parse(JSON.stringify(o));
const mid=a=>(a[0]+a[1])/2;
const mins=s=>{const a=s.split(":").map(Number);return a[0]*60+a[1]};
const hm=m=>z(Math.floor(m/60))+":"+z(m%60);
const qty=(q,u)=>q===0.5?"半"+u:(q%1?Math.floor(q)+" "+u+"半":q+" "+u);

/* ---------- 食物库：数据在 src/foods.js，这里展开成显示用的表 ----------
   FOODS 只含基准份量（显示名 = 名称 + 第一个份量），包括 hide 的条目；FBY 另含每个非基准份量的变体，id 为 <基准 id>@<份量 k>。 */
const FD=root.OnACutFoods||(typeof require!=="undefined"?require("./foods.js"):null);
if(!FD||!FD.FOODS) throw new Error("OnACutEngine: 找不到食物库，foods.js 要先于 engine.js 加载");
const CATS=FD.CATS, FOODS=[], FBY={};
FD.FOODS.forEach(b=>{
  const f={id:b.id,cat:b.cat,n:b.n+" "+b.u[0].l,p:b.p,c:b.c,f:b.f,g:b.g,tags:b.tags,base:b};
  if(b.k!=null) f.k=b.k; if(b.top) f.top=b.top; if(b.hide) f.hide=1;
  FOODS.push(f); FBY[f.id]=f;
  b.u.slice(1).forEach(u=>{
    const v={id:b.id+"@"+u.k,cat:b.cat,n:b.n+" "+u.l,p:r1(b.p*u.x),c:r1(b.c*u.x),f:r1(b.f*u.x),g:b.g,tags:b.tags,baseOf:b.id};
    if(b.k!=null) v.k=r1(b.k*u.x);
    FBY[v.id]=v;
  });
});
const baseId=fid=>String(fid||"").split("@")[0];
/* 某食物的全部份量（FBY 对象），基准在前 */
const portionsOf=id=>{const f=FBY[id]; return f&&f.base?[f].concat(f.base.u.slice(1).map(u=>FBY[id+"@"+u.k])):[]};
/* 给没有分类的自定义食物猜分类；不会猜出 veg */
function guessCat(f){
  if(f.s) return "sweet";
  const P=4*(+f.p||0), F=9*(+f.f||0), tot=P+4*(+f.c||0)+F;
  if(!(tot>0)) return "carb";
  return P/tot>=0.4?"pro":F/tot>=0.5?"fat":"carb";
}
/* 搜索：q 去空格转小写；候选 = 内置基准食物 + opts.my（自定义，只按名称）；内置候选跳过 hide 的条目。返回 [{food, score}] */
const normQ=s=>String(s==null?"":s).replace(/\s+/g,"").toLowerCase();
function searchFoods(q,opts){
  q=normQ(q); if(!q) return [];
  opts=opts||{};
  const ascii=/^[a-z]+$/.test(q), fav=opts.fav||[], limit=opts.limit||8, rc={}, src=opts.recent||{};
  Object.keys(src).forEach(k=>{const b=baseId(k); rc[b]=(rc[b]||0)+(+src[k]||0)});
  const match=(name,al,py)=>{
    let s=name===q?100:name.startsWith(q)?80:al.includes(q)?75:name.includes(q)?60:al.some(x=>x.includes(q))?50:0;
    if(ascii&&py) s=Math.max(s,py.startsWith(q)?45:(q.length>1&&py.includes(q))?30:0);
    return s;
  };
  const out=[], push=(food,id,name,s,extra)=>{
    if(!s) return;
    out.push({food,score:s+Math.min(15,3*(rc[id]||0))+(fav.includes(id)?8:0)+extra,len:name.length});
  };
  FOODS.forEach(f=>{if(f.hide) return; const b=f.base, name=normQ(b.n); push(f,f.id,name,match(name,b.a.map(normQ),b.py),0)});
  (opts.my||[]).forEach(f=>{const name=normQ(f.n); push(f,f.id,name,match(name,[],name.replace(/[^a-z]/g,"")),5)});
  out.sort((a,b)=>b.score-a.score||a.len-b.len);
  return out.slice(0,limit).map(x=>({food:x.food,score:x.score}));
}
/* 最近吃过：todayStr 之前 14 天（不含当天）的条目，按 fid（没有就按名称）分组，快照取最近一次的条目本身 */
function recentFoods(days,todayStr,n){
  n=n==null?8:n;
  const from=addDays(todayStr,-14), by={};
  Object.keys(days||{}).filter(d=>d>=from&&d<todayStr).sort().forEach(d=>{
    ((days[d]||{}).entries||[]).forEach(e=>{
      const key=e.fid?"f:"+e.fid:"n:"+e.n, g=by[key]||(by[key]={count:0});
      g.count++; g.last=d;
      g.food={id:e.fid||("rc-"+e.n),n:e.n,p:e.p,c:e.c,f:e.f,s:e.s?1:0,cat:"recent"};
      if(e.k!=null) g.food.k=e.k;
    });
  });
  return Object.keys(by).map(k=>by[k]).sort((a,b)=>b.count-a.count||(a.last<b.last?1:a.last>b.last?-1:0)).slice(0,n).map(g=>g.food);
}
const MEALS=["","第 1 餐","第 2 餐","第 3 餐","加餐"];

/* ---------- Mifflin-St Jeor BMR → TDEE → 目标 ---------- */
const MODES={
 cut1:{t:"温和刷脂",d:"热量 −15%，好坚持",k:-0.15,p:1.7,f:0.75},
 cut2:{t:"激进刷脂",d:"热量 −25%，更快也更饿，建议不超过 8 周",k:-0.25,p:2.0,f:0.7},
 keep:{t:"维持",d:"体重不变，改善体型",k:0,p:1.4,f:0.9},
 bulk:{t:"增肌",d:"热量 +10%，配合力量训练",k:0.10,p:1.8,f:0.9}};
const ACT=[1.2,1.3,1.375,1.45,1.5,1.6,1.675,1.75]; // 每周训练 0–7 次对应的活动系数
function compute(pf){
  const w=+pf.w,h=+pf.h,a=+pf.age,n=Math.max(0,Math.min(7,+pf.n||0)),m=MODES[pf.mode]||MODES.cut1;
  const bmr=10*w+6.25*h-5*a+(pf.sex==="m"?5:-161), tdee=bmr*ACT[n], floor=pf.sex==="m"?1500:1200;
  let avg=tdee*(1+m.k), clamped=false; if(avg<floor){avg=floor;clamped=true}
  const pw=Math.min(w,27*Math.pow(h/100,2));               // 体重很大时按 BMI 27 的体重算蛋白和脂肪
  const P=r0(m.p*pw), F=r0(Math.max(m.f,0.6)*pw);
  const swing=(n>0&&n<7)?140:0;                             // 训练日比休息日多约 1 拳主食
  const kT=avg+swing*(7-n)/7, kR=avg-swing*n/7;
  const mk=k=>{const C=Math.max(50,r0((k-4*P-9*F)/4)),K=r0(k/10)*10;return {p:[P-5,P+5],pf:r0(P*0.8),c:[C-8,C+8],f:[F-3,F+3],k:[K-50,K+50]}};
  const perWeek=(tdee-avg)*7/7700, goal=+pf.goal||0, diff=goal?w-goal:0;
  const weeks=(goal&&Math.abs(perWeek)>0.03&&diff*perWeek>0)?Math.ceil(Math.abs(diff/perWeek)):null;
  const minHealthy=r1(18.5*Math.pow(h/100,2));
  return {bmr,tdee,avg,clamped,kT,kR,train:mk(kT),rest:mk(kR),perWeek,weeks,lowGoal:goal&&goal<minHealthy?minHealthy:null};
}
function pfError(pf){
  if(pf.sex!=="f"&&pf.sex!=="m") return "请选择性别";
  const a=+pf.age,h=+pf.h,w=+pf.w,g=+pf.goal;
  if(!(a>=18&&a<=90)) return a>0&&a<18?"本工具面向成年人；未成年人请在医生或营养师指导下调整饮食":"请填写年龄（18–90）";
  if(!(h>=120&&h<=220)) return "请填写身高（120–220 cm）";
  if(!(w>=30&&w<=250)) return "请填写当前体重（30–250 kg）";
  if(pf.goal!==""&&pf.goal!=null&&!(g>=30&&g<=250)) return "目标体重请填 30–250 kg，或留空";
  return "";
}
const planFor=n=>{const on=[[],[1],[1,4],[1,3,5],[1,3,5,6],[1,2,3,4,5],[1,2,3,4,5,6],[0,1,2,3,4,5,6]][Math.max(0,Math.min(7,n))];return [0,1,2,3,4,5,6].map(i=>on.includes(i)?"A":"C")};

/* ---------- 每天的合计与评价 ---------- */
function totals(day,m){const t={p:0,c:0,f:0,k:0};(day.entries||[]).forEach(e=>{if(m&&e.m!==m)return;t.p+=e.p*e.q;t.c+=e.c*e.q;t.f+=e.f*e.q;t.k+=kcalOf(e)*e.q});return t}
/* 统一口径：蛋白到下限且热量不超上限，算“达标的一天” */
const dayOk=(T,t)=>T.p>=t.p[0]&&T.k<=t.k[1];
function mealNote(st,i,mt,es){
  const w=[], hasVeg=es.some(e=>baseId(e.fid)==="veg"), sweet=es.some(e=>e.s);
  if(i===4){ if(mt.k>250) w.push(`加餐 ${r0(mt.k)} kcal 偏多，正餐主食相应少半拳`); else if(sweet) w.push("甜点已计入额度");
    return w.length?["warn",w.join("；")+"。"]:["good","✓ 份量合适。"] }
  if(mt.p<25) w.push(`蛋白只有 ${r0(mt.p)}g，再加半掌肉或 1 个蛋`);
  else if(mt.p>50) w.push(`蛋白 ${r0(mt.p)}g 偏多，可挪一部分到下一餐`);
  if(i===1&&st!=="C"&&mt.c<45) w.push("练后这餐碳水偏少，可再加 1 拳主食");
  if(mt.f>25) w.push(`油脂 ${r0(mt.f)}g 偏高，下一餐蒸煮少油`);
  if(!hasVeg&&i!==1) w.push("缺蔬菜，补两捧");
  if(sweet) w.push("甜点已计入额度");
  return w.length?["warn",w.slice(0,2).join("；")+"。"]:["good","✓ 蛋白到位，搭配均衡。"];
}

/* ---------- 参考餐单：t 当天目标，tm 四个用餐时间（分钟），train 是否训练日 ---------- */
function buildTpl(t,tm,train){
  const P=mid(t.p), C=mid(t.c), F=mid(t.f);
  const m1=train?[["whey",1,"蛋白粉 1 勺"],["milk",1,"全脂牛奶 250ml"],["banana",1,"香蕉半根"]]:[["egg",2,"鸡蛋 2 个"],["yog",1,"无糖酸奶 150g"]];
  const sn=[["fruit",1,"水果 1 拳"]];
  let p=6,c=16,f=0; m1.concat(sn).forEach(it=>{const x=FBY[it[0]];p+=x.p*it[1];c+=x.c*it[1];f+=x.f*it[1]}); // 6/16 = 两餐蔬菜
  const fists=Math.max(1,half((C-c)/33)), palms=Math.max(1,half((P-p-fists*3)/30));
  const fatLeft=F-f-palms*3-fists*0.5, nuts=fatLeft>=18?1:0, tsp=Math.max(1,Math.round((fatLeft-nuts*8)/5-0.01));
  if(nuts) sn.push(["nuts",1,"坚果 1 小把"]);
  const f1=half(fists*(train?0.4:0.3)), f3=half(fists*0.2), f2=Math.max(0,fists-f1-f3), p2=Math.ceil(palms)/2, p3=palms-p2, o2=Math.ceil(tsp/2), o3=tsp-o2;
  const it=(id,q,name,u)=>q>0?[[id,q,name+(q===0.5?"":" ")+qty(q,u)]]:[];
  return [[hm(tm[0]),1,train?"练后第一餐":"第一餐",m1.concat(it("rice",f1,"米饭","拳"))],
    [hm(tm[1]),2,"正餐",it("lean",p2,"瘦肉","掌").concat(it("rice",f2,"米饭","拳"),[["veg",1,"蔬菜两捧"]],it("oil",o2,"油","茶匙"))],
    [hm(tm[2]),4,"加餐",sn],
    [hm(tm[3]),3,"收尾",it("lean",p3,"瘦肉或鱼","掌").concat(it("rice",f3,"米饭","拳"),[["veg",1,"蔬菜两捧"]],it("oil",o3,"油","茶匙"))]];
}

/* ---------- 实时建议：剩下的额度怎么吃 ----------
   分配顺序：蛋白下限 → 蔬菜两捧 → 脂肪下限（最多占剩余额度一半）→ 碳水。
   份量常量取自食物库：瘦肉 1 掌 147 kcal、米饭 1 拳 148、蔬菜两捧 44、油 1 茶匙 45、坚果 1 小把 96、蛋白粉 1 勺 118。 */
const unit=id=>{const x=FBY[id];return {p:x.p,c:x.c,f:x.f,k:Math.floor(kcalOf(x))}};
const U={lean:unit("lean"),rice:unit("rice"),veg:unit("veg"),oil:unit("oil"),nuts:unit("nuts"),whey:unit("whey")};
function advise(i){
  const T=i.T, t=i.t, flags=[];
  const o={budget:mid(t.k)-T.k,needP:Math.max(0,t.p[0]-T.p),overP:Math.max(0,T.p-t.p[1]),
    palms:0,whey:0,fatG:0,nuts:0,oilTsp:0,fists:0,veg:2,after:null,overK:0,spreadDays:0,perMeal:i.mealsLeft>=2,flags};
  const done=()=>{
    const a={p:T.p,c:T.c,f:T.f,k:T.k}, add=(u,q)=>{a.p+=u.p*q;a.c+=u.c*q;a.f+=u.f*q;a.k+=u.k*q};
    add(U.lean,o.palms);add(U.whey,o.whey);add(U.veg,o.veg/2);add(U.nuts,o.nuts);add(U.oil,o.oilTsp);add(U.rice,o.fists);
    o.after=a; o.overK=Math.max(0,a.k-t.k[1]);
    o.spreadDays=o.overK>60?Math.min(5,Math.max(2,Math.ceil(o.overK/80))):0;
    if(i.kOnly) flags.push("kOnly");
    return o};
  // 1. 已关窗：只在蛋白低于底线时补 1 勺蛋白粉
  if(i.windowClosed){ o.veg=0; o.perMeal=false; if(T.p<t.pf){o.whey=1;flags.push("closedLowP")} else flags.push("closed"); return done() }
  // 2–3. 蛋白：先保下限；已超上限就不再吃肉
  if(o.overP>0) flags.push("proteinOver");
  o.palms=(o.overP>0||o.needP<=8)?0:Math.max(0.5,half(o.needP/30));
  // 4–5. 扣掉蛋白和蔬菜后的余量
  const room=o.budget-o.palms*U.lean.k-U.veg.k;
  if(room<=0){ flags.push("overBudget"); return done() }
  // 6. 脂肪：补到下限，但最多用掉余量的一半
  const needF=Math.max(0,t.f[0]-T.f-o.palms*U.lean.f);
  o.fatG=Math.min(needF,Math.floor(room*0.5/9));
  o.nuts=o.fatG>=13?1:0;
  o.oilTsp=Math.max(0,Math.round((o.fatG-o.nuts*U.nuts.f)/U.oil.f));
  if(needF>o.fatG) flags.push("fatFloorShort");
  // 7. 碳水：剩下的都给主食（−8 是蔬菜里的碳水）
  const room2=room-o.nuts*U.nuts.k-o.oilTsp*U.oil.k;
  const fists=Math.floor(Math.min((t.c[1]-T.c-U.veg.c)/U.rice.c,room2/U.rice.k)*2)/2;
  o.fists=fists>=0.5?fists:0;
  return done();
}

/* ---------- 超出摊平（v8.1）----------
   某天有记录且已吃 − 调整后上限 ≥ 30 kcal：整个差值记一笔欠账，从第二天起最多还 5 天（按日历天，空白日照扣），过期作废。
   单日扣减 ≤ cutCap；多笔欠账旧账先还；只降热量和碳水；吃少了不产生额度。结果全部实时推算，不落盘。 */
const floorOf=sex=>sex==="m"?1500:1200;
function cutCap(t,floor){
  const v=Math.floor(Math.min(150,mid(t.k)*0.1,t.k[0]-floor,4*(t.c[0]-50)));
  return v>0?v:0;
}
function shiftT(t,cut){
  const dc=Math.round(cut/4);
  return {p:t.p.slice(),pf:t.pf,c:[t.c[0]-dc,t.c[1]-dc],f:t.f.slice(),k:[t.k[0]-cut,t.k[1]-cut]};
}
/* days = S.days；baseOf(date) → 这一天的原始目标；opts = {floor, to, over?:{date,k}}。
   返回 {days:{date:{cut, from:[{d,k}], t}}（只含 cut>0 的日期）, src:{超出日:{over, paid:[{d,k}], lost, left}}} */
function carryOver(days,baseOf,opts){
  days=days||{}; opts=opts||{};
  const floor=opts.floor, to=opts.to, ov=opts.over||null, out={days:{},src:{}};
  let start=null;
  Object.keys(days).forEach(d=>{const x=days[d]; if(x&&x.entries&&x.entries.length&&(start===null||d<start)) start=d});
  if(ov&&ov.date&&(start===null||ov.date<start)) start=ov.date;
  if(start===null||!to) return out;
  let debts=[];
  for(let date=start;date<=to;date=addDays(date,1)){
    // a. 过期的欠账作废
    debts=debts.filter(b=>{ if(b.exp<date){out.src[b.d].lost+=b.left;return false} return true });
    // b. 按超出日先后偿还，单日合计 ≤ cap
    const t0=baseOf(date), cap=cutCap(t0,floor), from=[];
    let cut=0;
    debts.forEach(b=>{ const k=Math.min(b.left,cap-cut); if(k>0){b.left-=k;cut+=k;from.push({d:b.d,k});out.src[b.d].paid.push({d:date,k})} });
    debts=debts.filter(b=>b.left>0);
    // c. 调整后的目标
    const t=shiftT(t0,cut);
    if(cut>0) out.days[date]={cut,from,t};
    // d. 这一天是否超出
    let eaten=null;
    if(ov&&ov.date===date) eaten=ov.k;
    else{const x=days[date]; if(x&&x.entries&&x.entries.length) eaten=totals(x).k}
    if(eaten==null) continue;
    const over=Math.round(eaten-t.k[1]);
    if(over>=30){ debts.push({d:date,left:over,exp:addDays(date,5)}); out.src[date]={over,paid:[],lost:0,left:0} }
  }
  debts.forEach(b=>{out.src[b.d].left+=b.left});
  return out;
}

const E={r0,r1,half,mid,z,ymd,parseD,addDays,diffDays,kcalOf,clone,FOODS,FBY,CATS,MEALS,MODES,ACT,
  compute,pfError,planFor,totals,mealNote,qty,hm,mins,buildTpl,dayOk,advise,
  baseId,portionsOf,guessCat,searchFoods,recentFoods,floorOf,cutCap,shiftT,carryOver};
if(typeof module!=="undefined"&&module.exports) module.exports=E; else root.OnACutEngine=E;
})(typeof self!=="undefined"?self:this);
