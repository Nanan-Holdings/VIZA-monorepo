export interface PhotoGuidance {
  instructions: string;
  cropToolDescription: string;
  formatHint: string;
  qualityDescription: string;
  formatSpec: string;
}

type PhotoGuidanceLocale = "en" | "zh";

const SCHENGEN_COUNTRIES = new Set([
  "france",
  "germany",
  "italy",
  "spain",
  "netherlands",
  "switzerland",
  "greece",
  "portugal",
  "austria",
  "belgium",
  "bulgaria",
  "croatia",
  "czech_republic",
  "czechia",
  "denmark",
  "estonia",
  "finland",
  "hungary",
  "latvia",
  "liechtenstein",
  "lithuania",
  "norway",
  "sweden",
  "poland",
  "romania",
  "slovakia",
  "malta",
  "iceland",
  "luxembourg",
  "slovenia",
]);

function getSchengenCountryName(
  country?: string,
  locale: PhotoGuidanceLocale = "zh"
): string {
  const names: Record<string, { en: string; zh: string }> = {
    france: { en: "France", zh: "法国" },
    germany: { en: "Germany", zh: "德国" },
    italy: { en: "Italy", zh: "意大利" },
    spain: { en: "Spain", zh: "西班牙" },
    netherlands: { en: "Netherlands", zh: "荷兰" },
    switzerland: { en: "Switzerland", zh: "瑞士" },
    greece: { en: "Greece", zh: "希腊" },
    portugal: { en: "Portugal", zh: "葡萄牙" },
    austria: { en: "Austria", zh: "奥地利" },
    belgium: { en: "Belgium", zh: "比利时" },
    bulgaria: { en: "Bulgaria", zh: "保加利亚" },
    croatia: { en: "Croatia", zh: "克罗地亚" },
    czech_republic: { en: "Czech Republic", zh: "捷克" },
    czechia: { en: "Czechia", zh: "捷克" },
    denmark: { en: "Denmark", zh: "丹麦" },
    estonia: { en: "Estonia", zh: "爱沙尼亚" },
    finland: { en: "Finland", zh: "芬兰" },
    hungary: { en: "Hungary", zh: "匈牙利" },
    latvia: { en: "Latvia", zh: "拉脱维亚" },
    liechtenstein: { en: "Liechtenstein", zh: "列支敦士登" },
    lithuania: { en: "Lithuania", zh: "立陶宛" },
    norway: { en: "Norway", zh: "挪威" },
    sweden: { en: "Sweden", zh: "瑞典" },
    poland: { en: "Poland", zh: "波兰" },
    romania: { en: "Romania", zh: "罗马尼亚" },
    slovakia: { en: "Slovakia", zh: "斯洛伐克" },
    malta: { en: "Malta", zh: "马耳他" },
    iceland: { en: "Iceland", zh: "冰岛" },
    luxembourg: { en: "Luxembourg", zh: "卢森堡" },
    slovenia: { en: "Slovenia", zh: "斯洛文尼亚" },
  };
  return country
    ? (names[country]?.[locale] ?? (locale === "zh" ? "申根" : "Schengen"))
    : locale === "zh"
      ? "申根"
      : "Schengen";
}

