"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  publishCatalogueEntryFromForm,
  retireCatalogueEntryFromForm,
  saveCatalogueDraftFromForm,
  type CatalogueActionResult,
} from "@/app/actions/admin-catalogue";
import type { CatalogueReadiness, PublicCataloguePayload } from "@/lib/admin/catalogue";

export interface CataloguePublicationCardProps {
  packageId: string;
  packageLabel: string;
  canonicalPricing: string;
  status: "draft" | "published" | "retired" | "not_started";
  version: number;
  publishedAt: string | null;
  payload: PublicCataloguePayload;
  readiness: CatalogueReadiness;
  copy: {
    canonicalPricing: string;
    draftFields: string;
    saveDraft: string;
    publish: string;
    retire: string;
    reason: string;
    featured: string;
    blockers: string;
    warnings: string;
    ready: string;
    publishedAt: string;
    pending: string;
    saved: string;
    fields: {
      slug: string;
      portalCountry: string;
      publicName: string;
      city: string;
      flagCode: string;
      publicType: string;
      visaType: string;
      validity: string;
      image: string;
      tag: string;
      governmentFee: string;
      agencyFee: string;
      discount: string;
    };
    statuses: Record<CataloguePublicationCardProps["status"], string>;
  };
}

function SubmitButton({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "danger" | "neutral" }) {
  const { pending } = useFormStatus();
  const className = tone === "danger"
    ? "bg-red-700 text-white"
    : tone === "neutral"
      ? "border border-[#d9dee7] bg-white text-[#334155]"
      : "bg-brand-500 text-white";
  return <button disabled={pending} className={`h-9 rounded-md px-4 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${className}`}>{pending ? "…" : children}</button>;
}

function Result({ result, saved }: { result: CatalogueActionResult | null; saved: string }) {
  if (!result) return null;
  return result.success
    ? <p role="status" className="mt-2 text-xs font-semibold text-emerald-700">{saved}</p>
    : <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{result.error}</p>;
}

const inputClass = "h-9 rounded-md border border-[#d9dee7] bg-white px-3 text-sm text-[#232323]";

