export function applyVietnamOfficialLookupEmail(
  answers: Record<string, string>,
  officialLookupEmail: string,
): Record<string, string> {
  return {
    ...answers,
    email_address: officialLookupEmail.trim().toLowerCase(),
    re_enter_email_address: officialLookupEmail.trim().toLowerCase(),
  };
}
