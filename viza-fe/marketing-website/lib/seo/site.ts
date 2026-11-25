export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://viza.it.com").replace(/\/$/, "");
export const SITE_NAME = "VIZA";
export const BRAND_SUFFIX = " | VIZA";

/** Registered address, used by the Organization schema and the contact page. */
export const ADDRESS = {
  streetAddress: "227 Pasir Panjang Rd",
  addressLocality: "Singapore",
  postalCode: "117341",
  addressCountry: "SG",
} as const;

/** Social profiles, kept in sync with components/SiteFooter.tsx. */
export const SAME_AS = [
  "https://www.facebook.com/profile.php?id=61592698634582",
  "https://www.pinterest.com/viza_com/",
  "https://www.instagram.com/viza_com/?hl=en",
  "https://www.linkedin.com/company/viza-com/home/?viewAsMember=true",
  "https://x.com/viza_it_com",
  "https://www.reddit.com/user/viza_com/",
] as const;
