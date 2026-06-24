import { redirect } from "next/navigation";

const MY_MDAC_FORM_URL =
  "/client/application/long-form?country=malaysia&visaType=MY_MDAC_ARRIVAL_CARD";

export default function MalaysiaArrivalCardPage() {
  redirect(MY_MDAC_FORM_URL);
}
