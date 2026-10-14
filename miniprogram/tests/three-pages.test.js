// 三页联动端到端测试（Node 环境模拟小程序运行时）
// 验证：数据层挂载 → 起卦 → 装卦 → 排盘数据 → 解卦数据 → 边界（静卦/无变卦/用神不上卦）
const path = require('path');
const assert = require('assert');

const MP = path.join(__dirname, '..');

// ---- 模拟小程序运行时 ----
const g = globalThis;
let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n      ' + e.message); }
}

// 页面注册表（模拟 Page()）
const pages = {};
global.Page = (cfg) => { pages[cfg.__name || Object.keys(pages).length] = cfg; };
global.getApp = () => ({ globalData: appInstance.globalData });
global.wx = {
  showToast() {}, showModal() {}, navigateTo() {}, navigateBack() {}, redirectTo() {},
  setNavigationBarTitle() {},
};

require(path.join(MP, 'data/core-data.js'));
require(path.join(MP, 'data/meaning-data.js'));
require(path.join(MP, 'data/yao-labels.js'));
require(path.join(MP, 'utils/lunar.js'));
require(path.join(MP, 'utils/rules.js'));
require(path.join(MP, 'utils/engine.js'));

const appInstance = {
  globalData: {
    engine: () => g.LiuYaoEngine,
    rules: () => g.LiuYaoRules,
    lastResults: null,
    divineDate: null,
    topic: '综合',
    topics: [],
    topicIndex: 0,
  },
};

// 加载三页（pan.js / interpret.js 顶部有 export，需先抹平）
const fs = require('fs');
function loadPage(rel) {
  const p = path.join(MP, rel);
  const src = fs.readFileSync(p, "utf8");
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', 'Page', 'getApp', 'wx', 'globalThis', src)(
    mod, mod.exports, require,
    (cfg) => { cfg.__name = rel; pages[rel] = cfg; },
    global.getApp, global.wx, g
  );
  return mod.exports;
}

console.log('\n[1] 数据层挂载');
t('IMEANING 64 卦', () => assert.strictEqual(Object.keys(g.IMEANING).length, 64));
t('IYAOLABEL 384 爻', () => assert.strictEqual(g.IYAOLABEL.length, 384));
t('ICORE 64 卦', () => assert.strictEqual(g.ICORE.length, 64));
t('lunar 挂到 globalThis.Solar', () => assert.strictEqual(typeof g.Solar, 'object'));
t('引擎与规则已注册', () => {
  assert.ok(g.LiuYaoEngine, 'LiuYaoEngine 缺失');
  assert.ok(g.LiuYaoRules, 'LiuYaoRules 缺失');
});

console.log('\n[2] 农历层可取日辰月建');
t('getDayGanZhi 有日辰', () => {
  const di = g.LiuYaoEngine.fullDivine([{ yang: true, sum: 7, moving: false, coins: [0, 0, 0], label: '少阳', mark: '' }].concat(
    Array.from({ length: 5 }, () => ({ yang: false, sum: 8, moving: false, coins: [1, 1, 1], label: '少阴', mark: '' }))
  ), new Date()).dayInfo;
  assert.ok(di && di.dayGZ, '未取到日辰');
});

console.log('\n[3] 排盘页数据组装');
const panMod = loadPage('pages/pan/pan.js');
const interpMod = loadPage('pages/interpret/interpret.js');

function mkResults(pattern) {
  // pattern: 6 个 0(少阳静)/1(少阴静)/2(老阳动)/3(老阴动)
  const MAP = {
    0: { yang: true, sum: 7, moving: false, coins: [0, 0, 0], label: '少阳', mark: '' },
    1: { yang: false, sum: 8, moving: false, coins: [1, 1, 1], label: '少阴', mark: '' },
    2: { yang: true, sum: 9, moving: true, coins: [0, 0, 0], label: '老阳', mark: '○' },
    3: { yang: false, sum: 6, moving: true, coins: [1, 1, 1], label: '老阴', mark: '×' },
  };
  return pattern.map(k => Object.assign({}, MAP[k]));
}

const DATE = new Date(2026, 9, 6, 10, 30);

t('静卦排盘字段完整', () => {
  const pan = panMod.buildPanData(mkResults([0, 0, 0, 0, 0, 0]), '综合', DATE);
  assert.strictEqual(pan.rows.length, 6, '六爻行数不对');
  assert.ok(pan.head.name, '缺卦名');
  assert.ok(pan.head.guaCi, '缺卦辞');
  assert.ok(pan.head.daXiang, '缺大象');
  assert.strictEqual(pan.changedInfo, null, '静卦不该有变卦');
  assert.strictEqual(pan.rows[0].pos, '上爻', '首行应为上爻');
  assert.strictEqual(pan.rows[5].pos, '初爻', '末行应为初爻');
  assert.ok(pan.rows.every(r => r.gz), '每行应有纳甲');
  assert.ok(pan.rows.every(r => r.states.length > 0), '每行应有旺衰标签');
  assert.ok(pan.meta.length === 3, '时相三项');
});

t('动爻排盘有变卦与化神标签', () => {
  const pan = panMod.buildPanData(mkResults([2, 1, 0, 0, 0, 0]), '财运', DATE);
  assert.ok(pan.changedInfo, '缺变卦');
  assert.ok(pan.changedInfo.guaCi, '变卦缺卦辞');
  const mv = pan.rows.filter(r => r.moving);
  assert.strictEqual(mv.length, 1, '动爻数不对');
  assert.ok(mv[0].cg, '动爻缺变爻纳甲');
});

