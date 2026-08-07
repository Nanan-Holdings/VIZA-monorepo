import type {
  ConsentApplication,
  ConsentDocumentStatus,
  ConsentHistoryEvent,
  NextConsentStep,
} from "./consent-config";

export type ConsentCopy = {
  gate: string;
  title: string;
  noApplicationTitle: string;
  noApplicationBody: string;
  startApplication: string;
  incompleteBody: string;
  completeBody: string;
  ds160Boundary: string;
  mailboxTitle: string;
  mailboxBody: string;
  currentVersions: string;
  currentAccepted: string;
  acceptanceNeeded: string;
  currentVersion: string;
  lastAccepted: (version: string, date: string) => string;
  noAcceptedVersion: string;
  readDocument: (title: string) => string;
  acceptVersion: (version: string) => string;
  accepted: string;
  agencySignature: string;
  agencySignatureBody: string;
  mandateVersion: string;
  signedAuthorisation: string;
  signedBy: (name: string, date: string) => string;
  previousSignature: (date: string) => string;
  applicantLegalName: string;
  applicantNameHint: (name: string) => string;
  typed: string;
  drawn: string;
  typedSignature: string;
  typedSignatureHint: string;
  typedSignaturePlaceholder: string;
  drawnSignature: string;
  drawnSignatureHint: string;
  saving: string;
  saveContinue: string;
  application: string;
  status: string;
  packet: string;
  readiness: string;
  currentLegalVersions: string;
  allAccepted: string;
  remaining: (count: number) => string;
  agencyAuthorisation: string;
  signed: string;
  unsigned: string;
  applicationAnswers: string;
  fieldsSaved: (count: number) => string;
  documents: string;
  documentsReady: (ready: number, total: number) => string;
  noDocuments: string;
  acceptedVersions: string;
  noConsentHistory: string;
  consentRequired: string;
  acceptEachVersion: string;
  applicantNameRequired: string;
  typedSignatureRequired: string;
  drawnSignatureRequired: string;
  saveFailed: string;
  drawSignatureAriaLabel: string;
  clearSignature: string;
};

const EN: ConsentCopy = {
  gate: "Consent gate",
  title: "Consent and authorisation",
  noApplicationTitle: "No application found",
  noApplicationBody: "VIZA needs an application record before terms, privacy, authorisation, and e-signature can be saved.",
  startApplication: "Start application",
  incompleteBody: "Consent is still blocking this application.",
  completeBody: "Consent is complete for this application.",
  ds160Boundary: "DS-160 boundary: this VIZA signature authorises preparation and support inside VIZA only. The official DS-160 final signature, CAPTCHA, and government submission are not completed or marked complete inside VIZA.",
  mailboxTitle: "Your destination mailbox must also be verified",
  mailboxBody: "After you accept Official Email Forwarding, VIZA may forward verification codes, status notices, QR codes, PDFs, and attachments received by your dedicated alias to your profile email. If Cloudflare sends a verification message, you must click its verification link yourself; VIZA will not confirm mailbox ownership on your behalf.",
  currentVersions: "Current document versions",
  currentAccepted: "Current accepted",
  acceptanceNeeded: "Current acceptance needed",
  currentVersion: "Current version",
  lastAccepted: (version, date) => `Last accepted ${version} on ${date}`,
  noAcceptedVersion: "No accepted version recorded",
  readDocument: (title) => `Read ${title}`,
  acceptVersion: (version) => `I have read and accept version ${version}.`,
  accepted: "Accepted",
  agencySignature: "Agency authorisation signature",
  agencySignatureBody: "By signing, the applicant authorises VIZA to prepare application materials, review documents, generate the VIZA packet, and support handoff steps for this application. This does not authorise VIZA to complete any official final signature or government submission step that must be performed by the applicant.",
  mandateVersion: "Mandate version",
  signedAuthorisation: "Signed current authorisation",
  signedBy: (name, date) => `${name} signed on ${date}.`,
  previousSignature: (date) => `A previous authorisation was signed on ${date}, but the current mandate version still needs a signature.`,
  applicantLegalName: "Applicant legal name",
  applicantNameHint: (name) => `Use the applicant name shown on the application: ${name}`,
  typed: "Typed",
  drawn: "Drawn",
  typedSignature: "Typed e-signature",
  typedSignatureHint: "Typing the applicant name here creates the VIZA agency authorisation signature record.",
  typedSignaturePlaceholder: "Type applicant full name",
  drawnSignature: "Drawn e-signature",
  drawnSignatureHint: "Draw with a mouse, trackpad, stylus, or finger. The image is submitted to the server with this form.",
  saving: "Saving consent",
  saveContinue: "Save and continue",
  application: "Application",
  status: "Status",
  packet: "Packet",
  readiness: "Readiness",
  currentLegalVersions: "Current legal versions",
  allAccepted: "All accepted",
  remaining: (count) => `${count} remaining`,
  agencyAuthorisation: "Agency authorisation",
  signed: "Signed",
  unsigned: "Unsigned",
  applicationAnswers: "Application answers",
  fieldsSaved: (count) => `${count} fields saved`,
  documents: "Documents",
  documentsReady: (ready, total) => `${ready}/${total} ready`,
  noDocuments: "No documents yet",
  acceptedVersions: "Accepted versions",
  noConsentHistory: "No consent versions have been accepted for this application yet.",
  consentRequired: "Start or select an application before recording consent.",
  acceptEachVersion: "Review and explicitly accept each current document version.",
  applicantNameRequired: "Enter the applicant legal name before signing.",
  typedSignatureRequired: "Type the applicant name as the e-signature.",
  drawnSignatureRequired: "Draw the applicant signature before submitting.",
  saveFailed: "Consent could not be saved.",
  drawSignatureAriaLabel: "Draw agency authorisation signature",
  clearSignature: "Clear signature",
};

