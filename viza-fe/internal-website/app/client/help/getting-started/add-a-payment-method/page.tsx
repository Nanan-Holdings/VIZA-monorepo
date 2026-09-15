import { redirect } from "next/navigation";

export default async function AddPaymentMethodPage() {
  redirect("/client/settings");
}
