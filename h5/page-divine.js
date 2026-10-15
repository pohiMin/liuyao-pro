/* 六爻 pro · H5 起卦页
 * ------------------------------------------------------------------
 * 盘面严格复刻基准文件 _preview/CSS重画八卦盘-效果预览.html：
 *   卦序 = 后天（离南上·坤西南·兑西·乾西北·坎北下·艮东北·震东·巽东南）
 *   R = 88（爻画半径）  RL = 122（文字半径）—— 用户截图实测值，未改
 *   爻画初爻朝圆心，外侧为上爻
 *
 * 铜钱摇卦：真实乾隆通宝素材，三枚同时抛落 → 翻滚 → 落定，
 * 按背面（背）数量定爻：
 *   0背=老阴(动,阴) 1背=少阳 2背=少阴 3背=老阳(动,阳)
 * 三背为老阳（动爻），即三个字；这是传统「金钱卦」的判法。
 */
(function () {
  'use strict';

  var bootErr = LY.check();
  if (bootErr) LY.showError(bootErr);

  /* ---------- 后天八卦（文王八卦） ----------
     洛书数为九宫数：坎1 坤2 震3 巽4 乾6 兑7 艮8 离9
     对宫洛书数之和恒为 10：9+1、2+8、7+3、6+4 —— 先天圆图不成立，故用后天。 */
  var RING = [
    { k: '101', n: '离', dir: '南',   sym: '火', wx: '火', ls: '9' },
    { k: '000', n: '坤', dir: '西南', sym: '地', wx: '土', ls: '2' },
    { k: '110', n: '兑', dir: '西',   sym: '泽', wx: '金', ls: '7' },
    { k: '111', n: '乾', dir: '西北', sym: '天', wx: '金', ls: '6' },
    { k: '010', n: '坎', dir: '北',   sym: '水', wx: '水', ls: '1' },
    { k: '001', n: '艮', dir: '东北', sym: '山', wx: '土', ls: '8' },
    { k: '100', n: '震', dir: '东',   sym: '雷', wx: '木', ls: '3' },
    { k: '011', n: '巽', dir: '东南', sym: '风', wx: '木', ls: '4' },
  ];

  var R = 88;    // 爻画所在半径（基准实测，对应 300px 盘面）
  var RL = 122;  // 文字所在半径（基准实测）
  // 实际使用值随盘面缩放而变（fitDisc 已把系数写进 CSS 变量，这里同步 JS 侧）
  var SCALE = 1;
  function radii() {
    SCALE = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--s')) || 1;
    return { R: R * SCALE, RL: RL * SCALE };
  }

  var POS = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];

  /* 铜钱落点 —— 放在盘面下方的「中场」区，不放在盘内。

     为什么不放盘内（这是算过的，不是拍脑袋）：
       盘面三条带（实测）—— 太极外圈 46 / 爻画带 78~98 / 文字带 109~135
       爻画带与文字带之间只有 11px 间隙；卦位角缝（22.5°+45k）扣掉爻画
       自身的角半宽后只剩 ~11°，连 52px 的钱都塞不进去。
       「不压太极也不压爻画」的落点用穷举验证过：无解。
     所以按传统铜钱起卦的实际形态办 —— 钱在盘外场地上落定，
     盘面只负责呈现卦位与点亮，这样两者都不遮挡，还看得清钱面。 */
  var SPOTS = [[-64, 0], [0, 22], [64, 0]];

  var TOPICS = [
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

  var $ = function (id) { return document.getElementById(id); };
  var ring = $('ring'), labels = $('labels'), hex = $('hex');
  var rollBtn = $('roll'), resetBtn = $('reset'), st = $('st');
  var edge = $('edge'), reveal = $('reveal');
  var coins = [$('c0'), $('c1'), $('c2')];

  var yaos = [], busy = false;

  /* 铜钱 PNG 预解码
     2026-10-13 正面改成 PNG 素材后新增。94KB 的图如果在用户点「摇一爻」的
     当场才去解码，第一枚钱抛出时会掉帧 —— 位图解码是主线程活，
     CSS transition 已经开始跑了，解码却还没完成。
     所以在页面初始化时就 fetch + decode()，把活提前干完。
     decode() 不支持的老浏览器用 img.onload 兜底，两种都不阻塞后续逻辑。 */
  (function preloadCoin() {
    var img = coins[0] && coins[0].querySelector('.cf-face img');
    if (!img) return;
    var src = img.getAttribute('src');
    if (!src) return;
    var pre = new Image();
    pre.src = src;
    if (pre.decode) {
      pre.decode().catch(function () { /* 解码失败就留给正式加载时重试，不阻塞 */ });
    }
  })();

  /* 边缘动效已改为纯 CSS 动画（.edge 三层 + .oct-line::before 流光），
     不再用 requestAnimationFrame 手写旋转 —— CSS 动画跑在合成层，
     比每帧改 style.transform 更省电，且浏览器能自己做优化。
     摇卦时只需给 .edge 加 .roll 类，三层会自动提速并提亮。 */

  /* 盘面尺寸与缩放系数
     --disc-d：盘面直径。基准 300px；按视口在 268~340 之间取。
     --s：几何缩放系数 = disc-d / 300，所有 calc(基准px * var(--s)) 跟着它走。

     为什么必须缩放（CDP 实测 6 档真机视口）：
       固定 300px 时，360px 的安卓小屏上 .disc scrollWidth=334 > clientWidth=300，
       .panel 352>334 直接 CLIP，安卓小屏还横向溢出 4px。
     基准 300px 时 s=1，几何与基准完全一致 —— 已定的视觉效果不变。 */
  function fitDisc() {
    var vw = document.documentElement.clientWidth;
    /* 可用宽度 = 视口 − .page 左右padding(24) − .panel 左右padding(26) − .panel 边框(2)
       实测：360→310、375→325、390→340；比这更宽的屏封顶 340，避免盘面过大失真。 */
    var avail = vw - 24 - 26 - 2;
    var d = Math.max(268, Math.min(340, avail));
    var s = d / 300;
    document.documentElement.style.setProperty('--disc-d', d + 'px');
    document.documentElement.style.setProperty('--s', s.toFixed(4));
    return d;
  }
  fitDisc();
  // 旋转屏 / 窗口 resize / 软键盘弹出都可能改视口宽度。
  // 必须重建八卦环 —— 爻画与文字的半径在 JS 里算，不随 CSS 变量自动变。
  window.addEventListener('resize', function () {
    fitDisc();
    buildRing();
  });
  window.addEventListener('orientationchange', function () {
    setTimeout(function () { fitDisc(); buildRing(); }, 120);
  });

  /* ---------- 八卦环 ---------- */
  function buildRing() {
    var rad = radii();
    ring.innerHTML = '';
    labels.innerHTML = '';
    RING.forEach(function (g, i) {
      // 爻画：初爻朝圆心（由内向外 = 初→上）
      var gw = document.createElement('div');
      gw.className = 'gw';
      gw.dataset.i = i;
      gw.style.transform = 'translate(-50%,-50%) rotate(' + (i * 45) + 'deg) translateY(-' + rad.R + 'px)';
      for (var p = 2; p >= 0; p--) {
        var row = document.createElement('div');
        row.className = 'yl';
        if (g.k[p] === '1') {
          var b = document.createElement('div');
          b.className = 'yb y';
          row.appendChild(b);
        } else {
          for (var t = 0; t < 2; t++) {
            var b2 = document.createElement('div');
            b2.className = 'yb n';
            row.appendChild(b2);
          }
        }
        gw.appendChild(row);
      }
      ring.appendChild(gw);

      // 文字：随盘旋转（罗盘式，顶部朝外）
      var lb = document.createElement('div');
      lb.className = 'lbl';
      lb.dataset.i = i;
      lb.style.transform = 'translate(-50%,-50%) rotate(' + (i * 45) + 'deg) translateY(-' + rad.RL + 'px)';
      /* 方位标签：只留「卦名 + 方位」。
         原先是 '<b>南</b><i>西南 · 9</i>'（9 是洛书数），
         洛书数对起卦没有作用，去掉后方位文字可以更大更清晰。 */
      lb.innerHTML = '<b>' + g.n + '</b><i>' + g.dir + '</i>';
      labels.appendChild(lb);
    });
  }

  /* ---------- 构建六爻记录条 ---------- */
  function buildHex() {
    hex.innerHTML = '';
    POS.forEach(function (p) {
      var row = document.createElement('div');
      row.className = 'hx';
      var nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = p;
      var ln = document.createElement('div');
      ln.className = 'ln';
      var s = document.createElement('div');
      s.className = 'hs pending';
      s.style.width = '78px';
      ln.appendChild(s);
      var mk = document.createElement('div');
      mk.className = 'mk';
      row.appendChild(nm); row.appendChild(ln); row.appendChild(mk);
      hex.appendChild(row);
    });
  }

  function lightHex(i, y) {
    var row = hex.children[i];
    var ln = row.querySelector('.ln');
    ln.innerHTML = '';
    var segs;
    if (y.yang) {
      segs = [{ w: 78 }];
    } else {
      segs = [{ w: 35 }, { w: 35 }];
    }
    segs.forEach(function (sg) {
      var s = document.createElement('div');
      s.className = 'hs' + (y.mv ? ' mv' : ' on');
      s.style.width = sg.w + 'px';
      ln.appendChild(s);
    });
    // 动爻标记：圆点（阳动）/ 交叉线（阴动），用 CSS 画，不依赖字体字形
    row.querySelector('.mk').innerHTML = y.mv
      ? (y.yang ? '<span class="dot"></span>' : '<span class="cross"></span>')
      : '';
  }

  function idxOf(k3) {
    for (var i = 0; i < RING.length; i++) if (RING[i].k === k3) return i;
    return -1;
  }

  function pulseRing(i) {
    var gw = ring.children[i];
    if (!gw) return;
    gw.classList.add('pulse');
    setTimeout(function () { gw.classList.remove('pulse'); }, 700);
  }

  function hiRing(i) {
    if (i < 0) return;
    ring.children[i].classList.add('hi');
    labels.children[i].classList.add('hi');
  }

  function bits() {
    var lo = yaos.slice(0, 3).map(function (y) { return y.yang ? '1' : '0'; }).join('');
    var up = yaos.slice(3, 6).map(function (y) { return y.yang ? '1' : '0'; }).join('');
    return { lo: lo, up: up, all: lo + up };
  }

  /* ---------- 铜钱动画 ----------
     三枚钱：抛出 → 翻滚 → 落定。
     落定朝向由「背面数」决定：显示背面的那几枚 rotateY 到 180° 的整数倍。
     翻滚用 CSS transition 分段控制，不写帧动画（省电且不掉帧）。

     位移只由 transform 负责；.coin 已用 margin-left/top 把原点对到盘心，
     这里不要再叠加 translate(-50%,-50%)，否则会双重偏移。 */
  function throwCoins() {
    var backs = [0, 0, 0];
    coins.forEach(function (c, i) {
      var d = SPOTS[i];
      // 先关掉过渡再归位，否则会从上一轮的落点滑过来（而不是被抛出）
      c.style.transition = 'none';
      c.style.opacity = '0';
      // 抛出起点：目标点正上方 150px 处（从舞台顶部落向中场）
      c.style.transform = 'translate(' + (d[0] * 0.25) + 'px,' + (d[1] - 150) + 'px) scale(.72)';
      c.querySelector('.coin-flip').style.transition = 'none';
      c.querySelector('.coin-flip').style.transform = 'rotateY(0deg)';
      void c.offsetWidth;   // 强制回流，让 reset 生效
      backs[i] = Math.random() < 0.5 ? 1 : 0;
    });
    return backs;
  }

  function landCoins(backs) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    coins.forEach(function (c, i) {
      var d = SPOTS[i];
      // 落定：淡入 + 落到目标点 + 轻微超冲回落（cubic-bezier）
      c.style.transition = 'opacity 200ms, transform 620ms cubic-bezier(.25,1.5,.5,1)';
      c.style.opacity = '1';
      c.style.transform = 'translate(' + d[0] + 'px,' + d[1] + 'px) rotate(' + ((i * 137) % 360) + 'deg)';
      // 翻滚：旋转若干圈后停在正/背面
      var flip = c.querySelector('.coin-flip');
      var turns = reduce ? 1 : (2 + Math.floor(Math.random() * 2));
      // 背面朝上 → rotateY(180deg) 的奇数倍
      flip.style.transition = reduce ? 'none' : 'transform 780ms cubic-bezier(.2,.9,.3,1)';
      flip.style.transform = 'rotateY(' + (backs[i] ? 180 * turns : 360 * turns) + 'deg)';
    });
  }

  function hideCoins() {
    coins.forEach(function (c, i) {
      var d = SPOTS[i];
      c.style.transition = 'opacity 300ms, transform 300ms ease-in';
      c.style.opacity = '0';
      c.style.transform = 'translate(' + d[0] + 'px,' + (d[1] - 60) + 'px) scale(.7)';
    });
  }

  /* ---------- 摇一爻 ---------- */
  async function rollOne() {
    if (busy || yaos.length >= 6) return;
    busy = true;
    rollBtn.disabled = true;
    var idx = yaos.length;

    st.textContent = '摇第 ' + (idx + 1) + ' 爻… 三枚铜钱入盘，轻摇三下…';
    edge.classList.add('roll');       // 边缘三层提速 + 提亮
    pulseRing(idx % 8);              // 当前爻位脉冲提示

    await LY.sleep(620);

    var backs = throwCoins();
    await LY.sleep(120);
    landCoins(backs);

    // 判定爻象 —— 复用引擎 tossCoins 的判法，避免与算法层口径不一致：
    //   字为 3、背为 2，三枚之和 6=老阴(动阴) 7=少阳(静阳) 8=少阴(静阴) 9=老阳(动阳)
    // backs[i] = 1 表示该枚显示背面；对应字面为 3、背面为 2
    var sum = 0;
    for (var i = 0; i < 3; i++) sum += backs[i] ? 2 : 3;
    var y;
    if (sum === 6)      y = { yang: false, moving: true, mv: true, label: '老阴' };  // 三背
    else if (sum === 7) y = { yang: true,  moving: false, mv: false, label: '少阳' };// 三字
    else if (sum === 8) y = { yang: false, moving: false, mv: false, label: '少阴' };
    else                y = { yang: true,  moving: true, mv: true, label: '老阳' };
    var nBack = backs.filter(function (b) { return b; }).length;

    await LY.sleep(700);
    edge.classList.remove('roll');     // 边缘恢复常速

    yaos.push(y);
    lightHex(idx, y);
    if (navigator.vibrate) navigator.vibrate(18);

    // 三爻成下卦 → 点亮下卦位
    if (yaos.length === 3) {
      var b3 = bits();
      var gi = idxOf(b3.lo);
      hiRing(gi);
      st.textContent = '下卦成：' + RING[gi].n + '（' + RING[gi].dir + ' · ' + RING[gi].sym + '）';
      await LY.sleep(680);
    }

    if (yaos.length === 6) {
      var b6 = bits();
      hiRing(idxOf(b6.up));
      await LY.sleep(620);

      var e = LY.engine();
      var result = e.fullDivine(yaos, new Date());
      var hexName = result.main.hex.name;

      LY.save(yaos, new Date());

      $('gn').textContent = hexName;
      $('gs').textContent = RING[idxOf(b6.up)].n + '上' + RING[idxOf(b6.lo)].n + '下'
        + ' · ' + (result.changed ? '之 ' + result.changed.hex.name : '六爻安静')
        + (result.hasMoving ? ' · 有动爻' : '');

      rollBtn.classList.add('hidden');
      resetBtn.classList.remove('hidden');
      st.textContent = '六爻已成卦！';
      await LY.sleep(420);
      reveal.classList.add('show');
      busy = false;
      return;
    }

    rollBtn.disabled = false;
    rollBtn.textContent = '摇第 ' + (yaos.length + 1) + ' 爻';
    st.textContent = '得' + y.label + '（' + sum + '，' + nBack + '背）'
      + (y.mv ? ' · 动爻' : '') + '。可继续摇下一爻。';
    busy = false;
  }

  /* ---------- 重置 ---------- */
  function doReset() {
    reveal.classList.remove('show');
    yaos = [];
    busy = false;
    /* 摇卦中途点重置时，边缘动效还停在 .roll 状态（提速+提亮）。
       不清掉的话边缘会一直加速，直到下次重新摇卦才恢复。 */
    edge.classList.remove('roll');
    buildRing();
    buildHex();
    hideCoins();
    rollBtn.classList.remove('hidden');
    rollBtn.disabled = false;
    rollBtn.textContent = '摇第 1 爻';
    resetBtn.classList.add('hidden');
    st.textContent = '法盘已备，铜钱在手。心中默念所问之事，诚心起卦。';
  }

  /* ---------- 话题选择 ---------- */
  function initTopics() {
    /* 下拉由 app.js 的 LY.topicSelect 自绘（原来「显示隐藏 select + sel.click()」
       那种写法在浏览器里点不开，等于从来没生效过，详见 app.js 里的说明）。 */
    LY.topic = TOPICS[0].key;
    LY.topicSelect($('topic-dd'), TOPICS, LY.topic, function (key) {
      LY.topic = key;
    });
  }

  /* ---------- 事件 ---------- */
  rollBtn.addEventListener('click', function () {
    rollOne().catch(function (e) {
      LY.showError(e);
      busy = false;
      rollBtn.disabled = false;
    });
  });
  resetBtn.addEventListener('click', doReset);
  $('again').addEventListener('click', doReset);
  $('to-pan').addEventListener('click', function () {
    location.href = 'pan.html';
  });

  buildRing();
  buildHex();
  initTopics();
})();
