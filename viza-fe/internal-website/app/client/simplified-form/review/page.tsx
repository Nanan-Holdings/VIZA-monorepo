"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSimplifiedFormContext } from "@/lib/context/simplified-form-context";

interface FieldValue {
  label: string;
  value: string;
}

export default function SimplifiedFormReviewPage() {
  const router = useRouter();
  const { formData } = useSimplifiedFormContext();
  const [fields, setFields] = useState<{ [section: string]: FieldValue[] }>({});

  useEffect(() => {
    if (!formData) {
      router.push("/client/simplified-form");
      return;
    }

    // Organize form data into sections for display
    const sections: { [section: string]: FieldValue[] } = {
      identity: [],
      contact: [],
      passport: [],
      travel: [],
      family: [],
      background: [],
    };

    // Helper to add non-empty fields
    const addField = (section: string, label: string, value: string | boolean | undefined) => {
      if (value && value !== "") {
        sections[section].push({
          label,
          value: typeof value === "boolean" ? (value ? "Yes" : "No") : String(value),
        });
      }
    };

    // Identity section
    addField("identity", "First Name", formData.identity.firstName);
    addField("identity", "Last Name", formData.identity.lastName);
    addField("identity", "Date of Birth", formData.identity.dob);
    addField("identity", "Gender", formData.identity.gender);
    addField("identity", "Nationality", formData.identity.nationality);
    addField("identity", "City of Birth", formData.identity.cityOfBirth);
    addField("identity", "Country of Birth", formData.identity.countryOfBirth);
    addField("identity", "Marital Status", formData.identity.maritalStatus);

    if (["Married", "Common Law Marriage", "Civil Union / Domestic Partnership", "Legally Separated"].includes(formData.identity.maritalStatus)) {
      addField("identity", "Spouse First Name", formData.family.spouseFirstName);
      addField("identity", "Spouse Last Name", formData.family.spouseLastName);
      addField("identity", "Spouse Date of Birth", formData.family.spouseDob);
      addField("identity", "Spouse Nationality", formData.family.spouseNationality);
    }

    // Contact section
    addField("contact", "Email", formData.contact.email);
    addField("contact", "Phone", formData.contact.phone);
    addField("contact", "Secondary Email", formData.contact.secondaryEmail);
    addField("contact", "Secondary Phone", formData.contact.secondaryPhone);
    addField("contact", "Country of Residence", formData.contact.homeCountry);
    addField("contact", "Street Address", formData.contact.street1);
    addField("contact", "City", formData.contact.city);
    addField("contact", "State/Province", formData.contact.state);
    addField("contact", "Postal Code", formData.contact.postalCode);

    // Passport section
    addField("passport", "Passport Number", formData.passport.number);
    addField("passport", "Passport Country", formData.passport.issuingCountry);
    addField("passport", "Issue Date", formData.passport.issueDate);
    addField("passport", "Expiration Date", formData.passport.expiryDate);

    // Travel section
    addField("travel", "Travel Plans", formData.travel.plansState);
    addField("travel", "Arrival Date", formData.travel.arrivalDate);
    addField("travel", "Has Been in US", formData.travel.hasBeenInUs);
    addField("travel", "Has Companions", formData.travel.hasCompanions);

    // Family section
    addField(
      "family",
      "Father's Name",
      `${formData.family.fatherFirstName} ${formData.family.fatherLastName}`.trim(),
    );
    addField(
      "family",
      "Mother's Name",
      `${formData.family.motherFirstName} ${formData.family.motherLastName}`.trim(),
    );
    addField("family", "Immediate Relatives in US", formData.family.relativesInUs);

    // Background section
    addField("background", "Primary Occupation", formData.work.primaryOccupation);
    addField("background", "Employer", formData.work.employerName);
    addField("background", "None Apply", formData.background.noneApply);

    setFields(sections);
  }, [formData, router]);

  const handleEdit = useCallback(() => {
    router.push("/client/simplified-form");
  }, [router]);

  const handleProceed = useCallback(() => {
    // Clear the context and proceed to the full application
    router.push("/client/application?step=review");
  }, [router]);

  if (!formData) {
    return null;
  }

  const sectionTitles: { [key: string]: string } = {
    identity: "Personal Identity",
    contact: "Contact Information",
    passport: "Passport Information",
    travel: "Travel Information",
    family: "Family Information",
    background: "Background Information",
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium"
          >
            <ChevronLeft className="w-5 h-5" />
            Edit Answers
          </button>

          <div className="flex items-start gap-4">
            <CheckCircle className="w-12 h-12 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Review Your Answers</h1>
              <p className="text-gray-600">
                Please review your information below. You can edit any section before proceeding to the full application.
              </p>
            </div>
          </div>
        </div>

        {/* Review Sections */}
        <div className="space-y-6 mb-8">
          {Object.entries(fields).map(([sectionKey, sectionFields]) => (
            sectionFields.length > 0 && (
              <Card key={sectionKey} className="border-gray-200">
                <CardHeader className="bg-gray-100 border-b">
                  <CardTitle className="text-lg text-gray-900">{sectionTitles[sectionKey]}</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sectionFields.map((field, idx) => (
                      <div key={idx}>
                        <p className="text-sm font-medium text-gray-600 mb-1">{field.label}</p>
                        <p className="text-base text-gray-900 break-words">{field.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 sticky bottom-0 bg-white border-t border-gray-200 p-4 rounded-lg shadow-lg">
          <Button
            variant="outline"
            onClick={handleEdit}
            className="flex-1"
          >
            ← Back to Edit
          </Button>
          <Button
            onClick={handleProceed}
            className="flex-1"
          >
            Proceed to Application →
          </Button>
        </div>
      </div>
    </div>
  );
}
