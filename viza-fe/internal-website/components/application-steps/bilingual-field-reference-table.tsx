"use client";

import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldReferenceRow {
  section: string;
  zh: string;
  en: string;
}

const FIELD_REFERENCE_ROWS: FieldReferenceRow[] = [
  { section: "个人信息", zh: "姓", en: "Surname" },
  { section: "个人信息", zh: "名", en: "Given name(s)" },
  { section: "个人信息", zh: "中文姓名", en: "Full name in native alphabet" },
  { section: "个人信息", zh: "出生日期", en: "Date of birth" },
  { section: "个人信息", zh: "婚姻状况", en: "Marital status" },
  { section: "个人信息", zh: "性别", en: "Gender" },
  { section: "个人信息", zh: "国籍", en: "Nationality" },
  { section: "个人信息", zh: "出生国家", en: "Country of birth" },
  { section: "个人信息", zh: "出生省 / 州", en: "State / province of birth" },
  { section: "个人信息", zh: "出生城市", en: "City of birth" },
  { section: "护照", zh: "护照号码", en: "Passport number" },
  { section: "护照", zh: "签发日期", en: "Issue date" },
  { section: "护照", zh: "有效期至", en: "Expiry date" },
  { section: "护照", zh: "签发国家", en: "Issuing country" },
  { section: "护照", zh: "签发机关", en: "Issuing authority" },
  { section: "旅行详情", zh: "到达日期", en: "Arrival date" },
  { section: "旅行详情", zh: "离开日期", en: "Departure date" },
  { section: "旅行详情", zh: "入境口岸", en: "Port of entry" },
  { section: "旅行详情", zh: "访问目的", en: "Purpose of visit" },
  { section: "旅行详情", zh: "住宿名称", en: "Accommodation name" },
  { section: "旅行详情", zh: "住宿地址", en: "Accommodation address" },
];

export function BilingualFieldReferenceTable() {
  return (
    <section className="mb-6 rounded-xl border border-[#efefef] bg-white shadow-[0_2px_12px_rgba(3,52,110,0.04)]">
      <div className="flex items-center gap-3 border-b border-[#efefef] px-4 py-4 sm:px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-[#03346E]">
          <Languages className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold leading-6 text-[#03346E]">双语对照表</h3>
          <p className="text-[13px] leading-5 text-gray-500">中文字段与英文官方字段名</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#efefef] bg-[#f8fafc]">
              <th className="w-[34%] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.02em] text-gray-500 sm:px-5">
                分组
              </th>
              <th className="w-[33%] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.02em] text-gray-500 sm:px-5">
                中文字段
              </th>
              <th className="w-[33%] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.02em] text-gray-500 sm:px-5">
                English field
              </th>
            </tr>
          </thead>
          <tbody>
            {FIELD_REFERENCE_ROWS.map((row, index) => {
              const showSection = FIELD_REFERENCE_ROWS[index - 1]?.section !== row.section;

              return (
                <tr key={`${row.section}-${row.zh}`} className="border-b border-[#efefef] last:border-b-0">
                  <td
                    className={cn(
                      "px-4 py-3 align-top text-[14px] font-medium text-[#03346E] sm:px-5",
                      !showSection && "text-gray-300",
                    )}
                  >
                    {showSection ? row.section : "同上"}
                  </td>
                  <td className="px-4 py-3 align-top text-[14px] leading-6 text-gray-900 sm:px-5">{row.zh}</td>
                  <td className="px-4 py-3 align-top text-[14px] leading-6 text-gray-700 sm:px-5">{row.en}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
