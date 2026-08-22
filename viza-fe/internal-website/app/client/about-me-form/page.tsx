import { redirect } from "next/navigation";
import { getAboutMeRedirectTarget } from "./redirect-target";

type AboutMeFormPageProps = {
  searchParams: Promise<{
    returnTo?: string | string[];
  }>;
};

export default async function AboutMeFormPage({
  searchParams,
}: AboutMeFormPageProps) {
  const params = await searchParams;
  redirect(getAboutMeRedirectTarget(params.returnTo));
}
