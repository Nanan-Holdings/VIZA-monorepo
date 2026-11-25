"use client";

/**
 * Text guide for the Vietnam official e-Visa page the applicant opens from the
 * VIZA handoff. The runner stops on the official review CAPTCHA; the applicant
 * enters it and clicks Next, which is the official submission.
 * Screenshots get added after the first real handoff (public/guides/vietnam).
 */
const STEPS = [
  {
    zh: "打开的是 VIZA 已经帮你填好的越南官网申请页。往上滚动，逐项核对资料和上传的照片、护照页。",
    en: "The page that opens is your Vietnam official application, already filled in by VIZA. Scroll up and check every answer and the uploaded photo and passport page.",
  },
  {
    zh: "回到页面底部，确认声明已勾选，然后输入官网显示的图片验证码（Captcha）。看不清可以点旁边的刷新换一张。",
    en: "At the bottom, make sure the declarations are ticked, then type the image verification code (Captcha) the site shows. Use the refresh icon next to it if it is hard to read.",
  },
  {
    zh: "点 “Next” / “Submit” 正式提交。官网会显示 “DECLARATION COMPLETED” 和以 E 开头的电子档案码（Electronic document code），请记下这个编号。",
    en: "Click “Next” / “Submit” to submit officially. The site shows “DECLARATION COMPLETED” and an electronic document code starting with E. Keep this code.",
  },
  {
    zh: "点 “Confirm” 进入付款页，用你自己的银行卡缴纳越南官方费用。VIZA 不收取任何费用。",
    en: "Click “Confirm” to go to payment and pay the Vietnamese government fee with your own card. VIZA charges nothing.",
  },
] as const;

export function VietnamOfficialSubmitGuide({ isZh }: { isZh: boolean }) {
  return (
    <section className="space-y-4 rounded-md border border-input bg-background p-4" aria-label={isZh ? "官网操作教程" : "Official site guide"}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          {isZh ? "在越南官网怎么操作" : "What to do on the Vietnam official site"}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {isZh
            ? "官网页面是英文的，而且是远程打开的，点击和滚动会有一点延迟，请耐心操作。不要刷新官网页面，否则已填写的内容会丢失。"
            : "The official page is in English and runs remotely, so clicks and scrolling are a little delayed. Don't reload the official page, or the filled answers are lost."}
        </p>
      </div>
      <ol className="space-y-3">
        {STEPS.map((step, index) => (
          <li key={step.en} className="text-sm leading-relaxed text-foreground">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
              {index + 1}
            </span>
            {isZh ? step.zh : step.en}
          </li>
        ))}
      </ol>
    </section>
  );
}
