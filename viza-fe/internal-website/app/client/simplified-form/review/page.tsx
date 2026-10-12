"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { CaretLeft as ChevronLeft, CheckCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSimplifiedFormContext } from "@/lib/context/simplified-form-context";
import { buildApplicationLongFormHref } from "@/lib/client/recent-application-form";

interface FieldValue {
  label: string;
  value: string;
}

type ReviewCopy = {
  yes: string;
  no: string;
  editAnswers: string;
  title: string;
  description: string;
  backToEdit: string;
  proceed: string;
  sections: Record<string, string>;
  fields: Record<string, string>;
};

const COPY: Record<"en" | "zh", ReviewCopy> = {
  en: {
    yes: "Yes",
    no: "No",
    editAnswers: "Edit answers",
    title: "Review your answers",
    description: "Review your information below. You can edit any section before proceeding to the full application.",
    backToEdit: "Back to edit",
    proceed: "Proceed to application",
    sections: {
      identity: "Personal identity",
      contact: "Contact information",
      passport: "Passport information",
      travel: "Travel information",
      family: "Family information",
      background: "Background information",
    },
    fields: {
      firstName: "First name",
      lastName: "Last name",
      dob: "Date of birth",
      gender: "Gender",
      nationality: "Nationality",
      cityOfBirth: "City of birth",
      countryOfBirth: "Country of birth",
      maritalStatus: "Marital status",
      spouseFirstName: "Spouse first name",
      spouseLastName: "Spouse last name",
      spouseDob: "Spouse date of birth",
      spouseNationality: "Spouse nationality",
      email: "Email",
      phone: "Phone",
      secondaryEmail: "Secondary email",
      secondaryPhone: "Secondary phone",
      homeCountry: "Country of residence",
      street1: "Street address",
      city: "City",
      state: "State / province",
      postalCode: "Postal code",
      number: "Passport number",
      issuingCountry: "Passport country",
      issueDate: "Issue date",
      expiryDate: "Expiration date",
      plansState: "Travel plans",
      arrivalDate: "Arrival date",
      hasBeenInUs: "Has been in the US",
      hasCompanions: "Has companions",
      fatherName: "Father's name",
      motherName: "Mother's name",
      relativesInUs: "Immediate relatives in the US",
      primaryOccupation: "Primary occupation",
      employerName: "Employer",
      noneApply: "None apply",
    },
  },
  zh: {
    yes: "是",
    no: "否",
    editAnswers: "编辑答案",
    title: "检查你的答案",
    description: "请检查以下信息。继续完整申请前，你可以编辑任何部分。",
    backToEdit: "返回编辑",
    proceed: "继续申请",
    sections: {
      identity: "个人身份",
      contact: "联系信息",
      passport: "护照信息",
      travel: "旅行信息",
      family: "家庭信息",
      background: "背景信息",
    },
    fields: {
      firstName: "名",
      lastName: "姓",
      dob: "出生日期",
      gender: "性别",
      nationality: "国籍",
      cityOfBirth: "出生城市",
      countryOfBirth: "出生国家",
      maritalStatus: "婚姻状况",
      spouseFirstName: "配偶名",
      spouseLastName: "配偶姓",
      spouseDob: "配偶出生日期",
      spouseNationality: "配偶国籍",
      email: "电子邮箱",
      phone: "电话",
      secondaryEmail: "备用电子邮箱",
      secondaryPhone: "备用电话",
      homeCountry: "居住国家",
      street1: "街道地址",
      city: "城市",
      state: "州 / 省",
      postalCode: "邮政编码",
      number: "护照号码",
      issuingCountry: "护照签发国家",
      issueDate: "签发日期",
      expiryDate: "有效期至",
      plansState: "旅行计划",
      arrivalDate: "抵达日期",
      hasBeenInUs: "是否去过美国",
      hasCompanions: "是否有同行人",
      fatherName: "父亲姓名",
      motherName: "母亲姓名",
      relativesInUs: "美国直系亲属",
      primaryOccupation: "主要职业",
      employerName: "雇主",
      noneApply: "均不适用",
    },
  },
};

