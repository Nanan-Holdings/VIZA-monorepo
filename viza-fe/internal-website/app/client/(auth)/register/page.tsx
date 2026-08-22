import { redirect } from "next/navigation";

interface RegisterRedirectProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RegisterRedirect({ searchParams }: RegisterRedirectProps) {
  const params = await searchParams;
  const next = new URLSearchParams();
  const invite = params.invite ?? params.referral ?? params.ref;
  const referralCode = Array.isArray(invite) ? invite[0] : invite;

  if (referralCode) next.set("referral", referralCode);

  const query = next.toString();
  redirect(query ? `/client/signup?${query}` : "/client/signup");
}
