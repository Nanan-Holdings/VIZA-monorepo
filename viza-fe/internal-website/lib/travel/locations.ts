export type CuratedCity = {
  en: string;
  zh?: string;
  aliases?: string[];
};

export const CURATED_CITIES_BY_COUNTRY: Record<string, CuratedCity[]> = {
  China: [
    { en: "Beijing", zh: "北京" },
    { en: "Shanghai", zh: "上海" },
    { en: "Guangzhou", zh: "广州" },
    { en: "Shenzhen", zh: "深圳" },
    { en: "Chengdu", zh: "成都" },
    { en: "Changsha", zh: "长沙", aliases: ["长沙市", "Hunan Changsha", "湖南长沙"] },
    { en: "Changchun", zh: "长春", aliases: ["长春市"] },
    { en: "Hangzhou", zh: "杭州" },
    { en: "Xi'an", zh: "西安" },
    { en: "Chongqing", zh: "重庆" },
  ],
  Japan: [
    { en: "Tokyo", zh: "东京", aliases: ["東京"] },
    { en: "Osaka", zh: "大阪" },
    { en: "Kyoto", zh: "京都" },
    { en: "Nagasaki", zh: "长崎", aliases: ["長崎"] },
    { en: "Sapporo", zh: "札幌" },
    { en: "Fukuoka", zh: "福冈" },
    { en: "Naha", zh: "那霸" },
    { en: "Nagoya", zh: "名古屋" },
  ],
  Singapore: [{ en: "Singapore", zh: "新加坡" }],
  "Hong Kong": [{ en: "Hong Kong", zh: "香港", aliases: ["HK"] }],
  Thailand: [
    { en: "Bangkok", zh: "曼谷" },
    { en: "Chiang Mai", zh: "清迈" },
    { en: "Phuket", zh: "普吉" },
    { en: "Krabi", zh: "甲米" },
    { en: "Pattaya", zh: "芭提雅" },
    { en: "Koh Samui", zh: "苏梅岛" },
  ],
  Malaysia: [
    { en: "Kuala Lumpur", zh: "吉隆坡" },
    { en: "Penang", zh: "槟城" },
    { en: "Johor Bahru", zh: "新山" },
    { en: "Langkawi", zh: "兰卡威" },
    { en: "Kota Kinabalu", zh: "哥打京那巴鲁" },
    { en: "Malacca", zh: "马六甲" },
  ],
  Indonesia: [
    { en: "Jakarta", zh: "雅加达" },
    { en: "Bali", zh: "巴厘岛" },
    { en: "Surabaya", zh: "泗水" },
    { en: "Yogyakarta", zh: "日惹" },
    { en: "Bandung", zh: "万隆" },
    { en: "Lombok", zh: "龙目岛" },
  ],
  Vietnam: [
    { en: "Hanoi", zh: "河内" },
    { en: "Ho Chi Minh City", zh: "胡志明市", aliases: ["Saigon"] },
    { en: "Da Nang", zh: "岘港" },
    { en: "Hoi An", zh: "会安" },
    { en: "Nha Trang", zh: "芽庄" },
    { en: "Phu Quoc", zh: "富国岛" },
  ],
  "South Korea": [
    { en: "Seoul", zh: "首尔" },
    { en: "Busan", zh: "釜山" },
    { en: "Jeju", zh: "济州" },
    { en: "Incheon", zh: "仁川" },
    { en: "Gyeongju", zh: "庆州" },
    { en: "Daegu", zh: "大邱" },
  ],
  Philippines: [
    { en: "Manila", zh: "马尼拉" },
    { en: "Cebu", zh: "宿务" },
    { en: "Boracay", zh: "长滩岛" },
    { en: "Davao", zh: "达沃" },
    { en: "Palawan", zh: "巴拉望" },
  ],
  India: [
    { en: "New Delhi", zh: "新德里" },
    { en: "Mumbai", zh: "孟买" },
    { en: "Bengaluru", zh: "班加罗尔" },
    { en: "Jaipur", zh: "斋浦尔" },
    { en: "Goa", zh: "果阿" },
    { en: "Chennai", zh: "金奈" },
  ],
  "United Arab Emirates": [
    { en: "Dubai", zh: "迪拜" },
    { en: "Abu Dhabi", zh: "阿布扎比" },
    { en: "Sharjah", zh: "沙迦" },
  ],
  Turkey: [
    { en: "Istanbul", zh: "伊斯坦布尔" },
    { en: "Ankara", zh: "安卡拉" },
    { en: "Antalya", zh: "安塔利亚" },
    { en: "Cappadocia", zh: "卡帕多奇亚" },
    { en: "Izmir", zh: "伊兹密尔" },
  ],
  France: [
    { en: "Paris", zh: "巴黎" },
    { en: "Lyon", zh: "里昂" },
    { en: "Nice", zh: "尼斯" },
    { en: "Marseille", zh: "马赛" },
    { en: "Bordeaux", zh: "波尔多" },
  ],
  Italy: [
    { en: "Rome", zh: "罗马" },
    { en: "Milan", zh: "米兰" },
    { en: "Florence", zh: "佛罗伦萨" },
    { en: "Venice", zh: "威尼斯" },
    { en: "Naples", zh: "那不勒斯" },
  ],
  Spain: [
    { en: "Madrid", zh: "马德里" },
    { en: "Barcelona", zh: "巴塞罗那" },
    { en: "Valencia", zh: "瓦伦西亚" },
    { en: "Seville", zh: "塞维利亚" },
    { en: "Malaga", zh: "马拉加" },
  ],
  Germany: [
    { en: "Berlin", zh: "柏林" },
    { en: "Munich", zh: "慕尼黑" },
    { en: "Frankfurt", zh: "法兰克福" },
    { en: "Hamburg", zh: "汉堡" },
    { en: "Cologne", zh: "科隆" },
  ],
  Netherlands: [
    { en: "Amsterdam", zh: "阿姆斯特丹" },
    { en: "Rotterdam", zh: "鹿特丹" },
    { en: "The Hague", zh: "海牙" },
    { en: "Utrecht", zh: "乌得勒支" },
  ],
  Switzerland: [
    { en: "Zurich", zh: "苏黎世" },
    { en: "Geneva", zh: "日内瓦" },
    { en: "Lucerne", zh: "卢塞恩" },
    { en: "Interlaken", zh: "因特拉肯" },
  ],
  Austria: [
    { en: "Vienna", zh: "维也纳" },
    { en: "Salzburg", zh: "萨尔茨堡" },
    { en: "Innsbruck", zh: "因斯布鲁克" },
    { en: "Hallstatt", zh: "哈尔施塔特" },
  ],
  Greece: [
    { en: "Athens", zh: "雅典" },
    { en: "Santorini", zh: "圣托里尼" },
    { en: "Mykonos", zh: "米科诺斯" },
    { en: "Thessaloniki", zh: "塞萨洛尼基" },
  ],
  Portugal: [
    { en: "Lisbon", zh: "里斯本" },
    { en: "Porto", zh: "波尔图" },
    { en: "Faro", zh: "法鲁" },
    { en: "Madeira", zh: "马德拉" },
  ],
  Egypt: [
    { en: "Cairo", zh: "开罗" },
    { en: "Luxor", zh: "卢克索" },
    { en: "Aswan", zh: "阿斯旺" },
    { en: "Sharm El Sheikh", zh: "沙姆沙伊赫" },
  ],
  Morocco: [
    { en: "Marrakesh", zh: "马拉喀什" },
    { en: "Casablanca", zh: "卡萨布兰卡" },
    { en: "Fes", zh: "非斯" },
    { en: "Rabat", zh: "拉巴特" },
  ],
  "United Kingdom": [
    { en: "London", zh: "伦敦" },
    { en: "Manchester", zh: "曼彻斯特" },
    { en: "Edinburgh", zh: "爱丁堡" },
    { en: "Birmingham", zh: "伯明翰" },
    { en: "Bristol", zh: "布里斯托" },
  ],
  Ireland: [
    { en: "Dublin", zh: "都柏林" },
    { en: "Cork", zh: "科克" },
    { en: "Galway", zh: "戈尔韦" },
  ],
  Canada: [
    { en: "Toronto", zh: "多伦多" },
    { en: "Vancouver", zh: "温哥华" },
    { en: "Montreal", zh: "蒙特利尔" },
    { en: "Calgary", zh: "卡尔加里" },
    { en: "Quebec City", zh: "魁北克城" },
  ],
  Mexico: [
    { en: "Mexico City", zh: "墨西哥城" },
    { en: "Cancun", zh: "坎昆" },
    { en: "Guadalajara", zh: "瓜达拉哈拉" },
    { en: "Monterrey", zh: "蒙特雷" },
    { en: "Tulum", zh: "图卢姆" },
  ],
  Brazil: [
    { en: "Rio de Janeiro", zh: "里约热内卢" },
    { en: "Sao Paulo", zh: "圣保罗" },
    { en: "Brasilia", zh: "巴西利亚" },
    { en: "Salvador", zh: "萨尔瓦多" },
    { en: "Florianopolis", zh: "弗洛里亚诺波利斯" },
  ],
  Argentina: [
    { en: "Buenos Aires", zh: "布宜诺斯艾利斯" },
    { en: "Mendoza", zh: "门多萨" },
    { en: "Cordoba", zh: "科尔多瓦" },
    { en: "Ushuaia", zh: "乌斯怀亚" },
  ],
  "United States": [
    { en: "New York", zh: "纽约" },
    { en: "Los Angeles", zh: "洛杉矶", aliases: ["LA", "L.A."] },
    { en: "San Francisco", zh: "旧金山" },
    { en: "Seattle", zh: "西雅图" },
    { en: "Chicago", zh: "芝加哥" },
    { en: "Las Vegas", zh: "拉斯维加斯" },
  ],
  Australia: [
    { en: "Sydney", zh: "悉尼" },
    { en: "Melbourne", zh: "墨尔本" },
    { en: "Brisbane", zh: "布里斯班" },
    { en: "Perth", zh: "珀斯" },
    { en: "Adelaide", zh: "阿德莱德" },
    { en: "Gold Coast", zh: "黄金海岸" },
  ],
  "New Zealand": [
    { en: "Auckland", zh: "奥克兰" },
    { en: "Wellington", zh: "惠灵顿" },
    { en: "Queenstown", zh: "皇后镇" },
    { en: "Christchurch", zh: "基督城" },
  ],
};

