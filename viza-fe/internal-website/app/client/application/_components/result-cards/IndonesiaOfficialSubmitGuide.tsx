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
    zh: "滚到最底部的 “Terms of Condition”，勾上两个声明框，然后点右下角蓝色的 “Save”。",
    en: "At the bottom, under “Terms of Condition”, tick both declarations, then click the blue “Save”.",
    image: { src: "/guides/indonesia/decl.webp", width: 953, height: 288 },
  },
  {
    zh: "弹出 “Are you sure want to continue application?” 时点 “Yes”。这一步就是正式提交申请。",
    en: "When “Are you sure want to continue application?” appears, click “Yes”. This officially submits your application.",
    image: { src: "/guides/indonesia/confirm.webp", width: 953, height: 462 },
  },
  {
    zh: "进入付款页后，选择信用卡/借记卡，用你自己的卡支付印尼官方费用。VIZA 不收取任何费用。",
    en: "On the payment page, choose credit/debit card and pay the Indonesian government fee with your own card. VIZA charges nothing.",
    image: null,
  },
  {
    zh: "如果页面要求输入 “OTP Code”，验证码会发到你在 VIZA 登记的邮箱，填入后点 “Submit”。",
    en: "If the page asks for an “OTP Code”, the code is sent to the email you registered with VIZA. Enter it and click “Submit”.",
    image: { src: "/guides/indonesia/otp.webp", width: 438, height: 189 },
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
