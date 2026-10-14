// 小程序入口：在此全局注册算法层（小程序无 window，用 globalThis 承载）
// 顺序不可颠倒：静态数据 → 农历库 → 规则层 → 引擎层
//   core-data   基础数据（64卦/纳甲/六亲/六神）
//   meaning-data 64卦现代白话解读
//   yao-labels  384爻吉凶标签
//   lunar       农历库（挂 globalThis.Solar，供引擎取日辰月建）
//   rules       规则层（旺衰/旬空/飞伏神/神煞）
//   engine      引擎层（抛爻/装卦/解卦）
require('./data/core-data.js');
require('./data/meaning-data.js');
require('./data/yao-labels.js');
require('./utils/lunar.js');
require('./utils/rules.js');
require('./utils/engine.js');

App({
  globalData: {
    // 引擎与规则以全局对象形式供页面取用（小程序无 window）
    engine: () => globalThis.LiuYaoEngine,
    rules: () => globalThis.LiuYaoRules,
  },
});
