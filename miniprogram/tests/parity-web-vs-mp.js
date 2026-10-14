// Web 版 vs 小程序版 一致性比对
// 思路：两版引擎分别在独立子进程中加载，对同一批卦例输出摘要后逐项比对。
// 运行：node miniprogram/tests/parity-web-vs-mp.js
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const WORKER = path.join(__dirname, '.parity-worker.js');
const N = 400;

// 生成确定性卦例（两进程必须拿到完全相同的输入）
function makeCases(n) {
  const cases = [];
  let seed = 20261006;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < n; i++) {
    const pat = [];
    for (let k = 0; k < 6; k++) pat.push(Math.floor(rnd() * 4));
    const topics = ['综合', '财运', '事业', '工作', '婚恋', '学业', '疾病', '官非'];
    cases.push({ pat, topic: topics[i % topics.length] });
  }
  return cases;
}

const CASES = makeCases(N);
const DATES = [
  new Date(2026, 9, 6, 10, 30),
  new Date(2026, 0, 20, 23, 0),
  new Date(2025, 5, 15, 8, 0),
];

const workerSrc = `
const path = require('path');
const which = process.argv[2];
const cases = JSON.parse(process.argv[3]);
const dates = JSON.parse(process.argv[4]).map(t => new Date(t));
const ROOT = ${JSON.stringify(ROOT)};
// Web 版数据/规则层挂 window（IIFE 写死），故垫一层 window → globalThis
globalThis.window = globalThis;
const MP = path.join(ROOT, 'miniprogram');
const base = which === 'web' ? path.join(ROOT, 'js') : MP;
// 小程序版按职责分目录：数据在 data/，规则与农历在 utils/
const p = (f) => which === 'web'
  ? path.join(base, f + '.js')
  : path.join(base, 'data', f + '.js');
const u = (f) => which === 'web'
  ? path.join(base, f + '.js')
  : path.join(base, 'utils', f + '.js');
require(p('core-data'));
require(p('meaning-data'));
require(p('yao-labels'));
// Web 版 lunar.js 走 CommonJS 分支（只挂 module.exports），需手动平铺到全局
const lunarMod = require(u('lunar'));
if (!globalThis.Solar && lunarMod && lunarMod.Solar) {
  for (const k in lunarMod) globalThis[k] = lunarMod[k];
}
require(u('rules'));
require(u('engine'));
const E = globalThis.LiuYaoEngine;
const MAP = {
  0: { yang: true,  sum: 7, moving: false, coins: [0,0,0], label: '少阳', mark: '' },
  1: { yang: false, sum: 8, moving: false, coins: [1,1,1], label: '少阴', mark: '' },
  2: { yang: true,  sum: 9, moving: true,  coins: [0,0,0], label: '老阳', mark: '○' },
  3: { yang: false, sum: 6, moving: true,  coins: [1,1,1], label: '老阴', mark: '×' },
};
const out = [];
for (let ci = 0; ci < cases.length; ci++) {
  const c = cases[ci];
  const date = dates[ci % dates.length];
  const res = c.pat.map(k => Object.assign({}, MAP[k]));
  try {
    const full = E.fullDivine(res, date);
    const ip = E.interpret(full, c.topic);
    const m = full.main;
    out.push({
      hex: m.hex.name,
      palace: m.hex.palace + '/' + m.hex.palaceType,
      shiIdx: m.shiIdx, yingIdx: m.yingIdx,
      dayGZ: m.dayGZ || '', monthZhi: m.monthZhi || '', kong: (m.kong || []).join(''),
      gz: m.yaos.map(y => y.gz + y.qin).join('|'),
      wang: m.yaos.map(y => y.wang || '').join(''),
      states: m.yaos.map(y => [y.wang, y.kong ? (y.kongJudge && y.kongJudge.zhen ? 'zhen' : 'jia') : '', y.monthPo ? 'po' : '', y.dayChong ? 'chong' : ''].join(',')).join('|'),
      changed: full.changed ? full.changed.hex.name : '',
      verdict: ip.verdict, score: ip.score, summary: ip.summary, advice: ip.advice,
      ys: ip.yongList.map(y => y.pos + y.gz + y.qin).join(','),
      fu: ip.fuShen ? (ip.fuShen.fei.gz + '/' + ip.fuShen.fu.gz + '/' + ip.fuShen.usable) : '',
      moving: (ip.movingNotes || []).map(x => x.pos + x.label + x.change).join(','),
      mean: ip.mean ? (ip.mean.short + '/' + ip.mean.luck) : '',
      yjc: ip.yuanJiChou ? (ip.yuanJiChou.yuan + '|' + ip.yuanJiChou.ji + '|' + ip.yuanJiChou.chou) : '',
    });
  } catch (e) {
    out.push({ error: String(e && e.message || e) });
  }
}
process.stdout.write(JSON.stringify(out));
`;
// worker 输出量大，改走临时文件传递
const workerSrc2 = workerSrc.replace(
  "process.stdout.write(JSON.stringify(out));",
  "require('fs').writeFileSync(process.argv[5], JSON.stringify(out));"
);
require('fs').writeFileSync(WORKER, workerSrc2, 'utf8');

const webOutFile = path.join(__dirname, '.parity-web.json');
const mpOutFile = path.join(__dirname, '.parity-mp.json');

function run(which, outFile) {
  execFileSync(process.execPath, [
    WORKER, which, JSON.stringify(CASES), JSON.stringify(DATES.map(d => d.getTime())), outFile,
  ], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(require('fs').readFileSync(outFile, 'utf8'));
}

const webOut = run('web', webOutFile);
const mpOut = run('mp', mpOutFile);

let pass = 0, fail = 0, errs = 0;
const FIELDS = ['hex', 'palace', 'shiIdx', 'yingIdx', 'dayGZ', 'monthZhi', 'kong', 'gz', 'wang', 'states', 'changed', 'verdict', 'score', 'summary', 'advice', 'ys', 'fu', 'moving', 'mean', 'yjc'];

for (let i = 0; i < CASES.length; i++) {
  const w = webOut[i], m = mpOut[i];
  if (w.error || m.error) {
    if (w.error && m.error) { errs++; continue; }
    console.log('✗ 第' + i + '卦 仅一侧报错: web=' + (w.error || 'ok') + ' mp=' + (m.error || 'ok'));
    fail++; continue;
  }
  const diff = FIELDS.filter(f => String(w[f]) !== String(m[f]));
  if (diff.length) {
    fail++;
    if (fail <= 3) {
      console.log('✗ 第' + i + '卦 [' + CASES[i].topic + '] 不一致字段: ' + diff.join(','));
      for (const f of diff) console.log('    web.' + f + ' = ' + w[f] + '\n    mp .' + f + ' = ' + m[f]);
    }
  } else pass++;
}

require('fs').unlinkSync(WORKER);
for (const f of [webOutFile, mpOutFile]) { try { require('fs').unlinkSync(f); } catch (e) {} }

console.log('\n' + '='.repeat(46));
console.log('卦例总数 ' + CASES.length + '：完全一致 ' + pass + ' / 不一致 ' + fail + ' / 两侧同错 ' + errs);
console.log('比对字段 ' + FIELDS.length + ' 个（含卦名/宫/世应/日辰/月建/旬空/纳甲/旺衰/旬空真假空/月破日冲/变卦/吉凶/指数/综述/断语/用神/飞伏/动爻/卦象/元神忌神仇神）');
console.log('='.repeat(46));
process.exit(fail ? 1 : 0);
