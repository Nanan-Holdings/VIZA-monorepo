"use client";

import { createContext, useContext, type ReactNode } from "react";

const ManagedApplicationEmailContext = createContext<string | null>(null);

export function ManagedApplicationEmailProvider({
  email,
  children,
}: {
  email: string | null;
  children: ReactNode;
}) {
  return (
    <ManagedApplicationEmailContext.Provider value={email}>
      {children}
    </ManagedApplicationEmailContext.Provider>
  );
}

export function useManagedApplicationEmail(): string | null {
  return useContext(ManagedApplicationEmailContext);
}
