export function extractJpVjwVerificationMessage(input: {
  subject?: string | null;
  text?: string | null;
  html?: string | null;
}): { url?: string; code?: string } {
  const source = `${input.subject ?? ""}\n${input.text ?? ""}\n${input.html ?? ""}`;
  const labelledCode = source.match(
    /(?:确认码|驗證碼|验证码|verification\s*code|confirmation\s*code|one[- ]time\s*code|code)[^0-9]{0,100}([0-9]{6})(?![0-9])/iu,
  )?.[1];
  const standaloneCode = source.match(/(?:^|[^0-9])([0-9]{6})(?![0-9])/u)?.[1];
  const url = source.match(/https?:\/\/[^\s"'<>]+/iu)?.[0];
  return {
    ...(url ? { url } : {}),
    ...(labelledCode || standaloneCode ? { code: labelledCode ?? standaloneCode } : {}),
  };
}