export function normalizeCuratedCityKey(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

export const CURATED_CITY_ZH_LABELS_BY_KEY: Record<string, string> = {};
export const CURATED_CITY_EN_LABELS_BY_KEY: Record<string, string> = {};

Object.values(CURATED_CITIES_BY_COUNTRY).forEach((cities) => {
  cities.forEach((city) => {
    const labels = [city.en, city.zh, ...(city.aliases ?? [])].filter(
      (value): value is string => Boolean(value)
    );

    labels.forEach((label) => {
      const key = normalizeCuratedCityKey(label);
      if (!key) return;
      CURATED_CITY_EN_LABELS_BY_KEY[key] ??= city.en;
      CURATED_CITY_ZH_LABELS_BY_KEY[key] ??= city.zh ?? city.en;
    });
  });
});

export function getCuratedCityLabel(
  value: string | null | undefined,
  locale: "zh" | "en"
): string | null {
  const key = normalizeCuratedCityKey(value);
  if (!key) return null;
  return locale === "zh"
    ? CURATED_CITY_ZH_LABELS_BY_KEY[key] ?? null
    : CURATED_CITY_EN_LABELS_BY_KEY[key] ?? null;
}

export function getCuratedCitiesForCountry(countryNameEn: string): CuratedCity[] {
  return CURATED_CITIES_BY_COUNTRY[countryNameEn] ?? [];
}
