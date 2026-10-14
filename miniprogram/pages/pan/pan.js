// 排盘页
// 移植要点：
//  1. Web 版 pan.js 靠 innerHTML 拼字符串；小程序无 DOM，改为「JS 组装数据对象 → setData → WXML 渲染」
//  2. 所有规则取自 rules.js（guaWu / liuChongDetail / fanFu / guaFanYin / jieQiOf 等），未改一行判据
//  3. 卦盘六爻自上而下排列：上爻 → 初爻
const app = getApp();
const E = app.globalData.engine();
const R = app.globalData.rules();

const POS_CN = ['初', '二', '三', '四', '五', '上'];

/** 卦辞去掉「卦名：」前缀（乾为天之卦辞作「乾：元亨」） */
function stripName(text, name) {
  if (!text) return '';
  const short = E.findShort(name);
  return text.replace(new RegExp('^' + (short || name) + '\\s*[：:]\\s*'), '');
}

/**
 * 装卦并组装排盘数据。
 * @param {Array} results 六次抛爻结果（results[0] 为初爻）
 * @param {string} topic  所问类别（用于神煞参看）
 * @param {Date}   date   起卦时刻（定日辰月建）
 */
function buildPanData(results, topic, date) {
  const result = E.fullDivine(results, date || new Date());
  const { main, changed, hasMoving } = result;
  const h = main.hex;

  // ---- 卦名头 ----
  const shiYao = main.yaos[main.shiIdx];
  const yingYao = main.yaos[main.yingIdx];
  const head = {
    symbol: h.symbol,
    name: h.name,
    sub: `${h.palace}宫 · ${h.palaceType} · 属${h.palaceElem}`,
    upper: `上卦 ${h.upper}（${h.upperNature}·${h.upperElem}）`,
    lower: `下卦 ${h.lower}（${h.lowerNature}·${h.lowerElem}）`,
    shi: `世 ${main.shiIdx + 1}爻 ${shiYao ? shiYao.gz : ''}`,
    ying: `应 ${main.yingIdx + 1}爻 ${yingYao ? yingYao.gz : ''}`,
    guaCi: stripName(h.guaCi, h.name),
    daXiang: h.daXiang,
  };

  // ---- 六爻表（自上而下） ----
  const rows = [];
  for (let i = 5; i >= 0; i--) {
    const y = main.yaos[i];
    const c = changed ? changed.yaos[i] : null;
    const wxc = E.WX_COLOR[y.wx] || '#a89880';

    // 旺衰休囚
    const stateTags = [{ t: y.wang || '休', c: y.wang || '休' }];
    // 旬空：按《增删卜易》旬空章分真空/假空
    if (y.kong) {
      const kj = y.kongJudge;
      stateTags.push({ t: kj && kj.zhen ? '真空' : '假空', c: kj && kj.zhen ? '真空' : '假空' });
    }
    if (y.monthPo) stateTags.push({ t: '月破', c: '月破' });
    if (y.dayChong) stateTags.push({ t: '日冲', c: '日冲' });
    // 暗动：静爻旺相而被日辰冲
    if (y.anDong && y.anDong.type === '暗动') stateTags.push({ t: '暗动', c: '暗动' });
    if (y.sanHe) stateTags.push({ t: '合' + y.sanHe, c: '休' });

    // 动爻化进神/退神、回头生克
    let cTag = '';
    if (c) {
      const jt = R.jinTui(y.zhi, c.zhi);
      if (jt === 'jin') cTag = '化进神';
      else if (jt === 'tui') cTag = '化退神';
      else {
        const back = R.rel(c.wx, y.wx);
        if (back === 'sheng') cTag = '回头生';
        else if (back === 'ke') cTag = '回头克';
      }
    }

    rows.push({
      pos: POS_CN[i] + '爻',
      shen: y.shen.name,
      shenColor: y.shen.color,
      yang: y.yang,
      moving: y.isMoving,
      sy: y.isShi ? '世' : (y.isYing ? '应' : ''),
      syType: y.isShi ? 'shi' : (y.isYing ? 'ying' : ''),
      qin: y.qin,
      gz: y.gz,
      gzColor: wxc,
      cg: c ? c.gz : '',
      cgColor: c ? (E.WX_COLOR[c.wx] || '#a89880') : '',
      cgQin: c ? c.qin : '',
      cTag,
      states: stateTags,
      yaoCi: y.yaoCi || '',
      xiaoXiang: y.xiaoXiang || '',
    });
  }

  // ---- 变卦 ----
  const changedInfo = changed ? {
    title: `${changed.hex.symbol} ${changed.hex.name}`,
    sub: `${changed.hex.palace}宫 · ${changed.hex.palaceType}`,
    guaCi: stripName(changed.hex.guaCi, changed.hex.name),
  } : null;

  // ---- 互错综 ----
  const hg = E.BY_BITS[E.huGu(main.bits)];
  const cg = E.BY_BITS[E.cuoGu(main.bits)];
  const zg = E.BY_BITS[E.zongGu(main.bits)];
  const related = [
    { k: '互卦', v: hg ? hg.name : '—' },
    { k: '错卦', v: cg ? cg.name : '—' },
    { k: '综卦', v: zg ? zg.name : '—' },
  ];

  // ---- 月建日辰旬空（缺失显示「未取」，不臆造） ----
  const jq = main.monthZhi ? R.jieQiOf(main.monthZhi) : null;
  const season = main.monthZhi ? R.SEASON_OF_ZHI[main.monthZhi] : null;
  const meta = [
    { k: '月建', v: (main.monthZhi || '未取') + (main.monthWx ? `（${main.monthWx}）` : '') + (jq ? ` · ${jq}后` : '') + (season ? ` · ${season}令` : '') },
    { k: '日辰', v: (main.dayGZ || '未取') + (main.dayWx ? `（${main.dayWx}）` : '') },
    { k: '旬空', v: main.kong.length ? main.kong.join('、') : '未取' },
  ];
  const noDay = !main.monthZhi;

  // ---- 取象（《卜筮正宗》八宫诸物/诸身，只作参看） ----
  let xiang = null;
  if (h.lower && h.upper) {
    const wl = R.guaWu(h.lower), wu = R.guaWu(h.upper);
    const tl = R.guaShenTi(h.lower), tu = R.guaShenTi(h.upper);
    if (wl || wu || tl || tu) {
      xiang = [
        `外卦${h.upper}为${wu || '—'}、${tu || '—'}（形）`,
        `内卦${h.lower}为${wl || '—'}、${tl || '—'}（性）`,
      ];
    }
  }

  // ---- 卦体格局（《增删卜易》卦体章） ----
  const geTags = [];
  if (main.isChong) geTags.push({ t: '六冲卦', d: R.CHONG_NOTE });
  if (main.isHe) geTags.push({ t: '六合卦', d: '卦逢六合：内外六爻三组地支两两相合。凡事若得三六合，诸事必得久远' });
  const najiaLite = main.yaos.map(y => ({ zhi: y.zhi, wx: y.wx, gz: y.gz, qin: y.qin }));
  const cd = R.liuChongDetail(najiaLite), hd = R.liuHeDetail(najiaLite);
  if (!main.isChong && cd.count) geTags.push({ t: `冲${cd.count}组`, d: '仅部分爻位相冲，不成六冲卦。冲而不全，散而未散' });
  if (!main.isHe && hd.count) geTags.push({ t: `合${hd.count}组`, d: '仅部分爻位相合，不成六合卦' });
  if (changed && main.isChong && changed.isHe) geTags.push({ t: '六冲变六合', d: R.CHONG_HE_NOTE });
  if (changed && main.isHe && changed.isChong) geTags.push({ t: '六合变六冲', d: R.HE_CHONG_NOTE });
  // 反伏吟
  const ff2 = R.fanFu(main.bits, changed ? changed.bits : null,
    main.yaos.map(y => ({ zhi: y.zhi })), changed ? changed.yaos.map(y => ({ zhi: y.zhi })) : null);
  if (ff2) {
    geTags.push({
      t: ff2.type + (ff2.guaScope === '内外卦' || !ff2.guaScope ? '卦' : '之' + ff2.guaScope + '伏吟'),
      d: ff2.note,
    });
  }
  // 卦之反吟
  if (changed) {
    const gy = R.guaFanYin(main.hex.lower, main.hex.upper, changed.hex.lower, changed.hex.upper);
    if (gy) geTags.push({ t: gy.kind || gy.type, d: gy.note });
  }
  // 卦身
  if (main.guaShen) {
    const gs = main.guaShen;
    if (gs.pos == null) {
      geTags.push({ t: '卦身不上卦', d: gs.note });
    } else {
      const gsYao = main.yaos[gs.pos - 1];
      const gsBad = !gsYao || gsYao.isMoving || gsYao.monthPo || (gsYao.kong && gsYao.kongJudge && gsYao.kongJudge.zhen);
      const gsKe = gsYao && main.yaos.some(y => y.isMoving && R.rel(y.wx, gsYao.wx) === 'ke');
      geTags.push({
        t: (gsBad || gsKe) ? '卦身受伤' : '卦身得安',
        d: gs.note + ((gsBad || gsKe) ? '——卦身或动、或破、或真空，另有动爻来克亦为受制，事有阻隔' : '——卦身安稳，事有根底'),
      });
    }
  }
  // 三合局
  if (main.sanHe) {
    geTags.push({
      t: '三合' + main.sanHe.wx + '局',
      d: main.sanHe.note + (main.anyMoving ? '（有动爻，成局更实）' : '（无动爻，谓之虚三待用）'),
    });
  }

  // ---- 神煞（只作参看，不入吉凶） ----
  const interp = E.interpret(result, topic || '综合');
  const shenSha = (interp.shenSha || []).map(s => ({
    name: s.name, zhi: s.zhi, note: s.note,
  }));

  return {
    head,
    rows,
    changedInfo,
    related,
    meta,
    noDay,
    xiang,
    geTags,
    shenSha,
    shenShaNote: interp.shenShaNote || '',
  };
}

Page({
  data: {
    ready: false,
    topic: '综合',
    head: null,
    rows: [],
    changedInfo: null,
    related: [],
    meta: [],
    noDay: false,
    xiang: null,
    geTags: [],
    shenSha: [],
    shenShaNote: '',
  },

  onLoad(query) {
    const results = getApp().globalData.lastResults;
    if (!results || results.length < 6) {
      wx.showToast({ title: '尚无卦象，请先起卦', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    const topic = query.topic || getApp().globalData.topic || '综合';
    try {
      const pan = buildPanData(results, topic, getApp().globalData.divineDate);
      this.setData(Object.assign({ ready: true, topic }, pan));
    } catch (e) {
      wx.showModal({
        title: '排盘失败',
        content: String(e && e.message ? e.message : e),
        showCancel: false,
      });
    }
  },

  onGoInterpret() {
    wx.navigateTo({ url: '/pages/interpret/interpret?topic=' + encodeURIComponent(this.data.topic) });
  },

  onGoDivine() {
    wx.redirectTo({ url: '/pages/divine/divine' });
  },
});

// 供测试与复用：导出数据组装函数（小程序支持 CommonJS）
module.exports = { buildPanData };
