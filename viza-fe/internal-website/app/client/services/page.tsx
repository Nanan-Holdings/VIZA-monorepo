// @ts-nocheck - lab booking system removed during domain migration

import type { Metadata } from "next";
import { ServicesContent } from "./services-content";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Services | VIZA Portal",
  description: "Browse recommended services, tests, and marketplaces tailored for you.",
};

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const result = await getClientBloodPanelServices();

  return (
    <ServicesContent
      scheduledEntries={result.success ? (result.scheduled ?? []) : []}
      historyEntries={result.success ? (result.history ?? []) : []}
      userAuthId={user?.id ?? null}
    />
  );
}
