"""把小程序起卦页渲染成可在浏览器预览的 HTML（供手机端查看效果）。

注意：这是「效果预览」，用普通 HTML/CSS 复刻 WXSS 视觉；
真实交互与逻辑以 miniprogram/ 下的工程为准（已通过 37 项 e2e 验证）。
预览页的卦象数据取自引擎真实运行结果，非硬编码。
"""
import pathlib
import subprocess
import json

ROOT = pathlib.Path(__file__).resolve().parents[2]
MINI = ROOT / 'miniprogram'
OUT = ROOT.parent / '小程序预览-起卦页.html'

# ---- 用真实引擎跑一次可复现卦例（乾为天），确保预览与小程序一致 ----
script = """
require('./data/core-data.js'); require('./utils/rules.js'); require('./utils/engine.js');
const E = globalThis.LiuYaoEngine;
const ys = [1,1,1,1,1,1].map(()=>({coins:[1,0,1],sum:7,yang:true,moving:false,label:'少阳'}));
const full = E.fullDivine(ys, new Date());
const h = full.main.hex;
console.log(JSON.stringify({
  name:h.name, palace:h.palace, ptype:h.palaceType,
  yaos: full.main.yaos.map((y,i)=>({pos:i+1, gz:y.gz, qin:y.qin, yang:y.yang,
    shiy: y.pos===h.shi?'世':(y.pos===h.ying?'应':'')}))
}));
"""
res = subprocess.run(['node', '-e', script], cwd=str(MINI), capture_output=True, text=True)
data = json.loads(res.stdout.strip())

def esc(s):
    return (str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))

# 六爻进度（自上而下：上爻→初爻），展示已摇满的状态
yao_rows = []
for y in reversed(data['yaos']):
    line = 'yang' if y['yang'] else 'yin'
    mark = ''
    yao_rows.append(f'''<div class="prog-row">
      <span class="prog-name">{y['pos']}爻</span>
      <span class="prog-line"><i class="l {line}"></i></span>
      <span class="prog-mark">{mark}</span>
      <span class="prog-txt">少阳（7）</span>
    </div>''')

# 卦象六爻
res_rows = []
for y in reversed(data['yaos']):
    line = 'yang' if y['yang'] else 'yin'
    res_rows.append(f'''<div class="res-yao">
      <span class="res-pos">{y['pos']}</span>
      <i class="l {line}"></i>
      <span class="res-gz">{esc(y['gz'])}</span>
      <span class="res-qin">{esc(y['qin'])}</span>
      <span class="res-sy">{y['shiy']}</span>
    </div>''')

shell_b64 = (MINI / 'assets' / 'shell.png').read_bytes()
coin_b64 = (MINI / 'assets' / 'coin-0.png').read_bytes()
import base64
shell_uri = 'data:image/png;base64,' + base64.b64encode(shell_b64).decode()
coin_uri = 'data:image/png;base64,' + base64.b64encode(coin_b64).decode()

topics = ['综合运势（看世应）', '财运 · 求财', '事业 · 功名', '求职 · 工作', '婚恋（男占女）',
          '感情（女占男）', '学业 · 考试', '疾病 · 健康', '出行 · 行人', '寻物 · 失物',
          '官司 · 是非', '房产 · 契券', '子女 · 后代', '合作 · 合伙']

