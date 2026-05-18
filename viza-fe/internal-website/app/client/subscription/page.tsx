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
    name: "体验版",
    price: "$0",
    cadence: "/ 月",
    status: "当前可用",
    description: "适合先体验 VIZA 的申请入口、双语表单和通用资料保存。",
    features: ["1 个进行中的签证申请", "通用资料自动预填", "双语对照表单", "热门目的地表单入口"],
  },
  {
    name: "标准版",
    price: "$19",
    cadence: "/ 月",
    status: "推荐预览",
    description: "适合同时准备多个国家签证，希望减少重复填写和遗漏的用户。",
    features: ["最多 3 个进行中的签证申请", "包含体验版能力", "字段级 visa consultant 帮助", "申请进度与材料提醒"],
  },
  {
    name: "高级版",
    price: "$49",
    cadence: "/ 月",
    status: "方案预览",
    description: "适合高频出行或家庭申请，需要更完整的核对、提醒和材料整理。",
    features: ["最多 8 个进行中的签证申请", "包含标准版能力", "材料清单核对", "提交前核对入口"],
  },
];

const renewalRows = [
  { label: "当前方案", value: "VIZA Application 体验版" },
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
                <p className="text-[14px] font-semibold text-[#03346E]">VIZA Application</p>
                <h1 className="mt-2 font-heading text-[32px] font-medium leading-tight text-[#2f2f2f] sm:text-[42px]">
                  VIZA Application
                </h1>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#667085]">
                  这里先作为申请方案和订阅说明页。正式计费、续费周期和价格还未开启，因此当前用户默认显示为 VIZA Application 体验版。
                </p>
              </div>
            </div>

            <div className="rounded-[16px] border border-[#d7e3f2] bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-[#667085]">当前方案</p>
                  <p className="mt-1 text-[24px] font-semibold text-[#03346E]">VIZA Application</p>
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
                  <h2 className="font-heading text-[26px] font-medium text-[#2f2f2f]">方案级别预览</h2>
                  <p className="mt-2 text-[14px] leading-6 text-[#667085]">
                    这些数字只是为了先看页面效果，正式价格、额度和续费周期之后再调整。
                  </p>
                </div>
                <span className="w-fit rounded-full bg-[#eef3fa] px-3 py-1 text-[13px] font-medium text-[#03346E]">
                  Pricing preview
                </span>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {plannedTiers.map((tier) => (
                  <article
                    key={tier.name}
                    className="flex min-h-[340px] flex-col rounded-[16px] border border-[#e6edf6] bg-white p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[20px] font-semibold text-[#26364a]">{tier.name}</h3>
                        <div className="mt-3 flex items-end gap-1">
                          <span className="text-[34px] font-semibold leading-none text-[#03346E]">{tier.price}</span>
                          <span className="pb-1 text-[14px] font-medium text-[#667085]">{tier.cadence}</span>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#eaf2ff] px-2.5 py-1 text-[12px] font-semibold text-[#03346E]">
                        {tier.status}
                      </span>
                    </div>
                    <p className="mt-4 text-[14px] leading-6 text-[#667085]">{tier.description}</p>
                    <ul className="mt-5 space-y-3">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-[14px] leading-6 text-[#26364a]">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#03346E]" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button
                      className="mt-auto rounded-full border border-[#03346E] px-4 py-2.5 text-[14px] font-semibold text-[#03346E] transition hover:bg-[#03346E] hover:text-white"
                      type="button"
                    >
                      查看方案
                    </button>
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
                    <p className="text-[16px] font-semibold text-[#26364a]">询问 visa consultant</p>
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
