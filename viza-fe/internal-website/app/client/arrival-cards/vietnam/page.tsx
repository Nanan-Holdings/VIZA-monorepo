import { redirect } from "next/navigation";

const VN_PREARRIVAL_FORM_URL =
  "/client/application/long-form?country=vietnam&visaType=VN_PREARRIVAL_DECLARATION&skipFormCheck=true";

export default function VietnamArrivalCardPage() {
  redirect(VN_PREARRIVAL_FORM_URL);
}
