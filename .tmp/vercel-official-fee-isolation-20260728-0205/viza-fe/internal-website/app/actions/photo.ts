"use server";

import { Buffer } from "node:buffer";
import { validatePhoto } from "@/lib/photo/validate";

export interface ValidatePhotoInput {
  /** Buffer of bytes — encoded as a string base64 over the wire. */
  base64: string;
  country: string;
  visaType: string;
}

export async function validatePhotoAction(input: ValidatePhotoInput) {
  const buf = Buffer.from(input.base64, "base64");
  return validatePhoto(buf, input.country, input.visaType);
}
