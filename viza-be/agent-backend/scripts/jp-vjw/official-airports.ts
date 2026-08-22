export const JP_CUSTOMS_AIRPORT_SOURCE = {
  url: "https://www.customs.go.jp/english/procedures/advance_e/contact.htm",
  effectiveDate: "2025-07-01",
  retrievedAt: "2026-08-22",
  authority: "Japan Customs",
} as const;

export type JpCustomsAirportOption = {
  value: string;
  text: string;
  label_zh: string;
  label_en: string;
  official_label: string;
};

const airport = (officialLabel: string, labelZh: string): JpCustomsAirportOption => ({
  value: officialLabel,
  text: officialLabel,
  label_zh: labelZh,
  label_en: officialLabel,
  official_label: officialLabel,
});

/**
 * Versioned snapshot of the "Customs Airport" table published by Japan
 * Customs. The English labels are kept byte-for-byte as the official values;
 * Chinese labels are display-only. Live submission must revalidate the chosen
 * airport against the current official source before using it.
 */
export const JP_CUSTOMS_AIRPORT_OPTIONS: JpCustomsAirportOption[] = [
  airport("Shinchitose Airport", "新千岁机场"),
  airport("Asahikawa Airport", "旭川机场"),
  airport("Hakodate Airport", "函馆机场"),
  airport("Aomori Airport", "青森机场"),
  airport("Hanamaki Airport", "花卷机场"),
  airport("Sendai Airport", "仙台机场"),
  airport("Akita Airport", "秋田机场"),
  airport("Fukushima Airport", "福岛机场"),
  airport("Hyakuri Airport", "茨城机场（百里机场）"),
  airport("Narita international Airport", "成田国际机场"),
  airport("Tokyo international Airport", "东京国际机场（羽田机场）"),
  airport("Niigata Airport", "新潟机场"),
  airport("Toyama Airport", "富山机场"),
  airport("Komatsu Airport", "小松机场"),
  airport("Shizuoka Airport", "静冈机场"),
  airport("Chubu International Airport", "中部国际机场"),
  airport("Kansai international Airport", "关西国际机场"),
  airport("Miho Airport", "米子机场（美保机场）"),
  airport("Okayama Airport", "冈山机场"),
  airport("Hiroshima Airport", "广岛机场"),
  airport("Tokushima Airport", "德岛机场"),
  airport("Takamatsu Airport", "高松机场"),
  airport("Matsuyama Airport", "松山机场"),
  airport("Fukuoka Airport", "福冈机场"),
  airport("Kitakyusyu Airport", "北九州机场"),
  airport("Saga Airport", "佐贺机场"),
  airport("Nagasaki Airport", "长崎机场"),
  airport("Kumamoto Airport", "熊本机场"),
  airport("Oita Airport", "大分机场"),
  airport("Miyazaki Airport", "宫崎机场"),
  airport("Kagoshima Airport", "鹿儿岛机场"),
  airport("Naha Airport", "那霸机场"),
  airport("Shinishigaki Airport", "新石垣机场"),
];
