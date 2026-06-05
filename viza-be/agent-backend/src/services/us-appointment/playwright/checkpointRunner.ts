import type { AppointmentManualActionType, USAppointmentStatus } from "../types.js";

export interface AppointmentCheckpointDetection {
  actionType: AppointmentManualActionType;
  status: USAppointmentStatus;
  instruction: string;
}

export function classifyOfficialSiteCheckpoint(pageText: string): AppointmentCheckpointDetection | null {
  const text = pageText.toLowerCase();
  if (text.includes("captcha") || text.includes("verify you are human")) {
    return {
      actionType: "captcha",
      status: "appointment_captcha_required",
      instruction: "Complete the CAPTCHA in the synchronized official browser, then resume in VIZA.",
    };
  }
  if (text.includes("verification code") || text.includes("email verification")) {
    return {
      actionType: "account_email_verification",
      status: "appointment_email_verification_required",
      instruction: "Enter the email verification code from the official appointment portal.",
    };
  }
  if (text.includes("payment") || text.includes("mrv")) {
    return {
      actionType: "payment",
      status: "appointment_payment_required",
      instruction: "Complete the official payment step manually. VIZA will not submit real payments in development.",
    };
  }
  if (text.includes("confirm appointment") || text.includes("schedule appointment")) {
    return {
      actionType: "final_confirmation",
      status: "appointment_final_confirmation_required",
      instruction: "Review the official appointment details and explicitly approve before booking.",
    };
  }
  if (text.includes("automation") || text.includes("prohibited conduct") || text.includes("terms of use")) {
    return {
      actionType: "site_policy_review",
      status: "appointment_blocked_by_site_policy",
      instruction: "Official site policy warning detected. Stop immediately and complete this manually.",
    };
  }
  return null;
}
