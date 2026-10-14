// 起卦页
// 移植要点：
//  1. 无 DOM —— 用 data + setData 驱动，动画靠 class 切换
//  2. 引擎/规则从 globalThis 取（小程序无 window）
//  3. 抛爻、装卦、解卦全部复用 Web 版算法层，未改一行逻辑
const app = getApp();
const E = app.globalData.engine();
const R = app.globalData.rules();

// 起卦页与排盘/解卦页通过 globalData 传递卦例
function saveState(results, topicIndex) {
  const g = app.globalData;
  const idx = topicIndex || 0;
  g.lastResults = results;
  g.divineDate = new Date();
  g.topicIndex = idx;
  g.topics = TOPICS;
  g.topic = (TOPICS[idx] || TOPICS[0]).key;
}

const TOPICS = [
  { key: '综合', label: '综合运势（看世应）' },
  { key: '财运', label: '财运 · 求财' },
  { key: '事业', label: '事业 · 功名' },
  { key: '工作', label: '求职 · 工作' },
  { key: '婚恋', label: '婚恋（男占女）' },
  { key: '感情', label: '感情（女占男）' },
  { key: '学业', label: '学业 · 考试' },
  { key: '疾病', label: '疾病 · 健康' },
  { key: '出行', label: '出行 · 行人' },
  { key: '寻物', label: '寻物 · 失物' },
  { key: '官非', label: '官司 · 是非' },
  { key: '房产', label: '房产 · 契券' },
  { key: '子女', label: '子女 · 后代' },
  { key: '合作', label: '合作 · 合伙' },
];

// 动画节奏（毫秒）：与 Web 版一致
const PACE = {
  slow: { shake: 280, toss: 900, gap: 120 },
  fast: { shake: 110, toss: 380, gap: 50 },
};

