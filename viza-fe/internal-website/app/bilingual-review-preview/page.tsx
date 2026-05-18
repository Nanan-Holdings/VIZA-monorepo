"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Languages,
  PencilLine,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from "lucide-react";

type FieldKind = "text" | "date" | "option" | "address";

interface PreviewField {
  id: string;
  section: string;
  label: string;
  helper: string;
  kind: FieldKind;
  chineseValue: string;
  englishValue: string;
  warnings: string[];
  long?: boolean;
  englishEdited?: boolean;
}

const INITIAL_FIELDS: PreviewField[] = [
  {
    id: "surname",
    section: "个人信息",
    label: "姓",
    helper: "护照上的姓氏拼音，通常使用大写字母。",
    kind: "text",
    chineseValue: "王",
    englishValue: "WANG",
    warnings: ["请确认右侧拼写与护照个人资料页、机读区完全一致。"],
  },
  {
    id: "givenNames",
    section: "个人信息",
    label: "名",
    helper: "护照上的名字拼音；多个名字按护照顺序填写。",
    kind: "text",
    chineseValue: "小明",
    englishValue: "XIAOMING",
    warnings: ["拼音敏感字段必须以护照为准，不能按习惯自行加空格或改拼写。"],
  },
  {
    id: "fullNameNative",
    section: "个人信息",
    label: "中文姓名",
    helper: "用于核对中文原文与英文罗马化是否对应。",
    kind: "text",
    chineseValue: "王小明",
    englishValue: "WANG XIAOMING",
    warnings: ["如护照姓名顺序不同，请以护照英文姓名为准。"],
  },
  {
    id: "birthDate",
    section: "个人信息",
    label: "出生日期",
    helper: "左侧可输入 1996年3月9日 或 1996-03-09。",
    kind: "date",
    chineseValue: "1996年3月9日",
    englishValue: "09/03/1996",
    warnings: ["右侧按官方格式 DD/MM/YYYY 显示，请特别检查日/月顺序。"],
  },
  {
    id: "maritalStatus",
    section: "个人信息",
    label: "婚姻状况",
    helper: "从官方选项中选择最接近的一项。",
    kind: "option",
    chineseValue: "未婚",
    englishValue: "Single",
    warnings: [],
  },
  {
    id: "gender",
    section: "个人信息",
    label: "性别",
    helper: "按证件信息填写。",
    kind: "option",
    chineseValue: "男",
    englishValue: "Male",
    warnings: [],
  },
  {
    id: "nationality",
    section: "个人信息",
    label: "国籍",
    helper: "国家名称会转成英文官方写法。",
    kind: "option",
    chineseValue: "中国",
    englishValue: "China",
    warnings: [],
  },
  {
    id: "cityOfBirth",
    section: "出生信息",
    label: "出生城市",
    helper: "城市名建议使用常见英文写法。",
    kind: "text",
    chineseValue: "北京",
    englishValue: "Beijing",
    warnings: ["出生地也属于拼写敏感信息，请与护照或出生证明保持一致。"],
  },
  {
    id: "stateOfBirth",
    section: "出生信息",
    label: "出生省 / 州",
    helper: "没有省州时可填写城市或按官方要求留空。",
    kind: "text",
    chineseValue: "北京",
    englishValue: "Beijing",
    warnings: [],
  },
  {
    id: "countryOfBirth",
    section: "出生信息",
    label: "出生国家",
    helper: "国家名称会转成英文官方写法。",
    kind: "option",
    chineseValue: "中国",
    englishValue: "China",
    warnings: [],
  },
  {
    id: "passportNumber",
    section: "护照信息",
    label: "护照号码",
    helper: "号码、字母通常不翻译，只做格式核对。",
    kind: "text",
    chineseValue: "E12345678",
    englishValue: "E12345678",
    warnings: ["请逐位核对，护照号码错误会直接影响预约和递交。"],
  },
  {
    id: "passportIssueDate",
    section: "护照信息",
    label: "签发日期",
    helper: "日期会统一成 DD/MM/YYYY。",
    kind: "date",
    chineseValue: "2024-03-09",
    englishValue: "09/03/2024",
    warnings: ["请确认这是签发日期，不是出生日期或有效期。"],
  },
  {
    id: "passportExpiryDate",
    section: "护照信息",
    label: "有效期至",
    helper: "日期会统一成 DD/MM/YYYY。",
    kind: "date",
    chineseValue: "2034-03-08",
    englishValue: "08/03/2034",
    warnings: ["请确认入境时护照剩余有效期符合目的地要求。"],
  },
  {
    id: "religion",
    section: "背景信息",
    label: "宗教信仰",
    helper: "如果表格允许且本人无宗教信仰，可使用 None。",
    kind: "option",
    chineseValue: "无",
    englishValue: "None",
    warnings: ["不要为了看起来更合适而编造答案，应按真实情况填写。"],
  },
  {
    id: "portOfEntry",
    section: "旅行信息",
    label: "出入境口岸",
    helper: "机场、港口或陆路口岸会转成英文常用名称。",
    kind: "text",
    chineseValue: "纽约肯尼迪国际机场",
    englishValue: "John F. Kennedy International Airport, New York",
    warnings: ["如尚未出票，先按计划口岸填写，提交前再核对行程。"],
  },
  {
    id: "journeyPurpose",
    section: "旅行信息",
    label: "旅行目的",
    helper: "常见目的会映射到官方英文选项。",
    kind: "option",
    chineseValue: "旅游",
    englishValue: "Tourism",
    warnings: [],
  },
  {
    id: "accommodationAddress",
    section: "旅行信息",
    label: "住宿地址",
    helper: "地址较长时采用上下两排展示，便于完整核对。",
    kind: "address",
    chineseValue: "巴黎第一区里沃利街 10 号",
    englishValue: "10 Rue de Rivoli, 1st arrondissement, Paris",
    warnings: ["地址翻译建议保留门牌号、街道、城市和国家，不要省略关键信息。"],
    long: true,
  },
  {
    id: "travelHistory",
    section: "历史记录",
    label: "上一次签证记录",
    helper: "长文本会自动切到两排布局。",
    kind: "address",
    chineseValue: "2023年获得申根旅游签证，签证号 SCH-2023-8891，有效期 30 天。",
    englishValue:
      "Schengen tourist visa issued in 2023, visa number SCH-2023-8891, valid for 30 days.",
    warnings: ["签证号和年份不要翻译错；如系统有固定字段，应拆分填写。"],
    long: true,
  },
];

