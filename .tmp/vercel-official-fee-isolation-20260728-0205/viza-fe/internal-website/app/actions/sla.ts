"use server";

import { withAdmin } from "@/lib/auth/with-admin";

/**
 * Per-package SLA reads (CS-005).
 *
 * Public read: pricing page surfaces median + p95. Server action
 * because the table sits behind RLS that allows SELECT to anon —
 * the action keeps the read path single-source-of-truth.
 */

export interface PackageSlaRow {
  country: string;
  visaType: string;
  medianHours: number;
  p95Hours: number;
  sampleSize: number;
  source: "seed" | "measured";
  lastUpdatedAt: string;
}

interface DbRow {
  country: string;
  visa_type: string;
  median_hours: number;
  p95_hours: number;
  sample_size: number;
  source: "seed" | "measured";
  last_updated_at: string;
}

function shape(r: DbRow): PackageSlaRow {
  return {
    country: r.country,
    visaType: r.visa_type,
    medianHours: r.median_hours,
    p95Hours: r.p95_hours,
    sampleSize: r.sample_size,
    source: r.source,
    lastUpdatedAt: r.last_updated_at,
  };
}

export async function listPackageSla(): Promise<PackageSlaRow[]> {
  return withAdmin("system", "actions/sla:list", async (admin) => {
    const { data, error } = await admin
      .from("package_sla")
      .select(
        "country, visa_type, median_hours, p95_hours, sample_size, source, last_updated_at",
      )
      .order("country", { ascending: true });
    if (error) throw new Error(`sla list: ${error.message}`);
    return ((data ?? []) as DbRow[]).map(shape);
  });
}

export async function getPackageSla(
  country: string,
  visaType: string,
): Promise<PackageSlaRow | null> {
  return withAdmin("system", "actions/sla:get", async (admin) => {
    const { data } = await admin
      .from("package_sla")
      .select(
        "country, visa_type, median_hours, p95_hours, sample_size, source, last_updated_at",
      )
      .eq("country", country)
      .eq("visa_type", visaType)
      .maybeSingle();
    return data ? shape(data as DbRow) : null;
  });
}
