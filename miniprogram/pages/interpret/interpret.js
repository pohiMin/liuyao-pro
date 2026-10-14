// 解卦页
// 移植要点：
//  1. Web 版 pan.js 的 renderInterpret 用 innerHTML 拼串；此处改为组装数据对象 → setData
//  2. 判据全部来自 engine.interpret()，未改一行逻辑
//  3. 断语措辞按平台合规要求作中性化处理（「仅供文化研究与自我省思参考」）
const app = getApp();
const E = app.globalData.engine();

const POS_CN = ['初', '二', '三', '四', '五', '上'];

/** 吉凶 → 样式类（沿用 Web 版 v-* 命名） */
const VERDICT_CLASS = {
  '大吉': 'v-daji',
  '吉': 'v-ji',
  '平': 'v-ping',
  '小凶': 'v-xiaoxiong',
  '凶': 'v-xiong',
};

/** 吉凶 → 标签配色类（动爻详参用） */
const LABEL_CLASS = { '吉': 'lbl-ji', '中': 'lbl-zhong', '凶': 'lbl-xiong' };

/**
 * 组装解卦数据。
 * @param {Array} results 六次抛爻结果
 * @param {string} topic  所问类别
 * @param {Date}   date   起卦时刻
 */
function buildInterpretData(results, topic, date) {
  const result = E.fullDivine(results, date || new Date());
  const r = E.interpret(result, topic || '综合');

  // ---- 顶部：吉凶判定 + 指数条 ----
  const scorePct = Math.max(0, Math.min(100, (r.score + 100) / 2));
  const top = {
    verdict: r.verdict,
    verdictClass: VERDICT_CLASS[r.verdict] || 'v-ping',
    topic: r.topic,
    score: r.score,
    scoreText: (r.score > 0 ? '+' : '') + r.score,
    scorePct: scorePct,
  };

  // ---- 用神取用 ----
  const yongshen = {
    desc: r.yongshen.desc,
    list: (r.yongList || []).map(y => ({
      text: `第${y.pos}爻 ${y.gz} ${y.qin}（${y.wx}）— ${y.wang}`
        + (y.isMoving ? '·动爻' : '') + (y.isShi ? '·临世' : '') + (y.isYing ? '·临应' : ''),
    })),
    empty: !(r.yongList && r.yongList.length),
    notes: (r.ysNotes || [])
      .filter(n => typeof n === 'object')
      .map(n => ({ gz: n.gz, qin: n.qin, text: n.notes.join('；') })),
  };

  // ---- 世应 ----
  const shiying = {
    line: `世爻 ${r.shiying.shi}（${r.shiying.shiWuxing}） · 应爻 ${r.shiying.ying}（${r.shiying.yingWuxing}）`,
    note: r.shiying.note,
    rule: r.shiRule ? { qin: r.shiRule.qin, note: r.shiRule.note } : null,
  };

  // ---- 飞伏神 ----
  const fuShen = r.fuShen ? {
    summary: r.fuShen.summary,
    fei: `${r.fuShen.fei.gz} ${r.fuShen.fei.qin}（${r.fuShen.fei.wx}）`,
    fu: `${r.fuShen.fu.gz} ${r.fuShen.fu.qin}（${r.fuShen.fu.wx}）· 伏于第${r.fuShen.fu.pos}爻`,
    usable: r.fuShen.usable,
    usableText: r.fuShen.usable ? '伏神有力，尚可得用' : '伏神无力，终不得出',
    qi: r.fuShen.qi ? {
      title: r.fuShen.qi.title,
      note: r.fuShen.qi.note,
      need: r.fuShen.qi.need,
      level: r.fuShen.qi.level === '强' ? '情重' : (r.fuShen.qi.level === '中' ? '情中等' : '情轻'),
    } : null,
    up: (r.fuShen.up || []).slice(),
    down: (r.fuShen.down || []).slice(),
  } : null;

  // ---- 元神忌神仇神 ----
  const yuanJiChou = r.yuanJiChou ? {
    yuan: r.yuanJiChou.yuan,
    ji: r.yuanJiChou.ji,
    chou: r.yuanJiChou.chou,
    rule: r.yuanJiChou.rule + (r.yuanJiChou.isFu ? '（用神伏藏，此处依伏神五行而论）' : ''),
    yuanNotes: (r.yuanJiChou.yuanNotes || []).slice(),
    jiNotes: (r.yuanJiChou.jiNotes || []).slice(),
    chouNotes: r.yuanJiChou.chouNotes || '',
  } : null;

  // ---- 卦体格局 ----
  const guaGe = (r.guaGe || []).slice();

  // ---- 动爻详参 ----
  const moving = (r.movingNotes || []).map(m => ({
    title: `${POS_CN[m.pos - 1]}爻动`,
    label: m.label,
    labelClass: LABEL_CLASS[m.label] || 'lbl-zhong',
    change: m.change,
    yaoCi: m.yaoCi,
    xiaoXiang: m.xiaoXiang || '',
  }));

  // ---- 卦象解读 ----
  const mean = r.mean ? {
    title: `卦象解读 · ${r.info.short}`,
    white: r.mean.white,
    career: r.mean.career,
    love: r.mean.love,
    health: r.mean.health,
  } : null;

  return {
    top,
    summary: r.summary,
    advice: r.advice,
    yongshen,
    shiying,
    fuShen,
    yuanJiChou,
    guaGe,
    moving,
    noMoving: r.noMoving || '',
    mean,
  };
}

Page({
  data: {
    ready: false,
    topic: '综合',
    topics: [],
    topicIndex: 0,
    top: null,
    summary: '',
    advice: '',
    yongshen: null,
    shiying: null,
    fuShen: null,
    yuanJiChou: null,
    guaGe: [],
    moving: [],
    noMoving: '',
    mean: null,
  },

  onLoad(query) {
    const g = getApp().globalData;
    if (!g.lastResults || g.lastResults.length < 6) {
      wx.showToast({ title: '尚无卦象，请先起卦', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    const topic = query.topic || g.topic || '综合';
    this.setData({
      topics: g.topics || [],
      topicIndex: g.topicIndex != null ? g.topicIndex : 0,
    });
    this.render(g.lastResults, topic);
  },

  /** 切换所问类别：重跑 interpret（用神随之改变，无需重起卦） */
  onTopicChange(e) {
    const idx = Number(e.detail.value);
    const g = getApp().globalData;
    const topic = (g.topics && g.topics[idx]) ? g.topics[idx].key : '综合';
    g.topicIndex = idx;
    g.topic = topic;
    this.setData({ topicIndex: idx, topic });
    this.render(g.lastResults, topic);
  },

  render(results, topic) {
    try {
      const data = buildInterpretData(results, topic, getApp().globalData.divineDate);
      this.setData(Object.assign({ ready: true }, data));
      wx.setNavigationBarTitle({ title: '解卦 · ' + topic });
    } catch (e) {
      wx.showModal({
        title: '解卦失败',
        content: String(e && e.message ? e.message : e),
        showCancel: false,
      });
    }
  },

  onGoPan() {
    wx.navigateBack();
  },

  onGoDivine() {
    wx.redirectTo({ url: '/pages/divine/divine' });
  },
});

// 供测试与复用：导出数据组装函数（小程序支持 CommonJS）
module.exports = { buildInterpretData };
