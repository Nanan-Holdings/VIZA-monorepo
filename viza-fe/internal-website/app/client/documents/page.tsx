"use client";

import { useSearchParams } from "next/navigation";
import { ApplicationStatusHub } from "@/components/client/application/application-status-hub";

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("view") === "detail" ? "detail" : "overview";

  return (
    <ApplicationStatusHub
      mode={mode}
      applicationId={searchParams.get("applicationId")}
      country={searchParams.get("country")}
      visaType={searchParams.get("visaType")}
      basePath="/client/documents"
    />
  );
}
