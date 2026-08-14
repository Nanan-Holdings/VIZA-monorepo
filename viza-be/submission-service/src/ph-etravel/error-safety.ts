const PH_ETRAVEL_SAFE_ERROR_MESSAGES: Record<string, string> = {
  ph_etravel_portal_payload_validation_failed:
    "Philippines eTravel could not start because the traveller's VIZA answers are incomplete or unsupported.",
  ph_etravel_stopped_before_submit:
    "Philippines eTravel reached the official Review step and stopped before final submit.",
  ph_etravel_confirmation_evidence_missing:
    "Philippines eTravel needs recovery because VIZA could not confirm an authoritative official reference and reference-derived QR render.",
  ph_etravel_authoritative_result_read_required:
    "Philippines eTravel needs recovery because an authoritative post-submit registration result was not confirmed.",
  ph_etravel_final_post_http_200_unverified:
    "Philippines eTravel needs recovery because an official final-post HTTP response did not confirm a result record.",
  ph_etravel_final_post_ambiguous_recovery_required:
    "Philippines eTravel needs recovery because the final official submission outcome is ambiguous.",
  ph_etravel_arrival_diverted_unsupported:
    "Philippines eTravel ordinary arrival automation does not support this traveller category.",
  ph_etravel_arrival_for_other_action_required:
    "Philippines eTravel needs operator review because the ordinary For Other registration path is not verified.",
  ph_etravel_launch_profile_persona_review_required:
    "Philippines eTravel launch is blocked until the enabled profile and persona branch is verified.",
  ph_etravel_launch_residence_review_required:
    "Philippines eTravel launch is blocked until the enabled residence branch is verified.",
  ph_etravel_launch_air_travel_review_required:
    "Philippines eTravel launch is blocked until the enabled AIR travel and destination branches are verified.",
  ph_etravel_launch_air_special_flight_review_required:
    "Philippines eTravel launch is blocked until the AIR Special Flight branch is verified.",
  ph_etravel_launch_health_positive_review_required:
    "Philippines eTravel launch is blocked until the selected positive Health branch is verified.",
  ph_etravel_launch_sea_disembarking_review_required:
    "Philippines eTravel launch is blocked until the SEA non-disembarking branch is verified.",
  ph_etravel_launch_sea_customs_flow_review_required:
    "Philippines eTravel launch is blocked until the SEA manual or electronic customs flow is verified.",
  ph_etravel_launch_sea_electronic_positive_review_required:
    "Philippines eTravel launch is blocked until the SEA electronic positive customs continuation is verified.",
  ph_etravel_launch_currency_positive_review_required:
    "Philippines eTravel launch is blocked until the positive currency declaration branch is verified.",
  ph_etravel_launch_attachment_review_required:
    "Philippines eTravel launch is blocked until attachment requiredness and server behavior are verified.",
  ph_etravel_launch_final_result_recovery_required:
    "Philippines eTravel launch is blocked until final result and recovery behavior are verified.",
  ph_etravel_structured_customs_action_required:
    "Philippines eTravel needs operator review because a positive customs or currency declaration requires structured official controls.",
  ph_etravel_sea_port_flow_action_required:
    "Philippines eTravel needs operator review because the SEA destination-port customs flow could not be verified safely.",
  ph_etravel_signature_required:
    "Philippines eTravel needs operator review because the official declaration signature gate was reached before Review.",
  ph_etravel_family_companion_confirmation:
    "Philippines eTravel needs operator review because the official Family Member(s) companion confirmation gate was reached before Review.",
  ph_etravel_family_member_action_required:
    "Philippines eTravel needs operator review because the official Family Member(s) step requires an explicit action.",
  ph_etravel_wizard_route_unverified:
    "Philippines eTravel needs operator review because the official wizard route could not be verified safely.",
  ph_etravel_wizard_route_sequence_unverified:
    "Philippines eTravel needs operator review because the official wizard page sequence could not be verified safely.",
  ph_etravel_post_signature_live_evidence_required:
    "Philippines eTravel needs operator review because post-signature continuation is not live-verified for this path.",
  sea_electronic_positive_post_signature_evidence_pending:
    "Philippines eTravel needs operator review because the SEA electronic positive path is not live-verified after signature.",
  phetravel_confirmation_evidence_incomplete:
    "Philippines eTravel needs recovery because VIZA could not confirm an authoritative official reference and reference-derived QR render.",
  phetravel_result_consistency_sync_failed:
    "Philippines eTravel needs operator recovery because the official evidence was captured but VIZA could not finish internal status sync.",
  phetravel_submission_state_sync_input_invalid:
    "Philippines eTravel needs operator recovery because the internal status sync request was incomplete.",
  phetravel_submission_state_sync_rpc_not_enabled:
    "Philippines eTravel needs operator recovery because the atomic internal status sync is not enabled.",
  phetravel_submission_state_sync_rpc_unavailable:
    "Philippines eTravel needs operator recovery because the atomic internal status sync is unavailable.",
  phetravel_submission_state_sync_rpc_failed:
    "Philippines eTravel needs operator recovery because the atomic internal status sync did not complete.",
  phetravel_submission_state_sync_rpc_response_invalid:
    "Philippines eTravel needs operator recovery because the atomic internal status sync response was incomplete.",
  phetravel_submission_state_sync_state_conflict:
    "Philippines eTravel needs operator recovery because the expected internal state no longer matches.",
  phetravel_submission_state_sync_idempotency_conflict:
    "Philippines eTravel needs operator recovery because a conflicting internal status sync replay was blocked.",
  phetravel_validation_failed:
    "Philippines eTravel could not start because required VIZA form data is missing.",
  phetravel_live_worker_error:
    "Philippines eTravel could not be completed automatically. VIZA needs to review this attempt.",
  ph_etravel_unexpected_portal_error:
    "Philippines eTravel could not be completed automatically. VIZA needs to review this attempt.",
  ph_etravel_official_account_required:
    "Philippines eTravel could not continue because the official account checkpoint needs operator review.",
  ph_etravel_official_mpin_required:
    "Philippines eTravel could not continue because the official account MPIN checkpoint needs operator review.",
  ph_etravel_official_mpin_invalid:
    "Philippines eTravel could not continue because the official account MPIN checkpoint needs operator review.",
  ph_etravel_recovery_record_not_found:
    "Philippines eTravel recovery could not find the requested official record.",
  ph_etravel_recovery_record_not_opened:
    "Philippines eTravel recovery could not open the requested official record.",
  ph_etravel_recovery_qr_missing:
    "Philippines eTravel recovery could not isolate the official QR artifact.",
  ph_etravel_runner_window_scheduled:
    "Philippines eTravel is scheduled until its official 72-hour registration window opens.",
  ph_etravel_runner_window_action_required:
    "Philippines eTravel needs operator review because its official 72-hour registration window is unavailable.",
  ph_etravel_runner_active_job_exists:
    "Philippines eTravel did not start because another active runner job already owns this application.",
  ph_etravel_official_login_verification_required:
    "Philippines eTravel could not continue because the official email verification checkpoint needs operator review.",
  ph_etravel_official_registration_verification_required:
    "Philippines eTravel could not continue because the official registration verification checkpoint needs operator review.",
  ph_etravel_registration_password_policy_failed:
    "Philippines eTravel could not continue because the managed account password did not satisfy the official password policy.",
  ph_etravel_registration_turnstile_blocked:
    "Philippines eTravel could not continue because the official Turnstile checkpoint needs operator review.",
  ph_etravel_official_portal_blocked:
    "Philippines eTravel could not continue because the official portal access checkpoint needs operator review.",
};

