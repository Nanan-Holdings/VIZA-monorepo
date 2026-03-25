export interface SubmissionQueueItem {
  id: string;
  application_id: string;
  status: "pending" | "processing" | "done" | "failed";
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicantProfile {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  occupation: string | null;
  address: string | null;
  passport_number: string | null;
  passport_issue_date: string | null;
  passport_expiry_date: string | null;
  issuing_country: string | null;
  issuing_authority: string | null;
  email: string | null;
  phone: string | null;
  wechat: string | null;
}

export interface Application {
  id: string;
  applicant_id: string;
  country: string;
  visa_type: string;
  status: string;
  arrival_date: string | null;
  departure_date: string | null;
  port_of_entry: string | null;
  purpose: string | null;
  accommodation_name: string | null;
  accommodation_address: string | null;
  confirmation_number: string | null;
  submitted_at: string | null;
}

export interface ApplicationDocument {
  id: string;
  application_id: string;
  document_type: string;
  storage_path: string | null;
  status: string;
  file_name: string | null;
}
