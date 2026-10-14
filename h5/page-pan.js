/* 六爻 pro · H5 排盘页
 * ------------------------------------------------------------------
 * 判据全部来自 vendor/engine.js 与 vendor/rules.js，未改一行逻辑。
 * 渲染方式：直接用字符串拼 innerHTML。
 */
(function () {
  'use strict';

  var page = document.getElementById('page');
  var esc = LY.esc;

  var bootErr = LY.check();
  if (bootErr) {
    LY.showError(bootErr);
    return;
  }

  var st = LY.requireDivine();      // 无六爻数据则跳回起卦页
  if (!st) return;

  var E = LY.engine();
  var R = LY.rules();
  var POS_CN = ['初', '二', '三', '四', '五', '上'];

  /* 旺衰休囚：t 为显示文案，c 为样式类（纯 ASCII） */
  var STATE_CLS = { 旺: 'wang', 相: 'xiang', 休: 'xiu', 囚: 'qiu', 死: 'si' };

  try {
    var result = E.fullDivine(st.results, st.date);
    render(result);
  } catch (e) {
    LY.showError(e);
  }

  function render(result) {
    var main = result.main;
    var changed = result.changed;
    var h = main.hex;

    var h1 = '';   // 卦名头

    /* ---- 卦名头 ---- */
    var shiYao = main.yaos[main.shiIdx];
    var yingYao = main.yaos[main.yingIdx];

    h1 += '<div class="panel">';
    h1 += '<div class="panel-head">'
        + '<span class="ph-index">二</span>'
        + '<span class="ph-title">排盘</span>'
        + '<span class="ph-note">纳甲装卦 · 六亲六神 · 旺衰旬空 · 卦体格局</span>'
        + '</div>';

    /* 第一行：卦象小图 + 卦名。卦象用 flex 布局，
       不能让column-reverse 容器按内容收缩（之前挤成一条粗横条）。 */
    h1 += '<div class="ph-row">';
    h1 += LY.guaBox(h.bits);
    h1 += '<div class="ph-row-txt">';
    h1 += '<div class="ph-title-lg">' + esc(h.name) + '</div>';
    h1 += '<div class="ph-sub">' + esc(h.palace) + '宫 · ' + esc(h.palaceType) + ' · 属' + esc(h.palaceElem) + '</div>';
    h1 += '</div>';
    h1 += '<div class="ph-sy">';
    h1 += '<span class="tag-shi">世 ' + (main.shiIdx + 1) + '爻'
        + (shiYao ? ' ' + esc(shiYao.gz) : '') + '</span>';
    h1 += '<span class="tag-ying">应 ' + (main.yingIdx + 1) + '爻'
        + (yingYao ? ' ' + esc(yingYao.gz) : '') + '</span>';
    h1 += '</div>';
    h1 += '</div>';

    /* 第二行：上下卦。
       世应已在第一行用徽标标出，这里不再重复 ——
       原先把「上卦/下卦/世应干支」都塞进右侧块，窄屏下互相挤，
       且世应信息出现两次。 */
    h1 += '<div class="ph-ba-row">';
    h1 += '<span class="ph-ba-item"><b>上卦</b>' + esc(h.upper)
        + '<i>' + esc(h.upperNature) + ' · ' + esc(h.upperElem) + '</i></span>';
    h1 += '<span class="ph-ba-item"><b>下卦</b>' + esc(h.lower)
        + '<i>' + esc(h.lowerNature) + ' · ' + esc(h.lowerElem) + '</i></span>';
    h1 += '</div>';

    h1 += '<div class="pan-guaCi"><span class="gc-k">卦辞</span>' + esc(LY.stripName(h.guaCi, h.name)) + '</div>';
    h1 += '<div class="pan-guaCi"><span class="gc-k">大象</span>' + esc(h.daXiang) + '</div>';
    h1 += '</div>';

    /* ---- 六爻表 ---- */
    /* 卡片式布局，不再需要七列表头（见 style.css 的六爻表说明） */
    var h2 = '<div class="panel">';
    h2 += '<div class="block-title">六爻装卦</div>';

    for (var i = 5; i >= 0; i--) {
      var y = main.yaos[i];
      var c = changed ? changed.yaos[i] : null;
      var wxc = E.WX_COLOR[y.wx] || '#a89880';

      var tags = [{ t: y.wang || '休', c: STATE_CLS[y.wang] || 'xiu' }];
      if (y.kong) {
        var isZhen = !!(y.kongJudge && y.kongJudge.zhen);
        tags.push({ t: isZhen ? '真空' : '假空', c: isZhen ? 'zhenkong' : 'jiakong' });
      }
      if (y.monthPo) tags.push({ t: '月破', c: 'yuepo' });
      if (y.dayChong) tags.push({ t: '日冲', c: 'richong' });
      if (y.anDong && y.anDong.type === '暗动') tags.push({ t: '暗动', c: 'andong' });
      if (y.sanHe) tags.push({ t: '合' + y.sanHe, c: 'xiu' });

      var cTag = '';
      if (c) {
        var jt = R.jinTui(y.zhi, c.zhi);
        if (jt === 'jin') cTag = '化进神';
        else if (jt === 'tui') cTag = '化退神';
        else {
          var back = R.rel(c.wx, y.wx);
          if (back === 'sheng') cTag = '回头生';
          else if (back === 'ke') cTag = '回头克';
        }
      }

      /* 每爻一张卡片（手机上七列并排读不清，详见 style.css 的说明）
         第一行：爻位 六神 爻画 世应
         第二行：六亲 纳甲 变爻（动爻才有）
         第三行：状态标签 */
      h2 += '<div class="yao-card' + (y.isMoving ? ' moving' : '') + '">';

      // --- 第一行 ---
      h2 += '<div class="yc-r1">';
      h2 += '<span class="yc-pos">' + POS_CN[i] + '爻</span>';
      h2 += '<span class="yc-shen" style="color:' + y.shen.color + '">' + esc(y.shen.name) + '</span>';
      h2 += '<span class="yc-line">';
      h2 += y.yang
        ? '<span class="l yang"></span>'
        : '<span class="l yin"><span class="l yin-seg"></span><span class="l yin-seg"></span></span>';
      if (y.isMoving) {
        h2 += y.yang
          ? '<span class="mv mv-o"></span>'
          : '<span class="mv"><span class="mv-slash mv-s1"></span><span class="mv-slash mv-s2"></span></span>';
      }
      h2 += '</span>';
      h2 += '<span class="yc-sy">';
      if (y.isShi) h2 += '<span class="tag-shi">世</span>';
      if (y.isYing) h2 += '<span class="tag-ying">应</span>';
      h2 += '</span>';
      h2 += '</div>';

      // --- 第二行：六亲 纳甲 变爻 ---
      h2 += '<div class="yc-r2">';
      h2 += '<span class="yc-qin">' + esc(y.qin) + '</span>';
      h2 += '<span class="yc-gz" style="color:' + wxc + '">' + esc(y.gz) + '</span>';
      if (c) {
        var cgc = E.WX_COLOR[c.wx] || '#a89880';
        h2 += '<span class="yc-cg">';
        // 变爻也画出来：虚线爻画 + 变卦的六亲，直接看出阴阳怎么变
        h2 += c.yang
          ? '<span class="l cg-yang"></span>'
          : '<span class="l cg-yin"><span class="l cg-yin-seg"></span><span class="l cg-yin-seg"></span></span>';
        h2 += '<span class="yc-cg-txt" style="color:' + cgc + '">' + esc(c.gz) + '</span>';
        h2 += '<span class="yc-cg-txt">' + esc(c.qin) + '</span>';
        if (cTag) h2 += '<span class="c-ctag">' + cTag + '</span>';
        h2 += '</span>';
      }
      h2 += '</div>';

      // --- 第三行：状态 ---
      h2 += '<div class="yc-r3">';
      tags.forEach(function (t) {
        h2 += '<span class="st ' + t.c + '">' + t.t + '</span>';
      });
      h2 += '</div></div>';
    }

    /* 变卦 */
    if (changed) {
      var ch = changed.hex;
      h2 += '<div class="pan-changed"><div class="pc-head"><span class="gc-k">变卦</span>';
      h2 += '<div class="pc-row">' + LY.guaBox(ch.bits);
      h2 += '<div><div class="pc-name">' + esc(ch.name) + '</div>';
      h2 += '<div class="pc-sub">' + esc(ch.palace) + '宫 · ' + esc(ch.palaceType) + '</div></div>';
      h2 += '</div></div>';
      h2 += '<div class="pc-guaCi">' + esc(LY.stripName(ch.guaCi, ch.name)) + '</div></div>';
    }

    /* 互错综 */
    var hg = E.BY_BITS[E.huGu(main.bits)];
    var cg = E.BY_BITS[E.cuoGu(main.bits)];
    var zg = E.BY_BITS[E.zongGu(main.bits)];
    h2 += '<div class="pan-related">'
        + '<span class="rel-item">互卦 ' + esc(hg ? hg.name : '—') + '</span>'
        + '<span class="rel-item">错卦 ' + esc(cg ? cg.name : '—') + '</span>'
        + '<span class="rel-item">综卦 ' + esc(zg ? zg.name : '—') + '</span>'
        + '</div>';
    h2 += '</div>';

    /* ---- 卦体格局 ---- */
    var ge = [];
    if (main.isChong) ge.push({ t: '六冲卦', d: R.CHONG_NOTE });
    if (main.isHe) ge.push({
      t: '六合卦',
      d: '卦逢六合：内外六爻三组地支两两相合。凡事若得三六合，诸事必得久远',
    });
    var najiaLite = main.yaos.map(function (y2) {
      return { zhi: y2.zhi, wx: y2.wx, gz: y2.gz, qin: y2.qin };
    });
    var cd = R.liuChongDetail(najiaLite);
    var hd = R.liuHeDetail(najiaLite);
    if (!main.isChong && cd.count) ge.push({ t: '冲' + cd.count + '组', d: '仅部分爻位相冲，不成六冲卦。冲而不全，散而未散' });
    if (!main.isHe && hd.count) ge.push({ t: '合' + hd.count + '组', d: '仅部分爻位相合，不成六合卦' });
    if (changed && main.isChong && changed.isHe) ge.push({ t: '六冲变六合', d: R.CHONG_HE_NOTE });
    if (changed && main.isHe && changed.isChong) ge.push({ t: '六合变六冲', d: R.HE_CHONG_NOTE });

    var ff2 = R.fanFu(
      main.bits, changed ? changed.bits : null,
      main.yaos.map(function (y3) { return { zhi: y3.zhi }; }),
      changed ? changed.yaos.map(function (y3) { return { zhi: y3.zhi }; }) : null
    );
    if (ff2) {
      ge.push({
        t: ff2.type + (ff2.guaScope === '内外卦' || !ff2.guaScope ? '卦' : '之' + ff2.guaScope + '伏吟'),
        d: ff2.note,
      });
    }
    if (changed) {
      var gy = R.guaFanYin(main.hex.lower, main.hex.upper, changed.hex.lower, changed.hex.upper);
      if (gy) ge.push({ t: gy.kind || gy.type, d: gy.note });
    }
    if (main.guaShen) {
      var gs = main.guaShen;
      if (gs.pos == null) {
        ge.push({ t: '卦身不上卦', d: gs.note });
      } else {
        var gsYao = main.yaos[gs.pos - 1];
        var gsBad = !gsYao || gsYao.isMoving || gsYao.monthPo ||
          (gsYao.kong && gsYao.kongJudge && gsYao.kongJudge.zhen);
        var gsKe = gsYao && main.yaos.some(function (y4) {
          return y4.isMoving && R.rel(y4.wx, gsYao.wx) === 'ke';
        });
        ge.push({
          t: (gsBad || gsKe) ? '卦身受伤' : '卦身得安',
          d: gs.note + ((gsBad || gsKe)
            ? '——卦身或动、或破、或真空，另有动爻来克亦为受制，事有阻隔'
            : '——卦身安稳，事有根底'),
        });
      }
    }
    if (main.sanHe) {
      ge.push({
        t: '三合' + main.sanHe.wx + '局',
        d: main.sanHe.note + (main.anyMoving ? '（有动爻，成局更实）' : '（无动爻，谓之虚三待用）'),
      });
    }

    var h3 = '';
    if (ge.length) {
      h3 += '<div class="panel"><div class="block-title">卦体格局</div>';
      ge.forEach(function (g) {
        h3 += '<div class="gt"><span class="gt-t">' + esc(g.t) + '</span>'
            + '<span class="gt-d">' + esc(g.d) + '</span></div>';
      });
      h3 += '</div>';
    }

    /* ---- 时相 ---- */
    var jq = main.monthZhi ? R.jieQiOf(main.monthZhi) : null;
    var season = main.monthZhi ? R.SEASON_OF_ZHI[main.monthZhi] : null;
    var meta = [
      {
        k: '月建',
        v: (main.monthZhi || '未取') + (main.monthWx ? '（' + main.monthWx + '）' : '')
          + (jq ? ' · ' + jq + '后' : '') + (season ? ' · ' + season + '令' : ''),
      },
      { k: '日辰', v: (main.dayGZ || '未取') + (main.dayWx ? '（' + main.dayWx + '）' : '') },
      { k: '旬空', v: main.kong.length ? main.kong.join('、') : '未取' },
    ];
    var h4 = '<div class="panel"><div class="block-title">时相</div>';
    meta.forEach(function (m) {
      h4 += '<div class="mt"><span class="mt-k">' + esc(m.k) + '</span><span class="mt-v">' + esc(m.v) + '</span></div>';
    });
    if (!main.monthZhi) h4 += '<div class="tip warn">未能取得月建日辰，旺衰与旬空暂不参断。</div>';
    h4 += '</div>';

    /* ---- 取象 ---- */
    var h5 = '';
    if (h.lower && h.upper) {
      var wl = R.guaWu(h.lower), wu = R.guaWu(h.upper);
      var tl = R.guaShenTi(h.lower), tu = R.guaShenTi(h.upper);
      if (wl || wu || tl || tu) {
        h5 += '<div class="panel"><div class="block-title">取象</div>';
        h5 += '<div class="ipb-li">· 外卦' + esc(h.upper) + '为' + esc(wu || '—') + '、' + esc(tu || '—') + '（形）</div>';
        h5 += '<div class="ipb-li">· 内卦' + esc(h.lower) + '为' + esc(wl || '—') + '、' + esc(tl || '—') + '（性）</div>';
        h5 += '</div>';
      }
    }

    /* ---- 神煞（只作参看） ---- */
    var interp = E.interpret(result, st.topic);
    var ss = interp.shenSha || [];
    var h6 = '';
    if (ss.length) {
      h6 += '<div class="panel"><div class="block-title">神煞参看</div>';
      ss.forEach(function (s) {
        h6 += '<div class="ss"><span class="ss-n">' + esc(s.name) + '</span>'
            + '<span class="ss-z">' + esc(s.zhi) + '</span>'
            + '<span class="ss-note">' + esc(s.note) + '</span></div>';
      });
      if (interp.shenShaNote) h6 += '<div class="tip">' + esc(interp.shenShaNote) + '</div>';
      h6 += '</div>';
    }

    /* ---- 按钮 ---- */
    var h7 = '<div class="btn-row">'
        + '<button class="btn btn-primary" id="go-interpret">看解卦</button>'
        + '<button class="btn btn-ghost" id="go-divine">重新起卦</button>'
        + '</div>';

    page.innerHTML = h1 + h2 + h3 + h4 + h5 + h6 + h7;

    document.getElementById('go-interpret').addEventListener('click', function () {
      location.href = 'interpret.html';
    });
    document.getElementById('go-divine').addEventListener('click', function () {
      location.href = 'index.html';
    });
  }
})();
