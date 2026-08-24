"use server";

import { getClientSessionWithFallback, type ClientSession } from "@/lib/client-session";
import { withAdmin } from "@/lib/auth/with-admin";
import { ensureApplicationManagedEmailForOwner } from "@/lib/application-managed-email.server";

type ApplicationOwner = {
  id: string;
  auth_user_id: string | null;
  dependant_of_user_id: string | null;
};

type ManagedEmailApplication = {
  id: string;
  applicant_id: string;
  group_id: string | null;
};

export type ApplicationManagedEmailResult =
  | { ok: true; email: string }
  | { ok: false; error: "AUTH_REQUIRED" | "NOT_FOUND" | "UNAUTHORIZED" | "SERVICE_UNAVAILABLE" };

function ownsApplicantProfile(profile: ApplicationOwner, session: ClientSession): boolean {
  return profile.id === session.userId ||
    Boolean(session.authUserId && profile.auth_user_id === session.authUserId) ||
    profile.dependant_of_user_id === (session.authUserId ?? session.userId);
}

export async function ensureApplicationManagedEmail(
  applicationId: string,
): Promise<ApplicationManagedEmailResult> {
  const session = await getClientSessionWithFallback();
  if (!session) return { ok: false, error: "AUTH_REQUIRED" };

  try {
    return await withAdmin(
      "system",
      "actions/application-managed-email:ensure",
      async (admin) => {
        const { data: application, error: applicationError } = await admin
          .from("applications")
          .select("id, applicant_id, group_id")
          .eq("id", applicationId)
          .maybeSingle();
        if (applicationError) throw new Error(applicationError.message);
        if (!application?.applicant_id) return { ok: false, error: "NOT_FOUND" } as const;

        const { data: profile, error: profileError } = await admin
          .from("applicant_profiles")
          .select("id, auth_user_id, dependant_of_user_id")
          .eq("id", application.applicant_id)
          .maybeSingle();
        if (profileError) throw new Error(profileError.message);
        if (!profile) return { ok: false, error: "NOT_FOUND" } as const;
        const managedEmailApplication = application as ManagedEmailApplication;
        let authorized = ownsApplicantProfile(profile as ApplicationOwner, session);
        if (!authorized && managedEmailApplication.group_id && session.authUserId) {
          const { data: group, error: groupError } = await admin
            .from("application_group")
            .select("id")
            .eq("id", managedEmailApplication.group_id)
            .eq("payer_user_id", session.authUserId)
            .maybeSingle();
          if (groupError) throw new Error(groupError.message);
          authorized = Boolean(group);
        }
        if (!authorized) {
          return { ok: false, error: "UNAUTHORIZED" } as const;
        }

        const email = await ensureApplicationManagedEmailForOwner(
          admin,
          applicationId,
          String(application.applicant_id),
        );
        return { ok: true, email } as const;
      },
    );
  } catch (error) {
    console.error("[application-managed-email] ensure failed", {
      applicationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: "SERVICE_UNAVAILABLE" };
  }
}
