import { Buffer } from "node:buffer";
import { renderPdf, type PdfLine } from "./simple-pdf";

/**
 * Receipt + invoice PDF templates (PAY-005).
 *
 * The receipt is the consumer-facing "you paid VIZA" artifact. The
 * invoice variant adds company-name + tax-ID + VAT-line fields when
 * supplied — for B2B clients expensing the visa cost.
 */

export interface PdfOrderLine {
  kind: string;
  description: string;
  amountCents: number;
  currency: string;
}

export interface PdfOrder {
  id: string;
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  paidAt: string | null;
  status: string;
  currency: string;
  agencyFeeCents: number;
  govtFeeCents: number;
  /** Tax computed by Stripe Tax (PAY-006). 0 when no tax applied. */
  taxAmountCents?: number;
  /** ISO-3166 country Stripe used for tax (or null). */
  taxCountry?: string | null;
  /** Tax rate in basis points (e.g. 2000 = 20.00%). */
  taxRateBasisPoints?: number | null;
  lines: PdfOrderLine[];
  packageLabel: string;
  stripePaymentIntentId: string | null;
}

export interface InvoiceMeta {
  companyName: string;
  taxId: string;
  vatPercent?: number;
  billingAddress?: string;
}

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "TWD", "CLP", "ISK"]);

function formatAmount(cents: number, currency: string): string {
  const upper = currency.toUpperCase();
  if (ZERO_DECIMAL.has(upper)) return `${cents.toLocaleString()} ${upper}`;
  const major = (cents / 100).toFixed(2);
  return `${major} ${upper}`;
}

function buildHeader(
  title: string,
  order: PdfOrder,
  invoice?: InvoiceMeta,
): PdfLine[] {
  const lines: PdfLine[] = [
    { text: "VIZA Pte. Ltd.", size: 16, bold: true },
    { text: "support@haggstorm.com  •  haggstorm.com" },
    { text: "" },
    { text: title, size: 18, bold: true },
    { text: `Order: ${order.id}` },
    { text: `Application: ${order.applicationId}` },
    { text: `Issued: ${new Date().toISOString().slice(0, 10)}` },
  ];
  if (order.paidAt) {
    lines.push({ text: `Paid at: ${order.paidAt}` });
  }
  if (order.stripePaymentIntentId) {
    lines.push({ text: `Stripe PI: ${order.stripePaymentIntentId}` });
  }
  lines.push({ text: "" });
  if (invoice) {
    lines.push({ text: "Bill to", bold: true });
    lines.push({ text: invoice.companyName });
    if (invoice.billingAddress) lines.push({ text: invoice.billingAddress });
    lines.push({ text: `Tax ID: ${invoice.taxId}` });
    lines.push({ text: "" });
  }
  lines.push({ text: "Customer", bold: true });
  lines.push({ text: order.applicantName });
  lines.push({ text: order.applicantEmail });
  lines.push({ text: "" });
  lines.push({ text: `Package: ${order.packageLabel}` });
  lines.push({ text: "" });
  return lines;
}

function buildLineItems(order: PdfOrder, invoice?: InvoiceMeta): PdfLine[] {
  const out: PdfLine[] = [];
  out.push({ text: "Line items", bold: true });
  let subtotal = 0;
  for (const l of order.lines) {
    out.push({
      text: `  • [${l.kind}] ${l.description} — ${formatAmount(l.amountCents, l.currency)}`,
    });
    subtotal += l.amountCents;
  }
  out.push({ text: "" });
  out.push({
    text: `Subtotal: ${formatAmount(subtotal, order.currency)}`,
    bold: true,
  });

  // PAY-006: prefer the Stripe-Tax-computed amount when present
  // (filled in on order.tax_amount_cents by the webhook). Fall back
  // to the invoice meta's vatPercent when Stripe Tax was off and the
  // caller is asking for a B2B invoice override.
  let taxCents = 0;
  let taxLine = "";
  if ((order.taxAmountCents ?? 0) > 0) {
    taxCents = order.taxAmountCents ?? 0;
    const ratePct = order.taxRateBasisPoints
      ? (order.taxRateBasisPoints / 100).toFixed(2)
      : null;
    const country = order.taxCountry ? ` (${order.taxCountry})` : "";
    taxLine = ratePct
      ? `Tax @ ${ratePct}%${country}: ${formatAmount(taxCents, order.currency)}`
      : `Tax${country}: ${formatAmount(taxCents, order.currency)}`;
  } else if (invoice && invoice.vatPercent && invoice.vatPercent > 0) {
    taxCents = Math.round((subtotal * invoice.vatPercent) / 100);
    taxLine = `VAT @ ${invoice.vatPercent}%: ${formatAmount(taxCents, order.currency)}`;
  }

  if (taxCents > 0) {
    out.push({ text: taxLine });
    out.push({
      text: `Total: ${formatAmount(subtotal + taxCents, order.currency)}`,
      bold: true,
    });
  } else {
    out.push({
      text: `Total: ${formatAmount(subtotal, order.currency)}`,
      bold: true,
    });
  }
  return out;
}

function buildFooter(invoice?: InvoiceMeta): PdfLine[] {
  return [
    { text: "" },
    { text: "" },
    {
      text: invoice
        ? "This is an invoice. Payment terms per the underlying engagement."
        : "Thank you for your business. Refund policy per the VIZA Terms of Service.",
    },
    { text: "VIZA does not provide immigration legal advice." },
  ];
}

export function buildReceiptPdf(order: PdfOrder): Buffer {
  const lines = [
    ...buildHeader("Receipt", order),
    ...buildLineItems(order),
    ...buildFooter(),
  ];
  return renderPdf(`VIZA receipt ${order.id}`, lines);
}

export function buildInvoicePdf(order: PdfOrder, invoice: InvoiceMeta): Buffer {
  const lines = [
    ...buildHeader("Invoice", order, invoice),
    ...buildLineItems(order, invoice),
    ...buildFooter(invoice),
  ];
  return renderPdf(`VIZA invoice ${order.id}`, lines);
}
