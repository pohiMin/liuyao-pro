# 六爻 pro

铜钱起卦 → 纳甲排盘 → 卦象解读，三页流程的六爻占卜工具。

**纯静态 H5**：无后端、无数据库、无构建、无第三方依赖，把 `h5/` 目录扔到任何静态服务器就能跑。

- 线上地址：https://liuyao-pro.app.workbuddy.host/
- 应用代码：`h5/`

## 本地运行

直接双击 `h5/index.html` 即可（无需服务器）。或起个本地服务：

```bash
cd h5
python -m http.server 8080
```

## 目录

```
h5/
├── index.html / pan.html / interpret.html   三页：起卦 / 排盘 / 解卦
├── style.css                                全局样式（八卦盘几何在此）
├── app.js                                   共享运行时：状态存取 / 报错可见化
├── page-divine.js                           起卦页：八卦盘构建 + 铜钱摇卦
├── page-pan.js / page-interpret.js          排盘 / 解卦页
├── vendor/                                  算法层：卦象数据 + 农历 + 规则 + 引擎
├── assets/                                  铜钱素材
└── tests/                                   Node 回归测试
```

三页之间用 `sessionStorage` 传递卦例数据。

## 回归测试

```bash
cd h5
node tests/engine-port.test.js    # 算法层 18 项
node tests/h5-structure.test.js   # 结构层 6 项
```

## 约定

- `vendor/` 是算法层，加载顺序不可颠倒：
  `core-data → meaning-data → yao-labels → lunar → rules → engine`
- `vendor/` 里 `lunar.js` 的 `wx.` 是二十八宿拼音缩写映射，不是微信 API
- 页面免责声明（起卦页 A14 / 解卦页 J13）不要删

## 说明

本项目此前有微信小程序版本，已于 2026-10-13 整体退役，不再维护。当前唯一代码线是 `h5/`。