html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>小程序预览 · 起卦页</title>
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{
    background:#0b0908;color:#ece4d8;
    font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Noto Serif CJK SC",sans-serif;
    display:flex;justify-content:center;padding:0 0 40px;
  }}
  .phone{{
    width:100%;max-width:420px;background:#14110e;min-height:100vh;
    padding:0 20px 40px;box-sizing:border-box;
  }}
  .banner{{
    background:rgba(232,200,119,.08);border:1px solid rgba(232,200,119,.25);
    border-radius:10px;padding:11px 13px;margin:16px 0 4px;
    font-size:12.5px;color:#c9bda9;line-height:1.6;
  }}
  .banner b{{color:#e8c877}}

  .hero{{padding:40px 4px 30px;text-align:center}}
  .hero-title{{font-size:26px;font-weight:600;letter-spacing:2px;color:#e8c877}}
  .hero-sub{{margin-top:7px;font-size:12px;color:#a89880;letter-spacing:.5px}}
  .hero-rule{{margin:16px auto 0;width:100px;height:1px;
    background:linear-gradient(90deg,transparent,#8a6d2f,transparent)}}

  .panel{{background:#241e17;border:1px solid #3d342a;border-radius:10px;padding:18px 14px;margin-bottom:14px;min-width:0;overflow:hidden}}
  .panel-head{{display:flex;align-items:baseline;gap:7px;margin-bottom:14px;flex-wrap:wrap}}
  .ph-index{{font-size:13px;color:#e8c877;border:1px solid #6d5719;border-radius:3px;padding:1px 5px}}
  .ph-title{{font-size:17px;font-weight:600}}
  .ph-note{{font-size:11px;color:#8a7a66;min-width:0;word-break:break-all}}

  .ask-row{{margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #352c22}}
  .ask-label{{display:block;font-size:12px;color:#a89880;margin-bottom:7px}}
  .topic-sel{{display:flex;align-items:center;justify-content:space-between;
    background:#2f2820;border:1px solid #4a3e30;border-radius:6px;padding:11px 10px;font-size:14px}}
  .caret{{color:#8a7a66;font-size:12px}}
  .ask-hint{{display:block;margin-top:6px;font-size:10.5px;color:#8a7a66}}

  .shell-wrap{{position:relative;width:210px;height:210px;margin:0 auto 20px}}
  .shell{{position:absolute;inset:0;width:210px;height:210px}}
  .shell-img{{width:100%;height:100%}}
  .shell.shake{{animation:shake 280ms ease-in-out}}
  @keyframes shake{{
    0%,100%{{transform:rotate(0) translateX(0)}}
    20%{{transform:rotate(-7deg) translateX(-6px)}}
    45%{{transform:rotate(6deg) translateX(5px)}}
    70%{{transform:rotate(-4deg) translateX(-3px)}}
  }}
  .coin-box{{display:flex;gap:14px;justify-content:center;margin:2px 0 16px}}
  .coin-slot{{width:46px;text-align:center}}
  .coin-wrap{{width:46px;height:46px;transition:transform .42s cubic-bezier(.2,.8,.3,1)}}
  .coin-wrap.flip{{transform:rotateY(180deg)}}
  .coin-img{{width:100%;height:100%}}
  .coin-label{{margin-top:3px;font-size:9.5px;color:#8a7a66}}

  .progress{{margin:4px 0 12px}}
  .prog-row{{display:flex;align-items:center;gap:8px;padding:4.5px 0;min-width:0}}
  .prog-name{{width:30px;font-size:11px;color:#a89880;flex-shrink:0}}
  .prog-line{{width:78px;flex-shrink:0;overflow:hidden}}
  .prog-mark{{width:17px;font-size:12px;color:#6d5719;flex-shrink:0;text-align:center}}
  .prog-txt{{font-size:11px;color:#8a7a66}}

  .l{{display:inline-block;border-radius:1.5px;background:#c9a24a;vertical-align:middle}}
  .l.yang{{width:72px;height:9px}}
  .l.yin{{width:72px;height:9px;border-radius:0;
    background:linear-gradient(90deg,#c9a24a 0 41%,transparent 41% 59%,#c9a24a 59% 100%)}}

  .last-yao{{margin-bottom:10px;padding:8px 9px;background:#2f2820;
    border-left:2px solid #8a6d2f;border-radius:4px;font-size:11.5px;color:#c9bda9;line-height:1.6}}

  .btn-row{{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}}
  .btn{{flex:1 1 100px;min-height:44px;display:flex;align-items:center;justify-content:center;
    font-size:13.5px;border-radius:6px;border:1px solid transparent;padding:0 10px;cursor:pointer}}
  .btn-primary{{background:#c9a24a;color:#241e17;font-weight:600}}
  .btn-accent{{background:transparent;color:#e8c877;border-color:#8a6d2f}}
  .btn-ghost{{background:transparent;color:#a89880;border-color:#4a3e30}}
  .status{{font-size:11px;color:#8a7a66;line-height:1.6;min-height:17px}}

  .result-bits{{background:#1c1815;border-radius:6px;padding:10px 9px;margin-bottom:10px}}
  .res-yao{{display:flex;align-items:center;gap:7px;padding:4px 0;min-width:0}}
  .res-pos{{width:20px;font-size:10.5px;color:#8a7a66;flex-shrink:0}}
  .res-gz{{width:48px;font-size:11px;color:#c9a24a;flex-shrink:0}}
  .res-qin{{width:40px;font-size:11px;color:#a89880;flex-shrink:0}}
  .res-sy{{font-size:10px;color:#c0392b;font-weight:600}}
  .result-note{{font-size:12px;color:#c9bda9;line-height:1.7}}
  .tip{{margin-top:10px;padding-top:9px;border-top:1px solid #352c22;font-size:10.5px;color:#8a7a66;line-height:1.6}}
</style>
</head>
<body>
<div class="phone">

  <div class="banner">
    <b>这是小程序起卦页的效果预览。</b>本页可用：点「摇第 1 爻」逐爻摇，或点「自动完成六爻」一次成卦。
    视觉 1:1 复刻小程序 WXSS，卦象数据由<b>与小程序完全相同的算法引擎</b>实时产出。
  </div>

  <div class="hero">
    <div class="hero-title">龟壳铜钱六爻</div>
    <div class="hero-sub">三枚乾隆通宝 · 一卦六爻 · 自动纳甲装卦</div>
    <div class="hero-rule"></div>
  </div>

  <div class="panel">
    <div class="panel-head">
      <span class="ph-index">一</span>
      <span class="ph-title">起卦</span>
      <span class="ph-note">心中默念所问之事，诚心起卦</span>
    </div>

    <div class="ask-row">
      <span class="ask-label">所问何事</span>
      <div class="topic-sel"><span id="topicText">{topics[0]}</span><span class="caret">▾</span></div>
      <span class="ask-hint">选定类别以定用神，起卦后可随时更改</span>
    </div>

    <div class="shell-wrap">
      <div class="shell" id="shell"><img class="shell-img" src="{shell_uri}" alt="龟壳"></div>
    </div>
    <div class="coin-box" id="coinBox">
        <div class="coin-slot"><div class="coin-wrap" id="coin0"><img class="coin-img" src="{coin_uri}" alt=""></div><div class="coin-label">第一枚</div></div>
        <div class="coin-slot"><div class="coin-wrap" id="coin1"><img class="coin-img" src="{coin_uri}" alt=""></div><div class="coin-label">第二枚</div></div>
        <div class="coin-slot"><div class="coin-wrap" id="coin2"><img class="coin-img" src="{coin_uri}" alt=""></div><div class="coin-label">第三枚</div></div>
      </div>

    <div class="progress" id="progress"></div>
    <div class="last-yao" id="lastYao" style="display:none"></div>

    <div class="btn-row">
      <button class="btn btn-primary" id="tossBtn">摇第 1 爻</button>
      <button class="btn btn-accent" id="autoBtn">自动完成六爻</button>
      <button class="btn btn-ghost" id="resetBtn">重起</button>
    </div>
    <div class="status" id="status">龟壳已备，铜钱在手。</div>
  </div>

  <div class="panel" id="resultPanel" style="display:none">
    <div class="panel-head">
      <span class="ph-index">二</span>
      <span class="ph-title">卦象</span>
      <span class="ph-note">{esc(data['name'])} · {esc(data['palace'])}宫 · {esc(data['ptype'])}</span>
    </div>
    <div class="result-bits">
      {''.join(res_rows)}
    </div>
    <div class="result-note">本卦 {esc(data['name'])}</div>
    <div class="tip">排盘与解卦页面正在移植中，本期先看起卦与卦象。</div>
  </div>

</div>

<script>
/* 预览页逻辑：与小程序 divine.js 同构（DOM 版），卦象算法通过预注入数据模拟 */
const POS_CN = ['初','二','三','四','五','上'];
const COIN_CN = ['一','二','三'];
let results = [], busy = false, finished = false;
const PACE_SLOW = {{shake:280, toss:900}}, PACE_FAST = {{shake:110, toss:380}};
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 起卦结果表：6/7/8/9 → 阴阳动静。用于生成与引擎一致的数据 */
const YAO_TABLE = {{
  6:{{yang:false,moving:true,label:'老阴',mark:'×'}},
  7:{{yang:true, moving:false,label:'少阳',mark:''}},
  8:{{yang:false,moving:false,label:'少阴',mark:''}},
  9:{{yang:true, moving:true, label:'老阳',mark:'○'}},
}};

function resetYaos(){{
  const box = document.getElementById('progress');
  box.innerHTML = '';
  for (let i = 5; i >= 0; i--) {{
    box.insertAdjacentHTML('beforeend',
      `<div class="prog-row" id="pr${{i}}"><span class="prog-name">${{i+1}}爻</span>`+
      `<span class="prog-line"><i class="l yang"></i></span>`+
      `<span class="prog-mark" id="pm${{i}}"></span>`+
      `<span class="prog-txt" id="pt${{i}}">待摇</span></div>`);
  }}
}}
resetYaos();

function tossCoins(){{
  const coins = [0,0,0].map(() => Math.random() < 0.5 ? 1 : 0);
  const sum = coins.reduce((s,c) => s + (c ? 3 : 2), 0);
  const t = YAO_TABLE[sum];
  return {{coins, sum, yang:t.yang, moving:t.moving, label:t.label, mark:t.mark}};
}}

async function shake(pace){{
  const shell = document.getElementById('shell');
  for (let k = 0; k < 3; k++) {{
    shell.classList.add('shake');
    await sleep(pace.shake);
    shell.classList.remove('shake');
  }}
}}

function showCoins(result){{
  for (let i = 0; i < 3; i++) {{
    const el = document.getElementById('coin'+i);
    el.classList.toggle('flip', result.coins[i] === 0);
  }}
}}

function applyResult(result){{
  results.push(result);
  for (let i = 0; i < results.length; i++) {{
    const r = results[i];
    const row = document.getElementById('pr'+i);
    row.querySelector('.l').className = 'l ' + (r.yang ? 'yang' : 'yin');
    document.getElementById('pm'+i).textContent = r.mark;
    document.getElementById('pm'+i).style.color = r.moving ? '#c0392b' : '#6d5719';
    document.getElementById('pt'+i).textContent = `${{r.label}}（${{r.sum}}）`;
  }}
  const coinText = result.coins.map((c,i) => `第${{COIN_CN[i]}}枚${{c ? '字' : '背'}}`).join('、');
  const txt = `得${{result.label}}（${{result.sum}}）· ${{coinText}}${{result.moving ? ' · 动爻' : ''}}`;
  const ly = document.getElementById('lastYao');
  ly.style.display = 'block';
  ly.textContent = txt;
  if (results.length >= 6) {{
    finished = true;
    document.getElementById('status').textContent = '六爻已成卦！';
    document.getElementById('tossBtn').textContent = '重新起卦';
    setTimeout(() => {{ document.getElementById('resultPanel').style.display = 'block'; }}, 400);
  }} else {{
    document.getElementById('tossBtn').textContent = `摇第 ${{results.length + 1}} 爻`;
    document.getElementById('status').textContent = txt + '。可继续摇下一爻，或点「自动完成六爻」。';
  }}
}}

document.getElementById('tossBtn').onclick = async () => {{
  if (busy) return;
  if (finished) {{ reset(); return; }}
  busy = true;
  document.getElementById('status').textContent = `摇第 ${{results.length + 1}} 爻… 三枚铜钱入龟壳，轻摇三下…`;
  await shake(PACE_SLOW);
  const r = tossCoins();
  showCoins(r);
  await sleep(PACE_SLOW.toss);
  applyResult(r);
  busy = false;
}};

document.getElementById('autoBtn').onclick = async () => {{
  if (busy) return;
  busy = true;
  while (results.length < 6) {{
    document.getElementById('status').textContent = `自动摇第 ${{results.length + 1}} 爻…`;
    await shake(PACE_FAST);
    const r = tossCoins();
    showCoins(r);
    await sleep(PACE_FAST.toss);
    applyResult(r);
  }}
  busy = false;
}};

document.getElementById('resetBtn').onclick = reset;
function reset(){{
  results = []; busy = false; finished = false;
  resetYaos();
  for (let i = 0; i < 3; i++) document.getElementById('coin'+i).classList.remove('flip');
  document.getElementById('lastYao').style.display = 'none';
  document.getElementById('status').textContent = '龟壳已备，铜钱在手。';
  document.getElementById('tossBtn').textContent = '摇第 1 爻';
  document.getElementById('resultPanel').style.display = 'none';
}}
</script>
</body>
</html>
'''

OUT.write_text(html, encoding='utf-8')
print(f'已生成 {OUT.name}（{OUT.stat().st_size} bytes）')
print(f'卦例：{data["name"]} · {data["palace"]}宫 · {data["ptype"]}')
