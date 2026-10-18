import { permanentRedirect } from "next/navigation";

/* VIZA is a free service now: the old agency-fee table (USD 99 per package)
   was still public here with no login. Official government fees are shown on
   each application instead. */
export default function PricingPage() {
  permanentRedirect("/client/home");
}
