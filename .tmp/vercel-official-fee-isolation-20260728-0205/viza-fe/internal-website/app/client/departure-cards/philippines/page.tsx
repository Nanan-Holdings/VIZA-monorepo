import { redirect } from "next/navigation";

const PH_ETRAVEL_DEPARTURE_FORM_URL =
  "/client/application/long-form?country=philippines&visaType=PH_ETRAVEL_DEPARTURE_CARD&skipFormCheck=true";

export default function PhilippinesEtravelDepartureCardPage() {
  redirect(PH_ETRAVEL_DEPARTURE_FORM_URL);
}
