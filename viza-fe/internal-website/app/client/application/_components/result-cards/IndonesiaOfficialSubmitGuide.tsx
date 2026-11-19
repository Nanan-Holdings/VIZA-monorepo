"use client";

import Image from "next/image";

/**
 * Step-by-step guide for the Indonesia official eVisa page the applicant
 * opens from the VIZA handoff. Screenshots are real official-page crops with
 * no applicant data (public/guides/indonesia).
 */
const STEPS = [
  {
    zh: "往下滚动，逐项核对资料。每一项右边的 “Check?” 都要勾上。",
    en: "Scroll down and review every item. Tick “Check?” on the right of each one.",
    image: { src: "/guides/indonesia/check.webp", width: 953, height: 83 },
  },
  {
    zh: "滚到最底部的 “Terms of Condition”，勾上两个声明框，然后点右下角蓝色的 “Save”。如果弹出 “Are you sure want to continue application?”，点 “Yes”。",
    en: "At the bottom, under “Terms of Condition”, tick both declarations, then click the blue “Save”. If “Are you sure want to continue application?” appears, click “Yes”.",
    image: { src: "/guides/indonesia/decl.webp", width: 953, height: 288 },
  },
  {
    zh: "回到申请列表后，状态显示 “DRAFT”（草稿），此时还没有提交。先不要点交易号，直接点下方蓝色的 “Submit”。",
    en: "Back on the application list it is marked “DRAFT” (not submitted yet). Don’t click the transaction number yet; click the blue “Submit” below.",
    image: { src: "/guides/indonesia/list.webp", width: 953, height: 222 },
  },
  {
    zh: "弹出 “Do you want to save this data as Guest or save this data with Register?” 时，点 “With Register”。接着出现防诈骗提示（Warning），点 “OK”。列表状态变成 “Waiting For Payment” 就是提交成功了。",
    en: "When asked “save this data as Guest or with Register?”, click “With Register”. Then click “OK” on the fraud warning. When the status changes to “Waiting For Payment”, your application is submitted.",
    image: { src: "/guides/indonesia/guest.webp", width: 438, height: 226 },
  },
  {
    zh: "点列表里带下划线的交易号（Transaction Number）进入详情页。官网会要求输入 “OTP Code”：去你在 VIZA 登记的邮箱查收印尼移民局（Indonesia Immigration）的邮件，验证码是 6 位字母加数字（例如 AB12CD），也看看垃圾邮件。只有 5 分钟有效，填入后点 “Submit”。",
    en: "Click the underlined transaction number to open the details. The site asks for an “OTP Code”: check the email you registered with VIZA for the message from Indonesia Immigration. The code is 6 letters and digits (for example AB12CD); check spam too. It is valid for 5 minutes. Enter it and click “Submit”.",
    image: { src: "/guides/indonesia/otp.webp", width: 438, height: 189 },
  },
  {
    zh: "详情页滚到最底部 “Payment Information”，点 “Make a Payment”。红色倒计时是官网的付款期限，过期申请会被取消。",
    en: "Scroll to “Payment Information” at the bottom and click “Make a Payment”. The red countdown is the official payment deadline; the application is cancelled if it runs out.",
    image: { src: "/guides/indonesia/pay.webp", width: 953, height: 148 },
  },
  {
    zh: "在官方付款页（finpay）填写你自己的 Visa / Mastercard / JCB 卡信息，点 “Bayar Sekarang”（立即支付），按银行提示完成 3DS 验证。刷卡会有银行手续费；VIZA 不收取任何费用。",
    en: "On the official payment page (finpay), enter your own Visa / Mastercard / JCB card, click “Bayar Sekarang” (Pay now) and complete your bank’s 3DS check. Card payments carry a bank fee; VIZA charges nothing.",
    image: null,
  },
] as const;

export function IndonesiaOfficialSubmitGuide({ isZh }: { isZh: boolean }) {
  return (
    <section className="space-y-4 rounded-md border border-input bg-background p-4" aria-label={isZh ? "官网操作教程" : "Official site guide"}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          {isZh ? "在印尼官网怎么操作" : "What to do on the Indonesia official site"}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {isZh
            ? "官网页面是英文的，而且是远程打开的，点击和滚动会有一点延迟，请耐心操作。官网闲置太久会自动登出；如果打开后看到的是官网首页或选择国家的页面，请回到 VIZA 重新准备官网会话。"
            : "The official page is in English and runs remotely, so clicks and scrolling are a little delayed. The official site logs you out after a while; if you see its home page or the country selection page, come back to VIZA and prepare a new session."}
        </p>
      </div>
      <ol className="space-y-4">
        {STEPS.map((step, index) => (
          <li key={step.en} className="space-y-2">
            <p className="text-sm leading-relaxed text-foreground">
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
                {index + 1}
              </span>
              {isZh ? step.zh : step.en}
            </p>
            {step.image ? (
              <Image
                src={step.image.src}
                width={step.image.width}
                height={step.image.height}
                alt={isZh ? `第 ${index + 1} 步的官网截图` : `Official site, step ${index + 1}`}
                className="h-auto max-w-full rounded border border-input"
                unoptimized
              />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