const DIRECT_TRANSLATIONS: Record<string, string> = {
  王: "WANG",
  小明: "XIAOMING",
  王小明: "WANG XIAOMING",
  北京: "Beijing",
  上海: "Shanghai",
  广州: "Guangzhou",
  深圳: "Shenzhen",
  中国: "China",
  美国: "United States",
  法国: "France",
  英国: "United Kingdom",
  日本: "Japan",
  新加坡: "Singapore",
  男: "Male",
  女: "Female",
  未婚: "Single",
  已婚: "Married",
  离异: "Divorced",
  无: "None",
  旅游: "Tourism",
  商务: "Business",
  留学: "Study",
  探亲: "Visit family",
  纽约肯尼迪国际机场: "John F. Kennedy International Airport, New York",
  上海浦东国际机场: "Shanghai Pudong International Airport",
  北京首都国际机场: "Beijing Capital International Airport",
  "巴黎第一区里沃利街 10 号": "10 Rue de Rivoli, 1st arrondissement, Paris",
};

const TEXT_REPLACEMENTS = [
  ["2023年", "issued in 2023"],
  ["获得", ""],
  ["申根", "Schengen"],
  ["旅游签证", "tourist visa"],
  ["签证号", "visa number"],
  ["有效期", "valid for"],
  ["30 天", "30 days"],
  ["，", ", "],
  ["。", "."],
] as const;

