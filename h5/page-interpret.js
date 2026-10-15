/* 六爻 pro · H5 解卦页
 * ------------------------------------------------------------------
 * 判据全部来自 vendor/engine.js 的 interpret()，未改一行逻辑。
 * 所问类别可随时切换：用神随之改变，卦象不变（无需重起卦）。
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

  var st = LY.requireDivine();     // 无六爻数据则跳回起卦页
  if (!st) return;

  var E = LY.engine();
  var POS_CN = ['初', '二', '三', '四', '五', '上'];

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

  var VERDICT_CLASS = {
    '大吉': 'v-daji', '吉': 'v-ji', '平': 'v-ping', '小凶': 'v-xiaoxiong', '凶': 'v-xiong',
  };
  var LABEL_CLASS = { '吉': 'lbl-ji', '中': 'lbl-zhong', '凶': 'lbl-xiong' };

  /* topic 只接受字符串。
     若上游误传对象（如 {key,label}），取其 key；都不是就用「综合」。
     不做这层防御的话，interpret() 会把对象塞进 summary，
     页面上直接出现「所问：[object Object]」。 */
  function normalizeTopic(v) {
    if (typeof v === 'string' && v) return v;
    if (v && typeof v === 'object' && typeof v.key === 'string' && v.key) return v.key;
    return '综合';
  }

  var current = normalizeTopic(st.topic);

  try {
    render(current);
  } catch (e) {
    LY.showError(e);
  }

  function render(topic) {
    current = topic;
    // 标签文案按当前 topic 重新取，切换类别后才不会显示上一项
    for (var i = 0; i < TOPICS.length; i++) {
      if (TOPICS[i].key === topic) curLabel = TOPICS[i].label;
    }
    var result = E.fullDivine(st.results, st.date);
    var r = E.interpret(result, topic);

    var h = '';

    /* ---- 类别切换 ----
       下拉由 app.js 的 LY.topicSelect 自绘并按当前 topic 初始化，
       切换后 render() 会重建整页、bind() 再建一次，所以选中项天然跟着走。 */
    h += '<div class="panel"><div class="ask-row">';
    h += '<span class="ask-label">所问何事（可改，卦象不变）</span>';
    h += '<div class="dd" id="topic-dd"></div>';
    h += '</div></div>';

    /* ---- 吉凶总判 ---- */
    var scorePct = Math.max(0, Math.min(100, (r.score + 100) / 2));
    h += '<div class="panel">';
    h += '<div class="panel-head">'
        + '<span class="ph-index">三</span><span class="ph-title">解卦</span>'
        + '<span class="ph-note">用神取用 · 吉凶断语 · 动爻详参</span></div>';
    h += '<div class="ip-top">';
    h += '<div class="ip-verdict ' + (VERDICT_CLASS[r.verdict] || 'v-ping') + '">';
    h += '<div class="iv-word">' + esc(r.verdict) + '</div>';
    h += '<div class="iv-topic">所问：' + esc(r.topic) + '</div></div>';
    h += '<div class="ip-score"><div class="is-bar"><div class="is-fill" style="width:' + scorePct + '%"></div></div>';
    h += '<div class="is-num">综合吉凶指数 ' + (r.score > 0 ? '+' : '') + r.score + '</div></div>';
    h += '</div>';
    h += '<div class="ip-summary">' + esc(r.summary) + '</div>';
    h += '<div class="ip-advice"><span class="gc-k">断语</span>' + esc(r.advice) + '</div>';
    h += '</div>';

    /* ---- 用神取用 ---- */
    h += '<div class="panel"><div class="ipb-title">用神取用</div>';
    h += '<div class="ipb-p">' + esc(r.yongshen.desc) + '。</div>';
    var yl = r.yongList || [];
    if (!yl.length) h += '<div class="ipb-p warn">卦中用神不上卦，须凭伏神与世应推断，事在暗处。</div>';
    yl.forEach(function (y) {
      h += '<div class="ipb-li">· 第' + y.pos + '爻 ' + esc(y.gz) + ' ' + esc(y.qin)
          + '（' + esc(y.wx) + '）— ' + esc(y.wang)
          + (y.isMoving ? '·动爻' : '') + (y.isShi ? '·临世' : '') + (y.isYing ? '·临应' : '')
          + '</div>';
    });
    (r.ysNotes || []).filter(function (n) { return typeof n === 'object'; }).forEach(function (n) {
      h += '<div class="ysn"><span class="ysn-h">' + esc(n.gz) + ' ' + esc(n.qin) + '：</span>'
          + esc(n.notes.join('；')) + '</div>';
    });
    h += '</div>';

    /* ---- 世应 ---- */
    h += '<div class="panel"><div class="ipb-title">世应关系</div>';
    h += '<div class="ipb-p">世爻 ' + esc(r.shiying.shi) + '（' + esc(r.shiying.shiWuxing) + '） · 应爻 '
        + esc(r.shiying.ying) + '（' + esc(r.shiying.yingWuxing) + '）</div>';
    h += '<div class="ipb-p">' + esc(r.shiying.note) + '</div>';
    if (r.shiRule) {
      h += '<div class="shirule"><span class="shirule-h">' + esc(r.shiRule.qin) + '持世</span>'
          + esc(r.shiRule.note) + '</div>';
    }
    h += '</div>';

    /* ---- 飞伏神 ---- */
    if (r.fuShen) {
      var f = r.fuShen;
      h += '<div class="panel"><div class="ipb-title">飞伏神</div>';
      h += '<div class="ipb-p">' + esc(f.summary) + '</div>';
      h += '<div class="fu-grid">';
      h += '<div class="fu"><span class="fu-k">飞神</span>' + esc(f.fei.gz) + ' ' + esc(f.fei.qin)
          + '（' + esc(f.fei.wx) + '）</div>';
      h += '<div class="fu"><span class="fu-k">伏神</span>' + esc(f.fu.gz) + ' ' + esc(f.fu.qin)
          + '（' + esc(f.fu.wx) + '）· 伏于第' + f.fu.pos + '爻</div>';
      h += '</div>';
      h += '<div class="fu-judge ' + (f.usable ? 'ok' : 'no') + '">'
          + (f.usable ? '伏神有力，尚可得用' : '伏神无力，终不得出') + '</div>';
      if (f.qi) {
        h += '<div class="fu-qi"><span class="fu-qi-h">' + esc(f.qi.title) + '</span>' + esc(f.qi.note)
            + '<div class="fu-need">须' + esc(f.qi.need) + '　（'
            + (f.qi.level === '强' ? '情重' : (f.qi.level === '中' ? '情中等' : '情轻')) + '）</div></div>';
      }
      if ((f.up || []).length) {
        h += '<div class="fu-why"><span class="fu-why-h">有力之处</span>' + esc(f.up.join('；')) + '</div>';
      }
      if ((f.down || []).length) {
        h += '<div class="fu-why"><span class="fu-why-h">无力之处</span>' + esc(f.down.join('；')) + '</div>';
      }
      h += '</div>';
    }

    /* ---- 元神忌神仇神 ---- */
    if (r.yuanJiChou) {
      var y = r.yuanJiChou;
      h += '<div class="panel"><div class="ipb-title">元神 · 忌神 · 仇神</div>';
      h += '<div class="yjc-grid">';
      h += '<div class="yj yuan"><span class="yj-k">元神</span>' + esc(y.yuan) + '</div>';
      h += '<div class="yj ji"><span class="yj-k">忌神</span>' + esc(y.ji) + '</div>';
      h += '<div class="yj chou"><span class="yj-k">仇神</span>' + esc(y.chou) + '</div>';
      h += '</div>';
      h += '<div class="ipb-p yjc-rule">' + esc(y.rule)
          + (y.isFu ? '（用神伏藏，此处依伏神五行而论）' : '') + '</div>';
      if ((y.yuanNotes || []).length) {
        h += '<div class="yjc-n"><span class="yjc-n-h">元神</span>' + esc(y.yuanNotes.join('；')) + '</div>';
      }
      if ((y.jiNotes || []).length) {
        h += '<div class="yjc-n"><span class="yjc-n-h">忌神</span>' + esc(y.jiNotes.join('；')) + '</div>';
      }
      if (y.chouNotes) {
        h += '<div class="yjc-n"><span class="yjc-n-h">仇神</span>' + esc(y.chouNotes) + '</div>';
      }
      h += '</div>';
    }

    /* ---- 卦体格局 ---- */
    if ((r.guaGe || []).length) {
      h += '<div class="panel"><div class="ipb-title">卦体格局</div>';
      r.guaGe.forEach(function (g) { h += '<div class="ipb-li">· ' + esc(g) + '</div>'; });
      h += '</div>';
    }

    /* ---- 动爻详参 / 静卦 ---- */
    h += '<div class="panel">';
    if ((r.movingNotes || []).length) {
      h += '<div class="ipb-title">动爻详参</div>';
      r.movingNotes.forEach(function (m) {
        h += '<div class="mv-card"><div class="mvc-head">';
        h += '<span class="mvc-t">' + POS_CN[m.pos - 1] + '爻动</span>';
        h += '<span class="jlbl ' + (LABEL_CLASS[m.label] || 'lbl-zhong') + '">' + esc(m.label) + '</span>';
        h += '</div>';
        h += '<div class="mvc-chg">' + esc(m.change) + '</div>';
        h += '<div class="mvc-ci">' + esc(m.yaoCi) + '</div>';
        if (m.xiaoXiang) {
          h += '<div class="mvc-xx"><span class="gc-k">象曰</span>' + esc(m.xiaoXiang) + '</div>';
        }
        h += '</div>';
      });
    } else {
      h += '<div class="ipb-title">静卦</div>';
      h += '<div class="ipb-p">' + esc(r.noMoving || '') + '</div>';
    }
    h += '</div>';

    /* ---- 卦象解读 ---- */
    if (r.mean) {
      h += '<div class="panel"><div class="ipb-title">卦象解读 · ' + esc(r.info.short) + '</div>';
      h += '<div class="ipb-p mn-white">' + esc(r.mean.white) + '</div>';
      h += '<div class="mn"><span class="mn-k">事业</span>' + esc(r.mean.career) + '</div>';
      h += '<div class="mn"><span class="mn-k">感情</span>' + esc(r.mean.love) + '</div>';
      h += '<div class="mn"><span class="mn-k">健康</span>' + esc(r.mean.health) + '</div>';
      h += '</div>';
    }

    /* ---- 按钮与声明 ---- */
    h += '<div class="btn-row">'
        + '<button class="btn btn-primary" id="go-pan">回看排盘</button>'
        + '<button class="btn btn-ghost" id="go-divine">重新起卦</button></div>';
    h += '<div class="tip">※ 本页内容由《周易》卦爻辞、京房纳甲与《增删卜易》《卜筮正宗》规则推演，'
        + '属传统文化研究与自我省思参考，不作为任何决策依据。</div>';

    page.innerHTML = h;
    bind();
  }

  function bind() {
    // 自绘下拉（app.js）：切换后重渲染整页，卦象不变、解读按新类别重算
    LY.topicSelect(document.getElementById('topic-dd'), TOPICS, current, function (key) {
      LY.topic = key;
      try {
        render(key);
      } catch (e) {
        LY.showError(e);
      }
    });

    document.getElementById('go-pan').addEventListener('click', function () {
      location.href = 'pan.html';
    });
    document.getElementById('go-divine').addEventListener('click', function () {
      location.href = 'index.html';
    });
  }
})();
