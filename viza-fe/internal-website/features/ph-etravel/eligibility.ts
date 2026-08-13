export const PH_ETRAVEL_FORM_URL =
  "/client/application/long-form?country=philippines&visaType=PH_ETRAVEL_ARRIVAL_CARD&skipFormCheck=true";

export type PhEtravelEligibilityChoice =
  | "ordinary_air_passenger"
  | "ordinary_sea_passenger"
  | "crew"
  | "cruise"
  | "special_registration"
  | "foreign_diplomat_or_dignitary"
  | "nine_e_visa"
  | "diplomatic_official_service_passport";

export type PhEtravelEligibilityStatus = "supported" | "unsupported";

export type PhEtravelEligibilityResult = {
  status: PhEtravelEligibilityStatus;
  reasonCode: string;
  titleEn: string;
  titleZh: string;
  messageEn: string;
  messageZh: string;
};

export const PH_ETRAVEL_BOUNDARY_COPY = {
  freeEn: "Official eTravel registration is free. VIZA does not collect an official eTravel fee.",
  freeZh: "菲律宾官方 eTravel 登记免费，VIZA 不收取 eTravel 官方费用。",
  notVisaEn: "eTravel is not a visa and does not replace visa eligibility.",
  notVisaZh: "eTravel 不是签证，也不能替代签证资格。",
  borderEn: "A submitted eTravel QR does not guarantee admission at Philippine border control.",
  borderZh: "即使取得 eTravel QR，也不保证菲律宾边检准入。",
} as const;

export const PH_ETRAVEL_FAMILY_MEMBER_COPY = {
  en: "If you register for a family member, the official eTravel site may require that family member profile first. Each selected family member generates a separate travel declaration.",
  zh: "如果为家庭成员申报，菲律宾官方 eTravel 可能要求先建立该家庭成员档案。每位被选择的家庭成员都会生成独立旅行申报。",
} as const;

export const PH_ETRAVEL_SEA_REVIEW_COPY = {
  ordinaryPassengerEn:
    "The verified SEA paths are for ordinary arriving passengers on non-cruise vessels. They are not for cruise travel, cruise crew, vessel crew, or other official-only routes.",
  ordinaryPassengerZh:
    "已验证的 SEA 路径适用于非邮轮船只抵达的普通旅客，不适用于邮轮旅行、邮轮工作人员、船员或其他仅限官方处理路径。",
  destinationEn:
    "SEA destination is path-specific. The disembarking path shows Residence, Hotel/Resort, and Port branches when is_disembarking is true; the electronic variant observed later did not show that stay UI before Health.",
  destinationZh:
    "SEA 目的地是路径相关的。下船路径在 is_disembarking=true 时显示 Residence、Hotel/Resort、Port 分支；后续观察到的电子变体在 Health 前未显示该住宿界面。",
  customsEn:
    "SEA customs is path-specific. One verified path showed manual Baggage and Currency forms, while a later SEA electronic variant reached a signature page.",
  customsZh:
    "SEA 海关是路径相关的。一个已验证路径显示手工 Baggage 和 Currency 表单，后续 SEA 电子变体则到达签名页。",
  signatureEn:
    "SEA signature is path-specific: the manual-forms path reached Summary without signature, while the electronic no-declaration variant goes from signature to Family Member(s), optional no-companion confirmation, and Summary before final Submit.",
  signatureZh:
    "SEA 签名是路径相关的：手工表单路径无签名进入 Summary；电子无申报变体则从签名进入 Family Member(s)、适用时的无同行确认，再到 Summary，之后才是最终 Submit。",
  crewCruiseEn:
    "The ordinary SEA dropdown can expose vessel crew labels, but VIZA v1 diverts crew. Cruise passengers and cruise crew use the separate official cruise declaration route.",
  crewCruiseZh:
    "普通 SEA 下拉项可出现 vessel crew 标签，但 VIZA v1 会分流船员。邮轮旅客和邮轮工作人员使用官方独立邮轮申报路径。",
} as const;

const supportedAir: PhEtravelEligibilityResult = {
  status: "supported",
  reasonCode: "ordinary_air_passenger_supported",
  titleEn: "Ordinary air passenger",
  titleZh: "普通航空入境旅客",
  messageEn:
    "This VIZA flow is for ordinary passengers arriving in the Philippines by air. You may prepare the form now; official submission is scheduled inside the 72-hour eTravel window.",
  messageZh:
    "此 VIZA 流程适用于乘飞机抵达菲律宾的普通旅客。你可以提前填写；系统只会在 eTravel 官方 72 小时窗口内安排官网提交。",
};