export default function SimplifiedFormReviewPage() {
  const locale = useLocale();
  const copy = locale.toLowerCase().startsWith("zh") ? COPY.zh : COPY.en;
  const router = useRouter();
  const searchParams = useSearchParams();
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
          value: typeof value === "boolean" ? (value ? copy.yes : copy.no) : String(value),
        });
      }
    };

    // Identity section
    addField("identity", copy.fields.firstName, formData.identity.firstName);
    addField("identity", copy.fields.lastName, formData.identity.lastName);
    addField("identity", copy.fields.dob, formData.identity.dob);
    addField("identity", copy.fields.gender, formData.identity.gender);
    addField("identity", copy.fields.nationality, formData.identity.nationality);
    addField("identity", copy.fields.cityOfBirth, formData.identity.cityOfBirth);
    addField("identity", copy.fields.countryOfBirth, formData.identity.countryOfBirth);
    addField("identity", copy.fields.maritalStatus, formData.identity.maritalStatus);

    if (["Married", "Common Law Marriage", "Civil Union / Domestic Partnership", "Legally Separated"].includes(formData.identity.maritalStatus)) {
      addField("identity", copy.fields.spouseFirstName, formData.family.spouseFirstName);
      addField("identity", copy.fields.spouseLastName, formData.family.spouseLastName);
      addField("identity", copy.fields.spouseDob, formData.family.spouseDob);
      addField("identity", copy.fields.spouseNationality, formData.family.spouseNationality);
    }

    // Contact section
    addField("contact", copy.fields.email, formData.contact.email);
    addField("contact", copy.fields.phone, formData.contact.phone);
    addField("contact", copy.fields.secondaryEmail, formData.contact.secondaryEmail);
    addField("contact", copy.fields.secondaryPhone, formData.contact.secondaryPhone);
    addField("contact", copy.fields.homeCountry, formData.contact.homeCountry);
    addField("contact", copy.fields.street1, formData.contact.street1);
    addField("contact", copy.fields.city, formData.contact.city);
    addField("contact", copy.fields.state, formData.contact.state);
    addField("contact", copy.fields.postalCode, formData.contact.postalCode);

    // Passport section
    addField("passport", copy.fields.number, formData.passport.number);
    addField("passport", copy.fields.issuingCountry, formData.passport.issuingCountry);
    addField("passport", copy.fields.issueDate, formData.passport.issueDate);
    addField("passport", copy.fields.expiryDate, formData.passport.expiryDate);

    // Travel section
    addField("travel", copy.fields.plansState, formData.travel.plansState);
    addField("travel", copy.fields.arrivalDate, formData.travel.arrivalDate);
    addField("travel", copy.fields.hasBeenInUs, formData.travel.hasBeenInUs);
    addField("travel", copy.fields.hasCompanions, formData.travel.hasCompanions);

    // Family section
    addField(
      "family",
      copy.fields.fatherName,
      `${formData.family.fatherFirstName} ${formData.family.fatherLastName}`.trim(),
    );
    addField(
      "family",
      copy.fields.motherName,
      `${formData.family.motherFirstName} ${formData.family.motherLastName}`.trim(),
    );
    addField("family", copy.fields.relativesInUs, formData.family.relativesInUs);

    // Background section
    addField("background", copy.fields.primaryOccupation, formData.work.primaryOccupation);
    addField("background", copy.fields.employerName, formData.work.employerName);
    addField("background", copy.fields.noneApply, formData.background.noneApply);

    setFields(sections);
  }, [copy, formData, router]);

  const handleEdit = useCallback(() => {
    const query = searchParams.toString();
    router.push(`/client/simplified-form${query ? `?${query}` : ""}`);
  }, [router, searchParams]);

  const handleProceed = useCallback(() => {
    // Clear the context and proceed to the full application
    router.push(buildApplicationLongFormHref({
      applicationId: searchParams.get("applicationId"),
      country: searchParams.get("country"),
      visaType: searchParams.get("visaType") ?? searchParams.get("visa_type"),
      step: "review",
    }));
  }, [router, searchParams]);

  if (!formData) {
    return null;
  }

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
            {copy.editAnswers}
          </button>

          <div className="flex items-start gap-4">
            <CheckCircle className="w-12 h-12 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{copy.title}</h1>
              <p className="text-gray-600">
                {copy.description}
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
                  <CardTitle className="text-lg text-gray-900">{copy.sections[sectionKey]}</CardTitle>
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
            ← {copy.backToEdit}
          </Button>
          <Button
            onClick={handleProceed}
            className="flex-1"
          >
            {copy.proceed} →
          </Button>
        </div>
      </div>
    </div>
  );
}
