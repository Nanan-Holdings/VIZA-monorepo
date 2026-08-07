const SIGNING_ZH: Record<string, string> = {
  loading: "正在加载声明…",
  errorTitle: "无法加载签名页面",
  notAuApplication: "只有澳大利亚 600 类访客签证申请需要签署这份声明。",
  alreadySignedTitle: "声明已签署",
  alreadySignedBody: "您的签名已保存，后续提交将由系统处理。",
  submittedTitle: "签名已提交",
  submittedBody: "您的申请已进入最终提交队列。",
  backToHome: "返回控制台",
  pageTitle: "签署声明",
  pageSubtitle: "请核对以下回答，并在下方完成签名。系统会将签名写入正式的 600 类声明文件，再提交至 ImmiAccount。",
  healthHeading: "健康声明",
  characterHeading: "品行声明",
  finalHeading: "最终确认",
  yes: "是",
  no: "否",
  unanswered: "未回答",
  signHeading: "在此签名",
  signSubtitle: "请使用手指、触控笔或鼠标签名；需要重写时点击“清除”。",
  padAriaLabel: "签名板",
  clear: "清除",
  submit: "提交签名",
  submitting: "正在提交…",
  reusableSignatureNotice: "通用资料中已保存电子签名，您也可以直接用于本次申请。",
  useSavedSignature: "使用通用签名",
};

const AU_DECLARATION_ZH: Record<string, string> = {
  explainPlaceholder: "请简要说明情况",
  healthLivedOutsidePassport:
    "过去 5 年，您是否曾在护照签发国以外居住超过 5 年（或在过去一年内居住超过 3 个月）？",
  healthVisitedFacility: "过去 5 年，您是否曾住院或入住其他医疗机构？",
  healthHealthcareWorker: "您是否从事医疗工作（例如医生、护士或急救员）？",
  healthAgedOrChildcare: "过去 5 年，您是否从事过老年护理或儿童照护工作？",
  healthClassroom3Months:
    "过去 5 年，您是否曾连续 3 个月以上在课堂学习或授课？",
  healthTbOrChestXray:
    "您是否曾患结核病、胸部 X 光检查异常，或与结核病患者有过密切接触？",
  hasHealthInsurance: "您是否拥有覆盖在澳大利亚停留期间的医疗保险？",
  charCriminalConvictions: "您是否曾在任何国家被指控犯有刑事罪，或被判有罪？",
  charWarCrimes: "您是否曾参与战争罪、反人类罪或种族灭绝？",
  charSexualOffence: "您是否曾被指控犯有性犯罪，或被判有罪（包括针对儿童的性犯罪）？",
  charTerrorism: "您是否曾参与或支持恐怖主义活动？",
  charPeopleSmuggling: "您是否曾参与人口走私或人口贩运？",
  charMilitaryTraining: "您是否接受过专门的军事、准军事、武器或爆炸物训练？",
  charVisaRefused: "您是否曾被任何国家拒绝签发签证，或被取消签证？",
  informationCorrect: "据我所知，所提供的全部信息真实、完整且准确。",
  understandsNoEntryGuarantee:
    "我理解签证不保证一定能够入境；边境官员仍可能拒绝我入境。",
  awareDataProcessing: "我知悉个人信息将由澳大利亚相关机构处理。",
  willLeaveBeforeExpiry: "我承诺在签证到期前离开澳大利亚。",
  genuineVisitor: "我确认自己是真实访客，并计划按所述目的临时停留。",
};

export function getSigningText(isZh: boolean, key: string, fallback: string): string {
  return isZh ? (SIGNING_ZH[key] ?? fallback) : fallback;
}

export function getAuDeclarationText(
  isZh: boolean,
  key: string,
  fallback: string,
): string {
  return isZh ? (AU_DECLARATION_ZH[key] ?? fallback) : fallback;
}