t('多动爻合成变卦', () => {
  const pan = panMod.buildPanData(mkResults([2, 3, 2, 3, 2, 3]), '事业', DATE);
  assert.strictEqual(pan.rows.filter(r => r.moving).length, 6, '六爻皆动');
  assert.ok(pan.changedInfo, '缺变卦');
});

t('排盘 14 类所问均不抛错', () => {
  const topics = ['综合', '财运', '事业', '工作', '婚恋', '感情', '学业', '疾病', '出行', '寻物', '官非', '房产', '子女', '合作'];
  for (const tp of topics) {
    const pan = panMod.buildPanData(mkResults([2, 1, 0, 3, 1, 0]), tp, DATE);
    assert.ok(pan.head.name, tp + ' 卦名缺失');
  }
});

console.log('\n[4] 解卦页数据组装');
t('动卦解卦字段完整', () => {
  const d = interpMod.buildInterpretData(mkResults([2, 1, 0, 0, 0, 0]), '财运', DATE);
  assert.ok(d.top.verdict, '缺吉凶判定');
  assert.ok(['大吉', '吉', '平', '小凶', '凶'].includes(d.top.verdict), '判定词不在枚举内：' + d.top.verdict);
  assert.ok(d.top.verdictClass, '缺判定样式类');
  assert.ok(d.top.scorePct >= 0 && d.top.scorePct <= 100, '指数条越界');
  assert.ok(d.summary, '缺综述');
  assert.ok(d.advice, '缺断语');
  assert.ok(d.yongshen.desc, '缺用神取用');
  assert.ok(d.shiying.line, '缺世应');
  assert.strictEqual(d.moving.length, 1, '动爻详参条数');
  assert.ok(d.moving[0].yaoCi, '动爻缺爻辞');
  assert.ok(d.moving[0].labelClass, '动爻缺标签样式');
});

t('静卦走 noMoving 分支', () => {
  const d = interpMod.buildInterpretData(mkResults([0, 0, 0, 0, 0, 0]), '综合', DATE);
  assert.strictEqual(d.moving.length, 0, '静卦不应有动爻');
  assert.ok(d.noMoving, '缺静卦说明');
});

t('用神不上卦时走空态', () => {
  // 遍历多卦找一例用神不上卦（伏神）
  let found = false;
  for (let a = 0; a < 64 && !found; a++) {
    for (let b = 0; b < 64 && !found; b++) {
      const res = mkResults([a % 4, b % 4, (a + 1) % 4, (b + 2) % 4, (a + 3) % 4, (b + 1) % 4]);
      try {
        const d = interpMod.buildInterpretData(res, '官非', DATE);
        if (d.fuShen) found = true;
      } catch (e) { /* 跳过异常卦例 */ }
    }
  }
  assert.ok(found, '未找到含飞伏神的卦例');
});

console.log('\n[5] 边界与健壮性');
t('随机 300 卦排盘+解卦全通过', () => {
  const topics = ['综合', '财运', '事业', '婚恋', '疾病', '官非'];
  for (let i = 0; i < 300; i++) {
    const pat = Array.from({ length: 6 }, () => Math.floor(Math.random() * 4));
    const tp = topics[i % topics.length];
    const pan = panMod.buildPanData(mkResults(pat), tp, DATE);
    assert.strictEqual(pan.rows.length, 6);
    const d = interpMod.buildInterpretData(mkResults(pat), tp, DATE);
    assert.ok(d.top.verdict, '第' + i + '卦缺判定');
  }
});

t('跨 12 个月日期均能取到日辰', () => {
  for (let m = 0; m < 12; m++) {
    const dt = new Date(2026, m, 15, 12, 0);
    const pan = panMod.buildPanData(mkResults([0, 1, 0, 1, 0, 1]), '综合', dt);
    assert.ok(pan.meta[1].v !== '未取', (m + 1) + '月日辰未取到');
  }
});

t('无 undefined 泄漏到页面数据', () => {
  const pan = panMod.buildPanData(mkResults([2, 3, 0, 1, 2, 0]), '合作', DATE);
  const d = interpMod.buildInterpretData(mkResults([2, 3, 0, 1, 2, 0]), '合作', DATE);
  const scan = (o, tag) => {
    for (const k in o) {
      const v = o[k];
      assert.ok(v !== undefined, tag + '.' + k + ' 为 undefined');
      if (v && typeof v === 'object' && !Array.isArray(v)) scan(v, tag + '.' + k);
      if (Array.isArray(v)) v.forEach((it, i) => {
        assert.ok(it !== undefined, tag + '.' + k + '[' + i + '] 为 undefined');
        if (it && typeof it === 'object') scan(it, tag + '.' + k + '[' + i + ']');
      });
    }
  };
  scan(pan, 'pan');
  scan(d, 'interp');
});

t('页面配置齐全（data/handler）', () => {
  for (const [name, need] of [
    ['pages/divine/divine.js', ['onTossOne', 'onAutoFull', 'onGoPan', 'onReset', 'buildResult']],
    ['pages/pan/pan.js', ['onGoInterpret', 'onGoDivine']],
    ['pages/interpret/interpret.js', ['onTopicChange', 'onGoPan', 'onGoDivine']],
  ]) {
    loadPage(name);
    const cfg = pages[name];
    assert.ok(cfg, name + ' 未注册');
    for (const h of need) assert.strictEqual(typeof cfg[h], 'function', name + ' 缺 ' + h);
    assert.ok(cfg.data && Object.keys(cfg.data).length > 0, name + ' 缺 data');
  }
});

console.log('\n' + '='.repeat(46));
console.log('通过 ' + pass + ' / 失败 ' + fail);
console.log('='.repeat(46));
process.exit(fail ? 1 : 0);
