/* On a Cut 计算引擎：纯函数，无 DOM、无存储。浏览器里挂在 window.OnACutEngine，Node 里走 module.exports。 */
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

/* ---------- food library (估算值，按实物单位) ---------- */
const FOODS=[
 {id:"lean",cat:"pro",n:"瘦肉 1 掌",p:30,c:0,f:3},
 {id:"beef",cat:"pro",n:"瘦牛肉 1 掌",p:30,c:0,f:8},
 {id:"salmon",cat:"pro",n:"三文鱼 1 掌",p:25,c:0,f:15},
 {id:"whey",cat:"pro",n:"蛋白粉 1 大勺",p:23,c:2,f:2},
 {id:"egg",cat:"pro",n:"鸡蛋 1 个",p:6.5,c:0.5,f:5},
 {id:"milk",cat:"pro",n:"全脂牛奶 250ml",p:8,c:12,f:9},
 {id:"lmilk",cat:"pro",n:"低脂牛奶 250ml",p:8.5,c:12.5,f:4},
 {id:"soy",cat:"pro",n:"无糖豆浆粉 1 袋",p:6,c:3,f:3},
 {id:"yog",cat:"pro",n:"无糖希腊酸奶 150g",p:13,c:6,f:3},
 {id:"tofu",cat:"pro",n:"豆腐 半盒",p:12,c:3,f:7},
 {id:"rice",cat:"carb",n:"米饭/杂粮饭 1 拳",p:3,c:33,f:0.5},
 {id:"yam",cat:"carb",n:"紫薯/红薯 1 拳",p:2,c:30,f:0},
 {id:"bag3",cat:"carb",n:"法棍 1/3 根",p:7,c:45,f:1},
 {id:"bag2",cat:"carb",n:"法棍 半根",p:11,c:70,f:1.5},
 {id:"toast",cat:"carb",n:"吐司 1 片",p:3,c:14,f:1},
 {id:"oat",cat:"carb",n:"燕麦 20g",p:2.5,c:13,f:1.5},
 {id:"noodle",cat:"carb",n:"面条 1 拳",p:4,c:30,f:0.5},
 {id:"banana",cat:"veg",n:"香蕉 半根",p:0.5,c:12,f:0},
 {id:"fruit",cat:"veg",n:"水果 1 拳",p:0.5,c:15,f:0},
 {id:"veg",cat:"veg",n:"蔬菜 两捧",p:3,c:8,f:0},
 {id:"oil",cat:"fat",n:"烹调油 1 茶匙",p:0,c:0,f:5},
 {id:"nuts",cat:"fat",n:"坚果 1 小把",p:3,c:3,f:8},
 {id:"avo",cat:"fat",n:"牛油果 半个",p:1.5,c:2,f:11},
 {id:"flan",cat:"sweet",n:"Flan 1 块",p:5,c:38,f:12},
 {id:"crois",cat:"sweet",n:"黄油可颂 1 个",p:5,c:26,f:14},
 {id:"pac",cat:"sweet",n:"巧克力可颂 1 个",p:6,c:32,f:17},
 {id:"cookie",cat:"sweet",n:"曲奇 1 大块",p:2.5,c:28,f:11},
 {id:"cake",cat:"sweet",n:"蛋糕 1 片",p:4,c:40,f:16},
 {id:"ice",cat:"sweet",n:"冰淇淋 1 球",p:2,c:16,f:7},
 {id:"tea",cat:"sweet",n:"奶茶 1 杯",p:3,c:45,f:8}
];
const FBY={}; FOODS.forEach(f=>{FBY[f.id]=f});
const CATS=[["pro","蛋白质"],["carb","主食"],["veg","蔬果"],["fat","油脂"],["sweet","甜点"]];
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
  const w=[], hasVeg=es.some(e=>e.fid==="veg"), sweet=es.some(e=>e.s);
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

const E={r0,r1,half,mid,z,ymd,parseD,addDays,diffDays,kcalOf,clone,FOODS,FBY,CATS,MEALS,MODES,ACT,
  compute,pfError,planFor,totals,mealNote,qty,hm,mins,buildTpl,dayOk,advise};
if(typeof module!=="undefined"&&module.exports) module.exports=E; else root.OnACutEngine=E;
})(typeof self!=="undefined"?self:this);
