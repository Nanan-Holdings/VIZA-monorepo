import { notFound } from "next/navigation";
import TravelMapPreviewClient from "./preview-client";

export const dynamic = "force-dynamic";

export default function TravelMapPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <TravelMapPreviewClient />;
}

