import { staticMetadataFor } from "@/lib/seo-page";

// The page is a client component, so its metadata lives in this segment layout.
export const generateMetadata = staticMetadataFor("careers", "/careers");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
