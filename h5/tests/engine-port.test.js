// H5 算法层验证（2026-10-13 从小程序 tests/ 迁入，指向改 h5/vendor）
// 关键：小程序无 window，且 CommonJS 模块作用域不会自动全局化，
// 故数据层已改为显式挂 globalThis；此处按 H5 <script> 顺序加载验证。
require('../vendor/core-data.js');
require('../vendor/rules.js');
require('../vendor/engine.js');

const Engine = globalThis.LiuYaoEngine;
const Rules = globalThis.LiuYaoRules;
const B = Engine.BY_BITS;

let pass = 0; const fail = [];
const ok = (cond, msg) => cond ? pass++ : fail.push(msg);

ok(!!Engine, 'engine 应挂到全局');
ok(!!Rules, 'rules 应挂到全局');
ok(Object.keys(B).length === 64, `BY_BITS 应 64 卦，实为 ${Object.keys(B).length}`);
ok(Object.keys(Engine).length === 25, `engine 导出应 25 项，实为 ${Object.keys(Engine).length}`);
ok(Object.keys(Rules).length === 64, `rules 导出应 64 项，实为 ${Object.keys(Rules).length}`);

// 成卦
const ys = [0, 1, 0, 1, 0, 1].map(b => ({ coins: [1, 0, 1], sum: b ? 7 : 8, yang: !!b, moving: false, label: b ? '少阳' : '少阴' }));
const h = Engine.buildHexagram(ys);
ok(h.bits === '010101', `bits 应为 010101（数组序=初爻在前），实为 ${h.bits}`);
ok(!!B[h.bits], '应能查到卦名');

// 世应相隔三位
let sy = 0;
for (const hex of Object.values(B)) if (((((hex.ying - hex.shi) % 6) + 6) % 6) === 3) sy++;
ok(sy === 64, `世应相隔三位应全对，实为 ${sy}`);

// 综错互卦
ok(!!B[Engine.zongGu(h.bits)] && !!B[Engine.cuoGu(h.bits)] && !!B[Engine.huGu(h.bits)], '综错互卦应均能查到');

// 旬空
ok(Array.isArray(Engine.xunKongOf('甲戌')), '旬空应返回数组');

// 生克关系
ok(Engine.relation('木', '火') === 'sheng', '木生火');
ok(Engine.relation('木', '土') === 'ke', '木克土');
ok(Engine.relation('木', '木') === 'same', '木比木');

// 全 64 卦装卦
const dayInfo = { dayGan: '甲', dayZhi: '戌', monthZhi: '酉', kong: ['申', '酉'], xunKong: ['申', '酉'], dayWx: '木', monthWx: '金' };
let arranged = 0;
for (const bits of Object.keys(B)) {
  try { const m = Engine.arrange(bits, dayInfo, []); if (m.yaos.length === 6) arranged++; }
  catch (e) { fail.push(`arrange ${bits} 抛错: ${e.message}`); }
}
ok(arranged === 64, `全 64 卦装卦应成功，实为 ${arranged}`);

// 全 64 卦解卦（验证 interpret 全链路 + 规则真源调用）
let interp = 0;
for (const bits of Object.keys(B)) {
  try {
    const yaoRes = bits.split('').map(b => ({ coins: [1, 0, 1], sum: b === '1' ? 7 : 8, yang: b === '1', moving: false, label: b === '1' ? '少阳' : '少阴' }));
    const full = Engine.fullDivine(yaoRes, null);
    const r = Engine.interpret(full, '财运');
    if (r && r.summary && r.sections) interp++;
  } catch (e) { fail.push(`interpret ${bits} 抛错: ${e.message}`); }
}
ok(interp === 64, `全 64 卦解卦应成功，实为 ${interp}`);

// 飞伏神路径（Wave 1 重构后的真源调用）——遍历全卦×全事项，基准为 140 例
const TOPICS = ['综合','财运','事业','工作','婚恋','感情','学业','疾病','出行','寻物','官非','房产','子女','合作'];
let fu = 0, combo = 0, fuErr = 0;
for (const bits of Object.keys(B)) {
  const yaoRes = bits.split('').map(b => ({ coins: [1, 0, 1], sum: b === '1' ? 7 : 8, yang: b === '1', moving: false, label: b === '1' ? '少阳' : '少阴' }));
  const full = Engine.fullDivine(yaoRes, null);
  for (const t of TOPICS) {
    combo++;
    try {
      const r = Engine.interpret(full, t);
      if (r && r.fuShen && r.fuShen.song) fu++;
    } catch (e) { fuErr++; fail.push(`飞伏 ${bits}/${t} 抛错: ${e.message}`); }
  }
}
ok(combo === 896, `卦×事项组合应 896，实为 ${combo}`);
ok(fu === 140, `飞伏神触发应 140 例（与 Web 版基线一致），实为 ${fu}`);
ok(fuErr === 0, `飞伏神路径不应抛错，实为 ${fuErr} 例`);

console.log(`\n通过 ${pass} 项，失败 ${fail.length} 项`);
if (fail.length) { console.log('失败明细:'); fail.slice(0, 12).forEach(f => console.log('  ✗', f)); }
else console.log('✓ 全部通过');
process.exit(fail.length ? 1 : 0);
