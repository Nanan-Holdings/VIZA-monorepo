import type { InboundMessage } from "../inbox/wait-for-message";

const OFFICIAL_SENDER = /(?:^|@)(?:immigration\.gov\.tw|coa\.immigration\.gov\.tw)$/i;
// NIA currently issues a 14-character mixed-case token, not a numeric OTP.
const CODE_PATTERN = /(?:驗證碼|verification\s*code|verify\s*code)(?:\s*[:：]\s*|\s*為\s*)([a-z0-9]{4,32})/i;

function decodedPart(value: string | null): string {
  if (!value) return "";
  const base64Body = value.match(/content-transfer-encoding:\s*base64[\s\S]*?\r?\n\r?\n([a-z0-9+/=\r\n]+)/i)?.[1];
  if (base64Body) {
    const decoded = Buffer.from(base64Body.replace(/\s/g, ""), "base64").toString("utf8");
    return decoded || value;
  }
  if (!/=([0-9a-f]{2})/i.test(value)) return value;
  const source = value.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "=" && /^[0-9a-f]{2}$/i.test(source.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(source.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(source.charCodeAt(index) & 0xff);
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

function messageText(message: Pick<InboundMessage, "subject" | "text" | "html">): string {
  return [message.subject, message.text, message.html]
    .map(decodedPart)
    .map((value) => value
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&(?:amp|quot|#39);/gi, " ")
      .replace(/\s+/g, " ")
      .trim())
    .join("\n");
}

function mailboxAddress(fromAddress: string): string {
  return fromAddress.match(/<([^>]+)>/)?.[1]?.trim() ?? fromAddress.trim();
}

export function isTaiwanNiaVerificationEmail(message: InboundMessage): boolean {
  return OFFICIAL_SENDER.test(mailboxAddress(message.from_addr)) && /(?:驗證碼|verification|verify)/i.test(messageText(message));
}

export function extractTaiwanNiaVerificationCode(message: Pick<InboundMessage, "subject" | "text" | "html">): string | null {
  return messageText(message).match(CODE_PATTERN)?.[1] ?? null;
}
