"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface VisaPackage {
  id: string;
  name: string;
  country: string;
  visa_type: string;
}

interface AssignPackageFormProps {
  userId: string;
  visaPackages: VisaPackage[];
}

export function AssignPackageForm({ userId, visaPackages }: AssignPackageFormProps) {
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  const handleAssign = async () => {
    if (!selectedPackageId || !userId) return;
    setIsSubmitting(true);

    try {
      const agentBackendUrl = process.env.NEXT_PUBLIC_AGENT_BACKEND_URL || "http://localhost:3002";
      const res = await fetch(`${agentBackendUrl}/api/user/package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, visaPackageId: selectedPackageId }),
      });

      if (!res.ok) {
        const body = await res.json();
        alert(`Failed to assign package: ${body.message}`);
        return;
      }

      setShowForm(false);
      setSelectedPackageId("");
      router.refresh();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors"
      >
        Assign Package
      </button>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-[#fafafa] space-y-3">
      <h3 className="text-sm font-semibold text-[#232323]">Assign Visa Package</h3>
      <select
        value={selectedPackageId}
        onChange={(e) => setSelectedPackageId(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
      >
        <option value="">Select a package...</option>
        {visaPackages.map((pkg) => (
          <option key={pkg.id} value={pkg.id}>
            {pkg.name} ({pkg.country} - {pkg.visa_type})
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          onClick={handleAssign}
          disabled={!selectedPackageId || isSubmitting}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "Assigning..." : "Confirm"}
        </button>
        <button
          onClick={() => { setShowForm(false); setSelectedPackageId(""); }}
          className="px-4 py-2 rounded-lg text-sm font-medium border text-[#6b6b6b] hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
