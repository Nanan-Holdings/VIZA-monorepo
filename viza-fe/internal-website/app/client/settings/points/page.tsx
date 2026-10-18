import { redirect } from "next/navigation";

/* The Points Center had nothing behind it: production has no reward wallet
   tables and Redeem had no action. VIZA is free, so there is nothing to redeem. */
export default function SettingsPointsPage() {
  redirect("/client/settings");
}
