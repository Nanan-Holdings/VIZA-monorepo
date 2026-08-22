import { redirect } from "next/navigation";

const KENYA_ETA_FORM_URL =
  "/client/application/long-form?country=kenya&visaType=KE_ETA&skipFormCheck=true";

/** Dedicated preview entry for the Kenya Electronic Travel Authorisation. */
export default function KenyaEtaPage() {
  redirect(KENYA_ETA_FORM_URL);
}