const ZH: ConsentCopy = {
  gate: "同意与授权",
  title: "同意与授权",
  noApplicationTitle: "未找到申请",
  noApplicationBody: "VIZA 需要先有申请记录，才能保存服务条款、隐私政策、授权和电子签名。",
  startApplication: "开始申请",
  incompleteBody: "当前申请仍被同意流程阻塞。",
  completeBody: "当前申请已完成同意流程。",
  ds160Boundary: "DS-160 边界说明：此处的 VIZA 签名仅授权 VIZA 准备材料并提供流程支持。DS-160 官方最终签名、验证码和政府提交不会在 VIZA 内完成，也不会在此标记为已完成。",
  mailboxTitle: "还需要验证您的收件邮箱",
  mailboxBody: "同意“官方邮件转发授权”后，VIZA 才能把专属别名邮箱收到的验证码、状态通知、二维码、PDF 和附件转发到您的账户邮箱。如果 Cloudflare 发送验证邮件，请由您本人点击验证链接；VIZA 不会代替您确认邮箱所有权。",
  currentVersions: "当前文件版本",
  currentAccepted: "已接受当前版本",
  acceptanceNeeded: "需要接受当前版本",
  currentVersion: "当前版本",
  lastAccepted: (version, date) => `上次接受：${version}（${date}）`,
  noAcceptedVersion: "尚无已接受的版本记录",
  readDocument: (title) => `阅读${title}`,
  acceptVersion: (version) => `我已阅读并接受版本 ${version}。`,
  accepted: "已接受",
  agencySignature: "机构授权签名",
  agencySignatureBody: "签署后，申请人授权 VIZA 为本次申请准备材料、审核文件、生成 VIZA 申请资料包并协助交接流程。此授权不包括代替申请人完成任何官方最终签名或政府提交步骤。",
  mandateVersion: "授权版本",
  signedAuthorisation: "已签署当前授权",
  signedBy: (name, date) => `${name} 已于 ${date} 签署。`,
  previousSignature: (date) => `此前已于 ${date} 签署过授权，但当前授权版本仍需要重新签名。`,
  applicantLegalName: "申请人法定姓名",
  applicantNameHint: (name) => `请填写申请表中的申请人姓名：${name}`,
  typed: "键入签名",
  drawn: "手写签名",
  typedSignature: "键入电子签名",
  typedSignatureHint: "在此键入申请人姓名，即会生成 VIZA 机构授权签名记录。",
  typedSignaturePlaceholder: "输入申请人全名",
  drawnSignature: "手写电子签名",
  drawnSignatureHint: "可使用鼠标、触控板、触控笔或手指签名；签名图片会随本表单提交到服务器。",
  saving: "正在保存同意记录",
  saveContinue: "保存并继续",
  application: "申请",
  status: "状态",
  packet: "资料包",
  readiness: "完成情况",
  currentLegalVersions: "当前法律文件版本",
  allAccepted: "已全部接受",
  remaining: (count) => `还剩 ${count} 项`,
  agencyAuthorisation: "机构授权",
  signed: "已签署",
  unsigned: "未签署",
  applicationAnswers: "申请表答案",
  fieldsSaved: (count) => `已保存 ${count} 个字段`,
  documents: "材料",
  documentsReady: (ready, total) => `${ready}/${total} 项已就绪`,
  noDocuments: "尚无材料",
  acceptedVersions: "已接受的版本",
  noConsentHistory: "当前申请尚无已接受的同意版本。",
  consentRequired: "请先开始或选择申请，再记录同意。",
  acceptEachVersion: "请阅读并明确接受每份当前文件版本。",
  applicantNameRequired: "请先填写申请人的法定姓名，再进行签名。",
  typedSignatureRequired: "请键入申请人姓名作为电子签名。",
  drawnSignatureRequired: "请先手写申请人签名，再提交。",
  saveFailed: "无法保存同意记录。",
  drawSignatureAriaLabel: "绘制机构授权签名",
  clearSignature: "清除签名",
};