export function CataloguePublicationCard(props: CataloguePublicationCardProps) {
  const [saveResult, saveAction] = useActionState(saveCatalogueDraftFromForm, null);
  const [publishResult, publishAction] = useActionState(publishCatalogueEntryFromForm, null);
  const [retireResult, retireAction] = useActionState(retireCatalogueEntryFromForm, null);
  const readiness = saveResult?.readiness ?? publishResult?.readiness ?? props.readiness;
  const statusTone = props.status === "published"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : props.status === "retired"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <article className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-[#232323]">{props.packageLabel}</h2>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone}`}>{props.copy.statuses[props.status]} · v{props.version}</span>
          </div>
          <p className="mt-1 text-xs text-[#64748b]">{props.copy.canonicalPricing}: {props.canonicalPricing}</p>
          {props.publishedAt ? <p className="mt-1 text-xs text-[#64748b]">{props.copy.publishedAt}: {new Date(props.publishedAt).toLocaleString()}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {readiness.blockers.length ? <span className="rounded-full bg-red-50 px-2 py-1 font-semibold text-red-700">{readiness.blockers.length} {props.copy.blockers}</span> : <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{props.copy.ready}</span>}
          {readiness.warnings.length ? <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-800">{readiness.warnings.length} {props.copy.warnings}</span> : null}
        </div>
      </div>

      {(readiness.blockers.length || readiness.warnings.length) ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {readiness.blockers.length ? <div className="rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-red-800">{props.copy.blockers}</p><ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-red-700">{readiness.blockers.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
          {readiness.warnings.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-amber-900">{props.copy.warnings}</p><ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-800">{readiness.warnings.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
        </div>
      ) : null}

      <details className="mt-4 rounded-lg border border-[#edf0f4] p-4" open={props.status === "not_started"}>
        <summary className="cursor-pointer text-sm font-semibold text-[#334155]">{props.copy.draftFields}</summary>
        <form action={saveAction} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="visaPackageId" value={props.packageId} />
          <label className="grid gap-1 text-xs text-[#64748b]">{props.copy.fields.slug}<input className={inputClass} name="slug" required defaultValue={props.payload.slug} /></label>
          <label className="grid gap-1 text-xs text-[#64748b]">{props.copy.fields.portalCountry}<input className={inputClass} name="portalCountry" required defaultValue={props.payload.portalCountry} /></label>
          <label className="grid gap-1 text-xs text-[#64748b]">{props.copy.fields.publicName}<input className={inputClass} name="name" required defaultValue={props.payload.name} /></label>
          <label className="grid gap-1 text-xs text-[#64748b]">{props.copy.fields.city}<input className={inputClass} name="city" required defaultValue={props.payload.city} /></label>
          <label className="grid gap-1 text-xs text-[#64748b]">{props.copy.fields.flagCode}<input className={inputClass} name="flagCode" required maxLength={2} defaultValue={props.payload.flagCode} /></label>
          <label className="grid gap-1 text-xs text-[#64748b]">{props.copy.fields.publicType}<input className={inputClass} name="type" required defaultValue={props.payload.type} /></label>
          <label className="grid gap-1 text-xs text-[#64748b]">{props.copy.fields.visaType}<input className={inputClass} name="visaType" required defaultValue={props.payload.visaType} /></label>
          <label className="grid gap-1 text-xs text-[#64748b]">{props.copy.fields.validity}<input className={inputClass} name="validity" required defaultValue={props.payload.validity} /></label>
          <label className="grid gap-1 text-xs text-[#64748b] xl:col-span-2">{props.copy.fields.image}<input className={inputClass} name="image" required defaultValue={props.payload.image} /></label>
          <label className="grid gap-1 text-xs text-[#64748b]">{props.copy.fields.tag}<select className={inputClass} name="tag" defaultValue={props.payload.tag}><option value="fast">fast</option><option value="evisa">evisa</option></select></label>
          <label className="flex items-end gap-2 pb-2 text-sm text-[#334155]"><input type="checkbox" name="featured" defaultChecked={props.payload.featured} />{props.copy.featured}</label>
          <label className="grid gap-1 text-xs text-[#64748b]">{props.copy.fields.governmentFee}<input className={inputClass} type="number" min="0" name="governmentFeeMinor" required defaultValue={props.payload.pricing.governmentFeeMinor} /></label>
          <label className="grid gap-1 text-xs text-[#64748b]">{props.copy.fields.agencyFee}<input className={inputClass} type="number" min="0" name="agencyFeeMinor" required defaultValue={props.payload.pricing.agencyFeeMinor} /></label>
          <label className="grid gap-1 text-xs text-[#64748b]">{props.copy.fields.discount}<input className={inputClass} type="number" min="0" name="firstTimeDiscountMinor" required defaultValue={props.payload.pricing.firstTimeDiscountMinor} /></label>
          <label className="grid gap-1 text-xs text-[#64748b] md:col-span-2 xl:col-span-4">{props.copy.reason}<input className={inputClass} name="reason" required minLength={5} /></label>
          <div className="md:col-span-2 xl:col-span-4"><SubmitButton>{props.copy.saveDraft}</SubmitButton><Result result={saveResult} saved={props.copy.saved} /></div>
        </form>
      </details>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <form action={publishAction} className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <input type="hidden" name="visaPackageId" value={props.packageId} />
          <input className={`${inputClass} w-full`} name="reason" required minLength={5} placeholder={props.copy.reason} />
          <div className="mt-2"><SubmitButton>{props.copy.publish}</SubmitButton><Result result={publishResult} saved={props.copy.saved} /></div>
        </form>
        {props.status === "published" ? <form action={retireAction} className="rounded-lg border border-red-200 bg-red-50/50 p-3"><input type="hidden" name="visaPackageId" value={props.packageId} /><input className={`${inputClass} w-full`} name="reason" required minLength={5} placeholder={props.copy.reason} /><div className="mt-2"><SubmitButton tone="danger">{props.copy.retire}</SubmitButton><Result result={retireResult} saved={props.copy.saved} /></div></form> : <div className="rounded-lg border border-dashed border-[#d9dee7] p-3 text-xs text-[#64748b]">{props.copy.pending}</div>}
      </div>
    </article>
  );
}
