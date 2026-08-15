import { ExternalLink, FileText } from "lucide-react";

export const PH_ETRAVEL_SEA_MANUAL_CUSTOMS_PDFS = [
  {
    id: "customs_baggage_declaration",
    label: "菲律宾海关行李申报表（官方 PDF）",
    href: "https://customs.gov.ph/wp-content/uploads/2023/04/Customs-Baggage-Declaration-Form-Philippines.pdf",
    isApplicantAnswer: false,
    affectsCompleteness: false,
  },
  {
    id: "bsp_currency_declaration",
    label: "菲律宾货币申报表（BSP 官方 PDF）",
    href: "https://www.bsp.gov.ph/Lists/Download%20Section/Attachments/62/Annex%20K%20%28Cir1146_2022%29.pdf",
    isApplicantAnswer: false,
    affectsCompleteness: false,
  },
] as const;

export type PhEtravelSeaManualCustomsFormsNoticeProps = {
  transportType?: "AIR" | "SEA" | null;
  seaFlow?: "manual_forms" | "electronic_customs" | null;
};

export function shouldShowPhEtravelSeaManualCustomsFormsNotice(
  input: PhEtravelSeaManualCustomsFormsNoticeProps
): boolean {
  return input.transportType === "SEA" && input.seaFlow === "manual_forms";
}

/**
 * External official references only. They are not answers, uploads, or
 * completeness requirements, and a remote PDF failure must not block VIZA.
 */
export function SeaManualCustomsFormsNotice(
  props: PhEtravelSeaManualCustomsFormsNoticeProps
) {
  if (!shouldShowPhEtravelSeaManualCustomsFormsNotice(props)) return null;

  return (
    <section
      aria-label="SEA 手工海关表单"
      className="space-y-2 rounded-md border border-[#d7e6fb] bg-[#f7fbff] p-3 text-sm text-[#315171]"
    >
      <p className="font-medium text-[#0b2545]">外部官方 PDF 表单</p>
      <p className="text-xs leading-5 text-[#47617f]">
        此 SEA 手工表单路径使用以下官方链接；打开或下载失败不会影响当前申请的保存、完整度或后续状态。
      </p>
      <div className="space-y-2">
        {PH_ETRAVEL_SEA_MANUAL_CUSTOMS_PDFS.map((document) => (
          <a
            key={document.id}
            href={document.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md border border-[#c9def6] bg-white px-3 py-2 text-[#03346E] hover:bg-[#edf6ff]"
          >
            <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{document.label}</span>
            <span className="shrink-0 text-xs text-[#47617f]">外部官方 PDF</span>
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}
