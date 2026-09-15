import { redirect } from "next/navigation";

/** Legacy compatibility route: guest payment confirmation has been retired. */
export default function WechatCheckoutCheckEmailPage() {
  redirect("/client/login");
}
