export interface PhotoGuidance {
  instructions: string;
  cropToolDescription: string;
  formatHint: string;
  qualityDescription: string;
  formatSpec: string;
}

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
  "czechia",
  "denmark",
  "finland",
  "hungary",
  "norway",
  "sweden",
  "poland",
  "malta",
  "iceland",
  "luxembourg",
  "slovenia",
]);

function getSchengenCountryName(country?: string): string {
  const names: Record<string, string> = {
    france: "法国",
    germany: "德国",
    italy: "意大利",
    spain: "西班牙",
    netherlands: "荷兰",
    switzerland: "瑞士",
    greece: "希腊",
    portugal: "葡萄牙",
    austria: "奥地利",
    belgium: "比利时",
    czechia: "捷克",
    denmark: "丹麦",
    finland: "芬兰",
    hungary: "匈牙利",
    norway: "挪威",
    sweden: "瑞典",
    poland: "波兰",
    malta: "马耳他",
    iceland: "冰岛",
    luxembourg: "卢森堡",
    slovenia: "斯洛文尼亚",
  };
  return country ? names[country] ?? "申根" : "申根";
}

export function getPhotoGuidance(country?: string, visaType?: string): PhotoGuidance {
  const normalizedCountry = country?.toLowerCase() ?? "";
  const normalizedVisaType = visaType?.toUpperCase() ?? "";

  if (normalizedCountry === "united_states" || normalizedVisaType === "DS160") {
    return {
      instructions: "请按美国国务院 DS-160 数字照片要求准备照片。照片应为近期拍摄、正面免冠、背景简洁，并在上传前通过系统质量检查。",
      cropToolDescription: "使用此工具裁剪为 DS-160 常用的正方形证件照构图，并检查头部居中、背景和清晰度。",
      formatHint: "建议上传 JPG/JPEG 文件。系统会检查格式、大小、尺寸和正方形比例。",
      qualityDescription: "美国 DS-160 照片通常要求彩色近照、白色或浅色背景、正面直视镜头、表情自然、双眼睁开。",
      formatSpec: "JPG/JPEG · 正方形 · 系统上传前检查",
    };
  }

  if (normalizedCountry === "indonesia" || normalizedVisaType === "B211A") {
    return {
      instructions: "请按印度尼西亚电子签证申请的证件照要求准备照片。照片应清晰、无遮挡、背景干净，并与护照身份信息一致。",
      cropToolDescription: "使用此工具裁剪出居中的护照式头像，便于后续上传到印尼签证申请材料中。",
      formatHint: "建议上传清晰 JPG/JPEG 证件照；如官方页面另有格式或大小限制，请以官方页面为准。",
      qualityDescription: "印尼签证照片应为近期正面证件照，面部无遮挡，背景简洁，避免过暗、过曝或明显修图。",
      formatSpec: "JPG/JPEG · 护照式证件照",
    };
  }

  if (normalizedCountry === "united_kingdom" || normalizedVisaType === "UK_STANDARD_VISITOR") {
    return {
      instructions: "请按 UKVI 访客签证申请的照片/身份材料要求准备图片。若官方流程要求在签证中心采集生物信息，请以 UKVI 页面和预约中心要求为准。",
      cropToolDescription: "使用此工具先准备一张清晰的护照式头像，方便后续材料核对或需要上传时使用。",
      formatHint: "建议上传清晰 JPG/JPEG 文件；UKVI 或签证中心如有额外规格，以官方页面为准。",
      qualityDescription: "英国访客签证相关照片应清晰、正面、无遮挡，背景干净，且能准确反映当前本人样貌。",
      formatSpec: "JPG/JPEG · 清晰护照式头像",
    };
  }

  if (SCHENGEN_COUNTRIES.has(normalizedCountry) || normalizedVisaType.includes("SCHENGEN")) {
    const countryName = getSchengenCountryName(normalizedCountry);
    return {
      instructions: `请按${countryName}申根短期签证申请的证件照要求准备照片。不同签证中心可能有细节差异，请以预约中心和官方清单为准。`,
      cropToolDescription: "使用此工具裁剪出居中的申根证件照构图，便于后续上传或线下递交材料。",
      formatHint: "建议上传清晰 JPG/JPEG 证件照；实际尺寸、背景和张数要求请按对应申根签证中心说明核对。",
      qualityDescription: "申根签证照片通常要求近期、正面、背景浅色、面部清晰无遮挡，不能使用过度美化或过暗照片。",
      formatSpec: "JPG/JPEG · 申根证件照",
    };
  }

  return {
    instructions: "请按该目的地官方签证申请页面的照片要求准备证件照。照片应为近期、清晰、正面、无遮挡，并能准确反映本人样貌。",
    cropToolDescription: "使用此工具裁剪出标准护照式头像，方便后续上传或材料核对。",
    formatHint: "建议上传清晰 JPG/JPEG 证件照；如官方页面另有要求，请以官方页面为准。",
    qualityDescription: "照片应背景简洁、光线均匀、面部清晰、无遮挡，避免明显修图、过曝或过暗。",
    formatSpec: "JPG/JPEG · 护照式证件照",
  };
}
