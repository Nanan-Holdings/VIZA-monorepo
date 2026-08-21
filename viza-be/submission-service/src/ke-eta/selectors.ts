export const KE_ETA_SELECTORS = {
  steps: {
    residenceCountry: ["text=Residence Country", "text=Country of Residence"],
    applicationType: ["text=Select Type", "text=Individual Application"],
    passportInformation: ["text=Passport Information"],
    selfieOrPhoto: ["text=Selfie or Photo", "text=Selfie or Photo"],
    contactInformation: ["text=Contact Information"],
    tripInformation: ["text=Trip Information"],
    travelInformation: ["text=Travel Information"],
    customsDeclaration: ["text=Customs Declaration"],
    requiredDocuments: ["text=Required Documents"],
    confirmAndProceed: ["text=Confirm and Proceed"],
    selectTypeOfTa: ["text=Select type of TA", "text=Select Type of TA"],
  },
  email: ["input[type='email']", "input[name*='email' i]"],
  fullName: ["input[name*='name' i]", "input[id*='name' i]"],
  passport: ["input[name*='passport' i]", "input[id*='passport' i]"],
  passportUpload: ["input[type='file'][name*='passport' i]", "input[type='file'][id*='passport' i]"],
  photoUpload: ["input[type='file'][name*='photo' i]", "input[type='file'][id*='photo' i]"],
  itineraryUpload: ["input[type='file'][name*='itinerary' i]", "input[type='file'][id*='flight' i]"],
  accommodationUpload: ["input[type='file'][name*='accommodation' i]", "input[type='file'][id*='accommodation' i]"],
  passportUploadButton: [
    "button:has-text('Upload Passport Drag & drop, scan or click here to manually select your document/photo')",
    "text=Upload Passport Drag & drop, scan or click here to manually select your document/photo",
  ],
  reference: ["[data-testid*='reference' i]", "[id*='reference' i]", "[class*='reference' i]"],
  approvalPdf: ["a[href$='.pdf' i]", "a[download*='approval' i]", "a[download*='eta' i]"],
} as const;

const OFFICIAL_HOSTS = new Set(["etakenya.go.ke", "www.etakenya.go.ke"]);

export function isOfficialKeEtaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && OFFICIAL_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export interface KeEtaReferenceEvidenceInput {
  portalUrl: string;
  bodyText: string;
  reference: string | null | undefined;
}

export function extractKeEtaReference(value: string): string | null {
  const match = value.match(/(?:application\s+)?reference\s*(?:number|no\.?|id)?\s*[:#-]\s*([A-Z0-9-]{6,})/iu)
    ?? value.match(/application\s*(?:number|no\.?|id)?\s*[:#-]\s*([A-Z0-9-]{6,})/iu);
  return match?.[1]?.trim() ?? null;
}

export function hasOfficialKeEtaReferenceEvidence(input: KeEtaReferenceEvidenceInput): boolean {
  return isOfficialKeEtaUrl(input.portalUrl)
    && Boolean(input.reference?.trim())
    && /eTA|electronic\s+travel\s+authori[sz]ation|application\s+(?:submitted|approved)/iu.test(input.bodyText);
}

export function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
}
