import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManagedApplicationEmailProvider } from "@/components/client/wizards/shell/managed-application-email-context";
import { StepGenericFields } from "@/components/client/wizards/shell/shared-steps/step-generic-fields";

vi.mock("next-intl", () => ({
  useTranslations: () => Object.assign(
    (key: string) => key,
    { has: () => false },
  ),
}));

describe("managed application email wizard fields", () => {
  it("shows and locks the VIZA applicant email while leaving sponsor email editable", () => {
    const onChange = vi.fn();
    render(
      <ManagedApplicationEmailProvider email="appl-test@viza.it.com">
        <StepGenericFields
          i18nNamespace="test"
          fields={[
            { kind: "email", key: "email_address", labelKey: "Applicant email" },
            { kind: "email", key: "sponsor_email", labelKey: "Sponsor email" },
          ]}
          values={{
            email_address: "personal@example.com",
            sponsor_email: "sponsor@example.com",
          }}
          onChange={onChange}
          onContinue={vi.fn()}
        />
      </ManagedApplicationEmailProvider>,
    );

    const applicantEmail = screen.getByDisplayValue("appl-test@viza.it.com");
    const sponsorEmail = screen.getByDisplayValue("sponsor@example.com");
    expect(applicantEmail).toBeDisabled();
    expect(sponsorEmail).toBeEnabled();

    fireEvent.change(sponsorEmail, { target: { value: "new-sponsor@example.com" } });
    expect(onChange).toHaveBeenCalledWith({
      email_address: "personal@example.com",
      sponsor_email: "new-sponsor@example.com",
    });
  });
});
