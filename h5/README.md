# 六爻 pro · H5 版

## 打开方式

直接双击 `index.html` 即可（纯静态，无需服务器、无需构建、无需联网）。

**手机上打开**：把 `h5/` 整个目录传到手机，用浏览器打开 `index.html`；
或起个本地服务，同局域网访问：

```bash
cd h5
python -m http.server 8080
# 手机浏览器访问 http://<电脑局域网IP>:8080
```

## 手机适配（已实测）

已在 6 档真实机型视口下用 CDP 实测并修完，横向溢出为 0：

| 机型 | CSS 视口 | DPR |
|---|---|---|
| 安卓小屏 | 360 | 3 |
| iPhone SE2/ 8 | 375 | 2 |
| iPhone 12/13 | 390 | 3 |
| iPhone 14 Pro | 393 | 3 |
| iPhone 14 Pro Max | 430 | 3 |

### 盘面按视口自适应

`--disc-d` 与 `--s` 由 `page-divine.js` 的 `fitDisc()` 按视口算出：

```
可用宽 = 视口 − 24(page padding) − 26(panel padding) − 2(panel border)
disc-d = clamp(268, 可用宽, 340)
--s    = disc-d / 300
```

所有盘面几何（爻画、文字、太极、金边、中场、铜钱）都用
`calc(基准值 * var(--s))`。**基准 300px 时 `--s`=1，几何与基准完全一致** ——
已定的视觉效果不变，同时 360px 小屏也放得下。

`resize` / `orientationchange` 会重新计算并**重建八卦环**（爻画与文字的半径
在 JS 里算，不随 CSS 变量自动变）。

### 其他适配项

- **安全区**：`.page` 的 padding 用 `env(safe-area-inset-*)`，避开刘海屏与底部 Home 指示条
- **触摸目标**：按钮、下拉选择器、揭幕按钮统一 `min-height:46px`（iOS HIG 最小 44px）
- **字号下限**：10~11px 的小字全部提到 11px 以上（爻位标注、方位注释、六亲纳甲、状态标签）
- **窄屏表格**：≤374px 时六爻表七列整体缩一档，避免「状态」列被挤
- **横向滚动**：`.disc` 加 `overflow:hidden` + `.sheen` 加 `contain:paint`
- 旋转中的 `.sheen` 会在布局上把 body 撑宽（视觉上 `clip-path` 已裁掉，
  但布局溢出计算不看 clip-path，部分安卓浏览器会出横向滚动条）
- **字体放大不锁死**：`-webkit-text-size-adjust:100%`，信息密集布局缩放是有用的无障碍手段
- `@media (hover:hover)` 才给按钮加 hover 反馈，避免触摸设备「粘住」

## 三页流程

| 页面 | 文件 | 作用 |
|---|---|---|
| 起卦 | `index.html` | 摇六爻 · 八卦盘逐爻点亮 · 成卦揭幕 |
| 排盘 | `pan.html` | 纳甲装卦 · 六亲六神 · 旺衰旬空 · 卦体格局 |
| 解卦 | `interpret.html` | 用神取用 · 吉凶断语 · 动爻详参 |

数据存 `sessionStorage`，三页共享。直接打开排盘/解卦页若没有卦例数据会自动跳回起卦页。

## 目录

```
h5/
├── index.html / pan.html / interpret.html    三页
├── style.css                                 全局样式（盘面几何在此）
├── app.js                                    共享运行时：状态存取 / 报错可见化 / DOM helper
├── page-divine.js                            起卦页逻辑（八卦盘构建 + 铜钱摇卦）
├── page-pan.js                               排盘页逻辑
├── page-interpret.js                         解卦页逻辑
├── vendor/                                   算法层：卦象/64卦解读/384爻标签 + 农历/规则/引擎
│   ├── core-data.js / meaning-data.js / yao-labels.js
│   └── lunar.js / rules.js / engine.js
└── tests/                                    Node 回归测试（不进包体）
    ├── engine-port.test.js                   算法层 18 项
    └── h5-structure.test.js                  结构层 6 项（class/id/ASCII/资源引用）
```

## 关键设计

**算法层零改动**。`vendor/` 六个文件按顺序用普通 `<script>` 加载即可（都是挂 `globalThis` 的 IIFE）。加载顺序不可颠倒：

