// H5 结构自检（2026-10-13 新建，替代原小程序 three-pages.test.js 的同类职责）
//
// 为什么要有这个：项目历史上两次栽在「类名」上——
//   ① 解卦页 .lbl 被起卦页同名规则污染，吉凶标签压字（用户截图报的 bug）
//   ② 小程序盘面渲染成黑块，根因是「2 个 class 未定义样式」，当时 WARN 没当错误看
// 所以这里把「用到的 class 必须有样式」做成一等断言，而不是靠人眼 review。
//
// 检查项：
//   1. HTML/JS 里用到的 class，必须在 style.css 有对应规则
//   2. JS 里 $(id)/getElementById 引用的 id，必须在对应 HTML 里存在
//   3. CSS 选择器不含非 ASCII（小程序侧踩过 unexpected '◆' 的坑）
//   4. CSS 花括号配对
//   5. HTML 引用的本地资源（img src / css url）必须真实存在
//   6. 无小程序残留：页面 JS 不得出现 Page(/App(/setData/wx. API、不得引用 .wxml/.wxss
//
// 用法：node tests/h5-structure.test.js   （在 h5/ 目录下跑）

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGES = ['index.html', 'pan.html', 'interpret.html'];
const JS_FILES = ['app.js', 'page-divine.js', 'page-pan.js', 'page-interpret.js'];

let pass = 0;
const fail = [];
const ok = (c, m) => (c ? pass++ : fail.push(m));

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ---------- 预处理 ----------
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// 取出所有规则的选择器部分（"selector { declarations }" 的 selector）
function cssSelectors(css) {
  const clean = stripComments(css);
  const sels = [];
  let depth = 0, buf = '';
  for (const ch of clean) {
    if (ch === '{') {
      if (depth === 0) sels.push(buf.trim());
      depth++; buf = '';
    } else if (ch === '}') {
      depth--; buf = '';
    } else if (depth === 0) {
      buf += ch;
    }
  }
  return sels.filter(Boolean);
}

const css = read('style.css');

// ---------- 1. class 覆盖 ----------
// 1a. CSS 里定义了的 class
const defined = new Set();
for (const sel of cssSelectors(css)) {
  for (const m of sel.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)) defined.add(m[1]);
}

