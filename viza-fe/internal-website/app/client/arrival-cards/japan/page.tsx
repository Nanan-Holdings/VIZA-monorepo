import { redirect } from "next/navigation";

const JAPAN_VISIT_JAPAN_WEB_FORM_URL =
  "/client/application/long-form?country=japan&visaType=JP_VISIT_JAPAN_WEB&skipFormCheck=true";

/** Dedicated preview entry for the free online Visit Japan Web declaration. */
export default function JapanVisitJapanWebPage() {
  redirect(JAPAN_VISIT_JAPAN_WEB_FORM_URL);
}