```
core-data → meaning-data → yao-labels → lunar → rules → engine
```

`rules.js` 顶层要读 `globalThis.ZHI_WUXING`，`engine.js` 顶层要读 `globalThis.Lunar`。

**盘面几何是唯一基准**：`_preview/CSS重画八卦盘-效果预览.html`。
R=88（爻画半径）、RL=122（文字半径）、爻线长 34 厚 5、gap 4，
全部为用户截图实测值，H5 版 1:1 复刻未做缩水。
爻画暗态用 `#6b5a42`（对比度 2.66:1），点亮`#e8c877`（10.88:1）——
**不要改回更暗的颜色**，真机盘面上会完全看不见。

**卦序=后天**（离南上·坤西南·兑西·乾西北·坎北下·艮东北·震东·巽东南），
洛书数为九宫数，对宫之和恒为 10（9+1、2+8、7+3、6+4）。

**铜钱落在盘面外的中场**，不在盘内。这是算过的结论：
盘面三条带（太极外圈 46 / 爻画带 78~98 / 文字带 109~135）之间
容不下三枚 52px 的钱，穷举验证「既不压太极也不压爻画」的落点无解。
所以按传统铜钱起卦的实际形态办——钱在盘外场地落定，盘面只管呈现卦位。

**爻象判法复用引擎口径**：字为 3、背为 2，三枚之和
6=老阴(动阴) 7=少阳(静阳) 8=少阴(静阴) 9=老阳(动阳)。

## 改了之后怎么验

**不要只看代码，必须截图看渲染。** 历史上多次「检查器 0 错误但渲染是错的」。

### Edge headless 截图（宽屏快速预览）

```bash
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
"$EDGE" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=480,1000 --virtual-time-budget=3000 \
  --screenshot=out.png "file:///绝对路径/h5/index.html"
```

### CDP 真机视口截图 + 自适应检测（手机适配必用）

用 Edge 的 CDP 在 6 档真实机型视口下检测横向溢出 / 触摸目标 / 字号 /
文本裁切。起实例有两个必需的参数，缺一个就连不上：

```python
EDGE, '--remote-debugging-port=9333',
'--remote-allow-origins=*',   # 缺这个 websocket 握手直接 403
```

测量用 `Emulation.setDeviceMetricsOverride` 设精确视口。

### 三个已知的测量陷阱

1. **Edge headless 忽略 `--window-size` 的窄宽度**，最小视口约 496px，
   设390 也拿到 496。要精确视口必须用 CDP 的
   `Emulation.setDeviceMetricsOverride`。
2. **截图缩放会造成「假溢出」**。截图被缩到更小宽度显示时，
   元素看起来伸出右边，实际 `getBoundingClientRect()` 完全正常。
   判断是否溢出必须用脚本量 `body.scrollWidth` vs `clientWidth`。
3. **`scrollWidth` 对 transform 元素失真**。旋转中的 `.sheen`
   `scrollWidth` 必然大于父容器，但视觉上已被 `clip-path` 裁掉。
   审计脚本要排除「祖先有 overflow/clip-path」的元素，否则满屏假警报。

### 回归测试

```bash
cd h5
node tests/engine-port.test.js    # 算法层 18 项
node tests/h5-structure.test.js   # 结构层 6 项
```

`engine-port.test.js` 直接指向 `vendor/`，测的是 H5 自己的算法层。
`h5-structure.test.js` 查 class/id/ASCII/资源引用与页面 JS 的小程序 API 残留。

## 铜钱素材

铜钱正面是 `assets/coin-qianlong-front.png`（256×256，94KB，
上乾→下隆→右通→左寶，方孔为 alpha=0 真镂空）。

生成脚本在项目根 `_preview/make_coin_png.py`：把 ImageGen 产出的
白底图按**纯亮度判据**抠成透明背景（饱和在这个图上不是可靠判据，
已弃用），并做反预乘去白边。亮度阈值是实测值：钱体最亮 min-channel=153，
背景最低=222，方孔≈251 → 中轴 178，软 ramp 155→200。

`assets/` 下的 `coin-face.png` 等 4 个旧 PNG 仅作回滚备份保留，不再引用。
