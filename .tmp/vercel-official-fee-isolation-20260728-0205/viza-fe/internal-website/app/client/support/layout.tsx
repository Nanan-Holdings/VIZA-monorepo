import { redirect } from "next/navigation";

// Support center is temporarily disabled portal-wide. All /client/support/*
// routes (including /requests) bounce to the help center. To re-enable,
// delete this layout file — the pages underneath are untouched.
export default function DisabledSupportLayout() {
  redirect("/client/help");
}
