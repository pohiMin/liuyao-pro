// 小程序起卦页端到端验证
// 模拟小程序运行时：wx API、Page/App 注册、setData 渲染，
// 跑通「自动完成六爻 → 成卦 → 装卦」全流程。
const path = require('path');
const assert = require('assert');

const PAGE_DIR = path.resolve(__dirname, '..');

// ---------- 迷你 wx 运行时 ----------
let __wxToast = [];
global.wx = {
  showToast: (o) => __wxToast.push(o.title),
  showLoading: () => {},
  hideLoading: () => {},
};
let __appCfg = null;
global.App = (cfg) => { __appCfg = cfg; };
global.getApp = () => ({ globalData: { engine: () => globalThis.LiuYaoEngine, rules: () => globalThis.LiuYaoRules } });

let __pageCfg = null;
global.Page = (cfg) => { __pageCfg = cfg; };

// ---------- 加载 app.js（注册算法层）----------
require(path.join(PAGE_DIR, 'app.js'));

// ---------- 加载页面 ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
require(path.join(PAGE_DIR, 'pages/divine/divine.js'));

// ---------- 构造 page 实例（模拟小程序 setData）----------
function makePage() {
  const cfg = __pageCfg;
  const inst = { ...cfg, data: JSON.parse(JSON.stringify(cfg.data)) };
  inst.setData = function (patch) {
    for (const k of Object.keys(patch)) {
      // 数组/对象整体替换，符合 setData 语义
      inst.data[k] = patch[k];
    }
  };
  inst.onLoad();
  return inst;
}

let pass = 0; const fail = [];
const ok = (c, m) => c ? pass++ : fail.push(m);

(async () => {
  const p = makePage();

  ok(p.data.status === '龟壳已备，铜钱在手。', '初始状态文案');
  ok(p.data.yaos.length === 6, '应有 6 行进度');
  ok(p.data.yaos[0].pos === 6 && p.data.yaos[5].pos === 1, '进度自上而下为上爻→初爻');
  ok(p.data.tossBtnText === '摇第 1 爻', '初始按钮文案');
  ok(p.data.result === null, '初始无卦象结果');
  ok(Array.isArray(p.data.topics) && p.data.topics.length === 14, '应有 14 个事项');

  // 切换事项
  p.onTopicChange({ detail: { value: 1 } });
  ok(p.data.topicIndex === 1, '事项切换应生效');
  ok(p.data.topics[1].key === '财运', '第 2 项应为财运');

  // 单爻摇卦（用慢档 3 次摇 + 抛掷，约 4.6s）
  await p.onTossOne();
  ok(p.results.length === 1, '应记录 1 爻');
  ok(p.data.yaos.filter(y => y.label !== '待摇').length === 1, '进度条应只有 1 爻已摇');
  ok(p.data.lastYao.includes('得'), '应显示本爻结果');
  ok(/第[一二三]枚[字背]/.test(p.data.lastYao), '应显示三枚铜钱正反');
  ok(p.data.tossBtnText === '摇第 2 爻', '按钮应变为摇第 2 爻');
  ok(!p.data.finished, '此时不应成卦');

  // 自动完成剩余五爻（快档）
  await p.onAutoFull();
  ok(p.results.length === 6, '应满 6 爻');
  ok(p.data.finished, '应标记成卦');
  ok(p.data.tossBtnText === '已成卦 · 重新起卦', '按钮应变回重新起卦');
  ok(p.data.status === '六爻已成卦！', '状态应为成卦提示');
  ok(p.data.yaos.every(y => y.label !== '待摇'), '6 爻应全部已摇');

  // 卦象结果
  const r = p.data.result;
  ok(!!r, '应产出卦象结果');
  ok(!!r.hexName, '应有卦名');
  ok(/宫$/.test(r.palace), '应有卦宫');
  ok(r.yaos.length === 6, '卦象应有 6 爻');
  ok(r.yaos.every(y => y.gz && y.qin), '每爻应有纳甲与六亲');
  ok(r.yaos.filter(y => y.shiying === '世').length === 1, '应有且仅有一个世爻');
  ok(r.yaos.filter(y => y.shiying === '应').length === 1, '应有且仅有一个应爻');
  ok(r.yaos.every(y => y.pos >= 1 && y.pos <= 6), '爻位应 1-6');

  // 校验爻位与卦画一致：bits 低位为初爻
  const full = globalThis.LiuYaoEngine.fullDivine(p.results, new Date());
  ok(full.main.hex.bits.length === 6, 'bits 应为 6 位');
  for (let i = 0; i < 6; i++) {
    if (String(i) !== r.yaos[5 - i].shiying.replace('世', '').replace('应', '')) { /* 占位 */ }
  }
  // 逐爻核对 UI 显示的阴阳与引擎一致（UI 自上而下，故逆序）
  let yangMatch = 0;
  for (let i = 0; i < 6; i++) {
    const uiYao = r.yaos[5 - i];
    if (uiYao.yang === full.main.yaos[i].yang && uiYao.gz === full.main.yaos[i].gz) yangMatch++;
  }
  ok(yangMatch === 6, `UI 六爻应与引擎一致，实为 ${yangMatch}/6`);

  // 重置
  p.onReset();
  ok(p.results.length === 0, '重置应清空结果');
  ok(p.data.result === null, '重置应清空卦象');
  ok(p.data.finished === false, '重置应回到未成卦');
  ok(p.data.tossBtnText === '摇第 1 爻', '重置应恢复按钮文案');
  ok(p.data.yaos.every(y => y.label === '待摇'), '重置应清空进度');

  // 重置后能重新起卦（死交互回归）
  await p.onAutoFull();
  ok(p.results.length === 6, '重置后应能重新起卦');
  ok(!!p.data.result, '重置后应能重新产出卦象');

  // 多次成卦稳定性：连跑 20 轮，验证不抛错
  let stable = 0;
  for (let i = 0; i < 20; i++) {
    p.onReset();
    try { await p.onAutoFull(); if (p.results.length === 6 && p.data.result) stable++; }
    catch (e) { fail.push(`第 ${i + 1} 轮抛错: ${e.message}`); break; }
  }
  ok(stable === 20, `连跑 20 轮应全成功，实为 ${stable}`);

  console.log(`\n通过 ${pass} 项，失败 ${fail.length} 项`);
  if (fail.length) { console.log('失败明细:'); fail.forEach(f => console.log('  ✗', f)); }
  else console.log('✓ 全部通过');
  process.exit(fail.length ? 1 : 0);
})();
