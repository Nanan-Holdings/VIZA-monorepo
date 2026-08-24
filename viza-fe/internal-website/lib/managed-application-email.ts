const MANAGED_APPLICATION_EMAIL_BASE_FIELD_NAMES = new Set([
  "alias_email_address",
  "applicant_email",
  "applicant_email_address",
  "applicant_contact_email",
  "applicants_email",
  "applicants_email_address",
  "confirm_email",
  "confirm_email_address",
  "email",
  "email_address",
  "email_address_confirmation",
  "email_confirmation",
  "email_id",
  "e_mail",
  "e_mail_address",
  "primary_email",
  "re_enter_email_address",
  "reenter_email",
  "reenter_email_address",
  "visa_email",
]);

function normalizeManagedEmailFieldName(fieldName: string): string {
  let normalized = fieldName.trim().toLowerCase();
  normalized = normalized.replace(/__\d+$/u, "");
  normalized = normalized.replace(/(?:-|_)(?:zh|en)$/u, "");
  return normalized;
}

/**
 * Applicant-owned correspondence fields use the application VIZA mailbox.
 * Third-party fields such as sponsor_email, employer_email, host_email, and
 * us_contact_email deliberately remain editable applicant data.
 */
export function isManagedApplicationEmailFieldName(fieldName: string): boolean {
  return MANAGED_APPLICATION_EMAIL_BASE_FIELD_NAMES.has(
    normalizeManagedEmailFieldName(fieldName),
  );
}

export function applyManagedApplicationEmailToAnswers(
  answers: Record<string, string>,
  managedEmail: string,
  fieldNames: Iterable<string> = Object.keys(answers),
): Record<string, string> {
  const email = managedEmail.trim().toLowerCase();
  if (!email) return { ...answers };

  const next = { ...answers };
  for (const fieldName of fieldNames) {
    if (isManagedApplicationEmailFieldName(fieldName)) {
      next[fieldName] = email;
    }
  }
  return next;
}

export function containsManagedApplicationEmailField(
  fieldNames: Iterable<string>,
): boolean {
  for (const fieldName of fieldNames) {
    if (isManagedApplicationEmailFieldName(fieldName)) return true;
  }
  return false;
}
