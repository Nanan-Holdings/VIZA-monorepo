"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2, ExternalLink, FileCheck2, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getJapanVfsChecklist,
  getJapanVfsEligibility,
  JAPAN_VFS_SG_OFFICIAL_URL,
  type JapanApplicantOccupation,
  type JapanVisaRequestType,
  type SingaporePassType,
} from "@/lib/japan-vfs-sg";

interface Props { applicationId: string }

export function JapanVfsAppointmentAssistant({ applicationId }: Props) {
  const [visaType, setVisaType] = useState<JapanVisaRequestType>("single_entry");
  const [occupation, setOccupation] = useState<JapanApplicantOccupation>("employed");
  const [passType, setPassType] = useState<SingaporePassType | "">("");
  const [passExpiry, setPassExpiry] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [consent, setConsent] = useState(false);
  const [uploaded, setUploaded] = useState<Set<string>>(new Set());
  const eligibility = getJapanVfsEligibility({ nationality: "China", passportType: "ordinary", singaporePassType: passType, singaporePassExpiryDate: passExpiry, intendedReturnDate: returnDate });
  const checklist = useMemo(() => getJapanVfsChecklist(visaType, occupation), [visaType, occupation]);
  const ready = eligibility.eligible && consent && checklist.every((item) => uploaded.has(item.id));
  const toggle = (id: string) => setUploaded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return <main className="mx-auto w-full max-w-[1090px] space-y-5 px-4 py-8">
    <header className="space-y-2">
      <p className="text-sm font-medium text-brand-600">日本旅游签证 · 新加坡 JVAC</p>
      <h1 className="font-heading text-3xl font-semibold">VFS 预约前检查</h1>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">完成资格和材料检查后，VIZA 会将您带到官方 VFS 页面完成预约。具体时段与最终提交始终由您确认。</p>
    </header>
    <Alert className="border-amber-200 bg-amber-50"><ShieldCheck className="h-4 w-4 text-amber-700" /><AlertTitle>请在出行前 3 个月内申请</AlertTitle><AlertDescription>JVAC 正常处理至少需 10 个工作日；材料不足可能导致无法受理或需要重新预约。</AlertDescription></Alert>
    <Card><CardHeader><CardTitle>1. 申请资格与签证类型</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm"><span>签证请求</span><select className="w-full rounded-md border p-2" value={visaType} onChange={(e) => setVisaType(e.target.value as JapanVisaRequestType)}><option value="single_entry">单次入境</option><option value="double_entry">双次入境（两次行程相隔不超过 6 个月）</option><option value="multiple_entry">多次入境</option></select></label>
      <label className="space-y-1 text-sm"><span>职业状态</span><select className="w-full rounded-md border p-2" value={occupation} onChange={(e) => setOccupation(e.target.value as JapanApplicantOccupation)}><option value="employed">受雇</option><option value="self_employed">企业主/自雇</option><option value="student">学生</option><option value="retired">退休</option><option value="housewife">家庭主妇/主夫</option><option value="unemployed">待业</option></select></label>
      <label className="space-y-1 text-sm"><span>新加坡长期准证</span><select className="w-full rounded-md border p-2" value={passType} onChange={(e) => setPassType(e.target.value as SingaporePassType)}><option value="">请选择</option><option value="pr">PR</option><option value="employment_pass">Employment Pass</option><option value="s_pass">S Pass</option><option value="work_permit">Work Permit</option><option value="dependent_pass">Dependent Pass</option><option value="long_term_visit_pass">Long-Term Visit Pass</option><option value="student_pass">Student Pass</option></select></label>
      <label className="space-y-1 text-sm"><span>准证到期日</span><input className="w-full rounded-md border p-2" type="date" value={passExpiry} onChange={(e) => setPassExpiry(e.target.value)} /></label>
      <label className="space-y-1 text-sm"><span>预计返回新加坡日期</span><input className="w-full rounded-md border p-2" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></label>
      <div className="self-end"><Badge variant={eligibility.eligible ? "default" : "secondary"}>{eligibility.eligible ? "资格通过" : "待补充"}</Badge><p className="mt-2 text-sm text-muted-foreground">{eligibility.reasonZh}</p></div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-brand-500" />2. 材料预检</CardTitle></CardHeader><CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">材料按每位申请人分别整理为 A4 文件，不使用订书钉、别针或回形针；非英文材料请准备译文。此处确认的是准备状态，VFS 最新 checklist 为最终依据。</p>
      {checklist.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"><Checkbox checked={uploaded.has(item.id)} onCheckedChange={() => toggle(item.id)} /><span><span className="block font-medium">{item.labelZh} <span className="font-normal text-muted-foreground">/ {item.labelEn}</span></span><span className="text-sm text-muted-foreground">{item.noteZh}</span></span></label>)}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>3. 授权并前往 VFS</CardTitle></CardHeader><CardContent className="space-y-4">
      <label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} /><span>我确认上述材料与行程信息真实，并授权 VIZA 保存预约前检查结果。VIZA 不会保存 VFS 密码、验证码、银行卡或会话令牌。</span></label>
      <Button className="w-full" disabled={!ready} asChild><a href={`${JAPAN_VFS_SG_OFFICIAL_URL}?application=${encodeURIComponent(applicationId)}`} target="_blank" rel="noreferrer"><CalendarCheck className="mr-2 h-4 w-4" />前往 VFS 选择时段并确认预约 <ExternalLink className="ml-2 h-4 w-4" /></a></Button>
      {ready && <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />预约前检查完成。请在官方页面完成登录、选时段及最终确认。</p>}
    </CardContent></Card>
  </main>;
}
