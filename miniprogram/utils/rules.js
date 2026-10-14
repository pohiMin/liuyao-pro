/* 六爻传统规则模块
 * ------------------------------------------------------------------
 * 规则全部依《增删卜易》（野鹤老人）、《卜筮正宗》（王洪绪）原文提炼，
 * 每条规则均标注出处章节，便于复核。
 *
 * 本模块只做「规则计算」，不生成断语——断语仍由 engine.interpret 统一组织。
 */
(function (global) {
  'use strict';

  const ZHI_WX = globalThis.ZHI_WUXING;
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // 地支相冲（卜筮正宗「地支相合相衝」）
  const CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
  // 地支相合（六合章：子丑 寅亥 卯戌 辰酉 巳申 午未）
  const HE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  // 三合局（六合章：申子辰水、巳酉丑金、寅午戌火、亥卯未木）
  const SANHE = [
    { zhi: ['申', '子', '辰'], wx: '水' },
    { zhi: ['巳', '酉', '丑'], wx: '金' },
    { zhi: ['寅', '午', '戌'], wx: '火' },
    { zhi: ['亥', '卯', '未'], wx: '木' },
  ];
  // 四长生（卜筮正宗「長生掌訣」）
  const CHANGSHENG = { 水: '申子', 金: '巳辰卯寅', 木: '亥子', 火: '寅卯', 土: '巳辰卯寅' };

  // 旬空所属季节之月（真空判定用，增删卜易旬空章「春土夏金秋木三冬逢火是真空」）
  const SEASON_MONTH_WX = { 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水', 子: '水', 丑: '土' };

  function shengOf(w) { return SHENG[w]; }
  function keOf(w) { return KE[w]; }
  function rel(a, b) {
    if (!a || !b) return null;
    if (a === b) return 'same';
    if (SHENG[a] === b) return 'sheng';
    if (SHENG[b] === a) return 'beSheng';
    if (KE[a] === b) return 'ke';
    return 'beKe';
  }

  // ============ 一、原神 / 忌神 / 仇神 ============
  // 《增删卜易》用神元神忌神仇神章：
  //   「元神者，生用神之爻…忌神者，克用神之爻也…仇神者，克制元神不能生用神，反生忌神而克害用神」
  //   「假令金为用神，生金者土也，土为元神；克金者火也，火为忌神；克土生火者木也，木为仇神。」
  function yuanJiChou(yongWx) {
    if (!yongWx) return null;
    // 元神 = 生用神者（用神所生者？注意方向：能生 yongWx 的那个五行）
    const yuan = Object.keys(SHENG).find(w => SHENG[w] === yongWx);
    // 忌神 = 克用神者
    const ji = Object.keys(KE).find(w => KE[w] === yongWx);
    // 仇神 = 克元神而生忌神者
    const chou = yuan ? Object.keys(KE).find(w => KE[w] === yuan && SHENG[w] === ji) : null;
    return { yuan: yuan || null, ji: ji || null, chou: chou || null };
  }

  // 六亲层面的对应：元神/忌神/仇神既可按五行推，也可按六亲推。
  // 五行推是本义（《增删卜易》原文即以五行举例），六亲推只是其外在表现。
  // 用神六亲 -> 生用神者六亲 / 克用神者六亲 / 克元神而生忌神者六亲
  const QIN = { 父母: '木', 兄弟: '木', 子孙: '火', 妻财: '土', 官鬼: '水' }; // 占位，实际按卦宫五行推
  function qinOfPalace(palaceElem, yaoWx) {
    if (palaceElem === yaoWx) return '兄弟';
    if (SHENG[yaoWx] === palaceElem) return '父母';
    if (SHENG[palaceElem] === yaoWx) return '子孙';
    if (KE[palaceElem] === yaoWx) return '妻财';
    return '官鬼';
  }
  // 由用神六亲反查其五行（用神六亲相对本宫的关系 → 实际爻的五行由该六亲爻决定）
  // 这里改为：给定卦宫与用神六亲，找出该六亲的五行（可能不唯一，跳过——按爻实际五行处理更准）
  // 故本函数仅在「用神为单爻」时用于校验，实际计算走 qinOfPalace + 爻五行。

  // ============ 二、元神 / 忌神 有力无力 ============
  // 《增删卜易》元神忌神衰旺章
  // 元神有力五：①旺相/临日月/得日月动爻生扶 ②动化回头生、化进神 ③长生帝旺于日辰
  //             ④与忌神同动 ⑤旺动临空、化空（「动不为空，待冲空实空之日而为有用」）
  // 元神无力六：①休囚不动或动而休囚又被伤克 ②休囚逢旬空月破 ③休囚动化退神
  //             ④衰而又绝 ⑤入三墓 ⑥休囚动而化绝、化克、化破、化散
  // 忌神有力五：①旺相/遇日月动爻生扶/临日月 ②动化回头生、化进神 ③旺动临空、化空
  //             ④长生帝旺于日辰 ⑤与仇神同动
  // 忌神无力七：①休囚不动或动而休囚被日月动爻克 ②静临空破 ③入三墓
  //             ④衰动化退神 ⑤衰而又绝 ⑥动化绝、化克、化破、化散 ⑦与元神同动
  function powerOfYuanJi(kind, yao, ctx) {
    // kind: 'yuan' | 'ji'
    const notes = [];
    let strong = 0;   // 有力计分
    let weak = 0;     // 无力计分
    if (yao.wang === '旺' || yao.wang === '相') { strong += 2; notes.push('旺相'); }
    else if (yao.wang === '囚' || yao.wang === '死') { weak += 1; notes.push('休囚'); }
    if (yao.gz === ctx.dayGZ) { strong += 2; notes.push('临日辰'); }
    if (yao.zhi === ctx.monthZhi) { strong += 2; notes.push('临月建'); }
    if (yao.isMoving) {
      notes.push('发动');
      if (yao.changedTui) { weak += 2; notes.push('化退神'); }
      if (yao.changedJin) { strong += 2; notes.push('化进神'); }
      if (yao.huiTouKe) { weak += 1; notes.push('化回头克'); }
      if (yao.huiTouSheng) { strong += 1; notes.push('化回头生'); }
      if (yao.kong) { strong += 1; notes.push('动而临空——动不为空，待出空'); }
    } else {
      if (yao.kong || yao.monthPo) { weak += 2; notes.push('静而空破'); }
    }
    if (yao.sanMu) { weak += 2; notes.push('入三墓'); }
    if (kind === 'yuan' && yao.partnerMoving) { strong += 1; notes.push('与忌神同动，得两生'); }
    if (kind === 'ji' && yao.partnerMoving) { weak += 1; notes.push('与元神同动，忌力稍减'); }
    return {
      notes,
      power: strong - weak,
      label: strong - weak > 0 ? '有力' : (strong - weak < 0 ? '无力' : '平'),
    };
  }

  // ============ 三、飞神 / 伏神 ============
  // 《增删卜易》飞伏神章 + 《黄金策》飞伏歌诀：
  //   「伏克飞神为出暴，飞来克伏反伤身。伏去生飞名泄气，飞来生伏得长生。」
  // 伏神有用者六：①得日月生 ②旺相 ③得飞神生 ④得动爻生 ⑤得日月动爻冲克飞神 ⑥飞神空破休囚墓绝
  // 伏神终不得出者五：①休囚无气 ②被日月冲克 ③被旺相飞神克害 ④墓绝于日月飞爻 ⑤休囚值旬空月破
  const FEIFU_SONG = {
    fuKeFei: '伏克飞神为出暴',   // 吉：伏神克飞神，伏神得势
    feiKeFu: '飞来克伏反伤身',   // 凶：飞神克伏神
    fuShengFei: '伏去生飞名泄气', // 凶：伏神生飞神，泄气
    feiShengFu: '飞来生伏得长生', // 吉：飞神生伏神
    biHe: '飞伏不和为无助',
  };
  function feiFuJudge(fuShen, feiShen, ctx) {
    if (!fuShen || !feiShen) return null;
    const r = rel(fuShen.wx, feiShen.wx);
    let key = 'biHe', verdict = '飞伏不和，伏神受制，须另寻他法';
    if (r === 'ke') { key = 'fuKeFei'; verdict = '伏克飞神，伏神虽被压而有出暴之势，谓之「出暴」，可用'; }
    else if (r === 'beKe') { key = 'feiKeFu'; verdict = '飞来克伏，伏神受伤，谓之「反伤身」，虽有用亦难出'; }
    else if (r === 'sheng') { key = 'fuShengFei'; verdict = '伏去生飞，泄气于飞神，事有漏泄，伏神终不得出'; }
    else if (r === 'beSheng') { key = 'feiShengFu'; verdict = '飞来生伏，伏神得长生，虽不现亦如现，可用'; }
    else { key = 'biHe'; verdict = '飞伏同气，伏神得飞神之扶，可出'; }

    // 伏神有用六 / 无用五
    const useReasons = [], deadReasons = [];
    if (ctx.dayWx && rel(ctx.dayWx, fuShen.wx) === 'sheng') useReasons.push('伏神得日月生');
    if (ctx.monthWx && rel(ctx.monthWx, fuShen.wx) === 'sheng') useReasons.push('伏神得月建生');
    if (fuShen.wang === '旺' || fuShen.wang === '相') useReasons.push('伏神旺相');
    if (rel(feiShen.wx, fuShen.wx) === 'sheng') useReasons.push('伏神得飞神生');
    if (ctx.movingShengFu) useReasons.push('伏神得动爻生');
    if (ctx.chongKeFei) useReasons.push('日月动爻冲克飞神');
    if (feiShen.kong || feiShen.monthPo || feiShen.wang === '囚' || feiShen.wang === '死' || feiShen.sanMu) {
      useReasons.push('飞神空破休囚墓绝');
    }
    if (fuShen.wang === '囚' || fuShen.wang === '死') deadReasons.push('伏神休囚无气');
    if (ctx.dayWx && (rel(ctx.dayWx, fuShen.wx) === 'ke' || rel(ctx.dayWx, fuShen.wx) === 'beKe') && CHONG[ctx.dayZhi] === fuShen.zhi) {
      deadReasons.push('伏神被日月冲克');
    }
    if ((feiShen.wang === '旺' || feiShen.wang === '相') && rel(feiShen.wx, fuShen.wx) === 'ke') {
      deadReasons.push('伏神被旺相飞神克害');
    }
    if (fuShen.kong || fuShen.monthPo) deadReasons.push('伏神休囚值旬空月破');

    const usable = useReasons.length > deadReasons.length;
    return { song: FEIFU_SONG[key], key, verdict, useReasons, deadReasons, usable };
  }

  // ============ 四、进神 / 退神 ============
  // 《增删卜易》进神退神章：
  //   进神：亥化子，寅化卯，巳化午，申化酉，丑化辰，辰化未，未化戌，戌化丑
  //   退神：子化亥，卯化寅，午化巳，酉化申，辰化丑，未化辰，戌化未，丑化戌
  const JIN = { 亥: '子', 寅: '卯', 巳: '午', 申: '酉', 丑: '辰', 辰: '未', 未: '戌', 戌: '丑' };
  const TUI = { 子: '亥', 卯: '寅', 午: '巳', 酉: '申', 辰: '丑', 未: '辰', 戌: '未', 丑: '戌' };
  function jinTui(fromZhi, toZhi) {
    if (!fromZhi || !toZhi) return null;
    if (JIN[fromZhi] === toZhi) return 'jin';
    if (TUI[fromZhi] === toZhi) return 'tui';
    return null;
  }
  // 野鹤曰：夫进神之法有四 / 退神之法亦有四
  // —— 此处只判进退，旺衰之进退留给解卦层按「动旺相而化旺相…待时而进」处理。

  // ============ 五、旬空：真空 / 假空 ============
  // 《增删卜易》旬空章：
  //   「旺不为空，动不为空，有日建动爻生扶者不为空，动而化空、伏而旺相皆不为空。
  //     月破为空。有卦不动为空，爻反伏而被克为空。
  //     真空为空，真空即春土、夏金、秋木、三冬逢火是真空。」
  // 「真空」之义：爻之五行在该月休囚无气（春土、夏金、秋木、冬火即其举例）而又逢旬空，
  //   则为空到底、待出旬填实方能有力；旺相之爻逢空则为假空，终非真空。
  function kongJudge(yao, ctx) {
    if (!yao.kong) return { isKong: false };
    const reasons = [];
    let zhen = false;
    // 真空：爻休囚无气（旺相休囚死囚）而逢空 —— 原文「春土、夏金、秋木、三冬逢火是真空」
    const SHI_RUI = yao.wang === '休' || yao.wang === '囚' || yao.wang === '死' || yao.wang === '待考';
    if (SHI_RUI) { zhen = true; reasons.push('爻逢旬空而休囚无气，是为真空'); }
    // 假空：旺相、发动、有日月生扶、动而化空、伏而旺相 —— 暂空待时
    if (yao.wang === '旺' || yao.wang === '相') { zhen = false; reasons.push('旺相不为空（假空），待时自出'); }
    if (yao.isMoving) { zhen = false; reasons.push('动不为空（假空），出空或填实之日可用'); }
    if (ctx.dayWx && rel(ctx.dayWx, yao.wx) === 'sheng') { zhen = false; reasons.push('得日辰生扶，不为空'); }
    if (ctx.monthWx && rel(ctx.monthWx, yao.wx) === 'sheng') { zhen = false; reasons.push('得月建生扶，不为空'); }
    if (yao.monthPo) { zhen = true; reasons.push('月破亦为空'); }
    if (yao.isFu && (yao.wang === '旺' || yao.wang === '相')) { zhen = false; reasons.push('伏而旺相，不为空'); }
    return {
      isKong: true, zhen, fake: !zhen,
      label: zhen ? '真空' : '假空',
      note: zhen
        ? '真空到底之空——爻本休囚无气，又逢旬空，须待出旬填实，非受生扶所能解'
        : '假空——旺相、发动或受生扶者，终非空亡，待冲空、实空、填实之日可用',
      reasons,
    };
  }

  // ============ 六、暗动 ============
  // 《增删卜易》暗动章：「静爻旺相日辰冲之为暗动，静爻休囚日辰冲之为破」
  // 《增删卜易》日辰章：「冲旺相之静爻，既为暗动；冲衰弱之静爻为日破」
  function anDong(yao, ctx) {
    if (yao.isMoving || !ctx.dayZhi || CHONG[ctx.dayZhi] !== yao.zhi) return null;
    if (yao.wang === '旺' || yao.wang === '相') {
      return { type: '暗动', good: true, note: '静爻旺相被日辰冲，是为暗动，愈得其实力' };
    }
    return { type: '日破', good: false, note: '静爻休囚被日辰冲，是为日破，愈加无用' };
  }

  // ============ 七、月破不破 ============
  // 《增删卜易》月破章：「目下虽破，出月则不破；今日虽破，实破之日则不破，合之日则不破。
  //   近应日，远应年月。惟而不动又无日辰动爻生助者，则到底而破矣。」
  function monthPoJudge(yao, ctx) {
    if (!yao.monthPo) return null;
    const reasons = [];
    let broken = true;
    if (yao.isMoving) { broken = false; reasons.push('动爻逢月破——神兆机于动，目下破而出月即不破'); }
    if (ctx.dayWx && rel(ctx.dayWx, yao.wx) === 'sheng') { broken = false; reasons.push('得日辰生扶，不为到底破'); }
    if (ctx.movingShengYong) { broken = false; reasons.push('得动爻生扶，不为到底破'); }
    if (ctx.heYong) { broken = false; reasons.push('逢合，待冲开之日即不破'); }
    return {
      type: '月破',
      broken,
      note: broken
        ? '月破而又不动、无日月动爻生助——到底而破，此爻终无可用'
        : '月破而有生扶或有动——非到底之破，待出月、实破或冲合之日可用',
      reasons,
    };
  }

  // ============ 八、六冲卦 / 六合卦 ============
  // 《增删卜易》六冲章：子午 丑未 寅申 卯酉 辰戌 巳亥
  //   「卦逢六冲」—— 内外六爻地支两两相冲
  // 六合章：「卦逢六合」—— 内外六爻地支两两相合
  //
  // 【关键】必须初四、二五、三上三组同时成立，方为六冲卦/六合卦。
  // 原文：「务要三组六冲皆全，只有两组或一组六冲者不是六冲卦。
  //   例雷水解卦，卦中地支装得寅辰午午申戌，出现寅申、辰戌两组六冲，
  //   但因午午不是六冲，故此卦并非六冲卦，余类推。」
  // 六合同理。故此处用 every（三组全成），非 some（任一组即成）。
  //
  // 六冲卦共十：乾为天、坤为地、坎为水、离为火、艮为山、巽为风、兑为泽（八纯）
  //           + 雷天大壮 + 天雷无妄
  // 六合卦共八：天地否、地天泰、地雷复、雷地豫、山火贲、火山旅、泽水困、水泽节
  const LIU_PAI = [[0, 3], [1, 4], [2, 5]];
  // 逐组冲/合明细，供卦盘展示「几组成立」
  function liuChongDetail(najia) {
    const hits = LIU_PAI.filter(([a, b]) => CHONG[najia[a].zhi] === najia[b].zhi);
    return { groups: hits, all: hits.length === 3, count: hits.length };
  }
  function liuHeDetail(najia) {
    const hits = LIU_PAI.filter(([a, b]) => HE[najia[a].zhi] === najia[b].zhi);
    return { groups: hits, all: hits.length === 3, count: hits.length };
  }
  function liuChong(najia) { return liuChongDetail(najia).all; }
  function liuHe(najia) { return liuHeDetail(najia).all; }
  // 六冲卦断语要点（六合章 / 六冲章）
  const CHONG_NOTE = '卦逢六冲：冲者散也。占吉事不宜冲散，占凶事宜于冲散；必兼用神而言——用神旺虽冲不破，用神失陷凶而又凶。';
  const CHONG_HE_NOTE = '六冲卦变六合：散而复聚、离而必合，占婚姻先难后成，此为吉象；但若占官非盗贼则相反宜之。';
  const HE_CHONG_NOTE = '六合卦变六冲：先合后离、先亲后疏、得而复失，成而后退。惟占官非、盗贼事宜之。';

  // ============ 九、反吟 / 伏吟 ============
  // 《增删卜易》反伏章（以卦画阴阳论）：
  //   「卦变者，内外动而反伏者，同一卦也。如乾卦变坤卦。」—— 内外卦阴阳全反
  //   「爻变者，内外爻动而反伏者，非同一卦也。如升之观是也。」—— 内外卦互易其位
  //
  // 《卜筮正宗》反吟卦定例第十一 / 伏吟卦定例第十二（以纳甲地支论，判据更密）：
  //   「反吟卦有二。有卦之反吟，有爻之反吟。卦之反吟，卦变相冲也；爻之反吟，爻变相冲也。」
  //     —— 卦之反吟为八卦相冲四组：乾变巽、坎变离、艮变坤、震变兑
  //     —— 爻之反吟为十二支相冲：子变午、丑变未、寅变申、卯变酉、辰变戌、巳变亥
  //   「伏吟卦有三：乾卦变震、震变乾、无妄变大壮、大壮变无妄，此子寅辰复化子寅辰、
  //     午申戌复化午申戌，内外卦之伏吟，一也；姤卦变恒……此午申戌复化午申戌，
  //     外卦之伏吟，二也；大有卦变噬嗑……此子寅辰复化子寅辰，内卦之伏吟，三也。」
  //     —— 伏吟之判据为「卦变而六爻地支不变」。原文 28 例逐一验之，无一例外。
  //
  // 两书判据不同，故并存：卦画层面依《增删卜易》判反伏，纳甲地支层面依《卜筮正宗》
  // 判伏吟与爻之反吟。二者常同时成立而不冲突，故反伏优先返回。
  //
  // @param bits   本卦卦画，索引 0=初爻（最下），5=上爻（最上）
  // @param cbits  变卦卦画
  // @param najia  本卦纳甲 [{gz,zhi,wx,qin}]，用于伏吟与爻之反吟判定
  // @param cnajia 变卦纳甲
  function fanFu(bits, cbits, najia, cnajia) {
    if (!cbits) return null;
    const lo = bits.slice(0, 3), up = bits.slice(3, 6);
    const clo = cbits.slice(0, 3), cup = cbits.slice(3, 6);
    const lowSelfRev = lo === lo.split('').reverse().join('');   // 内卦三爻自反
    const upSelfRev = up === up.split('').reverse().join('');    // 外卦三爻自反
    const wholeFan = clo === lo.split('').map(x => (x === '1' ? '0' : '1')).join('')
      && cup === up.split('').map(x => (x === '1' ? '0' : '1')).join(''); // 内外皆阴阳全反（乾变坤）
    // 内外卦互易其位（升之观）。须 lo !== up，否则内外相同，互易形同不变，
    // 会把「六冲卦自身不变」误判为反伏——那种情形应归伏吟。
    const swap = lo !== up && clo === up && cup === lo;
    if (wholeFan) {
      return {
        type: '反伏',
        note: '内卦外卦阴阳尽反（乾变坤之类），为反伏卦。主成而败、败而成、得而失、失而得，反复无常',
      };
    }
    if (swap) {
      return {
        type: '反伏',
        note: '内卦外卦互易其位而反伏（升之观之类），主彼此地位互易、事有反复，退则有失',
      };
    }

    // —— 以下依《卜筮正宗》纳甲地支判伏吟与爻之反吟 ——
    // 伏吟之总判据：六爻纳甲地支不变。然原文又分三类，以「卦画何者动」别之：
    //   内外卦之伏吟——内外卦画皆变而地支不变（乾变震、子寅辰复化子寅辰）
    //   外卦之伏吟——内卦画不动、惟外卦变而外卦地支不变（姤变恒、午申戌复化午申戌）
    //   内卦之伏吟——外卦画不动、惟内卦变而内卦地支不变（大有变噬嗑、子寅辰复化子寅辰）
    // 故 scope 依卦画动静而定，地支不变为总纲。
    if (najia && cnajia && najia.length === 6 && cnajia.length === 6) {
      const z = najia.map(x => x.zhi), cz = cnajia.map(x => x.zhi);
      const zhiSame = z.join('') === cz.join('');
      if (zhiSame) {
        const lowMoved = lo !== clo, upMoved = up !== cup;
        const scope = (lowMoved && upMoved) ? '内外卦' : upMoved ? '外卦' : lowMoved ? '内卦' : '不变';
        const scopeNote = {
          '内外卦': '内外卦之伏吟。主事情缠绵不进、呻吟忧鬱，须待冲开之年月日',
          '外卦': '为外卦之伏吟。主外应不济、人心不定，事多反复难决',
          '内卦': '为内卦之伏吟。主内乱不定、主意浮移，虽行其事而多反复',
          '不变': '六爻纳甲地支全不变（六冲之卦必然如此），为伏吟。主事情缠绵不进，须待冲开之年月日',
        }[scope];
        return {
          type: '伏吟',
          scope: scope === '不变' ? '内外卦' : scope,
          guaScope: scope,
          note: '六爻纳甲地支全不变（' + z.join('') + '复化' + cz.join('') + '），' + scopeNote,
        };
      }
      // 爻之反吟：逐爻地支相冲（《卜筮正宗》「子变午、午变子……以此变出相冲，乃爻之反吟也」）
      const chongIdx = [];
      for (let i = 0; i < 6; i++) if (CHONG[z[i]] === cz[i]) chongIdx.push(i);
      if (chongIdx.length) {
        const pos = ['初', '二', '三', '四', '五', '上'];
        return {
          type: '爻之反吟',
          scope: '爻',
          chongIdx,
          note: chongIdx.length + ' 爻变出相冲（'
            + chongIdx.map(i => pos[i] + '爻' + z[i] + '变' + cz[i]).join('、')
            + '），为爻之反吟。主此爻之事反复颠倒、进退失据',
        };
      }
    }

    const notes = [];
    if (lowSelfRev && upSelfRev) {
      // 六冲卦（乾坤坎离及颐大过中孚小过）内卦外卦各自自反，无纳甲时亦依卦画判伏吟
      return {
        type: '伏吟',
        scope: '内外卦',
        note: '内外卦三爻各自自反（六冲之卦必然如此），为伏吟。主事情缠绵不进、呻吟忧鬱，须待冲开之年月日',
      };
    }
    if (lowSelfRev) notes.push('内卦伏吟——内则不安，主呻吟、忧鬱、事不遂');
    if (upSelfRev) notes.push('外卦伏吟——外则不宁，主动摇、迁改不常');
    if (notes.length) {
      return { type: '伏吟', note: notes.join('；') + '。伏吟主事情缠绵不进，须待冲开之年月日。' };
    }
    return null;
  }

  // 卦之反吟（《卜筮正宗》反吟卦定例第十一）：八卦相冲四组。
  //   乾巽相冲（乾右戌、左亥，巽右辰、左巳，故辰戌、巳亥相冲）、坎离相冲（子午）、
  //   艮坤相冲（艮右丑、左寅，坤右未、左申，故丑未、寅申相冲）、震兑相冲（震下卯、兑下酉）。
  // 原文所举 16 例，由八纯卦相冲推演而出（乾变巽含天风姤、风天小畜等）。
  // @param lower,upper 本卦内卦、外卦名（如「乾为天」为 乾,乾）
  // @param clower,cupper 变卦内卦、外卦名
  const FAN_YIN_GROUPS = [
    { a: '乾', b: '巽', note: '乾巽相冲（辰戌、巳亥相冲）' },
    { a: '坎', b: '离', note: '坎离相冲（子午相冲）' },
    { a: '艮', b: '坤', note: '艮坤相冲（丑未、寅申相冲）' },
    { a: '震', b: '兑', note: '震兑相冲（卯酉相冲）' },
  ];
  const FAN_YIN_NOTE = '卦之反吟：卦变相冲，' + FAN_YIN_GROUPS.map(g => g.note).join('；')
    + '。主彼此相忤、事有反复，旧事牵连不尽';
  const YAO_FAN_YIN_NOTE = '爻之反吟：爻变相冲（子变午、丑变未、寅变申、卯变酉、辰变戌、巳变亥）。主此爻进退失据、事多反复';
  function guaFanYin(lower, upper, clower, cupper) {
    if (!clower || !cupper) return null;
    // 卦之反吟：内卦与外卦各自落入相冲的一组，且内外卦名不同
    const pairHit = FAN_YIN_GROUPS.find(g =>
      (lower === g.a && clower === g.b) || (lower === g.b && clower === g.a));
    if (pairHit && (lower !== clower || upper !== cupper)) {
      return {
        type: '卦之反吟', kind: '卦反吟', detail: pairHit.note,
        note: '卦之反吟：' + pairHit.note
          + '。本卦「' + lower + lower + '」变「' + clower + cupper + '」，主彼此相忤、事有反复，旧事牵连不尽',
      };
    }
    // 外卦反伏而内卦不动、内卦反伏而外卦不动（《增删卜易》「观之坤」「巽之观」）
    if (lower === clower && upper !== cupper) {
      return { type: '卦之反吟', kind: '外卦反伏', note: '外卦反伏而内卦不动（观之坤之类）。主内稳外动、事出意外，或有外来搅扰' };
    }
    if (lower !== clower && upper === cupper) {
      return { type: '卦之反吟', kind: '内卦反伏', note: '内卦反伏而外卦不动（巽之观之类）。主外静内动、主意不定，隐患伏于内' };
    }
    return null;
  }

  // ============ 十、卦身 ============
  // 《卜筮正宗》安月卦身诀：「阴世则从五月起，阳世还从子月生，欲得识其卦中意，从初数至世方真。」
  // 阳世：世爻为阳，从子月起初爻数至世爻；阴世：世爻为阴，从午（阴历五月建午）起初爻数至世爻。
  function guaShen(yaos, shiIdx) {
    const shi = yaos[shiIdx];
    if (!shi) return null;
    const isYangShi = shi.yang;
    // 五月建午，故阴世从「午」起
    const startZhi = isYangShi ? '子' : '午';
    const si = ZHI.indexOf(startZhi);
    const target = ZHI[(si + shiIdx) % 12];
    const holder = yaos.findIndex(y => y.zhi === target);
    return {
      target,
      pos: holder >= 0 ? holder + 1 : null,
      holder,
      note: holder >= 0
        ? `卦身在${['初', '二', '三', '四', '五', '上'][holder]}爻（${target}），卦身有伤则事难成、须防有人从中作梗`
        : `卦身${target}不上卦，事无头绪、须防中间阻隔`,
    };
  }

  // ============ 十一、三合局 ============
  // 《增删卜易》六合章：申子辰合水、巳酉丑合金、寅午戌合火、亥卯未合木
  function sanHeJu(yaos) {
    const present = new Set(yaos.map(y => y.zhi));
    for (const j of SANHE) {
      if (j.zhi.every(z => present.has(z))) {
        return { wx: j.wx, zhi: j.zhi, note: `卦中${j.zhi.join('')}三合成${j.wx}局` };
      }
    }
    return null;
  }

  // ============ 十二、旺相休囚四季表 ============
  // 《卜筮正宗》旺相休囚论第十三：
  //   「春令木旺火相，夏令火旺土相，秋令金旺水相，冬令水旺木相，四季之月上旺金相，此八者旺相也。
  //     春上金兮夏金水兮秋木火兮冬火土兮，此八者休囚也。」
  // 《火珠林》财官辅助章所载完全相同，可互为印证：
  //   「春，寅卯木旺，巳午火相，亥子水休，申酉金囚，辰戌丑未土死。」余三季同例。
  // 说明：月建取节气月（lunar.getMonthInGanZhiExact），立春建寅、惊蛰建卯……，
  //       故月支五行即代表当令之气。此处按原文列表存表，供展示与复核。
  const WANG_XIANG = {
    春: { 旺: '木', 相: '火', 休: '水', 囚: '金', 死: '土' },
    夏: { 旺: '火', 相: '土', 休: '木', 囚: '水', 死: '金' },
    秋: { 旺: '金', 相: '水', 休: '土', 囚: '火', 死: '木' },
    冬: { 旺: '水', 相: '木', 休: '金', 囚: '土', 死: '火' },
    四季: { 旺: '土', 相: '金', 休: '火', 囚: '木', 死: '水' },
  };
  // 月支 → 季令。辰戌丑未为四季月（旺相休囚与四季同）。
  const SEASON_OF_ZHI = {
    寅: '春', 卯: '春', 巳: '夏', 午: '夏', 申: '秋', 酉: '秋',
    亥: '冬', 子: '冬', 辰: '四季', 戌: '四季', 丑: '四季', 未: '四季',
  };
  // 校验某爻在某月建下的旺衰是否符合原文表
  function wangBySeason(yongWx, monthZhi) {
    const s = SEASON_OF_ZHI[monthZhi];
    if (!s || !yongWx) return null;
    const t = WANG_XIANG[s];
    for (const k of ['旺', '相', '休', '囚', '死']) if (t[k] === yongWx) return k;
    return null;
  }

  // ============ 十三、月破节气定例 ============
  // 《卜筮正宗》月破定例：
  //   「立春正月节建寅破申，惊蛰二月节建卯破酉，清明三月节建辰破戌，
  //     立夏四月节建巳破亥，芒种五月节建午破子，小暑六月节建未破丑，
  //     立秋七月节建申破寅，白露八月节建酉破卯，寒露九月节建戌破辰，
  //     立冬十月节建亥破巳，大雪节建子破午，小寒十二月节建丑破未。
  //     凡月建所冲之交名为月破。」
  // 即：月破 = 与节气月建相冲之地支。列表在此备查，判定本身由 CHONG 推出。
  const MONTH_PO_TABLE = [
    { jie: '立春', zhi: '寅', po: '申' }, { jie: '惊蛰', zhi: '卯', po: '酉' },
    { jie: '清明', zhi: '辰', po: '戌' }, { jie: '立夏', zhi: '巳', po: '亥' },
    { jie: '芒种', zhi: '午', po: '子' }, { jie: '小暑', zhi: '未', po: '丑' },
    { jie: '立秋', zhi: '申', po: '寅' }, { jie: '白露', zhi: '酉', po: '卯' },
    { jie: '寒露', zhi: '戌', po: '辰' }, { jie: '立冬', zhi: '亥', po: '巳' },
    { jie: '大雪', zhi: '子', po: '午' }, { jie: '小寒', zhi: '丑', po: '未' },
  ];
  // 月建所对应节气（供卦盘标注「某月节建X」）
  function jieQiOf(monthZhi) {
    const t = MONTH_PO_TABLE.find(x => x.zhi === monthZhi);
    return t ? t.jie : null;
  }

  // ============ 十四、伏吟卦定例（《卜筮正宗》伏吟卦定例第十二）============
  // 原文逐一列举三例，可用卦名反查 bits 作为 fanFu 的权威测试集：
  //   外卦之伏吟：乾变震、震变乾、无妄变大壮、大壮变无妄（子寅辰复化子寅辰、午申戌复化午申戌）
  //   又：姤变小畜、小畜变姤、遁变小过、小过变遁、否变豫、豫变否、
  //       丰变同人、同人变丰、履变归妹、归妹变履、解变讼、讼变解（午申戌复化午申戌）
  //   内卦之伏吟：大有变噬嗑、噬嗑变大有、屯变需、需变屯、
  //       晋变大畜、大畜变晋、随变夫、夫变随、小畜变益、益变小畜、泰变复、复变泰
  //       （子寅辰复变子寅辰）
  // 说明：此处不重复存表，改由 test_rules.js 依卦名驱动验证，规则由 fanFu 统一判定。

  // ============ 十五、反吟卦定例（《卜筮正宗》反吟卦定例第十一）============
  // 原文以「卦变相冲」定之：
  //   乾为天变巽为风、巽为风变乾为天；天风姤变风天小畜、小畜变姤；
  //   水火既济变火水未济、未济变既济；山地剥变地山谦、谦变剥；
  //   雷泽归妹变泽雷随、随变归妹。此即两卦地支对冲相变，亦即我 rules.fanFu 之 swap/wholeFan 两类。
  //   爻变相冲者：子变午、午变子、丑变未、未变丑、寅变申、申变寅、
  //   卯变酉、酉变卯、辰变戌、戌变辰、巳变亥、亥变巳。

  // ============ 十六、火珠林飞伏七情 ============
  // 《火珠林》专列七节，各有标题与断语：
  //   「财伏鬼乡，买卖遭伤；日辰福德，方始荣昌」
  //     「财爻伏官鬼之下，乃财爻泄鬼无气，须是子孙旺相，透出日辰，或持世上方有，盖子孙能克官鬼也。」
  //   「用财伏兄，口舌相侵；若在世下，旺相可成」
  //     「财伏兄弟之下，本无气无财，却喜财爻旺相，贴世下透出，值日辰方有。」
  //   「财伏父母，旺相得半；财伏子孙，有气必满」
  //     「财伏父母之下，求财有一半」——用财须子能辅财，财伏父下则子不能生财。
  //   「用鬼伏兄，同类欺凌；若不虚诈，人不一心」
  //   「鬼伏财乡，因财有伤；官吏阻节，独发乖张」
  //   「鬼伏父母，举状经官；若财世上，求之不难」
  //   「鬼伏子孙，去路无门；官乘旺相，透出可分」
  //   「官鬼伏官，小人作难；若亲见贵，方许开颜」
  // 判法：以「用神六亲伏于何六亲之下」定其情，再依日辰、旺相、持世定轻重。
  const FU_QI = {
    '妻财伏官鬼': { title: '财伏鬼乡', note: '财爻伏官鬼之下，财去生官、泄气无气，须子孙旺相透出或持世方有财；买卖多遭伤', need: '子孙旺相、透出日辰或持世' },
    '妻财伏兄弟': { title: '财伏兄弟', note: '财被他人把住，故生口舌；须财爻旺相、贴世下透出、值日辰方有', need: '财爻旺相、值日辰' },
    '妻财伏父母': { title: '财伏父母', note: '求财只有一半——用财须子能辅财，财伏父下则子不能生财，故仅得本等之财', need: '财爻旺相（仅得一半）' },
    '妻财伏子孙': { title: '财伏子孙', note: '世应不相克，财终是有；若子孙旺相，父母持世应亦不能克子孙，求财亦有', need: '子孙旺相则财必满' },
    '官鬼伏兄弟': { title: '官鬼伏兄弟', note: '兄为虚诈口舌，同类欺凌，主官府多诈、吏贴赚钱，所谋到底脱空', need: '官鬼旺相持世或日辰临官鬼' },
    '官鬼伏妻财': { title: '官鬼伏妻财', note: '财去克了文书，主官人要钱、文书有阻；须官鬼旺相、伏世下或父母透出值日辰', need: '官鬼旺相、父母透出值日辰' },
    '官鬼伏父母': { title: '官鬼伏父母', note: '官化文书，欲下状求名须卦身贴世或官鬼旺相、父母值日，方利于呈词补名', need: '官鬼旺相、父母值日辰' },
    '官鬼伏子孙': { title: '官鬼伏子孙', note: '去路无门，只宜散忧；须官鬼旺相、透出直日辰方可。若子孙旺相或官鬼落空，则不作此断', need: '官鬼旺相透日辰（子孙旺相则反断）' },
    '官鬼伏官鬼': { title: '官鬼伏官鬼', note: '乃关隔之象，又主小人作难；须得旺相相扶、亲见贵人才可开颜', need: '官鬼旺相、亲见贵人' },
  };
  // feiQin 飞神六亲, fuQin 伏神六亲
  // ctx: { isShi 伏于世下, dayIsFu 日辰为用神, fuWang 伏神旺衰, fuKong 伏神空, fuMoving 伏神发动 }
  function fuQiJudge(feiQin, fuQin, ctx) {
    const key = fuQin + '伏' + feiQin;
    const r = FU_QI[key];
    if (!r) return null;
    const c = ctx || {};
    const good = [], bad = [];
    if (c.isShi) good.push('伏于世爻之下');
    if (c.dayIsFu) good.push('日辰临用神');
    if (c.fuWang === '旺' || c.fuWang === '相') good.push('伏神旺相');
    if (c.fuMoving) good.push('伏神发动');
    if (c.fuWang === '休' || c.fuWang === '囚' || c.fuWang === '死') bad.push('伏神休囚无气');
    if (c.fuKong) bad.push('伏神逢旬空');
    let level = '弱';
    if (good.length >= 2) level = '强';
    else if (good.length === 1) level = '中';
    return { key, title: r.title, note: r.note, need: r.need, good, bad, level };
  }

  // ============ 十七、独发乱动 ============
  // 《火珠林》「独发易取，乱动难寻；先看世应，后审浅深」：
  //   「一看世上旁爻生财旺相，忌应爻克世；二看世下亲爻财官喜静；
  //     三看何爻最旺为用神，如发动，动要生世；四看独发之爻，旺相最急，休囚事慢。」
  // 《卜筮正宗》六爻安静诀 / 六爻乱动诀：
  //   「卦遇六爻安静，当看用与日辰…忌神切莫加临世，应临用及原神，作事断然昌盛。」
  //   「六爻乱动事难明，须向宫中看用神。用若休囚遭克害，须知此事费精神。」
  const DUFA_RULES = {
    安静: '六爻安静，事态平稳。当专看用神与日辰：日辰生用、临用、临原神者昌；忌神加临世应则凶',
    独发: '独发之爻最易取。旺相最急、休囚事慢；用神独发而旺相者事速成，休囚者须待时而动',
    乱动: '六爻乱动事难明，须向宫中看用神。用神若休囚又遭克害，须知此事费精神；此时唯以世应为纲、看动爻生克世应之向',
    子孙独发: '子孙独发为退为散；乘旺相亦可求财。子孙为伤官之神，发动利脱事，又为九流、中贵、福德、医药、蚕禽',
    兄弟独发: '兄弟独发为诈为虚；乘旺相则财破嗟吁。兄弟为劫财之神，大忌隐伏，动发主虚诈不实之事',
    父母独发: '父母独发重迭艰辛；乘旺相文书可成。父母为重迭之神（祖父母、父母两重），最忌出现发动',
    官鬼独发: '官鬼独发为欺为盗；临吉神功名可望，临囚神必主兴讼盗贼。官鬼为官史，求名遇吉神必主立身清高',
    妻财独发: '妻财独发生鬼伤父，问病难瘳、占亲无路。大抵财动克父亦能生鬼；财爻宜旺不宜空，宜静不宜动（惟占脱货要财动）',
  };
  function duFaJudge(movingCount, movingQins, yongQin, yongWang) {
    if (!movingCount) return { key: '安静', note: DUFA_RULES['安静'], score: 0 };
    if (movingCount === 1) {
      const q = movingQins[0];
      if (yongQin && q === yongQin) {
        const urgent = yongWang === '旺' || yongWang === '相';
        return {
          key: '独发',
          note: DUFA_RULES['独发'] + (urgent ? '。用神独发而旺相，其事最急' : '。用神独发而休囚，须待时而动，勿躁'),
          score: urgent ? 6 : -2, urgent,
        };
      }
      return { key: '独发', note: DUFA_RULES['独发'], score: 2 };
    }
    if (movingCount <= 2) return { key: '乱动', note: DUFA_RULES['乱动'], score: -3 };
    return {
      key: '乱动',
      note: DUFA_RULES['乱动'] + (yongWang === '休' || yongWang === '囚' || yongWang === '死'
        ? '。用神休囚而众爻乱动，此事最须费力' : ''),
      score: (yongWang === '休' || yongWang === '囚' || yongWang === '死') ? -8 : -4,
    };
  }

  // ============ 十八、诸爻持世 ============
  // 《卜筮正宗》诸爻持世诀：
  //   「世爻旺相最为强，作事亨通大吉昌…」
  //   「父母持世主身劳，求嗣妾众也难招。官动财安宜赴试，财摇谋利莫心焦。占身财动无贤妇，又恐区区寿不高。」
  //   「子孙持世事无忧，求名切忌坐当头。避乱许安失可得，官讼从今了便休。有生无克诸般吉，有克无生反见愁。」
  //   「鬼爻持世事难安，占身不病也遭官。财物时时忧失脱，功名最喜世当权。八墓愁疑无散日，逢冲转祸变成欢。」
  //   「财爻持世益财荣，兄若交重不可逢。更遇子孙明暗动，利身克爻丧文凭。求官问讼宜财旺，动变兄官万事凶。」
  //   「兄弟持世莫求财，官与须虑祸将来。朱雀并临防口舌，如摇必定损妻财。父母相生身有寿，化官化鬼有奇灾。」
  const SHI_RULES = {
    父母: { note: '父母持世主身劳，求嗣妾众难招；官动财安宜赴试，财摇谋利莫心焦。占身财动无贤妇，又恐区区寿不高', good: false },
    子孙: { note: '子孙持世事无忧，求名切忌坐当头；避乱许安失可得，官讼从今了便休。有生无克诸般吉，有克无生反见愁', good: true },
    官鬼: { note: '鬼爻持世事难安，占身不病也遭官；财物时时忧失脱，功名最喜世当权。八墓愁疑无散日，逢冲转祸变成欢', good: false },
    妻财: { note: '财爻持世益财荣，兄若交重不可逢；更遇子孙明暗动，利身克爻丧文凭。求官问讼宜财旺，动变兄官万事凶', good: true },
    兄弟: { note: '兄弟持世莫求财，官与须虑祸将来；朱雀并临防口舌，如摇必定损妻财。父母相生身有寿，化官化鬼有奇灾', good: false },
  };
  function shiRuleJudge(shiYao, ctx) {
    if (!shiYao) return null;
    const r = SHI_RULES[shiYao.qin];
    if (!r) return null;
    const c = ctx || {};
    const notes = [r.note];
    let score = 0;
    if (shiYao.wang === '旺' || shiYao.wang === '相') { score += 8; notes.push('世爻旺相，作事亨通'); }
    else if (shiYao.wang === '待考') notes.push('缺月建日辰，旺衰不参');
    else { score -= 8; notes.push('世爻休囚，力弱'); }
    if (c.shiKe) { score -= 10; notes.push('世爻被克，主受制于人'); }
    if (c.shiSheng) { score += 6; notes.push('世爻得生扶'); }
    if (c.shiChong) { score -= 6; notes.push('世爻逢冲，事有摇动'); }
    if (c.shiHe) notes.push('世爻逢合，事有牵系');
    return { qin: shiYao.qin, note: notes.join('；'), score, base: r.good };
  }

  // ============ 十九、六亲变化 ============
  // 《卜筮正宗》六亲变化歌：
  //   「父母化父母进神，文书许；化子不伤丁；化鬼官迁举；化财宅长忧；兄弟为泄气。
  //     子孙化退神，人财不称情；化父田蚕败；化财加倍荣；化鬼忧生产；兄弟谓相生。
  //     官化进神禄，求官应疾远；化财占病凶；化父文书遂；化子必伤官；化兄家不睦。
  //     妻财化进神钱财入宅来；化官忧戚戚；化子笑哈哈；化父宜家长；化兄当破财。
  //     兄弟化退神凡占无所忌；化父妾奴惊；化财财未遂；化官弟有灾；化子却如意。」
  const QIN_HUA_RULES = {
    父母: {
      父母: { note: '父母化父母进神，文书许', score: 8 },
      子孙: { note: '父母化子孙不伤丁', score: 0 },
      官鬼: { note: '父母化官鬼官迁举', score: 10 },
      妻财: { note: '父母化妻财宅长忧，兄弟为泄气', score: -6 },
      兄弟: { note: '父母化兄弟为泄气，泄我之气', score: -4 },
    },
    子孙: {
      子孙: { note: '子孙化退神，人财不称情', score: -8 },
      父母: { note: '子孙化父母田蚕败', score: -6 },
      妻财: { note: '子孙化妻财加倍荣', score: 8 },
      官鬼: { note: '子孙化官鬼忧生产；兄弟谓相生', score: -4 },
      兄弟: { note: '子孙化兄弟，兄弟谓相生', score: 2 },
    },
    官鬼: {
      官鬼: { note: '官化进神禄，求官应疾远', score: 10 },
      妻财: { note: '官化妻财，占病主凶（财生官而泄气）', score: -6 },
      父母: { note: '官化父母文书遂', score: 8 },
      子孙: { note: '官化子孙必伤官（子孙克官，为伤官之象）', score: -8 },
      兄弟: { note: '官化兄弟家不睦', score: -4 },
    },
    妻财: {
      妻财: { note: '妻财化进神，钱财入宅来', score: 10 },
      官鬼: { note: '妻财化官鬼忧戚戚', score: -8 },
      子孙: { note: '妻财化子孙笑哈哈', score: 8 },
      父母: { note: '妻财化父母宜家长', score: 4 },
      兄弟: { note: '妻财化兄弟当破财', score: -10 },
    },
    兄弟: {
      兄弟: { note: '兄弟化退神，凡占无所忌', score: 0 },
      父母: { note: '兄弟化父母妾奴惊', score: -6 },
      妻财: { note: '兄弟化妻财财未遂', score: -4 },
      官鬼: { note: '兄弟化官鬼弟有灾', score: -6 },
      子孙: { note: '兄弟化子孙却如意', score: 6 },
    },
  };
  function qinHuaJudge(fromQin, toQin) {
    if (!fromQin || !toQin) return null;
    const m = QIN_HUA_RULES[fromQin];
    if (!m || !m[toQin]) return null;
    const r = m[toQin];
    return { from: fromQin, to: toQin, note: r.note, score: r.score };
  }

  // ============ 二十、绝处逢生 / 合处逢冲 ============
  // 《卜筮正宗》绝处逢生克处逢生论第十六：
  //   「金绝于寅，木绝于申，水土绝于巳，火绝于亥。譬如寅日占卦金爻绝于寅，
  //     如卦中有土爻动而生之，是绝处逢生也…惟巳日占卦土爻绝于巳，如得月建生扶，
  //     常比上爻不谓绝也，谓之日生；如上化出巳，已有日月帮比，不云化绝，乃云回头生也。」
  //   → 日辰绝而不一定真绝，得月建或动爻生扶即谓之「绝处逢生」，不作绝论。
  const JUE_ZHI = { 金: '寅', 木: '申', 水: '巳', 土: '巳', 火: '亥' };
  function jueChuFengSheng(yongWx, dayZhi, ctx) {
    if (!yongWx || !dayZhi) return null;
    if (JUE_ZHI[yongWx] !== dayZhi) return null;
    const c = ctx || {};
    if (c.monthSheng || c.movingSheng) {
      return { note: `本爻${yongWx}绝于${dayZhi}，然得${c.monthSheng ? '月建' : '动爻'}生扶，是为绝处逢生，不作绝论`, rescue: true };
    }
    return { note: `本爻${yongWx}绝于${dayZhi}，又无月建动爻生扶，是为真绝`, rescue: false };
  }
  // 《卜筮正宗》合处逢冲冲中逢合论第十五：
  //   「合处逢冲有三：凡得六卦变六冲一也，日月冲爻二也，动爻变冲三也。
  //     冲中逢合亦有三：凡得六冲变六合一也，日月合爻二也，动爻变合三也。
  //     合处逢冲，谋虽成而终散；冲中逢合，事已散而复成。」
  function heChuFengChong(ctx) {
    const c = ctx || {};
    const notes = [];
    if (c.mainIsHe && c.changedIsChong) notes.push('合处逢冲（六冲变六合之反）：谋虽成而终散');
    if (c.mainIsHe && c.dayChongYong) notes.push('日月冲爻而逢合：合处逢冲，谋事有始无终');
    if (!c.mainIsHe && c.changedIsHe) notes.push('冲中逢合：事已散而复成');
    if (!c.mainIsHe && c.dayHeYong) notes.push('日月合爻：冲中逢合，散而复成');
    return notes;
  }

  // ============ 二十一、八宫诸物 / 诸身（取象）============
  // 《卜筮正宗》八宫诸物：乾为马 坤为牛 震为龙 巽为鸡 坎为豕 离为雉 艮为狗 兑为羊
  // 《卜筮正宗》八宫诸身：乾为首 坤为腹 震为足 巽为股 坎为耳 离为目 艮为手 兑为口
  // 《火珠林》占形性：外卦为形，内卦为性。
  const GUA_WU = { 乾: '马', 坤: '牛', 震: '龙', 巽: '鸡', 坎: '豕', 离: '雉', 艮: '狗', 兑: '羊' };
  const GUA_SHEN_TI = { 乾: '首', 坤: '腹', 震: '足', 巽: '股', 坎: '耳', 离: '目', 艮: '手', 兑: '口' };
  function guaWu(g) { return GUA_WU[g] || null; }
  function guaShenTi(g) { return GUA_SHEN_TI[g] || null; }

  // ============ 二十二、神煞（依《卜筮正宗》立场降权为参考）============
  // 《卜筮正宗》断易勿泥神煞：
  //   「易卦阴阳在变通，五行生克妙无穷。时人须辨阴阳理，神煞休将定吉凶。」
  // → 故本项目不将神煞计入吉凶评分，仅在卦盘列出，供用户自行参看。
  // 《卜筮正宗》禄马羊刃歌：「甲禄在寅，卯为羊刃；乙禄在卯，辰为羊刃；丙戊禄在巳，午为羊刃；
  //   丁己禄居午，未为羊刃；庚禄居申，酉为羊刃；辛禄到酉，戌为羊刃；壬禄在亥，子为羊刃；癸禄在子，丑为羊刃。
  //   申子辰马居寅，巳酉丑马在亥，寅午戌马居申，亥卯未马在巳。」
  // 《卜筮正宗》贵人歌诀：「甲戊兼牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，庚辛逢马虎，此是贵人方。」
  // 《卜筮正宗》三刑六害歌：「寅刑巳，巳刑申，丑戌相刑未并臻，子刑卯，卯刑子，辰午酉亥自相刑。
  //   六害：子未不堪亲，丑害午兮寅巳真，卯害辰兮申害亥，酉戌相穿转见深。」
  const LU = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
  const YANGREN = { 甲: '卯', 乙: '辰', 丙: '午', 丁: '未', 戊: '午', 己: '未', 庚: '酉', 辛: '戌', 壬: '子', 癸: '丑' };
  const MA = { 申: '寅', 子: '寅', 辰: '寅', 巳: '亥', 酉: '亥', 丑: '亥', 寅: '申', 午: '申', 戌: '申', 亥: '巳', 卯: '巳', 未: '巳' };
  const GUI_REN = { 甲: ['丑', '未'], 戊: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'], 壬: ['卯', '巳'], 癸: ['卯', '巳'], 庚: ['午', '寅'], 辛: ['午', '寅'] };
  const XING = { 寅: '巳', 巳: '申', 申: '寅', 丑: '戌', 戌: '丑', 未: '丑', 子: '卯', 卯: '子', 辰: '辰', 午: '午', 酉: '酉', 亥: '亥' };
  const HAI = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
  const SHEN_SHA_NOTE = '神煞只作参看，不入吉凶评分——《卜筮正宗》「神煞休将定吉凶」';
  // 传日干支与卦中六爻地支，列出所临神煞
  function shenSha(dayGan, dayZhi, yaoZhis) {
    if (!dayGan || !dayZhi) return null;
    const zset = new Set(yaoZhis || []);
    const has = z => zset.has(z);
    const out = [];
    if (LU[dayGan] && has(LU[dayGan])) out.push({ name: '日禄', zhi: LU[dayGan], note: '日临本禄，其气不减' });
    if (YANGREN[dayGan] && has(YANGREN[dayGan])) out.push({ name: '羊刃', zhi: YANGREN[dayGan], note: '羊刃刚暴之神，逢之须防刚冲突祸' });
    if (MA[dayZhi] && has(MA[dayZhi])) out.push({ name: '驿马', zhi: MA[dayZhi], note: '驿马主行动变迁，逢冲必动、遇合滞行' });
    (GUI_REN[dayGan] || []).forEach(z => { if (has(z)) out.push({ name: '天乙贵人', zhi: z, note: '逢凶化吉，遇事有人帮' }); });
    Object.keys(XING).forEach(a => { if (XING[a] !== a && has(a) && has(XING[a])) out.push({ name: '相刑', zhi: a + '刑' + XING[a], note: '主刑伤纠缠' }); });
    if (HAI[dayZhi] && has(HAI[dayZhi])) out.push({ name: '六害', zhi: dayZhi + '害' + HAI[dayZhi], note: '主暗损、不亲' });
    return out.length ? out : null;
  }

  global.LiuYaoRules = {
    SHENG, KE, GAN_WX, ZHI_WX, ZHI, CHONG, HE, SANHE, JIN, TUI, SEASON_MONTH_WX,
    rel, shengOf, keOf, qinOfPalace,
    yuanJiChou, powerOfYuanJi,
    feiFuJudge, FEIFU_SONG,
    jinTui, kongJudge, anDong, monthPoJudge,
    liuChong, liuHe, liuChongDetail, liuHeDetail, CHONG_NOTE, CHONG_HE_NOTE, HE_CHONG_NOTE,
    fanFu, guaFanYin, FAN_YIN_GROUPS, FAN_YIN_NOTE, YAO_FAN_YIN_NOTE, guaShen, sanHeJu,
    WANG_XIANG, SEASON_OF_ZHI, wangBySeason,
    MONTH_PO_TABLE, jieQiOf,
    // 十六、火珠林飞伏七情
    FU_QI, fuQiJudge,
    // 十七、独发乱动
    DUFA_RULES, duFaJudge,
    // 十八、诸爻持世
    SHI_RULES, shiRuleJudge,
    // 十九、六亲变化
    QIN_HUA_RULES, qinHuaJudge,
    // 二十、绝处逢生 / 合处逢冲
    jueChuFengSheng, heChuFengChong,
    // 二十一、八宫诸物 / 诸身（取象）
    GUA_WU, GUA_SHEN_TI, guaWu, guaShenTi,
    // 二十二、神煞（不入评分，只作参看）
    LU, YANGREN, MA, GUI_REN, XING, HAI, shenSha, SHEN_SHA_NOTE,
  };
})(typeof global !== 'undefined' ? global : this);

// ===== 小程序适配 =====
module.exports = (typeof LiuYaoRules !== 'undefined' && LiuYaoRules) || global.LiuYaoRules;
