"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { BrandActionButton } from "@/components/client/brand-action-button";

export function CheckoutSubmitButton({
  children,
  disabled,
  loadingText,
}: {
  children: ReactNode;
  disabled: boolean;
  loadingText: string;
}) {
  const { pending } = useFormStatus();

  return (
    <BrandActionButton
      type="submit"
      className="w-full"
      disabled={disabled}
      loading={pending}
      loadingText={loadingText}
    >
      {children}
    </BrandActionButton>
  );
}
