export {
  solveImageCaptcha,
  solveCaptcha,
  reportBadCaptcha,
  TwoCaptchaConfigError,
  TwoCaptchaApiError,
  TwoCaptchaZeroBalanceError,
  TwoCaptchaNetworkError,
  TwoCaptchaSolveTimeoutError,
} from "./two-captcha";

export type {
  CaptchaSolveResult,
  CaptchaSolveTelemetry,
  TokenCaptchaInput,
} from "./two-captcha";
