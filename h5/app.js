/* 六爻 pro · H5 共享运行时
 * ------------------------------------------------------------------
 * 纯静态站点：无后端、无数据库，三页之间靠 sessionStorage 传卦例数据。
 * 算法层（vendor/）原样复用，未改一行判据。
 *
 * 启动顺序不可颠倒：
 *   core-data → meaning-data → yao-labels → lunar → rules → engine
 * 因为 rules.js 顶层要读 globalThis.ZHI_WUXING，engine.js 顶层要读 globalThis.Lunar。
 *
 * 错误可见化：任何启动期/运行期异常都显示在页面顶部的红色条里，不留一片黑。
 */
(function () {
  'use strict';

  var KEY = 'liuyao-h5-state';

  var LY = {
    engine: function () { return globalThis.LiuYaoEngine; },
    rules: function () { return globalThis.LiuYaoRules; },

    /** 读取上次起卦结果（三页共享） */
    state: function () {
      try {
        var raw = sessionStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    /** 只存六爻结果与起卦时刻，不存 Date 之外的复杂对象 */
    save: function (results, divineDate) {
      try {
        sessionStorage.setItem(KEY, JSON.stringify({
          results: results,
          divineDate: divineDate ? divineDate.getTime() : Date.now(),
          topic: LY.topic,
        }));
      } catch (e) { /* 隐私模式下 sessionStorage 可能不可用，不影响主流程 */ }
    },

    topic: '综合',

    /** topic 只接受字符串；对象取 key，都不是则回落「综合」。
     *  不归一化的话，interpret() 会把对象写进 summary，
     *  页面上会出现「所问：[object Object]」。 */
    normalizeTopic: function (v) {
      if (typeof v === 'string' && v) return v;
      if (v && typeof v === 'object' && typeof v.key === 'string' && v.key) return v.key;
      return '综合';
    },

    /** 需要六爻才能进入的页面：无数据时跳回起卦页 */
    requireDivine: function () {
      var s = LY.state();
      if (!s || !s.results || s.results.length < 6) {
        location.replace('index.html');
        return null;
      }
      return {
        results: s.results,
        date: new Date(s.divineDate || Date.now()),
        topic: LY.normalizeTopic(s.topic),
      };
    },

    /** 显示错误条；err 可以是 Error 或字符串 */
    showError: function (err) {
      var msg = err && err.message ? err.message : String(err || '未知错误');
      var box = document.getElementById('boot-error');
      if (!box) {
        box = document.createElement('div');
        box.id = 'boot-error';
        box.className = 'boot-error';
        var page = document.querySelector('.page');
        if (page && page.firstChild) page.insertBefore(box, page.firstChild);
        else document.body.insertBefore(box, document.body.firstChild);
      }
      box.textContent = '运行异常：' + msg;
    },

    /** 自检：引擎/规则/基础数据是否就绪 */
    check: function () {
      if (!globalThis.LiuYaoEngine) return '引擎未加载，请检查 vendor 脚本是否全部就绪';
      if (typeof globalThis.LiuYaoEngine.fullDivine !== 'function') return '引擎已挂载但 fullDivine 不可用';
      if (!globalThis.LiuYaoRules) return '规则层未加载';
      if (!globalThis.ICORE || !globalThis.ICORE.length) return '基础卦象数据 ICORE 为空';
      return '';
    },

    /**
     * 主题色与卦象辅助
     */
    WX_COLOR: {
      金: '#d4af37', 木: '#4a9d5f', 水: '#3d7ea6', 火: '#c0392b', 土: '#b07d3f',
    },

    /** 六位二进制串 → 自上而下（上爻→初爻）的爻画数据，供 DOM 渲染 */
    bitsToLines: function (bits) {
      var out = [];
      for (var i = 5; i >= 0; i--) out.push({ key: 'l' + i, yang: bits[i] === '1' });
      return out;
    },

    /** 卦辞去掉「卦名：」前缀（乾为天作「乾：元亨」） */
    stripName: function (text, name) {
      if (!text) return '';
      var e = LY.engine();
      var short = e && e.findShort ? e.findShort(name) : '';
      var re = new RegExp('^' + (short || name) + '\\s*[：:]\\s*');
      return text.replace(re, '');
    },

    /** 渲染卦象小图（CSS 爻画，不用 U+4DC0 符号，安卓缺字形） */
    /** 卦象小图（六爻，自上而下：上爻 → 初爻）
     *  阴阳必须一眼可辨，所以阴爻的两段要真正断开：
     *  结构上 .gl-yin 自己就是 flex 容器，两段用 .gl-part；
     *  .gl-part 必须 flex:none，否则会被 flex 容器压扁贴死成整条。
     *  （之前 .gl-yin 挂在 .gl-seg 上再套 .gl-part，两层 flex 嵌套导致断口消失） */
    guaBox: function (bits) {
      var h = '<div class="gua-box">';
      for (var i = 5; i >= 0; i--) {
        if (bits[i] === '1') {
          h += '<div class="gl"><span class="gl-yang"></span></div>';
        } else {
          h += '<div class="gl"><span class="gl-yin">'
             + '<span class="gl-part"></span><span class="gl-part"></span></span></div>';
        }
      }
      return h + '</div>';
    },

    /** escape：所有插入 HTML 的用户/数据文本都要过一遍 */
    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    sleep: function (ms) {
      return new Promise(function (r) { setTimeout(r, ms); });
    },
  };

  globalThis.LY = LY;

  // 全局兜底：把未捕获异常显示到页面上，而不是只留在控制台
  window.addEventListener('error', function (e) {
    LY.showError((e && e.error) || (e && e.message) || '脚本错误');
  });
  window.addEventListener('unhandledrejection', function (e) {
    LY.showError((e && e.reason && e.reason.message) || e.reason || 'Promise 拒绝');
  });
})();
