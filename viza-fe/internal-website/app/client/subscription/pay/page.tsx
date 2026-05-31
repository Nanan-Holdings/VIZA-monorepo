import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PaymentStatusPoller } from "../payment-status-poller";
import { getPaymentRecordForCurrentUser } from "../data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PaySearchParams = {
  paymentId?: string | string[];
};

interface SubscriptionPayPageProps {
  searchParams?: Promise<PaySearchParams>;
}

function getParam(params: PaySearchParams | undefined, key: keyof PaySearchParams): string | null {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function readCodeUrl(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const wechatPay = (metadata as { wechat_pay?: unknown }).wechat_pay;
  if (!wechatPay || typeof wechatPay !== "object" || Array.isArray(wechatPay)) return null;
  const codeUrl = (wechatPay as { code_url?: unknown }).code_url;
  return typeof codeUrl === "string" && codeUrl.trim() ? codeUrl : null;
}

export default async function SubscriptionPayPage({ searchParams }: SubscriptionPayPageProps) {
  const params = await searchParams;
  const paymentId = getParam(params, "paymentId");
  const record = paymentId ? await getPaymentRecordForCurrentUser(paymentId) : null;
  const codeUrl = readCodeUrl(record?.metadata);
  const qrDataUrl = codeUrl
    ? await QRCode.toDataURL(codeUrl, {
        margin: 1,
        width: 320,
        color: {
          dark: "#03346E",
          light: "#FFFFFF",
        },
      })
    : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-16">
      <Button asChild variant="outline" className="h-11 w-fit rounded-full">
        <Link href="/client/subscription">
          <ArrowLeft className="h-4 w-4" />
          返回订阅方案
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">微信支付</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            请使用微信扫码完成支付。VIZA 仅收取页面展示的人民币服务费，官方签证费和第三方费用会单独说明。
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {qrDataUrl && paymentId ? (
            <div className="grid gap-6 md:grid-cols-[340px_minmax(0,1fr)] md:items-center">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <Image
                  src={qrDataUrl}
                  alt="微信支付二维码"
                  width={320}
                  height={320}
                  className="h-auto w-full"
                  unoptimized
                />
              </div>
              <div className="space-y-4">
                <div className="flex gap-3 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    支付结果由微信支付异步通知写回 VIZA。请勿重复支付同一个二维码；如支付后状态未刷新，请稍等片刻。
                  </p>
                </div>
                <PaymentStatusPoller paymentId={paymentId} />
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              未找到可用的微信支付二维码，请返回订阅页重新发起。
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