export function getPhotoGuidance(
  country?: string,
  visaType?: string,
  locale: PhotoGuidanceLocale = "zh"
): PhotoGuidance {
  const normalizedCountry = country?.toLowerCase() ?? "";
  const normalizedVisaType = visaType?.toUpperCase() ?? "";
  const isZh = locale === "zh";

  if (normalizedCountry === "united_states" || normalizedVisaType === "DS160") {
    return isZh
      ? {
          instructions:
            "请按美国国务院 DS-160 数字照片要求准备照片。照片应为近期拍摄、正面免冠、背景简洁，并在上传前通过系统质量检查。",
          cropToolDescription:
            "使用此工具裁剪为 DS-160 常用的正方形证件照构图，并检查头部居中、背景和清晰度。",
          formatHint:
            "建议上传 JPG/JPEG 文件。系统会检查格式、大小、尺寸和正方形比例。",
          qualityDescription:
            "美国 DS-160 照片通常要求彩色近照、白色或浅色背景、正面直视镜头、表情自然、双眼睁开。",
          formatSpec: "JPG/JPEG · 正方形 · 系统上传前检查",
        }
      : {
          instructions:
            "Prepare your photo according to the U.S. Department of State DS-160 digital photo requirements. It should be recent, front-facing, unobstructed, on a clean background, and checked before upload.",
          cropToolDescription:
            "Use this tool to crop a square DS-160-style passport photo and check head position, background, and clarity.",
          formatHint:
            "Upload a JPG/JPEG file. The system checks format, size, dimensions, and square aspect ratio.",
          qualityDescription:
            "DS-160 photos usually require a recent color image, white or light background, direct front-facing view, natural expression, and open eyes.",
          formatSpec: "JPG/JPEG · Square · Pre-upload check",
        };
  }

  if (normalizedCountry === "indonesia" || normalizedVisaType === "B211A") {
    return isZh
      ? {
          instructions:
            "请按印度尼西亚电子签证申请的证件照要求准备照片。照片应清晰、无遮挡、背景干净，并与护照身份信息一致。",
          cropToolDescription:
            "使用此工具裁剪出居中的护照式头像，便于后续上传到印尼签证申请材料中。",
          formatHint:
            "建议上传清晰 JPG/JPEG 证件照；如官方页面另有格式或大小限制，请以官方页面为准。",
          qualityDescription:
            "印尼签证照片应为近期正面证件照，面部无遮挡，背景简洁，避免过暗、过曝或明显修图。",
          formatSpec: "JPG/JPEG · 护照式证件照",
        }
      : {
          instructions:
            "Prepare a clear visa photo for the Indonesia eVisa application. The image should be recent, unobstructed, on a clean background, and consistent with your passport identity.",
          cropToolDescription:
            "Use this tool to crop a centered passport-style portrait for your Indonesia visa documents.",
          formatHint:
            "Upload a clear JPG/JPEG passport-style photo. If the official page lists additional limits, follow the official instructions.",
          qualityDescription:
            "Indonesia visa photos should be recent, front-facing, unobstructed, on a simple background, and not overly dark, bright, or retouched.",
          formatSpec: "JPG/JPEG · Passport-style photo",
        };
  }

  if (
    normalizedCountry === "united_kingdom" ||
    normalizedVisaType === "UK_STANDARD_VISITOR"
  ) {
    return isZh
      ? {
          instructions:
            "请按 UKVI 访客签证申请的照片/身份材料要求准备图片。若官方流程要求在签证中心采集生物信息，请以 UKVI 页面和预约中心要求为准。",
          cropToolDescription:
            "使用此工具先准备一张清晰的护照式头像，方便后续材料核对或需要上传时使用。",
          formatHint:
            "建议上传清晰 JPG/JPEG 文件；UKVI 或签证中心如有额外规格，以官方页面为准。",
          qualityDescription:
            "英国访客签证相关照片应清晰、正面、无遮挡，背景干净，且能准确反映当前本人样貌。",
          formatSpec: "JPG/JPEG · 清晰护照式头像",
        }
      : {
          instructions:
            "Prepare a clear passport-style image for UK visitor visa identity or document review. If UKVI or the visa application centre collects biometrics, follow the official appointment instructions.",
          cropToolDescription:
            "Use this tool to prepare a clear passport-style portrait for document review or upload if needed.",
          formatHint:
            "Upload a clear JPG/JPEG file. If UKVI or the visa centre lists additional specifications, follow the official instructions.",
          qualityDescription:
            "UK visitor visa-related images should be clear, front-facing, unobstructed, on a clean background, and reflect your current appearance.",
          formatSpec: "JPG/JPEG · Clear passport-style portrait",
        };
  }

  if (
    SCHENGEN_COUNTRIES.has(normalizedCountry) ||
    normalizedVisaType.includes("SCHENGEN")
  ) {
    const countryName = getSchengenCountryName(normalizedCountry, locale);
    return isZh
      ? {
          instructions: `请按${countryName}申根短期签证申请的证件照要求准备照片。不同签证中心可能有细节差异，请以预约中心和官方清单为准。`,
          cropToolDescription:
            "使用此工具裁剪出居中的申根证件照构图，便于后续上传或线下递交材料。",
          formatHint:
            "建议上传清晰 JPG/JPEG 证件照；实际尺寸、背景和张数要求请按对应申根签证中心说明核对。",
          qualityDescription:
            "申根签证照片通常要求近期、正面、背景浅色、面部清晰无遮挡，不能使用过度美化或过暗照片。",
          formatSpec: "JPG/JPEG · 申根证件照",
        }
      : {
          instructions: `Prepare a visa photo for the ${countryName} short-stay Schengen visa application. Requirements can vary by visa centre, so use the appointment centre and official checklist as the final source.`,
          cropToolDescription:
            "Use this tool to crop a centered Schengen-style visa photo for later upload or in-person submission.",
          formatHint:
            "Upload a clear JPG/JPEG passport-style photo. Confirm exact size, background, and copy-count requirements with the relevant Schengen visa centre.",
          qualityDescription:
            "Schengen visa photos usually need to be recent, front-facing, on a light background, clearly show the face, and avoid heavy retouching or poor exposure.",
          formatSpec: "JPG/JPEG · Schengen visa photo",
        };
  }

  return isZh
    ? {
        instructions:
          "请按该目的地官方签证申请页面的照片要求准备证件照。照片应为近期、清晰、正面、无遮挡，并能准确反映本人样貌。",
        cropToolDescription:
          "使用此工具裁剪出标准护照式头像，方便后续上传或材料核对。",
        formatHint:
          "建议上传清晰 JPG/JPEG 证件照；如官方页面另有要求，请以官方页面为准。",
        qualityDescription:
          "照片应背景简洁、光线均匀、面部清晰、无遮挡，避免明显修图、过曝或过暗。",
        formatSpec: "JPG/JPEG · 护照式证件照",
      }
    : {
        instructions:
          "Prepare a passport-style photo according to the destination's official visa application requirements. The photo should be recent, clear, front-facing, unobstructed, and accurately show your current appearance.",
        cropToolDescription:
          "Use this tool to crop a standard passport-style portrait for later upload or document review.",
        formatHint:
          "Upload a clear JPG/JPEG passport-style photo. If the official portal lists extra requirements, follow the official instructions.",
        qualityDescription:
          "Use a simple background, even lighting, a clear unobstructed face, and avoid heavy retouching, overexposure, or underexposure.",
        formatSpec: "JPG/JPEG · Passport-style photo",
      };
}
