import { redirect } from "next/navigation";

/**
 * The change-country picker merged into the applications index at
 * `/client/status`, which now lists every application and the destination
 * browser in one page. The regional pickers under `/client/destinations/*`
 * are unaffected — only this index moved.
 */
export default function DestinationsPage() {
  redirect("/client/status");
}
