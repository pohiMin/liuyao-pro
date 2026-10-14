
const path = require('path');
const which = process.argv[2];
const cases = JSON.parse(process.argv[3]);
const dates = JSON.parse(process.argv[4]).map(t => new Date(t));
const ROOT = "C:\\Users\\10061\\Desktop\\liuyao\\660d786435063ee0";
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
require('fs').writeFileSync(process.argv[5], JSON.stringify(out));
