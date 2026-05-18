import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FileText,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const plannedTiers = [
  {
    name: "基础版",
    status: "方案草案",
    description: "适合自己填写签证表单，只需要保存通用资料和双语表单辅助的用户。",
    features: ["通用资料自动预填", "双语对照表单", "热门目的地表单入口"],
  },
  {
    name: "智能版",
    status: "推荐方向",
    description: "适合需要 AI 帮忙理解字段、检查答案和减少重复填写的用户。",
    features: ["包含基础版能力", "字段级 AI 填写帮助", "申请进度与材料提醒"],
  },
  {
    name: "全程协助版",
    status: "待定",
    description: "适合需要更高触达度，希望有人协助检查材料和提交前核对的用户。",
    features: ["包含智能版能力", "材料清单核对", "提交前人工复核入口"],
  },
];

const renewalRows = [
  { label: "当前方案", value: "体验版" },
  { label: "续费状态", value: "暂未启用自动续费" },
  { label: "下次续费", value: "待定" },
  { label: "支付方式", value: "暂未绑定" },
];

export default function SubscriptionPage() {
  return (
    <div className="min-h-screen bg-[#fcfcfc] px-4 pb-16 pt-8 sm:px-6 lg:px-10">
      <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-6">
        <Link
          href="/client/home"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-[#e6e6e6] bg-white px-4 py-2 text-[14px] font-medium text-[#03346E] transition hover:border-[#03346E]"
        >
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Link>

        <section className="overflow-hidden rounded-[18px] border border-[#e7edf5] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="grid gap-6 border-b border-[#edf2f7] bg-[#f5f9ff] p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#03346E] text-white">
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-[#03346E]">VIZA Subscription</p>
                <h1 className="mt-2 font-heading text-[32px] font-medium leading-tight text-[#2f2f2f] sm:text-[42px]">
                  订阅与方案
                </h1>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#667085]">
                  这里先作为订阅入口和方案说明页。正式计费、续费周期和价格还未开启，因此当前用户默认显示为体验版。
                </p>
              </div>
            </div>

            <div className="rounded-[16px] border border-[#d7e3f2] bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-[#667085]">当前方案</p>
                  <p className="mt-1 text-[24px] font-semibold text-[#03346E]">体验版</p>
                </div>
                <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-[12px] font-semibold text-[#03346E]">
                  免费测试中
                </span>
              </div>
              <div className="mt-5 grid gap-3">
                {renewalRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 text-[14px]">
                    <span className="text-[#667085]">{row.label}</span>
                    <span className="font-semibold text-[#26364a]">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-0 divide-y divide-[#edf2f7]">
            <section className="grid gap-4 p-6 md:grid-cols-3 lg:p-8">
              <div className="rounded-[14px] border border-[#e6edf6] bg-white p-5">
                <Sparkles className="h-5 w-5 text-[#03346E]" />
                <p className="mt-4 text-[16px] font-semibold text-[#26364a]">当前可用</p>
                <p className="mt-2 text-[14px] leading-6 text-[#667085]">
                  双语表单、热门目的地入口和通用资料自动预填已开放。
                </p>
              </div>
              <div className="rounded-[14px] border border-[#e6edf6] bg-white p-5">
                <RefreshCw className="h-5 w-5 text-[#03346E]" />
                <p className="mt-4 text-[16px] font-semibold text-[#26364a]">续费状态</p>
                <p className="mt-2 text-[14px] leading-6 text-[#667085]">
                  自动续费和扣款尚未接入，正式上线前不会产生订阅费用。
                </p>
              </div>
              <div className="rounded-[14px] border border-[#e6edf6] bg-white p-5">
                <ShieldCheck className="h-5 w-5 text-[#03346E]" />
                <p className="mt-4 text-[16px] font-semibold text-[#26364a]">之后会补齐</p>
                <p className="mt-2 text-[14px] leading-6 text-[#667085]">
                  正式方案确定后，这里会展示价格、续费日期、发票和取消入口。
                </p>
              </div>
            </section>

            <section className="p-6 lg:p-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-heading text-[26px] font-medium text-[#2f2f2f]">方案级别草案</h2>
                  <p className="mt-2 text-[14px] leading-6 text-[#667085]">
                    这些不是最终价格页，只用于给用户一个清楚的产品层级预期。
                  </p>
                </div>
                <span className="w-fit rounded-full bg-[#eef3fa] px-3 py-1 text-[13px] font-medium text-[#03346E]">
                  Subscription design
                </span>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {plannedTiers.map((tier) => (
                  <article key={tier.name} className="rounded-[16px] border border-[#e6edf6] bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[20px] font-semibold text-[#26364a]">{tier.name}</h3>
                        <p className="mt-2 text-[14px] leading-6 text-[#667085]">{tier.description}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#eaf2ff] px-2.5 py-1 text-[12px] font-semibold text-[#03346E]">
                        {tier.status}
                      </span>
                    </div>
                    <ul className="mt-5 space-y-3">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-[14px] leading-6 text-[#26364a]">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#03346E]" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section className="grid gap-4 p-6 md:grid-cols-2 lg:p-8">
              <Link
                href="/client/application"
                className="flex items-center justify-between gap-4 rounded-[16px] border border-[#e6edf6] bg-white p-5 transition hover:border-[#03346E]"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#eef3fa] text-[#03346E]">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[16px] font-semibold text-[#26364a]">继续填写申请</p>
                    <p className="mt-1 text-[13px] text-[#667085]">订阅未开放也不影响当前申请流程。</p>
                  </div>
                </div>
              </Link>
              <Link
                href="/client/chat"
                className="flex items-center justify-between gap-4 rounded-[16px] border border-[#e6edf6] bg-white p-5 transition hover:border-[#03346E]"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#eef3fa] text-[#03346E]">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[16px] font-semibold text-[#26364a]">询问 VIZA AI</p>
                    <p className="mt-1 text-[13px] text-[#667085]">可以继续讨论适合你的方案和申请需求。</p>
                  </div>
                </div>
              </Link>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
