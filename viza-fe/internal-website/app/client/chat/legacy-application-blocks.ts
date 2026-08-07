import type { Message } from "@/app/actions/companion-sessions";
import type { ApplicationBlockPayload } from "@/components/client/companion/block-message";

export interface ApplicationBlockMessage {
  id: string;
  payload: ApplicationBlockPayload;
  timestamp: number;
}

const SINGAPORE_ARRIVAL_CARD_ROUTE =
  "/client/application?country=singapore&visaType=SG_ARRIVAL_CARD";

function isSingaporeArrivalCardPayload(
  payload: ApplicationBlockPayload
): boolean {
  return (
    payload.visaType === "SG_ARRIVAL_CARD" ||
    payload.productCode === "SG_ARRIVAL_CARD" ||
    payload.redirectUrl?.includes("visaType=SG_ARRIVAL_CARD") === true
  );
}

function isLegacySingaporeArrivalCardHandoff(content: string): boolean {
  return (
    /https?:\/\/(?:www\.)?ica\.gov\.sg\/[^\s。！？\n]*sg-arrival-card/iu.test(
      content
    ) ||
    /\/client\/application(?:\/long-form)?\?[^\s。！？\n]*visaType=SG_?ARRIVAL_?CARD/iu.test(
      content
    ) ||
    /(?:form\s*link|application\s*link)[^。！？\n]*SG_?ARRIVAL_?CARD/iu.test(
      content
    )
  );
}

/**
 * Older assistant messages predate persisted application blocks and can contain
 * only a prose application link. Rehydrate those handoffs as the same VIZA card
 * used by current Socket.IO events without changing historical database rows.
 */
export function buildLegacyApplicationBlocks(
  messages: Message[],
  explicitPayloads: ApplicationBlockPayload[]
): ApplicationBlockMessage[] {
  if (explicitPayloads.some(isSingaporeArrivalCardPayload)) return [];

  let sourceMessage: Message | null = null;
  for (const message of messages) {
    if (
      message.senderType === "agent" &&
      isLegacySingaporeArrivalCardHandoff(message.content)
    ) {
      sourceMessage = message;
    }
  }

  if (!sourceMessage) return [];

  const sourceTimestamp = sourceMessage.createdAt
    ? new Date(sourceMessage.createdAt).getTime()
    : Date.now();

  return [
    {
      id: `legacy-sgac-card-${sourceMessage.id}`,
      timestamp: sourceTimestamp + 1,
      payload: {
        blockType: "application_redirect",
        title: "Complete the Singapore electronic arrival card",
        description: "Continue with the dedicated Singapore form in VIZA.",
        fields: [],
        saveTarget: "application_redirect",
        redirectUrl: SINGAPORE_ARRIVAL_CARD_ROUTE,
        ctaLabel: "Start application",
        country: "singapore",
        visaType: "SG_ARRIVAL_CARD",
        productCode: "SG_ARRIVAL_CARD",
        productKind: "arrival_declaration",
        provider: "viza",
        requirement: "required",
        supportLevel: "automated",
      },
    },
  ];
}
