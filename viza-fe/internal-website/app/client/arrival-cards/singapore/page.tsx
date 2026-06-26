import { redirect } from "next/navigation";

const SG_ARRIVAL_CARD_FORM_URL =
  "/client/application/long-form?country=singapore&visaType=SG_ARRIVAL_CARD&skipFormCheck=true";

export default function SingaporeArrivalCardPage() {
  redirect(SG_ARRIVAL_CARD_FORM_URL);
}
