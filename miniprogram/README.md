# 六爻 pro · 微信小程序

铜钱起卦 · 纳甲排盘 · 卦象解读。算法层与 Web 版同源（`tests/parity-web-vs-mp.js` 验证 400 卦例 × 20 字段完全一致）。

## 一、本地导入与真机预览

### 1. 装微信开发者工具
下载：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

### 2. 导入项目
- 打开 DevTools → **导入项目**
- 目录选择：`本仓库/miniprogram` 目录（即 `miniprogram/` 这一层，不要选到仓库根）
- AppID：已写入 `project.config.json` → `wx828f1844efa44608`
- 后端服务：**不勾选**（本项目无网络请求）
- 点击「导入」即可编译运行

### 3. 真机预览
- DevTools 右上角 **预览** → 用微信扫码
- 手机上可完整走通：起卦 → 排盘 → 解卦

## 二、页面结构

| 页面 | 路径 | 职责 |
|------|------|------|
| 起卦 | `pages/divine/divine` | 三枚铜钱入龟壳，逐爻或自动成卦 |
| 排盘 | `pages/pan/pan` | 纳甲六亲、六神、旺衰旬空、变卦、卦体格局、神煞 |
| 解卦 | `pages/interpret/interpret` | 用神取用、世应、飞伏神、元神忌神仇神、动爻详参、卦象解读 |

页面间通过 `app.globalData` 传递卦例（`lastResults` / `divineDate` / `topic`）。

## 三、目录结构

```
miniprogram/
├── app.js / app.json / app.wxss   # 入口与全局样式
├── project.config.json             # 工程配置（含 AppID）
├── data/
│   ├── core-data.js                # 64 卦 / 纳甲 / 六亲 / 六神
│   ├── meaning-data.js             # 64 卦现代白话解读
│   └── yao-labels.js               # 384 爻吉凶标签
├── utils/
│   ├── lunar.js                    # 农历库（取日辰月建旬空）
│   ├── rules.js                    # 规则层（旺衰/旬空/飞伏神/神煞/卦体）
│   └── engine.js                   # 引擎层（抛爻/装卦/解卦）
├── assets/                         # 龟壳与铜钱 PNG
├── pages/{divine,pan,interpret}/   # 三页
└── tests/                          # 测试
```

## 四、测试

```bash
cd miniprogram
node tests/engine-port.test.js        # 算法层移植 18 项
node tests/page-e2e.test.js           # 起卦页 37 项
node tests/three-pages.test.js        # 三页联动 17 项
node tests/parity-web-vs-mp.js        # 与 Web 版一致性 400 卦例
```

## 五、主包体积

| 部分 | 体积 |
|------|------|
| utils（含农历库 426KB） | 514 KB |
| assets（PNG） | 194 KB |
| data | 149 KB |
| pages + 入口 | 55 KB |
| **合计** | **约 913 KB / 2048 KB（44.6%）** |

余量充足，无需分包。后续若加内容仍需留意 2MB 上限。

## 六、⚠️ 上架审核须知（重要）

微信小程序《运营规范》对 **算命 / 占卜 / 风水** 类内容审核严格，**目前无标准开放类目**可直接挂"六爻 / 算卦"，个人主体大概率被驳回。

### 建议做法

1. **类目选择**：优先试 `文娱 → 资讯`，或 `工具 → 其他工具`。避免选择任何带"占卜/命理/宗教"字样的类目。
2. **简介与文案中性化**：
   - 小程序名称「六爻 pro」可保留，但简介建议写为
     「铜钱起卦传统文化演示：纳甲装卦、六亲六神、旺衰旬空规则推演」
   - 页面内已加免责说明（解卦页底部），**不要**出现"预测命运""算命""准确率""灵验""转运开运"等词。
3. **不接入支付、不导流**：不出现任何购买算命服务、加微信、跳转外部链接的引导。
4. **不承诺准确性**：UI 中避免「精准测算」「必定灵验」类表述。
5. **预留驳回方案**：若审核不通过，可退回 Web 版（`index.html`）单文件、零审核、用户直接用浏览器打开，功能完全一致。

### 需要你本人完成的操作

我无法代为注册 / 上传 / 提交审核，以下必须你在本地或公众平台操作：

1. 登录 https://mp.weixin.qq.com ，用该 AppID 对应的小程序账号确认「开发 → 开发管理 → 开发设置」中的 AppID 一致
2. 在「设置 → 基本设置」填写名称、简介、类目、服务类目
3. DevTools 导入本项目 → 真机预览自测
4. DevTools 点「上传」→ 公众平台「提交审核」
5. 审核通过后「发布」

## 七、算法层移植要点（供后续维护）

小程序无 `window`，移植时做了三处适配（详见 `.ai-memory/`）：

| Web 版 | 小程序版 |
|--------|----------|
| `window.ICORE = ...` | `globalThis.ICORE = ...` |
| `})(typeof global !== 'undefined' ? global : this);` | 同（`global` 在小程序可用） |
| `lunar.js` 走 `window` 平铺 | 改 UMD 头，同时挂 `globalThis` 与 `module.exports` |

**注意**：不可把 `globalThis.ICORE =` 简化成裸赋值 `ICORE =`——小程序模块作用域下会变成模块局部变量，引擎读 `undefined`。
