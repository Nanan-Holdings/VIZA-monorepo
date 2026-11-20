// Historical UK drafts contain input hints and translated mirrors as answers.
// Bare example values ("Zhang", a real street address) remain valid answers.
export function isUkPlaceholderAnswer(value: string): boolean {
  return /^(?:请(?:填写|输入|填入|提供|选择)|please\s+(?:fill\s+(?:in|out)|enter|provide|select)\b|enter\s+(?:your|the)\b|(?:for\s+example|e\.?g\.?|例如|示例)\s*[:：,，]|门牌号\s*\+\s*街道[，,]|小区\/楼栋\/单元\/房号|house\s+number\s*\+\s*street[，,]|community\/building\/unit\/room\s+number)/i.test(value.trim());
}

export function sanitizeUkPlaceholderAnswers(
  answers: Record<string, string>,
  visaType?: string | null,
): Record<string, string> {
  if (visaType !== "UK_STANDARD_VISITOR") return answers;
  let result = answers;
  for (const [key, value] of Object.entries(answers)) {
    if (key.startsWith("__") || !isUkPlaceholderAnswer(value)) continue;
    if (result === answers) result = { ...answers };
    // Explicit clears also prevent a pending browser draft restoring the hint.
    result[key] = "";
  }
  return result;
}
