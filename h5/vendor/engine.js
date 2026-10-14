/* 六爻排盘与解卦引擎 */
(function () {
  'use strict';

  // ============ 基础常量 ============
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const ZHI_WX = globalThis.ZHI_WUXING;
  const WX_COLOR = { 金: '#d4af37', 木: '#4a9d5f', 水: '#3d7ea6', 火: '#c0392b', 土: '#b07d3f' };

  const LIU_QIN = ['父母', '兄弟', '子孙', '妻财', '官鬼'];
  const LIU_SHEN = [
    { name: '青龙', wx: '木', color: '#5a9e6f' },
    { name: '朱雀', wx: '火', color: '#c0392b' },
    { name: '勾陈', wx: '土', color: '#b07d3f' },
    { name: '螣蛇', wx: '火', color: '#9b59b6' },
    { name: '白虎', wx: '金', color: '#8e8e8e' },
    { name: '玄武', wx: '水', color: '#3d7ea6' },
  ];
  // 日干 -> 起六神（初爻起）
  const SHEN_START = { 甲: 0, 乙: 0, 丙: 1, 丁: 1, 戊: 2, 己: 3, 庚: 4, 辛: 4, 壬: 5, 癸: 5 };
  const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  // 地支相冲（子午 丑未 寅申 卯酉 辰戌 巳亥）——《增删卜易》六冲章
  const CHONG = { 子: '午', '午': '子', '丑': '未', '未': '丑', '寅': '申', '申': '寅', '卯': '酉', '酉': '卯', '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳' };
  // 地支相合（子丑 寅亥 卯戌 辰酉 巳申 午未）——《增删卜易》六合章
  const HE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  // 月建（节气月）地支 -> 五行
  const YUE_ORDER = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];

  // 旬空（空亡）
  const XUN_KONG = [
    ['子', '丑'], ['寅', '卯'], ['辰', '巳'], ['午', '未'], ['申', '酉'], ['戌', '亥'],
  ];
  const JIAZI = [];
  for (let i = 0; i < 60; i++) JIAZI.push(GAN[i % 10] + ZHI[i % 12]);

  function shengOf(w) { return SHENG[w]; }
  function keOf(w) { return KE[w]; }
  // 五行关系：a 对 b
  function relation(a, b) {
    if (a === b) return 'same';
    if (SHENG[a] === b) return 'sheng';   // a生b
    if (SHENG[b] === a) return 'beSheng'; // b生a
    if (KE[a] === b) return 'ke';         // a克b
    return 'beKe';                        // b克a
  }

  // ============ 数据索引 ============
  const CORE = globalThis.ICORE || [];
  const MEAN = globalThis.IMEANING || {};
  const LABELS = globalThis.IYAOLABEL || [];
  const BY_BITS = {};
  CORE.forEach(h => { BY_BITS[h.bits] = h; });
  const LABEL_MAP = {};
  LABELS.forEach(r => {
    if (!LABEL_MAP[r.hex]) LABEL_MAP[r.hex] = {};
    LABEL_MAP[r.hex][r.pos] = r;
  });
  // 本宫首卦（八纯卦）：飞伏神「用神不上卦，须于本宫首卦寻之」之取处
  // 直接由卦库推导，不另存一份硬编码表——避免与卦库失配。
  const PURE_BY_PALACE = {};
  CORE.forEach(h => { if (h.palaceType === '八纯卦') PURE_BY_PALACE[h.palace] = h.bits; });
  const MEAN_BY_SHORT = {};
  Object.keys(MEAN).forEach(full => { MEAN_BY_SHORT[MEAN[full].short] = MEAN[full]; });

  // ============ 铜钱起卦 ============
  // 三枚铜钱：字为阳(3)，背为阴(2)；和为 6/7/8/9
  // 6=老阴(交,动,阴) 7=少阳(单,静,阳) 8=少阴(拆,静,阴) 9=老阳(重,动,阳)
  function tossCoins() {
    const coins = [];
    for (let i = 0; i < 3; i++) coins.push(Math.random() < 0.5 ? 1 : 0); // 1=字面(阳)
    const sum = coins.reduce((s, c) => s + (c ? 3 : 2), 0);
    let value, yang, moving, label;
    if (sum === 6) { value = 6; yang = false; moving = true; label = '老阴'; }
    else if (sum === 7) { value = 7; yang = true; moving = false; label = '少阳'; }
    else if (sum === 8) { value = 8; yang = false; moving = false; label = '少阴'; }
    else { value = 9; yang = true; moving = true; label = '老阳'; }
    return { coins, sum: value, yang, moving, label, mark: moving ? (yang ? '○' : '×') : (yang ? '' : '') };
  }

  // 由六爻结果生成卦
  function buildHexagram(yaoResults) {
    let bits = '';
    for (let i = 0; i < 6; i++) bits += yaoResults[i].yang ? '1' : '0';
    let cbits = bits;
    const moving = [];
    yaoResults.forEach((r, i) => { if (r.moving) { moving.push(i); cbits = cbits.slice(0, i) + (r.yang ? '0' : '1') + cbits.slice(i + 1); } });
    return { bits, cbits, moving, hasMoving: moving.length > 0 };
  }

  // ============ 装卦 ============
  // lunar.js 以 UMD + this 作 root 加载，会把 Solar / Lunar 等平铺到 window。
  // 逐一候选并实际验证可用性，避免命中不兼容的分支。
  function getLunarNS() {
    const cands = [];
    const L = globalThis.Lunar;
    if (L) {
      if (L.Solar) cands.push(L.Solar);
      cands.push(L);
      for (const k in L) if (L[k] && typeof L[k].fromDate === 'function') cands.push(L[k]);
    }
    if (globalThis.Solar) cands.push(globalThis.Solar);
    for (const c of cands) {
      if (c && typeof c.fromDate === 'function') {
        try {
          const l = c.fromDate(new Date()).getLunar();
          if (l && typeof l.getDayInGanZhi === 'function' && l.getDayInGanZhi()) return { Solar: c };
        } catch (e) { /* 试下一个 */ }
      }
    }
    return null;
  }

  function getDayGanZhi(date) {
    try {
      const ns = getLunarNS();
      if (!ns) return null;
      const lunar = ns.Solar.fromDate(date).getLunar();
      if (!lunar || typeof lunar.getDayInGanZhi !== 'function') return null;
      return {
        dayGZ: lunar.getDayInGanZhi(),
        monthGZ: lunar.getMonthInGanZhiExact(),
        yearGZ: lunar.getYearInGanZhi(),
        lunarText: lunar.getYearInChinese() + '年' + lunar.getMonthInChinese() + '月' + lunar.getDayInChinese(),
      };
    } catch (e) { return null; }
  }

  function xunKongOf(dayGZ) {
    const idx = JIAZI.indexOf(dayGZ);
    if (idx < 0) return ['子', '丑'];
    const xun = Math.floor(idx / 10);
    return XUN_KONG[5 - xun] || ['子', '丑'];
  }

  // 装一卦（含变卦六亲，按本宫五行论）
  // 传统机制（原神/忌神/飞伏神/进退神/真空假空/暗动/月破不破）依《增删卜易》《卜筮正宗》，
  // 统一委托 js/rules.js 计算，此处只负责排盘与调用。
  function arrange(hexBits, dayInfo, movingIdx) {
    const h = BY_BITS[hexBits];
    if (!h) return null;
    const R = globalThis.LiuYaoRules;
    const kong = dayInfo && dayInfo.dayGZ ? xunKongOf(dayInfo.dayGZ) : [];
    // 缺日辰时不兜底成假干支——否则会输出看似可信的假数据（如"月建：寅"）
    const dayGan = dayInfo && dayInfo.dayGZ ? dayInfo.dayGZ[0] : null;
    const dayWx = dayGan ? (GAN_WX[dayGan] || null) : null;
    const monthZhi = dayInfo && dayInfo.monthGZ ? dayInfo.monthGZ[1] : null;
    const monthWx = monthZhi ? (ZHI_WX[monthZhi] || null) : null;
    const dayZhi = dayInfo && dayInfo.dayGZ ? dayInfo.dayGZ[1] : null;
    const start = (dayGan != null && SHEN_START[dayGan] != null) ? SHEN_START[dayGan] : null;

    const yaos = [];
    for (let i = 0; i < 6; i++) {
      const naj = h.najia[i];
      const zhi = naj.gz[1];
      const yongWx = naj.wx;
      const rel6 = relation(yongWx, h.palaceElem);
      const qin = naj.qin;
      // 旬空
      const isKong = kong.length > 0 && kong.indexOf(zhi) >= 0;
      // 月破：与月建相冲（子午 丑未 寅申 卯酉 辰戌 巳亥）
      const isMonthPo = !!monthZhi && CHONG[monthZhi] === zhi;
      const isDayChong = !!dayZhi && CHONG[dayZhi] === zhi;
      // 旺衰（缺月建时不臆断，标为"待考"）
      let wang = '待考';
      if (monthWx) {
        if (yongWx === monthWx) wang = '旺';
        else if (SHENG[monthWx] === yongWx) wang = '相';
        else if (SHENG[yongWx] === monthWx) wang = '休';
        else if (KE[yongWx] === monthWx) wang = '囚';
        else wang = '死';
      }
      // 日辰生克
      const dayRel = dayWx ? relation(dayWx, yongWx) : '—';
      yaos.push({
        pos: i + 1,
        index: i,
        yang: h.bits[i] === '1',
        gz: naj.gz, wx: yongWx, qin, zhi,
        // 源数据 yaoName[i][1] 形如「龙1」「雷0」，末尾 0/1 是阴阳标记
        //（实测 384 爻全部等于 bits 的阴阳，故为冗余信息）。
        // 此处剥离，避免页面上出现「雷0」这类脏值。
        xiang: String(h.yaoName[i][1]).replace(/\d+$/, ''),
        ming: h.yaoName[i][0],
        yaoCi: h.yaoCi[i],
        xiaoXiang: h.xiaoXiang[i] || '',
        isShi: (h.shi - 1) === i,
        isYing: (h.ying - 1) === i,
        isMoving: (movingIdx || []).indexOf(i) >= 0,
        shen: start == null ? { name: '—', wx: null, color: '#666' } : LIU_SHEN[(start + i) % 6],
        kong: isKong, monthPo: isMonthPo, dayChong: isDayChong, wang,
        dayRel,
        label: (LABEL_MAP[h.name.replace(/^.*?(为[地天水泽山风雷火])/, '$1')] || {})[i + 1] ||
          (function () { // 用简称回退
            const short = findShort(h.name);
            return short ? (LABEL_MAP[short] || {})[i + 1] : null;
          })(),
      });
    }

    // ===== 传统机制：依《增删卜易》《卜筮正宗》补算 =====
    // 上下文（含月建日辰的五行与地支，供 rules 判定用）
    const ctx = { monthZhi, monthWx, dayZhi, dayWx, dayGZ: dayInfo && dayInfo.dayGZ };
    // 动爻集合（供原神/忌神「与忌神同动」等判定）
    const movingYaos = yaos.filter(y => y.isMoving);
    ctx.movingShengYong = false; // 用神相关，interpret 阶段再定
    ctx.heYong = false;

    yaos.forEach(y => {
      // 旬空：真空 / 假空
      y.kongJudge = R.kongJudge(y, ctx);
      // 暗动（日辰冲静爻：旺相为暗动，休囚为日破）
      y.anDong = R.anDong(y, ctx);
      // 月破是否到底而破
      y.monthPoJudge = R.monthPoJudge(y, ctx);
      // 三合局入爻（申子辰水等）
      y.sanHe = false;
    });
    // 三合局：卦中三爻地支齐备者
    const ju = R.sanHeJu(yaos);
    if (ju) yaos.forEach(y => { if (ju.zhi.indexOf(y.zhi) >= 0) y.sanHe = ju.wx; });
    // 有动爻生扶 / 有合，给月破判定用
    const anyMoving = movingYaos.length > 0;
    yaos.forEach(y => {
      if (!y.monthPo) return;
      // 动爻生扶：任一主动爻生本爻
      const helped = movingYaos.some(m => relation(m.wx, y.wx) === 'sheng');
      const heWith = movingYaos.some(m => HE[m.zhi] === y.zhi) ||
        (monthZhi && HE[monthZhi] === y.zhi);
      y.monthPoJudge = R.monthPoJudge(y, {
        ...ctx,
        movingShengYong: helped,
        heYong: heWith,
      });
    });

    // 六冲 / 六合卦
    const najiaLite = yaos.map(y => ({ zhi: y.zhi, wx: y.wx, gz: y.gz, qin: y.qin }));
    const isChong = R.liuChong(najiaLite);
    const isHe = R.liuHe(najiaLite);

    // 卦身（安月卦身诀：阳世从子月起，阴世从午月起，从初数至世）
    const guaShen = R.guaShen(yaos, h.shi - 1);

    return {
      hex: h, bits: hexBits, yaos,
      kong, monthZhi, monthWx, dayZhi, dayWx, dayGZ: dayInfo && dayInfo.dayGZ,
      shiIdx: h.shi - 1, yingIdx: h.ying - 1,
      isChong, isHe, guaShen, sanHe: ju,
      anyMoving,
    };
  }

  function findShort(fullName) {
    const m = MEAN[fullName];
    return m ? m.short : null;
  }

  // ============ 装一卦完整（主卦+变卦）============
  function fullDivine(yaoResults, date) {
    const { bits, cbits, moving, hasMoving } = buildHexagram(yaoResults);
    const dayInfo = getDayGanZhi(date || new Date());
    const main = arrange(bits, dayInfo, moving);
    const changed = hasMoving ? arrange(cbits, dayInfo, []) : null;
    return { main, changed, moving, hasMoving, dayInfo, yaoResults };
  }

  // ============ 互卦 / 错卦 / 综卦 ============
  function huGu(bits) {
    // 互卦：二三四为下卦，三四五为上卦
    const lower = bits.slice(1, 4), upper = bits.slice(2, 5);
    return lower + upper;
  }
  function cuoGu(bits) { return bits.split('').map(b => b === '1' ? '0' : '1').join(''); }
  function zongGu(bits) { return bits.split('').reverse().join(''); }

  // ============ 用神取用 ============
  // 依《增删卜易》用神章：兄弟占兄弟；妻财占妻妾仆役、占货财珠宝仓库；
  // 子孙占子孙女、占医药僧道兵卒六畜；父母占父母、占文书契券；
  // 官鬼占功名官职、占丈夫、占病症、占官司是非；世爻占自身。
  const YONGSHEN_RULES = {
    '财运': { qin: '妻财', desc: '妻财为货物财宝、钱财，求财以妻财为用神' },
    '事业': { qin: '官鬼', desc: '官鬼为功名职位，求事业以官鬼为用神' },
    '工作': { qin: '官鬼', desc: '官鬼为职位工作，求职问工作以官鬼为用神' },
    '学业': { qin: '父母', desc: '父母为文书学问、求学功名，以父母为用神' },
    '婚恋': { qin: '妻财', desc: '男占女以妻财为用神' },
    '感情': { qin: '官鬼', desc: '女占男以官鬼为用神' },
    '疾病': { qin: '官鬼', desc: '官鬼为病症，子孙为医药神，同参则灵' },
    '出行': { qin: '世爻', desc: '世爻为行人自身' },
    '寻物': { qin: '妻财', desc: '妻财为失物、财物' },
    '官非': { qin: '官鬼', desc: '官鬼为官司是非、公门', sub: '子孙' },
    '房产': { qin: '父母', desc: '父母为房屋、宅舍、契券' },
    '子女': { qin: '子孙', desc: '子孙为子女晚辈、福神' },
    '合作': { qin: '妻财', desc: '妻财为合作求利之源' },
    '综合': { qin: '世爻', desc: '综合看世应与卦象整体' },
  };

  // ============ 飞伏神（用神不上卦时）============
  // 《增删卜易》飞伏神章：「凡卦，用神不现者…倘日月非用神，须于本宫首卦寻之。
  //   盖本宫之首卦六亲俱全之故耳。」—— 本宫首卦即该宫八纯卦。
  // 「假令占得天风姤卦…以寅卯木爻为妻财，今六爻并无寅卯，即是用神不上卦…
  //   按：乾卦寅木妻财在二爻，即以此寅木妻财伏于姤卦亥水之下。」
  // 飞伏歌诀与「有用六 / 无用五」的判定真源在 rules.js 的 feiFuJudge()，此处不再另立一套。
  function findFuShen(main, qin) {
    const pure = BY_BITS[PURE_BY_PALACE[main.hex.palace]];
    if (!pure) return null;
    // 在本宫首卦中找同六亲之爻，标定其「伏于本卦哪一爻之下」——按爻位对应
    for (let i = 0; i < 6; i++) {
      if (pure.najia[i].qin === qin) {
        const fei = main.yaos[i];           // 本卦同爻位 = 飞神
        const fu = {                        // 伏神（本宫首卦该爻）
          pos: i + 1, gz: pure.najia[i].gz, wx: pure.najia[i].wx, qin: qin, zhi: pure.najia[i].gz[1],
          isFu: true, underPos: i + 1,
        };
        // 伏神同样受月建、旬空、月破约束——判定交给 rules.feiFuJudge，故须补齐这三项
        fu.wang = globalThis.LiuYaoRules.wangBySeason(fu.wx, main.monthZhi);
        fu.kong = (main.kong || []).indexOf(fu.zhi) >= 0;
        fu.monthPo = !!main.monthZhi && CHONG[main.monthZhi] === fu.zhi;
        return { fu, fei, palace: main.hex.palace };
      }
    }
    return null;
  }

  // ============ 解卦 ============
  function interpret(result, topic) {
    const { main, changed, hasMoving, dayInfo } = result;
    const out = { topic: topic || '综合', sections: [], summary: '', score: 0 };
    const h = main.hex;
    const mean = MEAN_BY_SHORT[h.name.replace(/^.*?(为[地天水泽山风雷火])/, '$1')] || MEAN[h.name] ||
      (function () { const s = findShort(h.name); return s ? MEAN_BY_SHORT[s] : null; })();
    const short = findShort(h.name);
    const mLabel = short ? (LABEL_MAP[short] || {}) : {};

    // --- 基本信息 ---
    out.info = {
      name: h.name, short: short || h.name, symbol: h.symbol,
      palace: h.palace + '宫', palaceType: h.palaceType, palaceElem: h.palaceElem,
      upper: h.upper + '(' + h.upperNature + ')', lower: h.lower + '(' + h.lowerNature + ')',
      guaCi: h.guaCi, daXiang: h.daXiang,
      changedName: changed ? changed.hex.name : null,
      changedShort: changed ? findShort(changed.hex.name) : null,
      changedGuaCi: changed ? changed.hex.guaCi : null,
      changedDaXiang: changed ? changed.hex.daXiang : null,
      movingPos: result.moving.map(i => i + 1),
      dayGZ: dayInfo ? dayInfo.dayGZ : '', monthGZ: dayInfo ? dayInfo.monthGZ : '',
      kong: main.kong,
    };

    // --- 用神 ---
    const rule = YONGSHEN_RULES[topic] || YONGSHEN_RULES['综合'];
    out.yongshen = rule;
    let ysList = [];
    if (rule.qin === '世爻') {
      ysList = main.yaos.filter(y => y.isShi);
    } else {
      ysList = main.yaos.filter(y => y.qin === rule.qin);
    }
    out.yongList = ysList;

    // --- 用神旺衰分析 ---
    let score = 0;
    const ysNotes = [];
    const R = globalThis.LiuYaoRules;

    // ==== 飞伏神：用神不上卦时，到本宫首卦寻之（《增删卜易》飞伏神章）====
    if (ysList.length === 0 && rule.qin !== '世爻') {
      const ff = findFuShen(main, rule.qin);
      // 判定统一委托 rules.feiFuJudge（飞伏歌诀 + 有用六 / 无用五的真源）
      const judge = ff && R.feiFuJudge(ff.fu, ff.fei, {
        dayWx: main.dayWx, monthWx: main.monthWx, dayZhi: main.dayZhi,
        movingShengFu: main.yaos.some(y => y.isMoving && relation(y.wx, ff.fu.wx) === 'sheng'),
        chongKeFei: (main.dayZhi && CHONG[main.dayZhi] === ff.fei.zhi) ||
          (main.monthZhi && CHONG[main.monthZhi] === ff.fei.zhi),
      });
      if (judge) {
        const usable = judge.usable;
        out.fuShen = {
          ...ff, song: judge.song, judge: judge.verdict,
          up: judge.useReasons, down: judge.deadReasons, usable,
          summary: `用神${rule.qin}不上卦，伏于本卦第${ff.fu.pos}爻${ff.fei.gz}${ff.fei.qin}之下。`
            + `飞神${ff.fei.gz}、伏神${ff.fu.gz}——${judge.song}。${judge.verdict}。`
            + (usable ? '伏神有力，虽不现亦如现，可用。' : '伏神无力，虽有如无，终不能出。'),
        };
        // 伏神有力：加分；无力：减分（幅度小于明现用神，避免喧宾夺主）
        score += usable ? 8 : -14;
        ysNotes.push(out.fuShen.summary);

        // ==== 《火珠林》飞伏七情：用神伏于何六亲之下，各有断语 ====
        //  「财伏鬼乡，买卖遭伤」「用财伏兄，口舌相侵」「财伏父母，旺相得半」
        //  「用鬼伏兄，同类欺凌」「鬼伏财乡，因财有伤」「鬼伏父母，举状经官」…
        const fuQi = R.fuQiJudge(ff.fei.qin, ff.fu.qin, {
          isShi: ff.fei.isShi,
          dayIsFu: main.dayZhi === ff.fu.zhi,
          fuWang: ff.fu.wang,
          fuKong: ff.fu.kong,
          fuMoving: false,
        });
        if (fuQi) {
          out.fuShen.qi = fuQi;
          // 《火珠林》定轻重：得长生者言强，得休囚无气者言弱
          score += fuQi.level === '强' ? 6 : fuQi.level === '中' ? 2 : -6;
          ysNotes.push(`《火珠林》飞伏之情：${fuQi.title}——${fuQi.note}（要${fuQi.need}）`);
        }
      } else {
        ysNotes.push('卦中不见' + rule.qin + '，且本宫首卦亦无此六亲，用神不上卦无从寻伏，事在暗处。');
        score -= 12;
      }
    } else if (ysList.length === 0) {
      ysNotes.push('卦中不见' + (rule.qin === '世爻' ? '世爻' : rule.qin) + '，须以世应与卦象整体推断。');
      score -= 10;
    } else {
      ysList.forEach(y => {
        let s = 0; const notes = [];
        if (y.wang === '旺') { s += 25; notes.push('爻逢月建旺相'); }
        else if (y.wang === '相') { s += 15; notes.push('爻得月生而相'); }
        else if (y.wang === '休') { s += 0; notes.push('爻生月建而休'); }
        else if (y.wang === '囚') { s -= 12; notes.push('爻克月建而囚'); }
        else { s -= 22; notes.push('爻受月克而死'); }
        if (y.dayRel === 'same') { s += 15; notes.push('临日辰建禄，其力最旺'); }
        else if (y.dayRel === 'beSheng') { s += 12; notes.push('得日辰生扶'); }
        else if (y.dayRel === 'sheng') { s -= 5; notes.push('泄于日辰，力有不足'); }
        else if (y.dayRel === 'beKe') { s -= 18; notes.push('日辰相克，事有阻'); }
        else { s -= 8; notes.push('克日辰，耗力'); }
        // 旬空：区分真空 / 假空（《增删卜易》旬空章「旺不为空，动不为空…真空即春土夏金秋木三冬逢火是真空」）
        if (y.kong && y.kongJudge) {
          if (y.kongJudge.zhen) { s -= 20; notes.push('逢真空（' + y.kongJudge.reasons.join('；') + '），到底之空，须待出旬填实'); }
          else { s -= 6; notes.push('逢假空（' + y.kongJudge.reasons.slice(0, 1).join('；') + '），非到底空，待冲空、实空之日可用'); }
        }
        // 月破：区分到底破 / 非到底破（月破章「惟而不动又无日辰动爻生助者，则到底而破矣」）
        if (y.monthPo && y.monthPoJudge) {
          if (y.monthPoJudge.broken) { s -= 22; notes.push('月破到底（' + y.monthPoJudge.reasons.join('；') + '），此爻终无可用'); }
          else { s -= 8; notes.push('月破而非到底破（' + y.monthPoJudge.reasons.slice(0, 1).join('；') + '），待出月、实破或冲合之日可用'); }
        }
        // 暗动：静爻旺相逢日辰冲为暗动（暗动章）
        if (y.anDong && y.anDong.type === '暗动') { s += 6; notes.push('暗动：静爻旺相被日辰冲，愈得其实力'); }
        if (y.anDong && y.anDong.type === '日破') { s -= 14; notes.push('日破：静爻休囚被日辰冲，愈加无用'); }
        if (y.isMoving) { s += 8; notes.push('爻动，事情正在变化发展中'); }
        if (y.isShi) notes.push('用神临世，己方当权');
        if (y.isYing) notes.push('用神临应，对方主动');
        score += s;
        ysNotes.push({ pos: y.pos, gz: y.gz, qin: y.qin, wang: y.wang, score: s, notes: notes });
      });
    }
    out.ysNotes = ysNotes;

    // ==== 原神 / 忌神 / 仇神（《增删卜易》用神元神忌神仇神章）====
    // 「元神者，生用神之爻…忌神者，克用神之爻…仇神者，克制元神不能生用神，反生忌神而克害用神」
    // 用神不上卦而伏于本宫首卦时，依伏神五行论元忌仇神——伏神即是「暗处之用神」。
    const y0wx = ysList.length ? ysList[0].wx
      : (out.fuShen ? out.fuShen.fu.wx : null);
    if (y0wx && rule.qin !== '世爻') {
      const yjc = R.yuanJiChou(y0wx);
      if (yjc) {
        const yuanList = main.yaos.filter(y => y.wx === yjc.yuan);
        const jiList = main.yaos.filter(y => y.wx === yjc.ji);
        const chouList = yjc.chou ? main.yaos.filter(y => y.wx === yjc.chou) : [];
        // 元神有力无力
        let yuanScore = 0; const yuanNotes = [];
        yuanList.forEach(y => {
          const p = R.powerOfYuanJi('yuan', y, main);
          yuanNotes.push(`元神 ${y.gz}${y.qin}（${p.label}）${p.notes.length ? '：' + p.notes.join('、') : ''}`);
          if (y.isMoving) yuanScore += p.power > 0 ? 6 : -4;
          else yuanScore += p.power > 0 ? 3 : -2;
        });
        let jiScore = 0; const jiNotes = [];
        jiList.forEach(y => {
          const p = R.powerOfYuanJi('ji', y, main);
          // 忌神与元神同动者，忌力减（《增删卜易》「忌神与元神同动」列于忌神无力七）
          const sameMoving = yuanList.some(u => u.isMoving);
          jiNotes.push(`忌神 ${y.gz}${y.qin}（${p.label}）${p.notes.length ? '：' + p.notes.join('、') : ''}`);
          const eff = p.power - (sameMoving ? 1 : 0);
          if (y.isMoving) jiScore += eff > 0 ? -8 : 3;
          else jiScore += eff > 0 ? -4 : 1;
        });
        const chouNotes = chouList.map(y => `仇神 ${y.gz}${y.qin} 动而克元神、生忌神，为害更甚`).join('；');
        let chouScore = 0;
        chouList.forEach(y => { if (y.isMoving) chouScore -= 6; else chouScore -= 2; });
        score += yuanScore + jiScore + chouScore;
        out.yuanJiChou = {
          yuan: yuanList.length ? yuanList.map(y => y.gz + y.qin).join('、') : '不上卦',
          ji: jiList.length ? jiList.map(y => y.gz + y.qin).join('、') : '不上卦',
          chou: chouList.length ? chouList.map(y => y.gz + y.qin).join('、') : '不上卦',
          yuanNotes, jiNotes, chouNotes,
          isFu: !ysList.length,
          score: yuanScore + jiScore + chouScore,
          rule: '元神生用神为福，忌神克用神为害，仇神克元神而生忌神，其害倍之',
        };
      }
    }

    // --- 世应关系 ---
    const shi = main.yaos[main.shiIdx], ying = main.yaos[main.yingIdx];
    let shiyingNote = '', shiyingScore = 0;
    if (shi && ying) {
      const r = relation(shi.wx, ying.wx);
      if (r === 'sheng') { shiyingNote = '世生应：我方付出、主动求和，利于我方耗力，须防被动'; shiyingScore = -5; }
      else if (r === 'beSheng') { shiyingNote = '应生世：对方主动来就我，事有转机，易成'; shiyingScore = 15; }
      else if (r === 'ke') { shiyingNote = '世克应：我方能掌控局面、主动克彼，可成但费力'; shiyingScore = 12; }
      else if (r === 'beKe') { shiyingNote = '应克世：对方压制我方，处被动守势，不宜强争'; shiyingScore = -15; }
      else {
        const r2 = relation(ying.wx, shi.wx);
        if (r2 === 'sheng') { shiyingNote = '应生世：得对方之助，事顺'; shiyingScore = 12; }
        else { shiyingNote = '世应比和：两情相得，平和稳妥'; shiyingScore = 8; }
      }
      // 世爻旺衰
      if (shi.wang === '旺' || shi.wang === '相') { shiyingScore += 8; shiyingNote += '；世爻旺相，己方有力'; }
      else if (shi.wang === '死' || shi.wang === '囚') { shiyingScore -= 10; shiyingNote += '；世爻休囚，己方力弱'; }
      else if (shi.wang === '待考') { shiyingNote += '；缺月建日辰，旺衰暂不参断'; }
    }
    score += shiyingScore;
    out.shiying = { note: shiyingNote, shi: shi ? shi.gz : '', ying: ying ? ying.gz : '', shiWuxing: shi ? shi.wx : '', yingWuxing: ying ? ying.wx : '' };

    // ==== 《卜筮正宗》诸爻持世诀 ====
    //  「父母持世主身劳…子孙持世事无忧…鬼爻持世事难安…财爻持世益财荣…兄弟持世莫求财」
    if (shi) {
      const movingYaos0 = main.yaos.filter(y => y.isMoving);
      const sr = R.shiRuleJudge(shi, {
        shiKe: movingYaos0.some(m => relation(m.wx, shi.wx) === 'ke'),
        shiSheng: movingYaos0.some(m => relation(m.wx, shi.wx) === 'sheng'),
        shiChong: main.dayZhi && CHONG[main.dayZhi] === shi.zhi,
        shiHe: main.dayZhi && HE[main.dayZhi] === shi.zhi,
      });
      if (sr) {
        out.shiRule = sr;
        score += Math.max(-20, Math.min(20, sr.score));
        shiyingNote += '；' + sr.note;
        out.shiying.note = shiyingNote;
      }
    }

    // ==== 《卜筮正宗》绝处逢生论第十六 ====
    //  「金绝于寅、木绝于申、水土绝于巳、火绝于亥…得月建动爻生扶是绝处逢生，不作绝论」
    if (ysList.length && main.dayZhi) {
      const movingYaos1 = main.yaos.filter(y => y.isMoving);
      const jc = R.jueChuFengSheng(ysList[0].wx, main.dayZhi, {
        monthSheng: main.monthWx && relation(main.monthWx, ysList[0].wx) === 'sheng',
        movingSheng: movingYaos1.some(m => relation(m.wx, ysList[0].wx) === 'sheng'),
      });
      if (jc) { out.jueChu = jc; ysNotes.push(jc.note); if (!jc.rescue) score -= 6; }
    }

    // --- 动爻与变卦（含进神退神、回头生克、六亲变化、反伏）---
    if (hasMoving && changed) {
      const notes = [];
      let qinHuaScore = 0;
      result.moving.forEach(i => {
        const y = main.yaos[i], c = changed.yaos[i];
        const lbl = mLabel[i + 1];
        // 进神 / 退神（《增删卜易》进神退神章：亥化子、寅化卯…为进；子化亥、卯化寅…为退）
        const jt = R.jinTui(y.zhi, c.zhi);
        // 回头生 / 回头克：变爻对本爻的作用
        const backRel = relation(c.wx, y.wx);
        const huiTouKe = backRel === 'ke';
        const huiTouSheng = backRel === 'sheng';
        y.changedJin = jt === 'jin';
        y.changedTui = jt === 'tui';
        y.huiTouKe = huiTouKe;
        y.huiTouSheng = huiTouSheng;
        const extra = [];
        if (jt === 'jin') extra.push('化进神：由此而前进，如春木之荣、有源之水，久远长久之象');
        else if (jt === 'tui') extra.push('化退神：由此而渐退，如秋天花木，渐渐凋零');
        if (huiTouKe) extra.push('化回头克：变爻反克本爻，为凶之本');
        else if (huiTouSheng) extra.push('化回头生：变爻生本爻，得他扶助');
        // 《卜筮正宗》六亲变化歌：化出何六亲，各有断语
        const qh = R.qinHuaJudge(y.qin, c.qin);
        if (qh) {
          extra.push('六亲变化：' + qh.note);
          qinHuaScore = (qinHuaScore || 0) + qh.score;
        }
        notes.push({
          pos: i + 1, from: y.gz + y.qin, to: c.gz + c.qin,
          fromQin: y.qin, toQin: c.qin,
          yaoCi: y.yaoCi, xiaoXiang: y.xiaoXiang,
          label: lbl ? lbl.word : '中',
          // 用「化」而非箭头：→ (U+2192) 属箭头区，部分安卓字体缺字形
          change: `${y.gz}${y.qin} 变为 ${c.gz}${c.qin}（${y.qin} 化 ${c.qin}）`,
          jinTui: jt, huiTouKe, huiTouSheng, extra, qinHua: qh,
        });
        // 老阳老阴之辞
      });
      out.movingNotes = notes;
      // 《卜筮正宗》六亲变化歌：各动爻化出之六亲 summed
      if (qinHuaScore) {
        score += Math.max(-25, Math.min(25, qinHuaScore));
        out.qinHuaScore = qinHuaScore;
      }

      // ==== 《火珠林》独发易取、乱动难寻 ====
      //  「独发之爻旺相最急，休囚事慢」「六爻乱动事难明，须向宫中看用神」
      const yong0 = ysList.length ? ysList[0] : (out.fuShen ? { qin: rule.qin, wang: R.wangBySeason(out.fuShen.fu.wx, main.monthZhi) } : null);
      const df = R.duFaJudge(result.moving.length, result.moving.map(i => main.yaos[i].qin),
        yong0 ? yong0.qin : null, yong0 ? yong0.wang : null);
      if (df) {
        out.duFa = df;
        score += df.score;
        // 动爻专有断语（《卜筮正宗》五独发、《火珠林》子孙/兄弟/父母独发）
        if (result.moving.length === 1) {
          const solo = main.yaos[result.moving[0]].qin + '独发';
          if (R.DUFA_RULES[solo]) {
            out.duFaNote = R.DUFA_RULES[solo];
            score += solo === '子孙独发' ? 2 : solo === '父母独发' ? -4 : solo === '兄弟独发' ? -4 : 0;
          }
        }
      }
      // 变卦吉凶
      if (mean && mean.luck) {
        const luckMap = { '大吉': 30, '吉': 18, '平': 0, '小凶': -18, '凶': -28 };
        score += (luckMap[mean.luck] || 0) * 0.5;
      }
    } else {
      out.movingNotes = [];
      out.noMoving = '六爻安静，无变爻，事态平稳无波，以本卦卦象与用神旺衰直断即可。';
    }

    // --- 卦象吉凶 ---
    if (mean) {
      const luckMap = { '大吉': 30, '吉': 18, '平': 0, '小凶': -18, '凶': -28 };
      score += luckMap[mean.luck] || 0;
      out.mean = mean;
    }

    // ==== 卦体格局：六冲 / 六合 / 反伏 / 卦身 / 三合 ====
    // 《增删卜易》六冲章：「冲者散也…占凶事宜于冲散、占吉事而不宜，必兼用神而言」
    // 《增删卜易》六合章：「卦逢六合…诸占皆以为吉…然必用神有气相宜，用若失陷无益」
    const guaGe = [];
    if (main.isChong) {
      guaGe.push('六冲卦');
      // 吉事逢冲不宜，凶事逢冲为宜
      const yongQin = rule.qin;
      const yongOk = ysList.some(y => y.wang === '旺' || y.wang === '相');
      if (yongOk) { score -= 6; guaGe.push('六冲卦：用神旺相，虽冲不破，然吉事冲之则散，仍须防散'); }
      else { score -= 12; guaGe.push('六冲卦：用神失陷，冲之凶而又凶，散局之象'); }
      // 六冲变六合 / 六合变六冲
      if (changed) {
        if (changed.isHe) { score += 14; guaGe.push('六冲变六合：散而复聚、离而必合，此为吉象（占官非盗贼则相反）'); }
        else if (changed.isChong) { score -= 10; guaGe.push('六冲变六冲：有人解散之象，多主不成'); }
      }
    }
    if (main.isHe) {
      guaGe.push('六合卦');
      const yongOk = ysList.some(y => y.wang === '旺' || y.wang === '相');
      if (yongOk) { score += 12; guaGe.push('六合卦：用神有气而逢六合，万事若得三六合，诸事必得久远'); }
      else { score += 2; guaGe.push('六合卦：卦虽合而用神失陷，合不终合，须待用神出空得力'); }
      if (changed && changed.isChong) { score -= 16; guaGe.push('六合变六冲：先合后离、先亲后疏，得而复失'); }
    }
    // 反伏吟：卦画层依《增删卜易》反伏章；伏吟与爻之反吟依《卜筮正宗》定例（以纳甲地支为判据）
    const ff2 = R.fanFu(main.bits, changed ? changed.bits : null,
      main.yaos.map(y => ({ zhi: y.zhi })), changed ? changed.yaos.map(y => ({ zhi: y.zhi })) : null);
    if (ff2) {
      out.fanFu = ff2;
      if (ff2.type === '反伏') { score -= 10; guaGe.push('反伏卦：' + ff2.note); }
      else if (ff2.type === '爻之反吟') { score -= 5; guaGe.push('爻之反吟：' + ff2.note); }
      else { score -= 6; guaGe.push('伏吟卦：' + ff2.note); }
    }
    // 卦之反吟（《卜筮正宗》反吟卦定例第十一）：八卦相冲四组，或内/外卦单反
    if (changed) {
      const gy = R.guaFanYin(h.lower, h.upper, changed.hex.lower, changed.hex.upper);
      if (gy) {
        out.guaFanYin = gy;
        score -= 8;
        guaGe.push(gy.note);
      }
    }
    // 卦身（安月卦身诀）
    if (main.guaShen) {
      out.guaShen = main.guaShen;
      if (main.guaShen.pos != null) {
        const gsYao = main.yaos[main.guaShen.holder];
        // 卦身受伤有三源：卦身爻自身发动、或月破、或真空；另有他爻动而克卦身者，亦为受制
        const gsSelfBad = gsYao.isMoving || gsYao.monthPo || (gsYao.kong && gsYao.kongJudge && gsYao.kongJudge.zhen);
        const gsKe = main.yaos.some(y => y.isMoving && relation(y.wx, gsYao.wx) === 'ke');
        if (gsSelfBad || gsKe) {
          score -= 8;
          guaGe.push('卦身受伤：' + main.guaShen.note
            + (gsKe ? '；又有动爻来克卦身' : '') + '——事有阻隔，须防有人从中作梗');
        } else { score += 4; guaGe.push('卦身得安：' + main.guaShen.note); }
      } else {
        score -= 4; guaGe.push('卦身不上卦：' + main.guaShen.note);
      }
    }
    // 三合局
    if (main.sanHe) {
      out.sanHe = main.sanHe;
      guaGe.push(main.sanHe.note + (main.anyMoving ? '（有动爻，成局更实）' : '（无动爻，谓之虚三待用，须待日后补凑）'));
      if (main.anyMoving) score += 5;
    }

    // ==== 《卜筮正宗》合处逢冲 / 冲中逢合论第十五 ====
    //  「合处逢冲，谋虽成而终散；冲中逢合，事已散而复成」
    if (ysList.length) {
      const y0z = ysList[0].zhi;
      const hc = R.heChuFengChong({
        mainIsHe: main.isHe, changedIsChong: !!(changed && changed.isChong),
        dayChongYong: !!(main.dayZhi && CHONG[main.dayZhi] === y0z && main.isHe),
        dayHeYong: !!(main.dayZhi && HE[main.dayZhi] === y0z && !main.isHe),
      });
      if (hc.length) {
        out.heChuChong = hc;
        hc.forEach(t => {
          guaGe.push(t);
          if (/终散/.test(t)) score -= 8; else if (/复成/.test(t)) score += 8;
        });
      }
    }

    // ==== 独发乱动入卦体（提示性质，不重复计分）====
    if (out.duFa) guaGe.push('动静之象：' + out.duFa.key + '——' + out.duFa.note.split('；')[0]);
    if (out.duFaNote) guaGe.push(out.duFaNote);

    // ==== 《卜筮正宗》八宫诸物 / 诸身（取象，供参看）====
    out.guaWu = { lower: R.guaWu(h.lower), upper: R.guaWu(h.upper), ti: R.guaShenTi(h.lower) + '、' + R.guaShenTi(h.upper) };

    // ==== 神煞：依《卜筮正宗》「神煞休将定吉凶」，只列出不入分 ====
    if (main.dayZhi) {
      out.shenSha = R.shenSha(main.dayGZ && main.dayGZ[0], main.dayZhi, main.yaos.map(y => y.zhi));
    }
    out.shenShaNote = R.SHEN_SHA_NOTE;

    out.guaGe = guaGe;

    // --- 汇总评分与结论 ---
    score = Math.max(-100, Math.min(100, Math.round(score)));
    out.score = score;
    let verdict, advice;
    if (score >= 55) { verdict = '大吉'; advice = '卦象有力，用神得生旺，世应相得，事情顺遂，可以积极推进。'; }
    else if (score >= 20) { verdict = '吉'; advice = '整体向好，虽有小的波折但大体如意，稳步推进、量力而行即可。'; }
    else if (score > -20) { verdict = '平'; advice = '吉凶参半，成败在人，宜守中持正、静观其变，不宜冒进亦不必放弃。'; }
    else if (score > -55) { verdict = '小凶'; advice = '卦象有阻，用神失力或受克，宜暂缓、宜退守，宜调整策略后再谋。'; }
    else { verdict = '凶'; advice = '卦象不利，用神空破受克，世应相违，宜避免强争，宜静待时转。'; }
    out.verdict = verdict;
    out.advice = advice;
    // 断语附加卦体关键提示（最多两条，避免正文冗长）
    const geHint = guaGe.filter(g => /六冲变六合|六合变六冲|卦身受伤|反伏/.test(g)).slice(0, 2).join('；');
    out.summary = `本卦【${h.name}】${h.palace}宫${h.palaceType}，所问「${out.topic}」以${rule.qin}为用神。${ysNotes[0] && typeof ysNotes[0] === 'string' ? ysNotes[0] : ''}${shiyingNote ? ' ' + shiyingNote + '。' : ''}${geHint ? geHint + '。' : ''}${advice}`;

    return out;
  }

  globalThis.LiuYaoEngine = {
    tossCoins, buildHexagram, fullDivine, arrange, interpret,
    huGu, cuoGu, zongGu, getDayGanZhi, xunKongOf,
    findShort, WX_COLOR, LIU_QIN, LIU_SHEN, YONGSHEN_RULES,
    BY_BITS, MEAN_BY_SHORT, LABEL_MAP, ZHI_WX, GAN_WX, SHENG, KE, relation,
    CHONG, findFuShen,
  };
})();

// ===== 小程序适配：CommonJS 环境（Node 测试）导出；小程序无 module则跳过 =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof LiuYaoEngine !== 'undefined' && LiuYaoEngine) || globalThis.LiuYaoEngine;
}