// 1b. HTML class 属性里用到的 class
const usedInHtml = new Set();
for (const p of PAGES) {
  const html = read(p);
  for (const m of html.matchAll(/class="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) usedInHtml.add(c);
  }
  // class="{{...}}" 之类模板不算，H5 没这语法；但 JS 拼的 class 要算，见 1c
}

// 1c. JS 里拼出来的 class。
//     两种形态都要覆盖：
//       · innerHTML 模板里嵌的 HTML：'<span class="jlbl ' + x + '">'
//       · classList 动态加类：el.classList.add('moving')
//     曾经的错误写法：用 [^"\\]+ 做捕获组，结果把 ' + (cond ? ' a' : '') + '
//     整段吞进来，拆出一堆 ', +, (y.isMoving 之类的假 class。捕获组一律不允许跨引号。
//     第二个坑：class 属性常被拼接拆开 —— class="yao-card' + (...) + '"，
//     开引号闭引号不在同一个字符串字面量里，所以 [^"]* 会一路吃到闭引号，
//     把中间的 JS 表达式当成类名。正确做法是遇任一种引号即止（[^"']*）。 */
const usedInJs = new Set();
for (const f of JS_FILES) {
  const src = read(f);
  for (const m of src.matchAll(/class="([^"']*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) usedInJs.add(c);
  }
  for (const m of src.matchAll(/class=\\"([^"'\\]*)\\"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) usedInJs.add(c);
  }
  for (const m of src.matchAll(/classList\.(?:add|remove|toggle|contains)\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) {
    for (const c of m[1].split(/\s+/)) if (c) usedInJs.add(c);
  }
}

const missing = [...usedInHtml, ...usedInJs].filter((c) => !defined.has(c));
ok(missing.length === 0,
  `用到的 class 必须有样式，缺失：${[...new Set(missing)].join(', ')}`);

// ---------- 2. id 覆盖 ----------
const htmlIds = new Set();
for (const p of PAGES) for (const m of read(p).matchAll(/id="([^"]+)"/g)) htmlIds.add(m[1]);

// JS 侧动态创建的 id 也要算进来，否则会误报：
//   · innerHTML 模板里的 id="go-pan"
//   · box.id = 'boot-error'
const jsIds = new Set();
for (const f of JS_FILES) {
  const src = read(f);
  for (const m of src.matchAll(/id="([^"]+)"/g)) jsIds.add(m[1]);
  for (const m of src.matchAll(/\.id\s*=\s*['"`]([^'"`]+)['"`]/g)) jsIds.add(m[1]);
}
const allIds = new Set([...htmlIds, ...jsIds]);

const refIds = new Set();
for (const f of JS_FILES) {
  const src = read(f);
  for (const m of src.matchAll(/\$\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) refIds.add(m[1]);
  for (const m of src.matchAll(/getElementById\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) refIds.add(m[1]);
}
const missingIds = [...refIds].filter((i) => !allIds.has(i));
ok(missingIds.length === 0,
  `JS 引用的 id 必须存在于 HTML 或由 JS 创建，缺失：${missingIds.join(', ')}`);

// ---------- 3. CSS 选择器 ASCII ----------
const badSel = cssSelectors(css).filter((s) => /[^\x00-\x7F]/.test(s));
ok(badSel.length === 0, `CSS 选择器必须纯 ASCII（WXSS 会 unexpected），违规：${badSel.join(' | ')}`);

// ---------- 4. CSS 花括号配对 ----------
ok((css.match(/{/g) || []).length === (css.match(/}/g) || []).length, 'style.css 花括号必须配对');

// ---------- 5. 资源存在 ----------
const missingAssets = [];
const assetRe = /(?:src|href)="([^"#][^"]*\.(?:png|jpg|jpeg|svg|webp|css|js))"/g;
for (const p of PAGES) {
  const html = read(p);
  for (const m of html.matchAll(assetRe)) {
    const rel = m[1].split('?')[0];
    if (/^(https?:)?\/\//.test(rel)) continue;
    if (!fs.existsSync(path.join(ROOT, rel))) missingAssets.push(`${p} → ${rel}`);
  }
}
ok(missingAssets.length === 0, `HTML 引用的本地资源必须存在，缺失：${missingAssets.join(', ')}`);

// ---------- 6. 无小程序残留 ----------
const mpResidue = [];
for (const f of JS_FILES) {
  const src = read(f);
  if (/\bPage\s*\(/.test(src)) mpResidue.push(`${f} 出现 Page()`);
  if (/\bsetData\s*\(/.test(src)) mpResidue.push(`${f} 出现 setData()`);
  // wx. 只查 API 形态（wx.xxx(），排除 lunar.js 里 '{wx.mu}' 这类宿名映射；页面 JS 本就不该有
  if (/\bwx\.[a-zA-Z]+\s*\(/.test(src)) mpResidue.push(`${f} 出现 wx.*() API`);
}
for (const p of PAGES) {
  const html = read(p);
  if (/\.wxml|\.wxss|wx:for|wx:if|bindtap/.test(html)) mpResidue.push(`${p} 含 WXML 语法`);
}
ok(mpResidue.length === 0, `不得残留小程序 API/语法：${mpResidue.join(', ')}`);

// ---------- 汇总 ----------
console.log(`\n通过 ${pass} 项，失败 ${fail.length} 项`);
if (fail.length) {
  console.log('失败明细:');
  fail.forEach((f) => console.log('  ✗', f));
  process.exit(1);
} else {
  console.log('✓ 全部通过');
  console.log(`  class：CSS 定义 ${defined.size} / HTML 用到 ${usedInHtml.size} / JS 拼出 ${usedInJs.size}`);
  console.log(`  id：HTML ${htmlIds.size} / JS 创建 ${jsIds.size} / JS 引用 ${refIds.size}`);
}
