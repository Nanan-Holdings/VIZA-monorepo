import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/app/actions/notification-prefs";
import { NotificationPrefsForm } from "./prefs-form";
import { getNotificationsCopy } from "./copy";

export const dynamic = "force-dynamic";

export default async function ClientNotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/client/login");

  const prefs = await getNotificationPreferences();
  const copy = getNotificationsCopy(await getLocale());

  async function save(patch: Record<string, boolean>) {
    "use server";
    await updateNotificationPreferences(patch);
  }

  return (
    <div className="w-full p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#232323]">{copy.title}</h1>
        <p className="text-sm text-[#6b6b6b]">
          {copy.description}
        </p>
      </div>
      <NotificationPrefsForm initial={prefs} action={save} />
    </div>
  );
}
