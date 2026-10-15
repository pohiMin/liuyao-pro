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

    /**
     * 话题下拉（A13「所问何事」）—— 自绘列表，不用原生 <select>。
     *
     * 为什么不用原生：原生下拉只能由「用户直接点 select 元素」这一个手势打开，
     * 脚本 sel.click() 打不开。项目曾用「显示隐藏 select + sel.click()」，
     * 结果起卦页和解卦页点了完全没反应，change 不触发，
     * LY.topic 永远停在「综合」——等于所有卦都按综合运势推，分类功能形同虚设。
     *
     * 自绘后交互自己兜：点外部关闭 / Esc / ↑↓ 移动 / Home·End /
     * 选中项滚动进可视区 / aria-expanded 与 aria-selected 同步。
     * document 级监听只在「打开期间」挂上、关闭时摘掉，
     * 否则解卦页每次 render() 重建下拉都会漏一批监听器。
     *
     * @param {HTMLElement} root 挂载容器，内部会被整块重建
     * @param {Array<{key:string,label:string}>} topics 选项
     * @param {string} value 初始 key，找不到则回落第一项
     * @param {function(string,string):void} onChange 选中后回调 (key, label)
     * @return {{setValue:function(string):void,destroy:function():void}|null}
     */
    topicSelect: function (root, topics, value, onChange) {
      if (!root || !topics || !topics.length) return null;

      var cur = 0;
      for (var i = 0; i < topics.length; i++) if (topics[i].key === value) { cur = i; break; }

      var h = '<div class="topic-sel dd-label" role="button" tabindex="0"'
            + ' aria-haspopup="listbox" aria-expanded="false">'
            + '<span class="dd-text">' + LY.esc(topics[cur].label) + '</span>'
            + '<span class="caret"></span></div>'
            + '<div class="dd-menu" role="listbox" hidden>';
      for (var j = 0; j < topics.length; j++) {
        h += '<div class="dd-opt" role="option" data-i="' + j + '" tabindex="-1"'
           + ' aria-selected="' + (j === cur ? 'true' : 'false') + '">'
           + LY.esc(topics[j].label) + '</div>';
      }
      root.innerHTML = h + '</div>';

      var label = root.querySelector('.dd-label');
      var text = root.querySelector('.dd-text');
      var menu = root.querySelector('.dd-menu');
      var opts = [].slice.call(root.querySelectorAll('.dd-opt'));

      function paint() {
        text.textContent = topics[cur].label;
        for (var n = 0; n < opts.length; n++) {
          opts[n].setAttribute('aria-selected', n === cur ? 'true' : 'false');
        }
      }
      function showOpt(o) {
        // scrollIntoView 在旧内核上不认 options 参数，会连页面一起滚，所以手工兜
        if (o && o.scrollIntoView) {
          try { o.scrollIntoView({ block: 'nearest' }); }
          catch (e) { o.scrollIntoView(); }
        }
      }
      function onDocClick() { close(); }
      function onDocKey(e) {
        if (menu.hidden) return;
        if (e.key === 'Escape') { close(); label.focus(); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          cur = (cur + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length;
          paint(); showOpt(opts[cur]); return;
        }
        if (e.key === 'Home' || e.key === 'End') {
          e.preventDefault();
          cur = (e.key === 'Home' ? 0 : opts.length - 1);
          paint(); showOpt(opts[cur]);
        }
      }
      function open() {
        menu.hidden = false;
        label.setAttribute('aria-expanded', 'true');
        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', onDocKey);
        showOpt(opts[cur]);
      }
      function close() {
        // 已经收起就别再摘监听器：解卦页每次 render() 都会重建下拉，
        // 无条件 removeEventListener 会让「挂/摘次数配平」这个不变量失效
        if (menu.hidden) return;
        menu.hidden = true;
        label.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', onDocClick);
        document.removeEventListener('keydown', onDocKey);
      }
      function toggle() { if (menu.hidden) open(); else close(); }
      function pick(n) {
        if (n < 0 || n >= opts.length) return;
        cur = n; paint(); close();
        if (onChange) onChange(topics[cur].key, topics[cur].label);
      }

      label.addEventListener('click', function (e) {
        e.stopPropagation();   // 不加这句，同一次点击会冒到 document 把刚开的菜单关掉
        toggle();
      });
      label.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault(); e.stopPropagation(); toggle();
        }
      });
      menu.addEventListener('click', function (e) {
        var o = e.target && e.target.closest ? e.target.closest('.dd-opt') : null;
        if (o) pick(parseInt(o.getAttribute('data-i'), 10));
      });

      return {
        setValue: function (k) {
          for (var n = 0; n < topics.length; n++) if (topics[n].key === k) { cur = n; paint(); return; }
        },
        destroy: function () { close(); root.innerHTML = ''; },
      };
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