const POS_CN = ['初', '二', '三', '四', '五', '上'];
const COIN_CN = ['一', '二', '三'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

Page({
  data: {
    topics: TOPICS,
    topicIndex: 0,
    shellImg: '/assets/shell.png',
    coins: [
      { i: 0, cn: COIN_CN[0], img: '/assets/coin-0.png', show: false },
      { i: 1, cn: COIN_CN[1], img: '/assets/coin-1.png', show: false },
      { i: 2, cn: COIN_CN[2], img: '/assets/coin-2.png', show: false },
    ],
    yaos: [],
    lastYao: '',
    status: '龟壳已备，铜钱在手。',
    tossing: false,
    shaking: false,
    finished: false,
    tossBtnText: '摇第 1 爻',
    result: null,
  },

  // 内部状态（不进 setData，避免无谓渲染）
  results: [],
  _busy: false,

  onLoad() {
    this.resetYaos();
  },

  /** 初始化六爻进度条（自上而下：上爻→初爻，与卦画顺序一致） */
  resetYaos() {
    const yaos = [];
    for (let i = 5; i >= 0; i--) {
      yaos.push({ pos: i + 1, yang: true, moving: false, mark: '', label: '待摇' });
    }
    this.setData({ yaos });
  },

  onTopicChange(e) {
    this.setData({ topicIndex: Number(e.detail.value) });
  },

  // ============ 摇一爻 ============
  async onTossOne() {
    if (this._busy) return;
    if (this.data.finished) { this.onReset(); return; }
    this._busy = true;
    this.setData({ tossing: true });

    const cur = this.results.length + 1;
    this.setData({ status: `摇第 ${cur} 爻… 三枚铜钱入龟壳，轻摇三下…` });

    // 摇三下
    for (let k = 0; k < 3; k++) {
      this.setData({ shaking: true });
      await sleep(PACE.slow.shake);
      this.setData({ shaking: false });
    }

    // 抛三枚
    const result = E.tossCoins();
    const coins = this.data.coins.map((c, i) => ({ ...c, show: result.coins[i] === 0 }));
    this.setData({ coins, tossing: true });
    await sleep(PACE.slow.toss);

    this.applyResult(result, PACE.slow);
    this._busy = false;
  },

  /** 自动完成六爻（走快档） */
  async onAutoFull() {
    if (this._busy) return;
    this._busy = true;
    this.setData({ tossing: true });

    while (this.results.length < 6) {
      const cur = this.results.length + 1;
      this.setData({ status: `自动摇第 ${cur} 爻…` });

      for (let k = 0; k < 3; k++) {
        this.setData({ shaking: true });
        await sleep(PACE.fast.shake);
        this.setData({ shaking: false });
      }
      const result = E.tossCoins();
      const coins = this.data.coins.map((c, i) => ({ ...c, show: result.coins[i] === 0 }));
      this.setData({ coins, tossing: true });
      await sleep(PACE.fast.toss);
      await sleep(PACE.fast.gap);

      this.applyResult(result, PACE.fast, true);
    }

    this.setData({ tossing: false, finished: true, tossBtnText: '已成卦 · 重新起卦' });
    this._busy = false;
  },

  /** 落一爻：更新进度条、状态文案，判断是否成卦 */
  applyResult(result, pace, silent) {
    this.results.push(result);

    // 进度条：results[0] 是初爻，UI 自上而下为上爻→初爻
    const yaos = [];
    for (let i = 5; i >= 0; i--) {
      const r = this.results[i];
      yaos.push(r
        ? { pos: i + 1, yang: r.yang, moving: r.moving, mark: r.mark, label: `${r.label}（${r.sum}）` }
        : { pos: i + 1, yang: true, moving: false, mark: '', label: '待摇' });
    }
    this.setData({ yaos });

    const coinText = result.coins
      .map((c, i) => `第${COIN_CN[i]}枚${c ? '字' : '背'}`)
      .join('、');
    const lastYao = `得${result.label}（${result.sum}）· ${coinText}${result.moving ? ' · 动爻' : ''}`;
    this.setData({ lastYao });

    if (this.results.length >= 6) {
      this.setData({
        finished: true,
        tossing: false,
        tossBtnText: '重新起卦',
        status: '六爻已成卦！',
      });
      this.buildResult();
    } else if (!silent) {
      this.setData({
        tossBtnText: `摇第 ${this.results.length + 1} 爻`,
        status: `${lastYao}。可继续摇下一爻，或点「自动完成六爻」。`,
      });
    }
  },

  /** 成卦后用引擎装卦，产出卦象摘要，并把卦例存入全局供排盘/解卦页取用 */
  buildResult() {
    try {
      const full = E.fullDivine(this.results, new Date());
      const main = full.main;
      const h = main.hex;
      const yaos = [];
      for (let i = 5; i >= 0; i--) {
        const y = main.yaos[i];
        yaos.push({
          pos: i + 1,
          yang: y.yang,
          gz: y.gz,
          qin: y.qin,
          shiying: y.pos === h.shi ? '世' : (y.pos === h.ying ? '应' : ''),
        });
      }
      saveState(this.results, this.data.topicIndex);
      this.setData({
        result: {
          hexName: h.name,
          palace: `${h.palace}宫`,
          palaceType: h.palaceType,
          changedName: full.hasMoving && full.changed ? full.changed.hex.name : '',
          yaos,
        },
      });
    } catch (e) {
      wx.showToast({ title: '装卦失败：' + e.message, icon: 'none', duration: 3000 });
    }
  },

  onGoPan() {
    if (!app.globalData.lastResults) {
      wx.showToast({ title: '请先完成六爻', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/pan/pan?topic=' + encodeURIComponent(app.globalData.topic || '综合'),
    });
  },

  onReset() {
    this._busy = false;
    this.results = [];
    this.resetYaos();
    const g = app.globalData;
    g.lastResults = null;
    g.divineDate = null;
    this.setData({
      coins: this.data.coins.map((c) => ({ ...c, show: false })),
      lastYao: '',
      status: '龟壳已备，铜钱在手。',
      tossing: false,
      shaking: false,
      finished: false,
      tossBtnText: '摇第 1 爻',
      result: null,
    });
  },
});