export const PH_ETRAVEL_SAFE_FALLBACK_ERROR_CODE = "ph_etravel_safe_failure";
export const PH_ETRAVEL_SAFE_FALLBACK_ERROR_MESSAGE =
  "Philippines eTravel could not be completed automatically. VIZA needs to review this attempt.";

export function safePhEtravelErrorCode(code: string): string {
  return PH_ETRAVEL_SAFE_ERROR_MESSAGES[code] ? code : PH_ETRAVEL_SAFE_FALLBACK_ERROR_CODE;
}

export function safePhEtravelErrorSummary(input: {
  code: string;
  missingFields?: string[];
}): { code: string; message: string; portalSummary: string } {
  const code = safePhEtravelErrorCode(input.code);
  const baseMessage = code === PH_ETRAVEL_SAFE_FALLBACK_ERROR_CODE
    ? PH_ETRAVEL_SAFE_FALLBACK_ERROR_MESSAGE
    : PH_ETRAVEL_SAFE_ERROR_MESSAGES[code];
  const missingFields = (input.missingFields ?? [])
    .filter((field) => /^[a-z0-9_.-]{1,80}$/i.test(field))
    .slice(0, 20);
  const missingSuffix = missingFields.length > 0
    ? ` Missing VIZA fields: ${missingFields.join(", ")}.`
    : "";
  return {
    code,
    message: `${baseMessage}${missingSuffix}`,
    portalSummary: baseMessage,
  };
}

export function safePhEtravelServiceLog(input: { code: string }): string {
  const safe = safePhEtravelErrorSummary({ code: input.code });
  return `${safe.code}: ${safe.portalSummary}`;
}

export function safePhEtravelDiagnosticLogs(logs: string[]): string[] {
  return logs.flatMap((log) => {
    const match = log.match(/^(ph_etravel_[a-z0-9_]+)/i);
    return match ? [match[1].toLowerCase()] : [];
  });
}