const DOCUMENT_COPY: Record<string, { title: string; shortTitle: string; summary: string }> = {
  terms_of_service: {
    title: "服务条款",
    shortTitle: "服务条款",
    summary: "适用于 VIZA 账户使用、服务边界、申请人责任、费用和责任限制的平台条款。",
  },
  privacy_policy: {
    title: "隐私政策",
    shortTitle: "隐私政策",
    summary: "说明申请人信息、材料的处理、共享、保留以及隐私权利。",
  },
  agency_authorisation: {
    title: "机构授权",
    shortTitle: "授权",
    summary: "授权 VIZA 团队和系统准备申请材料、协调文件审核并完成本次申请的交接资料。",
  },
  alias_email_forwarding: {
    title: "官方邮件转发授权",
    shortTitle: "邮件转发授权",
    summary: "授权 VIZA 将专属别名邮箱收到的官方签证邮件副本转发至您的账户邮箱；邮件可能包含验证码、状态通知、二维码、PDF 和附件。启用转发前可能还需要验证邮箱所有权。",
  },
};

export function getConsentCopy(isZh: boolean): ConsentCopy {
  return isZh ? ZH : EN;
}

export function localizeConsentDocument<T extends ConsentDocumentStatus | ConsentHistoryEvent>(
  document: T,
  isZh: boolean,
): T {
  if (!isZh) return document;
  const copy = DOCUMENT_COPY[document.consentType];
  if (!copy) {
    return {
      ...document,
      title: "其他同意文件",
      shortTitle: "其他文件",
      summary: "请阅读并确认当前文件内容后再继续。",
    } as T;
  }
  return { ...document, ...copy } as T;
}

export function localizeNextStep(nextStep: NextConsentStep, isZh: boolean): NextConsentStep {
  if (!isZh) return nextStep;
  const labels: Record<NextConsentStep["key"], string> = {
    start_application: "开始申请",
    complete_consent: "完成同意与授权",
    sign_authorisation: "签署机构授权",
    fill_application: "继续填写申请表",
    upload_documents: "上传材料",
    view_status: "查看申请状态",
  };
  const reasons: Record<NextConsentStep["key"], string> = {
    start_application: "同意记录需要绑定到具体签证申请。",
    complete_consent: "请先接受当前法律文件版本并完成机构授权签名。",
    sign_authorisation: "请完成机构授权签名后再继续。",
    fill_application: "请先完成申请表，再继续后续流程。",
    upload_documents: "请补齐申请所需材料。",
    view_status: "同意与授权已完成，可查看申请处理状态。",
  };
  return { ...nextStep, label: labels[nextStep.key], reason: reasons[nextStep.key] };
}

export function localizeStatus(status: string, isZh: boolean): string {
  if (!isZh) return status.replace(/_/g, " ");
  const labels: Record<string, string> = {
    not_started: "未开始",
    draft: "草稿",
    in_progress: "处理中",
    submitted: "已提交",
    completed: "已完成",
    ready_for_submission: "可提交",
    not_ready: "未就绪",
  };
  return labels[status] ?? "状态待确认";
}

export function localizeDocumentTitle(
  document: ConsentDocumentStatus | ConsentHistoryEvent,
  isZh: boolean,
): string {
  return localizeConsentDocument(document, isZh).title;
}

export function localizeApplicationName(application: ConsentApplication, isZh: boolean): string {
  return `${application.countryFlag} ${isZh ? application.countryNameZh : application.countryName} ${isZh ? application.visaTypeLabelZh : application.visaTypeLabel}`;
}
