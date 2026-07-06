"use server";

import { getClientSessionWithFallback } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ApplicationRow,
  DocumentRow,
  PaymentRow,
} from "@/lib/client/application-progress";

export interface ClientHomeProfile {
  full_name: string | null;
  surname: string | null;
  given_names: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  birth_country: string | null;
  birth_province_or_state: string | null;
  birth_city: string | null;
  gender: string | null;
  nationality: string | null;
  occupation: string | null;
  address: string | null;
  passport_number: string | null;
  passport_issue_date: string | null;
  passport_expiry_date: string | null;
  passport_issuing_country: string | null;
  email: string | null;
  phone: string | null;
  wechat: string | null;
}

export interface ClientHomeDashboardData {
  authenticated: boolean;
  authEmail: string | null;
  profile: ClientHomeProfile | null;
  applications: ApplicationRow[];
  documents: DocumentRow[];
  payments: PaymentRow[];
  error?: string;
}

const PROFILE_COLUMNS = [
  "full_name",
  "surname",
  "given_names",
  "date_of_birth",
  "place_of_birth",
  "birth_country",
  "birth_province_or_state",
  "birth_city",
  "gender",
  "nationality",
  "occupation",
  "address",
  "passport_number",
  "passport_issue_date",
  "passport_expiry_date",
  "passport_issuing_country",
  "email",
  "phone",
  "wechat",
].join(", ");

const APPLICATION_COLUMNS =
  "id, status, country, visa_type, visa_package_id, submission_result_status, submitted_at, created_at, updated_at";

const DOCUMENT_COLUMNS = "id, application_id, document_type, status, created_at, updated_at";

const PAYMENT_COLUMNS = "id, application_id, visa_package_id, status, created_at, updated_at";

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

export async function getClientHomeDashboardData(): Promise<ClientHomeDashboardData> {
  try {
    const session = await getClientSessionWithFallback();
    if (!session) {
      return {
        authenticated: false,
        authEmail: null,
        profile: null,
        applications: [],
        documents: [],
        payments: [],
      };
    }

    const adminClient = createAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from("applicant_profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", session.userId)
      .maybeSingle();

    if (profileError) {
      return {
        authenticated: true,
        authEmail: session.email,
        profile: null,
        applications: [],
        documents: [],
        payments: [],
        error: profileError.message,
      };
    }

    if (!profile) {
      return {
        authenticated: true,
        authEmail: session.email,
        profile: null,
        applications: [],
        documents: [],
        payments: [],
      };
    }
    const homeProfile = profile as unknown as ClientHomeProfile;

    const { data: applicationRows, error: applicationError } = await adminClient
      .from("applications")
      .select(APPLICATION_COLUMNS)
      .eq("applicant_id", session.userId)
      .order("created_at", { ascending: false });

    if (applicationError) {
      return {
        authenticated: true,
        authEmail: session.email,
        profile: homeProfile,
        applications: [],
        documents: [],
        payments: [],
        error: applicationError.message,
      };
    }

    const applications = (applicationRows ?? []) as ApplicationRow[];
    const applicationIds = applications.map((application) => application.id);
    const packageIds = applications
      .map((application) => application.visa_package_id)
      .filter((id): id is string => Boolean(id));

    let documents: DocumentRow[] = [];
    let payments: PaymentRow[] = [];

    if (applicationIds.length > 0) {
      const { data: documentRows, error: documentError } = await adminClient
        .from("application_documents")
        .select(DOCUMENT_COLUMNS)
        .in("application_id", applicationIds);

      if (documentError) {
        return {
          authenticated: true,
          authEmail: session.email,
          profile: homeProfile,
          applications,
          documents: [],
          payments: [],
          error: documentError.message,
        };
      }

      documents = (documentRows ?? []) as DocumentRow[];

      const paymentReads: Array<Promise<{ data: PaymentRow[] | null; error: { message: string } | null }>> = [
        adminClient
          .from("payment_records")
          .select(PAYMENT_COLUMNS)
          .eq("applicant_id", session.userId)
          .in("application_id", applicationIds) as unknown as Promise<{
          data: PaymentRow[] | null;
          error: { message: string } | null;
        }>,
      ];

      if (packageIds.length > 0) {
        paymentReads.push(
          adminClient
            .from("payment_records")
            .select(PAYMENT_COLUMNS)
            .eq("applicant_id", session.userId)
            .in("visa_package_id", packageIds) as unknown as Promise<{
            data: PaymentRow[] | null;
            error: { message: string } | null;
          }>,
        );
      }

      const paymentResults = await Promise.all(paymentReads);
      const paymentError = paymentResults.find((result) => result.error)?.error;
      if (paymentError) {
        return {
          authenticated: true,
          authEmail: session.email,
          profile: homeProfile,
          applications,
          documents,
          payments: [],
          error: paymentError.message,
        };
      }

      payments = dedupeById(paymentResults.flatMap((result) => result.data ?? []));
    }

    return {
      authenticated: true,
      authEmail: session.email,
      profile: homeProfile,
      applications,
      documents,
      payments,
    };
  } catch (error) {
    return {
      authenticated: false,
      authEmail: null,
      profile: null,
      applications: [],
      documents: [],
      payments: [],
      error: error instanceof Error ? error.message : "Failed to load client home dashboard",
    };
  }
}
