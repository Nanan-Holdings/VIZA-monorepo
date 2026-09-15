import { redirect } from "next/navigation";

/** Legacy compatibility route: guest WeChat checkout has been retired. */
export default function WechatCheckoutPage() {
  redirect("/client/application");
}
