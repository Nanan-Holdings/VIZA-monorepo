import type { KrSubmissionResult } from "../submission-result.js";
import type { DispatchOutcome } from "../queue/types.js";

export const KOREA_VISA_PORTAL_EFORM_URL = "https://www.visa.go.kr/openPage.do?MENU_ID=10204";

const BEIJING_KVAC = {
  code: "beijing",
  nameEn: "Korea Visa Application Center Beijing",
  nameZh: "韩国签证申请中心（北京）",
  bookingUrl: "https://www.visaforkorea-bj.com/visacenter/booking/insert",
  addressZh: "北京市辖区韩国签证申请中心",
};

export async function runOne(applicationId: string, _jobId?: string): Promise<DispatchOutcome> {
  const result: KrSubmissionResult = {
    country: "KR",
    status: "form_ready_for_kvac",
    applicationId,
    annex17PdfUrl: `/api/applications/${applicationId}/kr-annex17-pdf`,
    officialEformPortalUrl: KOREA_VISA_PORTAL_EFORM_URL,
    officialEformStatus: "manual_action_required",
    recommendedCenter: BEIJING_KVAC,
    manualAction: {
      type: "official_eform_generation_required",
      status: "open",
      instructions:
        "Korea C-3-9 is ready for KVAC paper intake. Generate the Korea Visa Portal barcode e-Form when live e-Form automation is enabled; use the official Annex-17 PDF fallback meanwhile.",
    },
    appointmentStatus: "not_started",
  };

  const { writeSubmissionResult } = await import("../result-writer.js");
  await writeSubmissionResult(applicationId, result, "form_ready_for_kvac");
  return {
    outcome: "paper_ready",
    reachedStep: "korea_annex17_ready",
    artefacts: [],
  };
}
