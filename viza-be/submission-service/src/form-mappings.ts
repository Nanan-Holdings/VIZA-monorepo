/**
 * Form field mappings for evisa.imigrasi.go.id
 *
 * These selectors map applicant data fields to the Indonesian e-visa portal
 * form inputs. Update these if the portal changes its HTML structure.
 *
 * Last verified: 2026-03
 */

export interface FormFieldMapping {
  selector: string;
  type: "text" | "select" | "date" | "file" | "radio" | "checkbox";
  label: string;
}

/**
 * Step 1 — Applicant personal information
 */
export const personalInfoMappings: Record<string, FormFieldMapping> = {
  full_name: {
    selector: 'input[name="nama_lengkap"], input[id="full_name"], input[placeholder*="Full Name"]',
    type: "text",
    label: "Full Name",
  },
  date_of_birth: {
    selector: 'input[name="tanggal_lahir"], input[id="dob"], input[type="date"][name*="birth"]',
    type: "date",
    label: "Date of Birth",
  },
  place_of_birth: {
    selector: 'input[name="tempat_lahir"], input[id="place_of_birth"]',
    type: "text",
    label: "Place of Birth",
  },
  gender: {
    selector: 'select[name="jenis_kelamin"], select[id="gender"]',
    type: "select",
    label: "Gender",
  },
  nationality: {
    selector: 'select[name="kewarganegaraan"], select[id="nationality"]',
    type: "select",
    label: "Nationality",
  },
  occupation: {
    selector: 'input[name="pekerjaan"], input[id="occupation"]',
    type: "text",
    label: "Occupation",
  },
  address: {
    selector: 'textarea[name="alamat"], textarea[id="address"], input[name="alamat"]',
    type: "text",
    label: "Home Address",
  },
};

/**
 * Step 2 — Passport information
 */
export const passportMappings: Record<string, FormFieldMapping> = {
  passport_number: {
    selector: 'input[name="nomor_paspor"], input[id="passport_number"]',
    type: "text",
    label: "Passport Number",
  },
  passport_issue_date: {
    selector: 'input[name="tanggal_terbit"], input[id="passport_issue_date"]',
    type: "date",
    label: "Passport Issue Date",
  },
  passport_expiry_date: {
    selector: 'input[name="tanggal_kadaluarsa"], input[id="passport_expiry"]',
    type: "date",
    label: "Passport Expiry Date",
  },
  issuing_country: {
    selector: 'select[name="negara_penerbit"], select[id="issuing_country"]',
    type: "select",
    label: "Issuing Country",
  },
  issuing_authority: {
    selector: 'input[name="pejabat_penerbit"], input[id="issuing_authority"]',
    type: "text",
    label: "Issuing Authority",
  },
};

/**
 * Step 3 — Travel information
 */
export const travelInfoMappings: Record<string, FormFieldMapping> = {
  arrival_date: {
    selector: 'input[name="tanggal_kedatangan"], input[id="arrival_date"]',
    type: "date",
    label: "Arrival Date",
  },
  departure_date: {
    selector: 'input[name="tanggal_keberangkatan"], input[id="departure_date"]',
    type: "date",
    label: "Departure Date",
  },
  port_of_entry: {
    selector: 'select[name="pelabuhan_masuk"], select[id="port_of_entry"]',
    type: "select",
    label: "Port of Entry",
  },
  purpose: {
    selector: 'select[name="tujuan_kunjungan"], select[id="visit_purpose"]',
    type: "select",
    label: "Purpose of Visit",
  },
  accommodation_name: {
    selector: 'input[name="nama_hotel"], input[id="accommodation_name"]',
    type: "text",
    label: "Accommodation Name",
  },
  accommodation_address: {
    selector: 'input[name="alamat_hotel"], input[id="accommodation_address"], textarea[name="alamat_hotel"]',
    type: "text",
    label: "Accommodation Address",
  },
};

/**
 * Document upload inputs — Step 4
 */
export const documentUploadMappings: Record<string, FormFieldMapping> = {
  passport_copy: {
    selector: 'input[type="file"][name*="passport"], input[type="file"][id*="passport"]',
    type: "file",
    label: "Passport Bio Page",
  },
  photo: {
    selector: 'input[type="file"][name*="foto"], input[type="file"][name*="photo"], input[type="file"][id*="photo"]',
    type: "file",
    label: "Applicant Photo",
  },
  flight_booking: {
    selector: 'input[type="file"][name*="flight"], input[type="file"][name*="tiket"]',
    type: "file",
    label: "Flight Booking",
  },
  hotel_booking: {
    selector: 'input[type="file"][name*="hotel"], input[type="file"][name*="akomodasi"]',
    type: "file",
    label: "Hotel Booking",
  },
  travel_itinerary: {
    selector: 'input[type="file"][name*="itinerary"], input[type="file"][name*="rencana"]',
    type: "file",
    label: "Travel Itinerary",
  },
  bank_statement: {
    selector: 'input[type="file"][name*="bank"], input[type="file"][name*="rekening"]',
    type: "file",
    label: "Bank Statement",
  },
};

/** The URL of the Indonesian e-visa portal */
export const EVISA_PORTAL_URL = "https://evisa.imigrasi.go.id";

/** Selector for the submit/next button on each form step */
export const NEXT_BUTTON_SELECTOR =
  'button[type="submit"], button:has-text("Next"), button:has-text("Lanjut"), button:has-text("Submit")';

/** Selector for the confirmation number on the success page */
export const CONFIRMATION_NUMBER_SELECTOR =
  '[class*="confirmation"], [id*="confirmation"], [class*="reference"], [id*="reference"]';
