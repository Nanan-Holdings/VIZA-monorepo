export {
  solveImageCaptcha,
  solveGridCaptcha,
  solveCaptcha,
  reportBadCaptcha,
  reportGoodCaptcha,
  TwoCaptchaConfigError,
  TwoCaptchaApiError,
  TwoCaptchaZeroBalanceError,
  TwoCaptchaNetworkError,
  TwoCaptchaSolveTimeoutError,
} from "./two-captcha";

export type {
  CaptchaSolveResult,
  CaptchaSolveTelemetry,
  GridCaptchaSolveResult,
  GridCaptchaTaskOptions,
  TokenCaptchaInput,
} from "./two-captcha";
