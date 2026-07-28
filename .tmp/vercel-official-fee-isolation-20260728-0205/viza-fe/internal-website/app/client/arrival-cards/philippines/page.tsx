import { redirect } from "next/navigation";

const PH_ETRAVEL_FORM_URL =
  "/client/application/long-form?country=philippines&visaType=PH_ETRAVEL_ARRIVAL_CARD&skipFormCheck=true";

export default function PhilippinesEtravelArrivalCardPage() {
  redirect(PH_ETRAVEL_FORM_URL);
}
