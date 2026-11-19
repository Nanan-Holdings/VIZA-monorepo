/**
 * DS-160 run checkpoints. The submission worker writes the CEAC page it has
 * reached to `submission_queue.current_stage` (`ceac_starting`,
 * `ceac_session_ready`, `ceac_page:<page>`); this table turns that into a
 * progress percentage and a label for the applicant.
 */

export type Ds160ProgressPhase = "preparing" | "filling" | "confirming";

export interface Ds160Checkpoint {
  key: string;
  progress: number;
  labelEn: string;
  labelZh: string;
  phase: Ds160ProgressPhase;
}

export interface Ds160ProgressInfo extends Ds160Checkpoint {
  /** 1-based position among the checkpoints. */
  step: number;
  totalSteps: number;
  /** Highest progress the bar may creep to before the next checkpoint. */
  ceiling: number;
  /** Rough minutes left, from typical successful runs. */
  minutesLeft: number;
}

/** Live DS-160 runs on the US East worker take about 7–8 minutes end to end. */
export const DS160_TYPICAL_RUN_MINUTES = 8;

const page = (
  id: string,
  progress: number,
  labelEn: string,
  labelZh: string,
  phase: Ds160ProgressPhase = "filling",
): Ds160Checkpoint => ({ key: `ceac_page:${id}`, progress, labelEn, labelZh, phase });

export const DS160_CHECKPOINTS: readonly Ds160Checkpoint[] = [
  { key: "ceac_starting", progress: 6, labelEn: "Opening the official DS-160 site", labelZh: "正在打开 DS-160 官网", phase: "preparing" },
  { key: "ceac_session_ready", progress: 10, labelEn: "Official site opened", labelZh: "已进入官网，正在创建申请", phase: "preparing" },
  page("personal_information_1", 14, "Personal information (1)", "个人信息（一）"),
  page("personal_information_2", 19, "Personal information (2)", "个人信息（二）"),
  page("travel_information", 24, "Travel information", "旅行信息"),
  page("travel_companions", 28, "Travel companions", "同行人员"),
  page("previous_us_travel", 32, "Previous U.S. travel", "以往赴美记录"),
  page("address_and_phone", 37, "Address and phone", "地址和电话"),
  page("passport", 42, "Passport", "护照信息"),
  page("us_contact", 47, "U.S. point of contact", "美国联系人"),
  page("family_relatives", 51, "Family: relatives", "家庭信息（亲属）"),
  page("family_spouse", 55, "Family: spouse", "家庭信息（配偶）"),
  page("work_education_present", 59, "Work / education: present", "工作/教育（当前）"),
  page("work_education_previous", 63, "Work / education: previous", "工作/教育（以往）"),
  page("work_education_additional", 66, "Work / education: additional", "工作/教育（其他）"),
  page("security_background_1", 69, "Security and background (1/5)", "安全与背景（1/5）"),
  page("security_background_2", 72, "Security and background (2/5)", "安全与背景（2/5）"),
  page("security_background_3", 75, "Security and background (3/5)", "安全与背景（3/5）"),
  page("security_background_4", 78, "Security and background (4/5)", "安全与背景（4/5）"),
  page("security_background_5", 81, "Security and background (5/5)", "安全与背景（5/5）"),
  page("upload_photo", 84, "Uploading the photo", "上传照片"),
  page("confirm_photo", 87, "Confirming the photo", "确认照片"),
  page("review", 90, "Reviewing the application", "核对申请"),
  page("sign_and_submit", 94, "Signing and submitting", "签名并提交", "confirming"),
  page("confirmation", 98, "Getting the confirmation page", "正在获取确认页", "confirming"),
];

/** CEAC pages before the form itself count as the "site opened" checkpoint. */
const ALIASES: Record<string, string> = {
  "ceac_page:start": "ceac_session_ready",
  "ceac_page:security_notice": "ceac_session_ready",
  "ceac_page:retrieve_application": "ceac_session_ready",
};

export function ds160ProgressForStage(stage: string | null | undefined): Ds160ProgressInfo | null {
  const raw = stage?.trim().toLowerCase();
  if (!raw) return null;
  const key = ALIASES[raw] ?? raw;
  const index = DS160_CHECKPOINTS.findIndex((checkpoint) => checkpoint.key === key);
  if (index < 0) return null;
  const checkpoint = DS160_CHECKPOINTS[index];
  const next = DS160_CHECKPOINTS[index + 1];
  const minutesLeft = Math.max(
    1,
    Math.ceil(((100 - checkpoint.progress) / 100) * DS160_TYPICAL_RUN_MINUTES),
  );
  return {
    ...checkpoint,
    step: index + 1,
    totalSteps: DS160_CHECKPOINTS.length,
    ceiling: next ? next.progress - 1 : 99,
    minutesLeft,
  };
}
