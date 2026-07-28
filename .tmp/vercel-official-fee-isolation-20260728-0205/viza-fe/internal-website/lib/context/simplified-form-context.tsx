"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { SimplifiedFormData, emptySimplifiedForm } from "@/components/client/simplified-form/types";

interface SimplifiedFormContextType {
  formData: SimplifiedFormData | null;
  setFormData: (data: SimplifiedFormData) => void;
  clearFormData: () => void;
}

const SimplifiedFormContext = createContext<SimplifiedFormContextType | undefined>(undefined);

export const SimplifiedFormProvider = ({ children }: { children: ReactNode }) => {
  const [formData, setFormData] = useState<SimplifiedFormData | null>(null);

  const clearFormData = () => setFormData(null);

  return (
    <SimplifiedFormContext.Provider value={{ formData, setFormData, clearFormData }}>
      {children}
    </SimplifiedFormContext.Provider>
  );
};

export const useSimplifiedFormContext = () => {
  const context = useContext(SimplifiedFormContext);
  if (context === undefined) {
    throw new Error("useSimplifiedFormContext must be used within SimplifiedFormProvider");
  }
  return context;
};