function formatOfficialDate(value: string): string | null {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const chineseMatch = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  const match = isoMatch ?? chineseMatch;

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

function looksLikeMostlyLatin(value: string): boolean {
  return /^[\dA-Za-z\s,.'#/-]+$/.test(value.trim());
}

function translateText(value: string, kind: FieldKind): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (kind === "date") {
    return formatOfficialDate(trimmed) ?? "日期格式无法识别，请手动确认";
  }

  const direct = DIRECT_TRANSLATIONS[trimmed];
  if (direct) {
    return direct;
  }

  if (looksLikeMostlyLatin(trimmed)) {
    return trimmed;
  }

  let translated = trimmed;
  for (const [source, target] of TEXT_REPLACEMENTS) {
    translated = translated.replaceAll(source, target);
  }

  if (translated !== trimmed) {
    return translated.replace(/\s+/g, " ").replace(/,\s*\./g, ".").trim();
  }

  if (kind === "address") {
    return `Please confirm English address: ${trimmed}`;
  }

  return `Please confirm official English: ${trimmed}`;
}

function getFieldBadge(field: PreviewField): string {
  if (field.englishEdited) {
    return "英文已手动编辑";
  }

  if (field.kind === "date") {
    return "官方日期格式";
  }

  if (field.kind === "option") {
    return "官方选项映射";
  }

  return "自动生成英文";
}

function groupFields(fields: PreviewField[]): Array<{ section: string; fields: PreviewField[] }> {
  const grouped = new Map<string, PreviewField[]>();

  for (const field of fields) {
    const sectionFields = grouped.get(field.section) ?? [];
    sectionFields.push(field);
    grouped.set(field.section, sectionFields);
  }

  return Array.from(grouped.entries()).map(([section, sectionFields]) => ({
    section,
    fields: sectionFields,
  }));
}

export default function BilingualReviewPreviewPage() {
  const [fields, setFields] = useState<PreviewField[]>(INITIAL_FIELDS);
  const sections = useMemo(() => groupFields(fields), [fields]);
  const editedCount = fields.filter((field) => field.englishEdited).length;

  function updateChineseValue(fieldId: string, chineseValue: string) {
    setFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              chineseValue,
              englishValue: translateText(chineseValue, field.kind),
              englishEdited: false,
            }
          : field,
      ),
    );
  }

  function updateEnglishValue(fieldId: string, englishValue: string) {
    setFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              englishValue,
              englishEdited: true,
            }
          : field,
      ),
    );
  }

  function refreshAllTranslations() {
    setFields((current) =>
      current.map((field) => ({
        ...field,
        englishValue: translateText(field.chineseValue, field.kind),
        englishEdited: false,
      })),
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 py-6 text-[#23262d] sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-[#dfe5ee] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#03346E]">
              <Languages className="h-4 w-4" />
              独立验证页
            </div>
            <h1 className="font-heading text-3xl font-medium text-[#24272f]">
              双语核对页验证
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#5e6673]">
              这个页面不接入真实申请流程。左侧输入中文，右侧会自动生成英文或官方格式；两边都可以直接编辑，用来验证提交前核对体验。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshAllTranslations}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cbd8ea] bg-white px-3 text-sm font-medium text-[#03346E] transition-colors hover:bg-[#eef5ff]"
            >
              <RefreshCw className="h-4 w-4" />
              重新生成英文
            </button>
            <button
              type="button"
              onClick={() => setFields(INITIAL_FIELDS)}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d8dce3] bg-white px-3 text-sm font-medium text-[#424955] transition-colors hover:bg-[#f0f2f5]"
            >
              <RotateCcw className="h-4 w-4" />
              重置示例
            </button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[#dfe5ee] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#03346E]">
              <Sparkles className="h-4 w-4" />
              中文驱动翻译
            </div>
            <p className="mt-2 text-sm leading-6 text-[#5e6673]">
              修改任意中文输入后，右侧英文会立刻刷新，模拟后续真实 AI 翻译服务。
            </p>
          </div>
          <div className="rounded-lg border border-[#dfe5ee] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#03346E]">
              <PencilLine className="h-4 w-4" />
              双侧可编辑
            </div>
            <p className="mt-2 text-sm leading-6 text-[#5e6673]">
              英文侧可以人工覆盖；一旦再次改中文，会重新生成英文并清除手动编辑标记。
            </p>
          </div>
          <div className="rounded-lg border border-[#dfe5ee] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#03346E]">
              <CheckCircle2 className="h-4 w-4" />
              当前状态
            </div>
            <p className="mt-2 text-sm leading-6 text-[#5e6673]">
              共 {fields.length} 个核对字段，{editedCount} 个英文值已手动编辑。
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[#dfe5ee] bg-white">
          <div className="hidden grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-[#dfe5ee] bg-[#edf3fb] px-4 py-3 text-xs font-semibold text-[#42506a] md:grid">
            <span>字段</span>
            <span>中文原文</span>
            <span>英文翻译 / 官方格式</span>
          </div>

          {sections.map((section) => (
            <div key={section.section} className="border-b border-[#e6ebf2] last:border-b-0">
              <div className="bg-[#f7fafe] px-4 py-3 text-sm font-semibold text-[#03346E]">
                {section.section}
              </div>

              <div className="divide-y divide-[#eef1f5]">
                {section.fields.map((field) => (
                  <div
                    key={field.id}
                    className={
                      field.long
                        ? "grid gap-3 px-4 py-4 md:grid-cols-[180px_minmax(0,1fr)]"
                        : "grid gap-3 px-4 py-4 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]"
                    }
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#24272f]">{field.label}</p>
                      <p className="mt-1 text-xs leading-5 text-[#697386]">{field.helper}</p>
                      <span className="mt-2 inline-flex rounded-full bg-[#eaf2ff] px-2 py-1 text-[11px] font-medium text-[#03346E]">
                        {getFieldBadge(field)}
                      </span>
                    </div>

                    <label className={field.long ? "md:col-start-2" : undefined}>
                      <span className="mb-1 block text-xs font-semibold text-[#667085] md:hidden">
                        中文原文
                      </span>
                      <textarea
                        value={field.chineseValue}
                        onChange={(event) => updateChineseValue(field.id, event.target.value)}
                        rows={field.long ? 4 : 2}
                        className="min-h-[76px] w-full resize-y rounded-md border border-[#d6dce6] bg-white px-3 py-2 text-sm leading-6 text-[#252a33] outline-none transition focus:border-[#03346E] focus:ring-2 focus:ring-[#03346E]/15"
                        aria-label={`${field.label}中文原文`}
                      />
                    </label>

                    <label className={field.long ? "md:col-start-2" : undefined}>
                      <span className="mb-1 block text-xs font-semibold text-[#667085] md:hidden">
                        英文翻译 / 官方格式
                      </span>
                      <textarea
                        value={field.englishValue}
                        onChange={(event) => updateEnglishValue(field.id, event.target.value)}
                        rows={field.long ? 4 : 2}
                        className="min-h-[76px] w-full resize-y rounded-md border border-[#b8c9e0] bg-[#f8fbff] px-3 py-2 text-sm font-medium leading-6 text-[#172033] outline-none transition focus:border-[#03346E] focus:ring-2 focus:ring-[#03346E]/15"
                        aria-label={`${field.label}英文翻译`}
                      />
                    </label>

                    {field.warnings.length > 0 && (
                      <div className={field.long ? "md:col-start-2" : "md:col-start-2 md:col-span-2"}>
                        <div className="flex gap-2 rounded-md border border-[#f0d8a5] bg-[#fff8e8] px-3 py-2 text-xs leading-5 text-[#815b16]">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            {field.warnings.map((warning) => (
                              <p key={warning}>{warning}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
