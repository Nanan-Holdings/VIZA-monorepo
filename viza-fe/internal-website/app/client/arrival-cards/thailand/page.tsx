import { redirect } from "next/navigation";

const TH_TDAC_FORM_URL =
  "/client/application/long-form?country=thailand&visaType=TH_TDAC_ARRIVAL_CARD&skipFormCheck=true";

export default function ThailandArrivalCardPage() {
  redirect(TH_TDAC_FORM_URL);
}