const supportedSea: PhEtravelEligibilityResult = {
  status: "supported",
  reasonCode: "ordinary_sea_passenger_supported",
  titleEn: "Ordinary sea passenger",
  titleZh: "普通海路入境旅客",
  messageEn:
    "This VIZA flow is only for verified ordinary SEA arrival passenger paths. Cruise travel, cruise crew, vessel crew, and cruise passengers must use separate official paths.",
  messageZh:
    "此 VIZA 流程仅适用于已验证的普通 SEA 入境旅客路径。邮轮旅行、邮轮工作人员、船员和邮轮旅客必须走官方独立路径。",
};

const unsupportedByChoice: Record<Exclude<PhEtravelEligibilityChoice, "ordinary_air_passenger" | "ordinary_sea_passenger">, PhEtravelEligibilityResult> = {
  crew: {
    status: "unsupported",
    reasonCode: "crew_requires_separate_official_path",
    titleEn: "Crew member path required",
    titleZh: "机组/船员需走独立路径",
    messageEn:
      "Arriving flight or vessel crew are listed by the official eTravel service, but this ordinary passenger flow is not verified for crew declarations.",
    messageZh:
      "菲律宾官方 eTravel 覆盖抵达机组/船员，但当前普通旅客流程尚未验证机组/船员申报路径。",
  },
  cruise: {
    status: "unsupported",
    reasonCode: "cruise_requires_separate_official_path",
    titleEn: "Cruise path required",
    titleZh: "邮轮旅客需走独立路径",
    messageEn:
      "The official eTravel site has a separate cruise travel declaration path. Do not use the ordinary arrival passenger form for cruise travel.",
    messageZh:
      "菲律宾官方 eTravel 有独立邮轮旅行申报路径。邮轮旅客不要使用当前普通入境旅客表单。",
  },
  special_registration: {
    status: "unsupported",
    reasonCode: "special_registration_not_supported",
    titleEn: "Special registration not supported here",
    titleZh: "特殊登记暂不支持",
    messageEn:
      "The official service exposes a special registration path. VIZA must not submit those cases through the ordinary passenger flow.",
    messageZh:
      "菲律宾官方服务有特殊登记路径。VIZA 当前不能把这类申请放进普通旅客流程提交。",
  },
  foreign_diplomat_or_dignitary: {
    status: "unsupported",
    reasonCode: "official_exception_foreign_diplomat_or_dignitary",
    titleEn: "Official exception",
    titleZh: "官方例外身份",
    messageEn:
      "Foreign diplomats, dependents, dignitaries, and delegations are listed as official eTravel exceptions and are outside this flow.",
    messageZh:
      "外国外交官及家属、外国政要及随行团属于官方 eTravel 例外身份，不适用当前流程。",
  },
  nine_e_visa: {
    status: "unsupported",
    reasonCode: "official_exception_9e_visa",
    titleEn: "9(e) visa holder exception",
    titleZh: "9(e) 签证持有人例外",
    messageEn:
      "9(e) visa holders are listed as official eTravel exceptions and must not be routed through this ordinary passenger flow.",
    messageZh:
      "9(e) 签证持有人属于官方 eTravel 例外身份，不能进入当前普通旅客流程。",
  },
  diplomatic_official_service_passport: {
    status: "unsupported",
    reasonCode: "official_exception_passport_type",
    titleEn: "Diplomatic, official, or service passport exception",
    titleZh: "外交/公务/因公护照例外",
    messageEn:
      "Holders of diplomatic, official, or service passports are listed as official eTravel exceptions and are outside this flow.",
    messageZh:
      "持外交、公务或因公护照者属于官方 eTravel 例外身份，不适用当前流程。",
  },
};

export function evaluatePhEtravelEligibility(
  choice: PhEtravelEligibilityChoice,
): PhEtravelEligibilityResult {
  if (choice === "ordinary_air_passenger") {
    return supportedAir;
  }
  if (choice === "ordinary_sea_passenger") {
    return supportedSea;
  }
  return unsupportedByChoice[choice];
}
