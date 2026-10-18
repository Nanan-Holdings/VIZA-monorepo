import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { destinationCoverUrl } from "../cover";

describe("destinationCoverUrl", () => {
  const base = "https://viza.it.com";
  it("uses the first destination the text names", () => {
    expect(destinationCoverUrl("Canada to Refocus Express Entry on High-Wage Talent", base)).toBe("https://viza.it.com/assets/heroes/canada.jpg");
    expect(destinationCoverUrl("UK ETA fee rises as US tightens ESTA checks", base)).toBe("https://viza.it.com/assets/heroes/united-kingdom.jpg");
    expect(destinationCoverUrl("ETIAS launch date confirmed for Schengen travellers", base)).toBe("https://viza.it.com/assets/heroes/france.jpg");
    expect(destinationCoverUrl("Türkiye extends e-visa", base)).toBe("https://viza.it.com/assets/heroes/turkiye.jpg");
  });

  it("does not mistake ordinary words for country codes", () => {
    expect(destinationCoverUrl("Let us explain the new passport rules", base)).toBeNull();
    expect(destinationCoverUrl("Togo updates rules for entry visas", base)).toBeNull();
  });
});
