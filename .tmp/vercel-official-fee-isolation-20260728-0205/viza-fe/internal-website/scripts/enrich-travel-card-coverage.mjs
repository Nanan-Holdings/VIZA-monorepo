import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const publicRoot = path.join(appRoot, "public");
const locationsPath = path.join(appRoot, "lib", "travel", "locations.ts");
const cardDataPath = path.join(
  appRoot,
  "components",
  "client",
  "travel",
  "travel-card-curated-data.json"
);

const USER_AGENT = "VIZA Travel AI card coverage updater/1.0";
const MIN_ATTRACTIONS_PER_CITY = Number(
  process.env.TRAVEL_CARD_MIN_ATTRACTIONS ?? 10
);
const DEFAULT_DOWNLOAD_DELAY_MS = Number(
  process.env.TRAVEL_CARD_DOWNLOAD_DELAY_MS ?? 1200
);
const DEFAULT_QUERY_DELAY_MS = Number(
  process.env.TRAVEL_CARD_QUERY_DELAY_MS ?? 900
);
const DEFAULT_IMAGE_WIDTH = Number(process.env.TRAVEL_CARD_IMAGE_WIDTH ?? 640);
const IMAGE_DOWNLOAD_ATTEMPTS = Number(
  process.env.TRAVEL_CARD_IMAGE_ATTEMPTS ?? 2
);
const IMAGE_DOWNLOAD_BATCH_SIZE = Number(
  process.env.TRAVEL_CARD_IMAGE_BATCH_SIZE ?? 6
);
const FETCH_TIMEOUT_MS = Number(process.env.TRAVEL_CARD_FETCH_TIMEOUT_MS ?? 25000);
const WIKIPEDIA_FALLBACK_ONLY =
  process.env.TRAVEL_CARD_WIKIPEDIA_FALLBACK_ONLY === "1";
const FALLBACK_PAGE_EXCLUDE_PATTERN =
  /\b(list of|tourism in|airport|station|university|school|college|hospital|battle|province|county|district|governorate|prefecture)\b/i;

const args = process.argv.slice(2);
const shouldWrite = args.includes("--write");
const shouldDryRun = args.includes("--dry-run");
const shouldRefresh = args.includes("--refresh");
const cityFilters = args
  .flatMap((arg, index) =>
    arg === "--city" && args[index + 1] ? [args[index + 1]] : []
  )
  .map(normalizeKey);
let dropdownCities = [];

const CITY_TITLE_OVERRIDES = new Map(
  Object.entries({
    "newyork|unitedstates": "New York City",
    "losangeles|unitedstates": "Los Angeles",
    "lasvegas|unitedstates": "Las Vegas",
    "goldcoast|australia": "Gold Coast, Queensland",
    "quebeccity|canada": "Quebec City",
    "hoian|vietnam": "Hội An (city)",
    "saopaulo|brazil": "Sao Paulo",
    "cordoba|argentina": "Córdoba, Argentina",
    "florianopolis|brazil": "Florianópolis",
    "faro|portugal": "Faro, Portugal",
    "fes|morocco": "Fez, Morocco",
    "cork|ireland": "Cork (city)",
    "malacca|malaysia": "Malacca City",
    "cappadocia|turkey": "Cappadocia",
    "madeira|portugal": "Madeira",
    "queenstown|newzealand": "Queenstown, New Zealand",
    "goa|india": "Goa",
    "bali|indonesia": "Bali",
    "hawaii|unitedstates": "Hawaii",
    "kohsamui|thailand": "Ko Samui",
  }).map(([key, value]) => [key, value])
);

const MANUAL_CITY_IMAGE_PAGES = new Map(
  Object.entries({
    "hoian|vietnam": { title: "Hội An (city)" },
    "madeira|portugal": {
      imageFile: "View from Miradouro do Pico do Arieiro - Madeira 01.jpg",
    },
    "luxor|egypt": { title: "Luxor Temple" },
    "sharmelsheikh|egypt": { title: "Naama Bay" },
    "cork|ireland": { title: "Cork (city)" },
    "tulum|mexico": { imageFile: "Tulum - 01.jpg" },
    "queenstown|newzealand": { title: "Lake Wakatipu" },
  }).map(([key, value]) => [key, value])
);

const MANUAL_ATTRACTION_PAGES = new Map(
  Object.entries({
    "kyoto|japan": [
      { title: "Kiyomizu-dera", zh: "清水寺" },
      { title: "Kinkaku-ji", zh: "金阁寺" },
      { title: "Fushimi Inari-taisha", zh: "伏见稻荷大社" },
      { title: "Arashiyama", zh: "岚山" },
    ],
    "johorbahru|malaysia": [
      { title: "Sultan Abu Bakar State Mosque", zh: "苏丹阿布巴卡清真寺" },
      { title: "Johor Bahru City Square", zh: "新山城市广场" },
      { title: "Johor Bahru Old Chinese Temple", zh: "新山古庙" },
      { title: "Istana Besar", zh: "新山大王宫" },
    ],
    "hoian|vietnam": [
      { title: "Japanese Bridge", zh: "日本廊桥" },
      { title: "Museum of Trade Ceramics", zh: "贸易陶瓷博物馆" },
      { title: "Mỹ Sơn", zh: "美山圣地" },
      { title: "Cham Islands", zh: "占婆群岛" },
    ],
    "daegu|southkorea": [
      { title: "Donghwasa", zh: "桐华寺" },
      { title: "Daegu National Museum", zh: "大邱国立博物馆" },
      { title: "Apsan Park", zh: "前山公园" },
      { title: "Seomun Market", zh: "西门市场" },
      { title: "Dalseong Park", zh: "达城公园" },
      { title: "83 Tower", zh: "83塔", lat: 35.8533, lng: 128.5636 },
      { title: "E-World", zh: "E-World乐园", lat: 35.8531, lng: 128.5647 },
      { title: "Suseong Lake", zh: "寿城池", lat: 35.8288, lng: 128.6177 },
      {
        nameEn: "Kim Gwangseok-gil Street",
        zh: "金光石路",
        imageFile: "2017년 12월 대구 김광석다시그리기길.jpg",
        lat: 35.8584,
        lng: 128.6066,
      },
      {
        nameEn: "Daegu Yangnyeongsi Museum of Oriental Medicine",
        zh: "大邱药令市韩医药博物馆",
        imageFile: "Daegu Yangnyeongsi Museum of Oriental Medicine.jpg",
        lat: 35.8671,
        lng: 128.5924,
      },
    ],
    "incheon|southkorea": [
      { title: "Incheon Bridge", zh: "仁川大桥", lat: 37.4137, lng: 126.5664 },
      { title: "Chinatown, Incheon", zh: "仁川唐人街", lat: 37.4752, lng: 126.6186 },
      { title: "Songdo Central Park", zh: "松岛中央公园" },
      { title: "Wolmido", zh: "月尾岛" },
    ],
    "boracay|philippines": [
      {
        nameEn: "White Beach",
        zh: "白沙滩",
        imageFile: "Boracay White Beach in day (985286231).jpg",
        lat: 11.9609,
        lng: 121.9245,
      },
      {
        nameEn: "Bulabog Beach",
        zh: "布拉波海滩",
        imageFile: "Bulabog Beach Boracay - panoramio.jpg",
        lat: 11.966,
        lng: 121.9297,
      },
      {
        nameEn: "Willy's Rock",
        zh: "威利岩",
        imageFile: "Willy's Rock in Boracay at low tide.jpg",
        lat: 11.9692,
        lng: 121.9203,
      },
      {
        nameEn: "Mount Luho",
        zh: "卢霍山观景台",
        imageFile: "View from Mount Luho View Deck Boracay - panoramio.jpg",
        lat: 11.9786,
        lng: 121.9294,
      },
      {
        nameEn: "Puka Shell Beach",
        zh: "普卡贝壳海滩",
        imageFile: "Puka Beach, Boracay Island, Philippines.jpg",
        lat: 11.9977,
        lng: 121.9197,
      },
      {
        nameEn: "Diniwid Beach",
        zh: "迪尼维德海滩",
        imageFile: "Diniwid Beach, Boracay.jpg",
        lat: 11.9782,
        lng: 121.9176,
      },
      {
        nameEn: "Ilig-Iligan Beach",
        zh: "伊利格伊利根海滩",
        imageFile: "Ilig-Iligan Beach, Boracay.jpg",
        lat: 11.985,
        lng: 121.936,
      },
      {
        nameEn: "Crystal Cove Island",
        zh: "水晶湾岛",
        imageFile: "Crystal Cove Island Boracay.jpg",
        lat: 11.9403,
        lng: 121.9395,
      },
      {
        nameEn: "Crocodile Island",
        zh: "鳄鱼岛",
        imageFile: "Boracay Crocodile Island.jpg",
        lat: 11.9444,
        lng: 121.9452,
      },
      {
        nameEn: "Ariel's Point",
        zh: "阿里尔悬崖跳水点",
        imageFile: "Ariel's Point Boracay.jpg",
        lat: 11.8643,
        lng: 121.9145,
      },
    ],
    "langkawi|malaysia": [
      { title: "Langkawi Sky Bridge", zh: "兰卡威天空之桥", lat: 6.3864, lng: 99.6624 },
      { title: "Langkawi Cable Car", zh: "兰卡威缆车", lat: 6.3716, lng: 99.6713 },
      { title: "Seven Wells Waterfall", zh: "七仙井瀑布" },
      { title: "Langkawi Legend Park", zh: "兰卡威传奇公园" },
      {
        nameEn: "Eagle Square",
        zh: "鹰广场",
        imageFile: "Eagle Square Langkawi.jpg",
        lat: 6.3085,
        lng: 99.852,
      },
      {
        nameEn: "Kilim Karst Geoforest Park",
        zh: "基林喀斯特地质森林公园",
        imageFile: "Kilim Karst Geoforest Park Langkawi.jpg",
        lat: 6.409,
        lng: 99.863,
      },
      {
        nameEn: "Pantai Cenang",
        zh: "珍南海滩",
        imageFile: "Pantai Cenang Langkawi.jpg",
        lat: 6.2932,
        lng: 99.7277,
      },
      {
        nameEn: "Tanjung Rhu Beach",
        zh: "丹绒鲁海滩",
        imageFile: "Tanjung Rhu Langkawi.jpg",
        lat: 6.454,
        lng: 99.828,
      },
      { title: "Galeria Perdana", zh: "首相纪念馆" },
      { title: "Underwater World Langkawi", zh: "兰卡威海底世界", lat: 6.2877, lng: 99.7286 },
    ],
    "bandung|indonesia": [
      { title: "Gedung Sate", zh: "沙爹大楼" },
      { title: "Trans Studio Bandung", zh: "万隆Trans Studio乐园" },
      { title: "Merdeka Building", zh: "独立大厦" },
      { title: "Bosscha Observatory", zh: "波斯查天文台", lat: -6.8246, lng: 107.6159 },
      { title: "Bandung Geological Museum", zh: "万隆地质博物馆" },
      { title: "Grand Mosque of Bandung", zh: "万隆大清真寺" },
      { title: "Braga Street", zh: "布拉加街" },
      { title: "Tangkuban Perahu", zh: "覆舟火山" },
      { title: "Kawah Putih", zh: "白火山湖" },
      { title: "Sri Baduga Museum", zh: "斯里巴杜加博物馆" },
    ],
    "lombok|indonesia": [
      { title: "Mount Rinjani", zh: "林贾尼火山" },
      { title: "Mount Rinjani National Park", zh: "林贾尼火山国家公园" },
      { title: "Gili Trawangan", zh: "特拉旺岸岛", lat: -8.3483, lng: 116.0389 },
      { title: "Gili Meno", zh: "美诺岛" },
      { title: "Gili Air", zh: "艾尔岛" },
      { title: "Pura Lingsar", zh: "林萨尔寺" },
      { title: "Bayan Beleq Mosque", zh: "巴彦贝勒清真寺" },
      {
        nameEn: "Senggigi Beach",
        zh: "圣吉吉海滩",
        imageFile: "Senggigi Beach Lombok.jpg",
        lat: -8.493,
        lng: 116.046,
      },
      {
        nameEn: "Tanjung Aan Beach",
        zh: "丹戎安海滩",
        imageFile: "Tanjung Aan Beach Lombok.jpg",
        lat: -8.912,
        lng: 116.319,
      },
      {
        nameEn: "Sade Village",
        zh: "萨德传统村",
        imageFile: "Sade Village Lombok.jpg",
        lat: -8.839,
        lng: 116.294,
      },
    ],
    "nhatrang|vietnam": [
      { title: "Po Nagar", zh: "婆那加占婆塔" },
      { title: "Long Son Pagoda", zh: "龙山寺", lat: 12.255, lng: 109.18 },
      { title: "Christ the King Cathedral, Nha Trang", zh: "芽庄大教堂" },
      { title: "Yersin Museum", zh: "耶尔森博物馆" },
      {
        nameEn: "Nha Trang Beach",
        zh: "芽庄海滩",
        imageFile: "Nha Trang Beach.jpg",
        lat: 12.238,
        lng: 109.197,
      },
      { title: "Hon Tre", zh: "竹岛", lat: 12.214, lng: 109.298 },
      {
        nameEn: "Hon Mun",
        zh: "黑岛",
        imageFile: "Hon Mun island Nha Trang.jpg",
        lat: 12.168,
        lng: 109.301,
      },
      {
        nameEn: "Dam Market",
        zh: "芽庄大坝市场",
        imageFile: "Dam Market Nha Trang.jpg",
        lat: 12.2541,
        lng: 109.1919,
      },
      {
        nameEn: "National Oceanographic Museum of Vietnam",
        zh: "越南国家海洋博物馆",
        imageFile: "National Oceanographic Museum of Vietnam.jpg",
        lat: 12.207,
        lng: 109.214,
      },
      {
        nameEn: "VinWonders Nha Trang",
        zh: "芽庄珍珠乐园",
        imageFile: "Vinpearl Land Nha Trang.jpg",
        lat: 12.217,
        lng: 109.243,
      },
    ],
    "phuquoc|vietnam": [
      { title: "Phú Quốc National Park", zh: "富国国家公园" },
      {
        title: "Phú Quốc Prison",
        zh: "富国监狱",
        imageFile: "Phu Quoc Prison.jpg",
        lat: 10.045,
        lng: 104.025,
      },
      {
        nameEn: "Dinh Cau",
        zh: "丁舅庙",
        imageFile: "Dinh Cau Phu Quoc.jpg",
        lat: 10.2169,
        lng: 103.958,
      },
      {
        nameEn: "Sao Beach",
        zh: "星星海滩",
        imageFile: "Sao Beach Phu Quoc.jpg",
        lat: 10.055,
        lng: 104.036,
      },
      {
        nameEn: "Long Beach",
        zh: "长滩",
        imageFile: "Long Beach Phu Quoc.jpg",
        lat: 10.168,
        lng: 103.963,
      },
      {
        nameEn: "Hon Thom",
        zh: "香岛",
        imageFile: "Hon Thom Phu Quoc.jpg",
        lat: 9.955,
        lng: 104.02,
      },
      {
        nameEn: "An Thoi Islands",
        zh: "安泰群岛",
        imageFile: "An Thoi Islands Phu Quoc.jpg",
        lat: 9.98,
        lng: 104.03,
      },
      {
        nameEn: "Suoi Tranh Waterfall",
        zh: "筝溪瀑布",
        imageFile: "Suoi Tranh Waterfall Phu Quoc.jpg",
        lat: 10.183,
        lng: 104.012,
      },
      {
        nameEn: "Vinpearl Safari Phu Quoc",
        zh: "富国珍珠野生动物园",
        imageFile: "Vinpearl Safari Phu Quoc.jpg",
        lat: 10.335,
        lng: 103.894,
      },
      { title: "Phú Quốc", zh: "富国岛" },
    ],
    "davao|philippines": [
      { title: "People's Park (Davao City)", zh: "人民公园" },
      { title: "Davao Cathedral", zh: "圣佩德罗主教座堂" },
      { title: "Lon Wa Buddhist Temple", zh: "龙华寺" },
      { title: "Monfort Bat Sanctuary", zh: "蒙福特蝙蝠保护区" },
      { title: "Mount Apo", zh: "阿波山" },
      {
        nameEn: "Philippine Eagle Center",
        zh: "菲律宾鹰中心",
        imageFile: "Philippine Eagle Center Davao.jpg",
        lat: 7.181,
        lng: 125.417,
      },
      {
        nameEn: "Davao Crocodile Park",
        zh: "达沃鳄鱼公园",
        imageFile: "Davao Crocodile Park.jpg",
        lat: 7.096,
        lng: 125.61,
      },
      {
        nameEn: "Eden Nature Park",
        zh: "伊甸自然公园",
        imageFile: "Eden Nature Park Davao.jpg",
        lat: 7.0,
        lng: 125.49,
      },
      {
        nameEn: "Museo Dabawenyo",
        zh: "达沃博物馆",
        imageFile: "Museo Dabawenyo.jpg",
        lat: 7.064,
        lng: 125.607,
      },
      {
        nameEn: "Samal Island",
        zh: "萨马尔岛",
        imageFile: "Samal Island Davao.jpg",
        lat: 7.074,
        lng: 125.708,
      },
    ],
    "palawan|philippines": [
      { title: "Puerto Princesa Subterranean River National Park", zh: "普林塞萨港地下河国家公园" },
      { title: "Honda Bay", zh: "本田湾" },
      { title: "Puerto Princesa Cathedral", zh: "普林塞萨港主教座堂" },
      { title: "Plaza Cuartel", zh: "库阿特尔广场", lat: 9.7398, lng: 118.7296 },
      {
        nameEn: "Palawan Heritage Center",
        zh: "巴拉望遗产中心",
        imageFile: "Palawan Heritage Center.jpg",
        lat: 9.741,
        lng: 118.741,
      },
      {
        nameEn: "Palawan Wildlife Rescue and Conservation Center",
        zh: "巴拉望野生动物救援与保护中心",
        imageFile: "Palawan Wildlife Rescue and Conservation Center.jpg",
        lat: 9.798,
        lng: 118.747,
      },
      {
        nameEn: "Iwahig Prison and Penal Farm",
        zh: "伊瓦希格监狱农场",
        imageFile: "Iwahig Prison and Penal Farm.jpg",
        lat: 9.733,
        lng: 118.63,
      },
      {
        nameEn: "Ugong Rock",
        zh: "乌贡岩",
        imageFile: "Ugong Rock Palawan.jpg",
        lat: 10.133,
        lng: 118.827,
      },
      { title: "El Nido, Palawan", zh: "爱妮岛" },
      {
        nameEn: "Nacpan Beach",
        zh: "纳克潘海滩",
        imageFile: "Nacpan Beach Palawan.jpg",
        lat: 11.319,
        lng: 119.424,
      },
    ],
    "sharjah|unitedarabemirates": [
      {
        title: "Sharjah Museum of Islamic Civilization",
        zh: "沙迦伊斯兰文明博物馆",
        lat: 25.3622,
        lng: 55.3887,
      },
      { title: "Al Noor Mosque (Sharjah)", zh: "努尔清真寺" },
      { title: "Sharjah Fort", zh: "沙迦堡", imageFile: "Sharjah Fort (Al Hisn).JPG" },
      { title: "Sharjah Art Museum", zh: "沙迦艺术博物馆" },
      { title: "Sharjah Heritage Museum", zh: "沙迦遗产博物馆", lat: 25.358, lng: 55.384 },
      { title: "Sharjah Aquarium", zh: "沙迦水族馆", lat: 25.35, lng: 55.376 },
      { title: "Al Majaz Waterfront", zh: "马贾兹滨水区", lat: 25.327, lng: 55.385 },
      { title: "Central Souq, Sharjah", zh: "沙迦中央市场", lat: 25.344, lng: 55.389 },
      { title: "Mleiha Archaeological Centre", zh: "姆莱哈考古中心", lat: 25.125, lng: 55.859 },
      { title: "Sharjah Desert Park", zh: "沙迦沙漠公园", lat: 25.289, lng: 55.704 },
    ],
    "hallstatt|austria": [
      { title: "Hallstatt", zh: "哈尔施塔特小镇" },
      { title: "Hallstatt Museum", zh: "哈尔施塔特博物馆" },
      { title: "Hallstätter See", zh: "哈尔施塔特湖" },
      { title: "Salzkammergut", zh: "萨尔茨卡默古特湖区" },
    ],
    "santorini|greece": [
      { title: "Oia, Greece", zh: "伊亚小镇", lat: 36.4618, lng: 25.3753 },
      { title: "Akrotiri (prehistoric city)", zh: "阿克罗蒂里遗址", lat: 36.3514, lng: 25.4036 },
      { title: "Santorini caldera", zh: "圣托里尼火山口", lat: 36.4, lng: 25.4 },
      { title: "Nea Kameni", zh: "尼亚卡梅尼岛", lat: 36.4042, lng: 25.3964 },
    ],
    "mykonos|greece": [
      { title: "Mykonos windmills", zh: "米科诺斯风车", lat: 37.444, lng: 25.3256 },
      {
        title: "Panagia Paraportiani",
        zh: "帕拉波尔蒂尼教堂",
        imageFile: "Church of Panagia Paraportiani.jpg",
        lat: 37.4467,
        lng: 25.3242,
      },
      { title: "Delos", zh: "提洛岛" },
      { title: "Archaeological Museum of Mykonos", zh: "米科诺斯考古博物馆", lat: 37.451, lng: 25.329 },
    ],
    "madeira|portugal": [
      { title: "Funchal", zh: "丰沙尔" },
      {
        title: "Pico do Arieiro",
        zh: "阿雷罗峰",
        imageFile: "View from Miradouro do Pico do Arieiro - Madeira 01.jpg",
      },
      { title: "Cabo Girão", zh: "吉朗角" },
      { title: "Laurisilva of Madeira", zh: "马德拉月桂林", lat: 32.75, lng: -17.0 },
    ],
    "luxor|egypt": [
      { title: "Luxor Temple", zh: "卢克索神庙" },
      { title: "Karnak", zh: "卡纳克神庙" },
      { title: "Valley of the Kings", zh: "帝王谷", lat: 25.7402, lng: 32.6014 },
      {
        title: "Mortuary Temple of Hatshepsut",
        zh: "哈特谢普苏特女王神庙",
        lat: 25.7382,
        lng: 32.6066,
      },
    ],
    "aswan|egypt": [
      { title: "Elephantine", zh: "象岛" },
      { title: "Unfinished obelisk", zh: "未完成方尖碑", lat: 24.0761, lng: 32.8955 },
      { title: "Nubian Museum", zh: "努比亚博物馆", lat: 24.0821, lng: 32.8882 },
      { title: "Aswan Botanical Garden", zh: "阿斯旺植物园" },
    ],
    "sharmelsheikh|egypt": [
      { title: "Ras Muhammad National Park", zh: "拉斯穆罕默德国家公园", lat: 27.7233, lng: 34.2539 },
      { title: "Naama Bay", zh: "纳马湾", lat: 27.9145, lng: 34.3197 },
      { title: "Nabq Protected Area", zh: "纳布克保护区", lat: 28.1095, lng: 34.4162 },
      { title: "Tiran Island", zh: "蒂朗岛", imageFile: "Sharm El-Sheikh, Egypt.jpg", lat: 27.95, lng: 34.55 },
    ],
    "casablanca|morocco": [
      { title: "Hassan II Mosque", zh: "哈桑二世清真寺" },
      { title: "Casablanca Cathedral", zh: "卡萨布兰卡主教座堂", lat: 33.5926, lng: -7.6217 },
      { title: "Casablanca Twin Center", zh: "卡萨布兰卡双子中心" },
      { title: "Mahkama du Pacha", zh: "帕夏法院", lat: 33.5734, lng: -7.5992 },
    ],
    "fes|morocco": [
      { title: "Fes el Bali", zh: "非斯巴厘老城", lat: 34.0648, lng: -4.9731 },
      {
        title: "Al-Attarine Madrasa",
        zh: "阿塔林经学院",
        imageFile: "Al-Attarine Madrasa DSCF3633 (R Prazeres).jpg",
        lat: 34.064,
        lng: -4.9722,
      },
      { title: "University of al-Qarawiyyin", zh: "卡鲁因大学" },
      { title: "Chouara Tannery", zh: "舒瓦拉皮革染坊", lat: 34.0662, lng: -4.9705 },
      { title: "Bab Bou Jeloud", zh: "布日卢蓝门", imageFile: "Fes Bab Bou Jeloud 2011.jpg", lat: 34.0618, lng: -4.9846 },
    ],
    "cork|ireland": [
      { title: "English Market", zh: "英国市场" },
      {
        title: "Saint Fin Barre's Cathedral",
        zh: "圣芬巴尔主教座堂",
        imageFile: "02 St Fin Barre's Cathedral Facade.jpg",
      },
      { title: "Crawford Art Gallery", zh: "克劳福德美术馆" },
      { title: "Elizabeth Fort", zh: "伊丽莎白堡", lat: 51.8952, lng: -8.4806 },
    ],
    "vancouver|canada": [
      { title: "Stanley Park", zh: "斯坦利公园" },
      { title: "Granville Island", zh: "格兰维尔岛" },
      { title: "Canada Place", zh: "加拿大广场" },
      { title: "Vancouver Art Gallery", zh: "温哥华美术馆" },
    ],
    "cancun|mexico": [
      { title: "Isla Mujeres", zh: "女人岛" },
      {
        title: "Cancún Underwater Museum",
        zh: "坎昆水下博物馆",
        imageFile: "DSCN0626 (14108251890).jpg",
        lat: 21.0867,
        lng: -86.7719,
      },
      { title: "Xcaret Park", zh: "西卡莱特公园", lat: 20.5806, lng: -87.1192 },
      { title: "Xel-Ha Park", zh: "谢尔哈公园" },
    ],
    "tulum|mexico": [
      {
        nameEn: "Tulum Archaeological Site",
        zh: "图卢姆玛雅遗址",
        imageFile: "Tulum - 01.jpg",
        lat: 20.2148,
        lng: -87.4299,
      },
      {
        nameEn: "Gran Cenote",
        zh: "大天坑",
        imageFile: "Gran cenote Tulum (20767289564).jpg",
        lat: 20.2479,
        lng: -87.464,
      },
      {
        title: "Sian Ka'an",
        zh: "锡安卡安保护区",
        imageFile: "Biósfera de Sian Kaan Quintana Roo.JPG",
      },
      { title: "Coba", zh: "科巴遗址" },
    ],
    "salvador|brazil": [
      {
        title: "Pelourinho",
        zh: "佩洛里尼奥",
        imageFile: "Centro Histórico Salvador Vista Aérea 2021-0933.jpg",
        lat: -12.9711,
        lng: -38.5089,
      },
      { title: "Elevador Lacerda", zh: "拉塞尔达电梯", lat: -12.9747, lng: -38.5135 },
      {
        title: "Forte de Santo Antônio da Barra",
        zh: "圣安东尼奥达巴拉堡",
        lat: -13.0105,
        lng: -38.5325,
      },
      { title: "Porto da Barra Beach", zh: "巴拉港海滩", lat: -13.0037, lng: -38.5324 },
    ],
    "florianopolis|brazil": [
      {
        title: "Hercílio Luz Bridge",
        zh: "埃尔西利乌·卢斯大桥",
        imageFile: "Ponte Hercilio Luz - Florianopolis - Santa Catarina.jpg",
      },
      { title: "Lagoa da Conceição", zh: "康塞桑泻湖", lat: -27.5949, lng: -48.4598 },
      { title: "Santo Antônio de Lisboa, Santa Catarina", zh: "圣安东尼奥德里斯本街区", lat: -27.5092, lng: -48.5206 },
      { title: "Campeche Island", zh: "坎佩切岛", lat: -27.6942, lng: -48.4675 },
    ],
    "mendoza|argentina": [
      { title: "General San Martín Park", zh: "圣马丁将军公园" },
      {
        title: "Cerro de la Gloria",
        zh: "荣耀山",
        imageFile: "Army of the Andes Monument, Mendoza 01.jpg",
        lat: -32.8892,
        lng: -68.8889,
      },
      { title: "Bodega Catena Zapata", zh: "卡特纳酒庄", lat: -33.0121, lng: -68.8725 },
      { title: "Teatro Independencia", zh: "独立剧院" },
    ],
    "cordoba|argentina": [
      { title: "Jesuit Block and Estancias of Córdoba", zh: "科尔多瓦耶稣会街区和庄园" },
      { title: "Córdoba Cathedral, Argentina", zh: "科尔多瓦主教座堂", lat: -31.4166, lng: -64.1836 },
      {
        title: "Sarmiento Park",
        zh: "萨米恩托公园",
        imageFile: "Parque Sarmiento, Córdoba, Argentina 1.jpg",
        lat: -31.4303,
        lng: -64.1769,
      },
      { title: "Evita Fine Arts Museum", zh: "埃维塔美术馆", lat: -31.427, lng: -64.185 },
      { title: "Paseo del Buen Pastor", zh: "好牧人步道", lat: -31.422, lng: -64.187 },
    ],
    "ushuaia|argentina": [
      { title: "Tierra del Fuego National Park", zh: "火地岛国家公园" },
      { title: "Les Eclaireurs Lighthouse", zh: "莱塞克莱尔灯塔" },
      { title: "Maritime Museum of Ushuaia", zh: "乌斯怀亚海事博物馆", lat: -54.8055, lng: -68.3014 },
      { title: "Beagle Channel", zh: "比格尔海峡", lat: -54.875, lng: -68.25 },
    ],
    "losangeles|unitedstates": [
      { title: "Hollywood Sign", zh: "好莱坞标志" },
      { title: "Hollywood Walk of Fame", zh: "好莱坞星光大道" },
      { title: "Griffith Observatory", zh: "格里菲斯天文台" },
      { title: "Getty Center", zh: "盖蒂中心" },
      { title: "Santa Monica Pier", zh: "圣莫尼卡码头" },
      { title: "Los Angeles County Museum of Art", zh: "洛杉矶郡艺术博物馆" },
      { title: "The Broad", zh: "布洛德博物馆" },
      { title: "Walt Disney Concert Hall", zh: "华特迪士尼音乐厅" },
      { title: "Griffith Park", zh: "格里菲斯公园" },
      { title: "Los Angeles Memorial Coliseum", zh: "洛杉矶纪念体育场" },
    ],
    "lasvegas|unitedstates": [
      { title: "Las Vegas Strip", zh: "拉斯维加斯大道" },
      { title: "Fremont Street Experience", zh: "弗里蒙特街体验" },
      { title: "Bellagio (resort)", zh: "百乐宫" },
      { title: "The Venetian Las Vegas", zh: "威尼斯人酒店" },
      { title: "Sphere (venue)", zh: "Sphere球形馆", lat: 36.1204, lng: -115.1613 },
      { title: "The Strat", zh: "同温层塔" },
      { title: "High Roller (Ferris wheel)", zh: "豪客摩天轮" },
      { title: "Neon Museum", zh: "霓虹博物馆" },
      { title: "Red Rock Canyon National Conservation Area", zh: "红岩峡谷国家保护区" },
      { title: "Hoover Dam", zh: "胡佛水坝" },
    ],
    "goldcoast|australia": [
      { title: "Surfers Paradise, Queensland", zh: "冲浪者天堂" },
      { title: "Q1 (building)", zh: "Q1大厦" },
      { title: "Sea World (Australia)", zh: "澳大利亚海洋世界" },
      { title: "Burleigh Head National Park", zh: "伯利角国家公园" },
    ],
    "queenstown|newzealand": [
      { title: "Lake Wakatipu", zh: "瓦卡蒂普湖" },
      { title: "Skyline Queenstown", zh: "皇后镇天际缆车" },
      { title: "Queenstown Gardens", zh: "皇后镇花园" },
      {
        title: "Kawarau Gorge Suspension Bridge",
        zh: "卡瓦劳峡谷吊桥",
        imageFile: "The Kawarau bridge.jpg",
      },
    ],
  }).map(([key, value]) => [key, value])
);

const ATTRACTION_CLASS_IDS = [
  "Q570116", // tourist attraction
  "Q33506", // museum
  "Q22698", // park
  "Q4989906", // monument
  "Q839954", // archaeological site
  "Q23413", // castle
  "Q16560", // palace
  "Q11303", // skyscraper
  "Q16970", // church
  "Q44539", // temple
  "Q32815", // mosque
  "Q12280", // bridge
  "Q12518", // tower
  "Q1496967", // shopping mall
  "Q15243209", // historic district
  "Q194195", // amusement park
  "Q23442", // island
  "Q62832", // astronomical observatory
  "Q863404", // pier
  "Q207694", // art museum
  "Q24354", // theatre
  "Q811979", // architectural structure
  "Q174782", // lighthouse
  "Q483110", // stadium
];

const EXCLUDED_ATTRACTION_PATTERN =
  /\b(airport|air force|air base|airbase|naval base|military base|historical marker|railway station|metro station|subway station|bus station|station|police|hospital|headquarters|office|bank|power station|circuit|cemetery|interchange|highway)\b/i;
const PRIORITY_ATTRACTION_PATTERN =
  /\b(sign|walk of fame|hollywood|griffith|getty|santa monica|observatory|museum|gallery|park|garden|palace|castle|temple|church|mosque|cathedral|tower|bridge|historic|old town|square|plaza|waterfront|harbour|harbor|strip|bellagio|venetian|sphere|fremont|pier|fort|fortress|monument|theatre|theater|zoo|aquarium|island|beach|market|bazaar|mall|opera|national park|canyon|dam)\b/i;
const WIDE_AREA_CITY_KEYS = new Set([
  "bali|indonesia",
  "goa|india",
  "cappadocia|turkey",
  "madeira|portugal",
  "hawaii|unitedstates",
  "goldcoast|australia",
  "queenstown|newzealand",
  "palawan|philippines",
  "phuquoc|vietnam",
  "boracay|philippines",
  "kohsamui|thailand",
  "langkawi|malaysia",
]);

const TRADITIONAL_TO_SIMPLIFIED = new Map(
  Object.entries({
    臺: "台",
    灣: "湾",
    廣: "广",
    東: "东",
    門: "门",
    園: "园",
    館: "馆",
    宮: "宫",
    樂: "乐",
    標: "标",
    誌: "志",
    賭: "赌",
    萊: "莱",
    塢: "坞",
    聖: "圣",
    羅: "罗",
    馬: "马",
    薩: "萨",
    維: "维",
    納: "纳",
    爾: "尔",
    蘭: "兰",
    亞: "亚",
    國: "国",
    際: "际",
    機: "机",
    場: "场",
    車: "车",
    鐵: "铁",
    橋: "桥",
    區: "区",
    歷: "历",
    術: "术",
    劇: "剧",
    觀: "观",
    廟: "庙",
    濱: "滨",
    島: "岛",
    廳: "厅",
    廈: "厦",
    樓: "楼",
    頭: "头",
    碼: "码",
    長: "长",
    舊: "旧",
    鎮: "镇",
    鄉: "乡",
    莊: "庄",
    牆: "墙",
    鐘: "钟",
    雲: "云",
    愛: "爱",
    麗: "丽",
    榮: "荣",
    華: "华",
    寶: "宝",
    貝: "贝",
    達: "达",
    內: "内",
    緬: "缅",
    靈: "灵",
    隱: "隐",
    濟: "济",
    寧: "宁",
    蘇: "苏",
    錫: "锡",
    鄭: "郑",
    陽: "阳",
    書: "书",
    畫: "画",
    勝: "胜",
    跡: "迹",
    遺: "遗",
    產: "产",
    風: "风",
  })
);

function toSimplifiedChinese(value) {
  return String(value ?? "")
    .split("")
    .map((char) => TRADITIONAL_TO_SIMPLIFIED.get(char) ?? char)
    .join("");
}

function normalizeKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cityLookupKey(city) {
  return `${normalizeKey(city.en)}|${normalizeKey(city.country)}`;
}

function commonsFileImageUrl(fileName) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    fileName
  )}`;
}

function commonsFileSourceUrl(fileName) {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(
    fileName.replaceAll(" ", "_")
  )}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDropdownCities(source) {
  const cities = [];
  let currentCountry = "";

  source.split(/\r?\n/).forEach((line) => {
    const countryMatch = line.match(/^\s{2}(?:"([^"]+)"|([A-Za-z ]+)):\s*\[/);
    if (countryMatch) {
      currentCountry = countryMatch[1] ?? countryMatch[2] ?? "";
    }

    const cityMatch = line.match(
      /\{\s*en:\s*"([^"]+)",\s*zh:\s*"([^"]+)"(?:,\s*aliases:\s*\[([^\]]+)])?/
    );
    if (!cityMatch || !currentCountry) return;

    cities.push({
      country: currentCountry,
      en: cityMatch[1],
      zh: cityMatch[2],
      aliases: Array.from(cityMatch[3]?.matchAll(/"([^"]+)"/g) ?? []).map(
        (match) => match[1]
      ),
    });
  });

  return cities;
}

function itemHasCityKey(item, city) {
  const cityKeys = [city.en, city.zh, ...city.aliases].map(normalizeKey);
  return (item.cityKeys ?? []).some((key) => cityKeys.includes(normalizeKey(key)));
}

function getExistingAttractions(data, city) {
  return data.attractions.filter((item) => itemHasCityKey(item, city));
}

function getExistingCityCard(data, city) {
  return data.cities.find((item) => itemHasCityKey(item, city));
}

async function fetchJson(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      });
    } catch (error) {
      lastError = error;
      await delay(2000 * attempt);
      continue;
    }
    const text = await response.text();
    if (response.ok) return JSON.parse(text);

    if (response.status === 429 || response.status >= 500) {
      await delay(2000 * attempt);
      continue;
    }

    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  throw new Error(
    `Failed after ${attempts} attempts: ${url}${
      lastError instanceof Error ? ` (${lastError.message})` : ""
    }`
  );
}

async function findWikipediaCityPage(city) {
  const override = CITY_TITLE_OVERRIDES.get(cityLookupKey(city));
  const titleCandidates = override ? [override, city.en] : [city.en];

  for (const title of titleCandidates) {
    const direct = await getWikipediaPages({
      titles: title,
      limit: 1,
    });
    const page = direct.find((candidate) => candidate.qid && candidate.coords);
    if (page) return page;
    await delay(DEFAULT_QUERY_DELAY_MS);
  }

  const searchQueries = [
    `${city.en} ${city.country}`,
    `${city.en} ${city.country} city`,
    city.en,
  ];

  for (const query of searchQueries) {
    const candidates = await getWikipediaPages({ search: query, limit: 5 });
    const page = candidates
      .filter((candidate) => candidate.qid && candidate.coords)
      .sort((first, second) => scoreCityPage(second, city) - scoreCityPage(first, city))[0];
    if (page) return page;
    await delay(DEFAULT_QUERY_DELAY_MS);
  }

  return null;
}

function scoreCityPage(page, city) {
  const title = normalizeKey(page.title);
  const cityKey = normalizeKey(city.en);
  const countryKey = normalizeKey(city.country);
  let score = 0;
  if (title === cityKey) score += 30;
  if (title.includes(cityKey)) score += 12;
  if (title.includes(countryKey)) score += 6;
  if (page.description && /city|town|capital|municipality|island/i.test(page.description)) {
    score += 6;
  }
  if (page.imageUrl) score += 4;
  return score;
}

async function getWikipediaPages({ titles, search, limit }) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "pageprops|coordinates|pageimages|description",
    piprop: "original|thumbnail",
    pithumbsize: String(DEFAULT_IMAGE_WIDTH),
    redirects: "1",
    origin: "*",
  });

  if (titles) {
    params.set("titles", titles);
  } else {
    params.set("generator", "search");
    params.set("gsrsearch", search);
    params.set("gsrlimit", String(limit));
  }

  url.search = params;
  const payload = await fetchJson(url);
  const redirectAliases = new Map();
  (payload.query?.redirects ?? []).forEach((redirect) => {
    const aliases = redirectAliases.get(redirect.to) ?? [];
    aliases.push(redirect.from);
    redirectAliases.set(redirect.to, aliases);
  });

  return Object.values(payload.query?.pages ?? {})
    .filter((page) => !page.missing)
    .map((page) => ({
      title: page.title,
      aliases: redirectAliases.get(page.title) ?? [],
      qid: page.pageprops?.wikibase_item,
      coords: page.coordinates?.[0],
      imageUrl: page.thumbnail?.source ?? page.original?.source ?? "",
      originalImageUrl: page.original?.source ?? page.thumbnail?.source ?? "",
      sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(
        page.title.replaceAll(" ", "_")
      )}`,
      description: page.description ?? "",
    }));
}

async function findManualCityImagePage(city, fallbackPage) {
  const manual = MANUAL_CITY_IMAGE_PAGES.get(cityLookupKey(city));
  if (!manual) return fallbackPage;

  if (manual.imageFile) {
    return {
      title: manual.nameEn ?? city.en,
      imageUrl: commonsFileImageUrl(manual.imageFile),
      sourceUrl: commonsFileSourceUrl(manual.imageFile),
    };
  }

  const pages = await getWikipediaPages({
    titles: manual.title,
    limit: 1,
  });
  return pages.find((page) => page.imageUrl) ?? fallbackPage;
}

async function fetchManualAttractionCandidates(cityPage, city) {
  const manualEntries = MANUAL_ATTRACTION_PAGES.get(cityLookupKey(city)) ?? [];
  if (!manualEntries.length) return [];

  const titledEntries = manualEntries.filter((entry) => entry.title);
  const pagesByTitle = new Map();

  if (titledEntries.length) {
    const pages = await getWikipediaPages({
      titles: titledEntries.map((entry) => entry.title).join("|"),
      limit: titledEntries.length,
    });

    pages.forEach((page) => {
      [page.title, ...(page.aliases ?? [])].forEach((title) => {
        pagesByTitle.set(normalizeKey(title), page);
      });
    });
  }

  return manualEntries
    .map((entry) => {
      const page = entry.title ? pagesByTitle.get(normalizeKey(entry.title)) : null;
      const coord =
        entry.lat !== undefined && entry.lng !== undefined
          ? { lat: entry.lat, lng: entry.lng }
          : page?.coords
            ? { lat: page.coords.lat, lng: page.coords.lon }
            : null;
      const imageUrl = entry.imageFile
        ? commonsFileImageUrl(entry.imageFile)
        : page?.imageUrl ?? "";
      const sourceUrl = entry.imageFile
        ? commonsFileSourceUrl(entry.imageFile)
        : page?.sourceUrl ?? "";

      if (!coord || !imageUrl || !sourceUrl) return null;

      return {
        itemUrl: sourceUrl,
        name: entry.zh ?? toSimplifiedChinese(page?.title ?? entry.nameEn ?? ""),
        nameEn: entry.nameEn ?? page?.title ?? entry.title ?? entry.zh,
        description:
          entry.description ??
          toSimplifiedChinese(page?.description ?? "") ??
          "",
        coord,
        distanceKm: distanceKm(
          { lat: cityPage.coords.lat, lng: cityPage.coords.lon },
          coord
        ),
        imageUrl,
        sourceUrl,
        sitelinks: 10000,
      };
    })
    .filter(Boolean);
}

function pointFromWikidata(value) {
  const match = String(value ?? "").match(/Point\(([-0-9.]+) ([-0-9.]+)\)/);
  if (!match) return null;
  return {
    lng: Number(match[1]),
    lat: Number(match[2]),
  };
}

function distanceKm(first, second) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latDelta = toRadians(second.lat - first.lat);
  const lngDelta = toRadians(second.lng - first.lng);
  const firstLat = toRadians(first.lat);
  const secondLat = toRadians(second.lat);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(firstLat) *
      Math.cos(secondLat) *
      Math.sin(lngDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function safeDecodeUrlText(value) {
  try {
    return decodeURIComponent(String(value ?? "").replaceAll("_", " "));
  } catch {
    return String(value ?? "").replaceAll("_", " ");
  }
}

function isSubstantialCityKey(key) {
  if (!key) return false;
  return /^[a-z0-9]+$/.test(key) ? key.length >= 4 : key.length >= 2;
}

function hasOtherDropdownCityName(candidate, city, allCities) {
  const currentKeys = new Set(
    [city.en, city.zh, ...city.aliases].map(normalizeKey)
  );
  const haystack = normalizeKey(
    `${candidate.name} ${candidate.nameEn} ${safeDecodeUrlText(candidate.sourceUrl)}`
  );

  return (allCities ?? []).some((otherCity) => {
    const isCurrentCity = [otherCity.en, otherCity.zh, ...otherCity.aliases]
      .map(normalizeKey)
      .some((key) => currentKeys.has(key));
    if (isCurrentCity) return false;

    return [otherCity.en, otherCity.zh, ...otherCity.aliases]
      .map(normalizeKey)
      .some((key) => isSubstantialCityKey(key) && haystack.includes(key));
  });
}

function wikidataBindingToCandidate(binding, centerCoords) {
  const coord = pointFromWikidata(binding.coord?.value);
  if (!coord) return null;

  const name =
    binding.labelZhCn?.value ??
    binding.labelZhHans?.value ??
    binding.labelZh?.value ??
    binding.labelEn?.value ??
    binding.itemLabel?.value ??
    "";
  const nameEn = binding.labelEn?.value ?? name;
  const description =
    binding.descZhCn?.value ??
    binding.descZhHans?.value ??
    binding.descZh?.value ??
    binding.descEn?.value ??
    "";

  return {
    itemUrl: binding.item?.value ?? "",
    name: toSimplifiedChinese(name),
    nameEn,
    description: toSimplifiedChinese(description),
    coord,
    distanceKm: distanceKm(
      { lat: centerCoords.lat, lng: centerCoords.lon },
      coord
    ),
    imageUrl: binding.image?.value ?? "",
    sourceUrl: binding.article?.value ?? binding.item?.value ?? "",
    sitelinks: Number(binding.sitelinks?.value ?? 0),
  };
}

function isValidAttractionCandidate(item, city, allCities, maxDistanceKm) {
  return (
    item &&
    item.name &&
    item.coord &&
    item.imageUrl &&
    item.sourceUrl &&
    item.distanceKm <= maxDistanceKm &&
    !EXCLUDED_ATTRACTION_PATTERN.test(
      `${item.name} ${item.nameEn} ${item.description}`
    ) &&
    !hasOtherDropdownCityName(item, city, allCities)
  );
}

async function fetchAdministrativeAttractionCandidates(cityPage, city, allCities) {
  const classes = ATTRACTION_CLASS_IDS.map((id) => `wd:${id}`).join(" ");
  const qid = cityPage.qid;
  const query = `SELECT DISTINCT ?item ?itemLabel ?labelZhCn ?labelZhHans ?labelZh ?labelEn ?descZhCn ?descZhHans ?descZh ?descEn ?coord ?image ?article ?sitelinks WHERE {
    VALUES ?class { ${classes} }
    {
      ?item wdt:P131* wd:${qid}.
    } UNION {
      ?item wdt:P276/wdt:P131* wd:${qid}.
    } UNION {
      ?item wdt:P706 wd:${qid}.
    }
    ?item wdt:P625 ?coord.
    ?item wdt:P18 ?image.
    ?item wikibase:sitelinks ?sitelinks.
    ?item wdt:P31/wdt:P279* ?class.
    FILTER(?item != wd:${qid})
    OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. }
    OPTIONAL { ?item rdfs:label ?labelZhCn FILTER(LANG(?labelZhCn) = "zh-cn") }
    OPTIONAL { ?item rdfs:label ?labelZhHans FILTER(LANG(?labelZhHans) = "zh-hans") }
    OPTIONAL { ?item rdfs:label ?labelZh FILTER(LANG(?labelZh) = "zh") }
    OPTIONAL { ?item rdfs:label ?labelEn FILTER(LANG(?labelEn) = "en") }
    OPTIONAL { ?item schema:description ?descZhCn FILTER(LANG(?descZhCn) = "zh-cn") }
    OPTIONAL { ?item schema:description ?descZhHans FILTER(LANG(?descZhHans) = "zh-hans") }
    OPTIONAL { ?item schema:description ?descZh FILTER(LANG(?descZh) = "zh") }
    OPTIONAL { ?item schema:description ?descEn FILTER(LANG(?descEn) = "en") }
    BIND(COALESCE(?labelZhCn, ?labelZhHans, ?labelZh, ?labelEn) AS ?itemLabel)
  } ORDER BY DESC(?sitelinks) LIMIT 60`;

  const url = new URL("https://query.wikidata.org/sparql");
  url.search = new URLSearchParams({ query, format: "json" });
  const payload = await fetchJson(url);
  const maxDistanceKm = WIDE_AREA_CITY_KEYS.has(cityLookupKey(city)) ? 120 : 50;
  return payload.results.bindings
    .map((binding) => wikidataBindingToCandidate(binding, cityPage.coords))
    .filter((item) =>
      isValidAttractionCandidate(item, city, allCities, maxDistanceKm)
    )
    .sort((first, second) => attractionScore(second) - attractionScore(first));
}

async function fetchAttractionCandidates(cityPage, radius = 45, city, allCities) {
  const classes = ATTRACTION_CLASS_IDS.map((id) => `wd:${id}`).join(" ");
  const qid = cityPage.qid;
  const coords = cityPage.coords;
  const query = `SELECT DISTINCT ?item ?itemLabel ?labelZhCn ?labelZhHans ?labelZh ?labelEn ?descZhCn ?descZhHans ?descZh ?descEn ?coord ?image ?article ?sitelinks WHERE {
    SERVICE wikibase:around {
      ?item wdt:P625 ?coord.
      bd:serviceParam wikibase:center "Point(${coords.lon} ${coords.lat})"^^geo:wktLiteral.
      bd:serviceParam wikibase:radius "${radius}".
    }
    ?item wdt:P18 ?image.
    ?item wikibase:sitelinks ?sitelinks.
    ?item wdt:P31/wdt:P279* ?class.
    VALUES ?class { ${classes} }
    FILTER(?item != wd:${qid})
    OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. }
    OPTIONAL { ?item rdfs:label ?labelZhCn FILTER(LANG(?labelZhCn) = "zh-cn") }
    OPTIONAL { ?item rdfs:label ?labelZhHans FILTER(LANG(?labelZhHans) = "zh-hans") }
    OPTIONAL { ?item rdfs:label ?labelZh FILTER(LANG(?labelZh) = "zh") }
    OPTIONAL { ?item rdfs:label ?labelEn FILTER(LANG(?labelEn) = "en") }
    OPTIONAL { ?item schema:description ?descZhCn FILTER(LANG(?descZhCn) = "zh-cn") }
    OPTIONAL { ?item schema:description ?descZhHans FILTER(LANG(?descZhHans) = "zh-hans") }
    OPTIONAL { ?item schema:description ?descZh FILTER(LANG(?descZh) = "zh") }
    OPTIONAL { ?item schema:description ?descEn FILTER(LANG(?descEn) = "en") }
    BIND(COALESCE(?labelZhCn, ?labelZhHans, ?labelZh, ?labelEn) AS ?itemLabel)
  } ORDER BY DESC(?sitelinks) LIMIT 35`;

  const url = new URL("https://query.wikidata.org/sparql");
  url.search = new URLSearchParams({ query, format: "json" });
  const payload = await fetchJson(url);
  return payload.results.bindings
    .map((binding) => wikidataBindingToCandidate(binding, coords))
    .filter((item) =>
      isValidAttractionCandidate(item, city, allCities, radius + 2)
    )
    .sort((first, second) => attractionScore(second) - attractionScore(first));
}

function attractionScore(item) {
  let score = item.sitelinks;
  if (PRIORITY_ATTRACTION_PATTERN.test(`${item.name} ${item.nameEn} ${item.description}`)) {
    score += 40;
  }
  if (item.sourceUrl.includes("wikipedia.org/wiki/")) score += 10;
  if (item.description) score += 4;
  score -= Math.min(item.distanceKm ?? 0, 80) * 1.4;
  return score;
}

function uniqueAttractions(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = normalizeKey(candidate.nameEn || candidate.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchWikipediaFallbackCandidates(cityPage, city) {
  const searches = [
    `${city.en} tourist attractions`,
    `${city.en} landmarks`,
    `${city.en} museum`,
    `${city.en} park palace castle cathedral`,
    `${city.en} old town waterfront`,
  ];
  const pages = [];

  for (const search of searches) {
    try {
      pages.push(...(await getWikipediaPages({ search, limit: 10 })));
    } catch {
      // keep trying the other fallback searches
    }
    await delay(DEFAULT_QUERY_DELAY_MS);
  }

  const cityTitleKey = normalizeKey(cityPage.title);
  return pages
    .map((page) => {
      if (!page.coords) return null;
      const coord = { lat: page.coords.lat, lng: page.coords.lon };
      const candidate = {
        itemUrl: page.sourceUrl,
        name: toSimplifiedChinese(page.title),
        nameEn: page.title,
        description: toSimplifiedChinese(page.description ?? ""),
        coord,
        distanceKm: distanceKm(
          { lat: cityPage.coords.lat, lng: cityPage.coords.lon },
          coord
        ),
        imageUrl: page.imageUrl,
        sourceUrl: page.sourceUrl,
        sitelinks: 0,
      };
      return candidate;
    })
    .filter(
      (candidate) =>
        candidate &&
        normalizeKey(candidate.nameEn) !== cityTitleKey &&
        candidate.imageUrl &&
        candidate.sourceUrl &&
        candidate.distanceKm <= 80 &&
        !FALLBACK_PAGE_EXCLUDE_PATTERN.test(candidate.nameEn) &&
        !EXCLUDED_ATTRACTION_PATTERN.test(
          `${candidate.name} ${candidate.nameEn} ${candidate.description}`
        ) &&
        !hasOtherDropdownCityName(candidate, city, dropdownCities)
    )
    .sort((first, second) => attractionScore(second) - attractionScore(first));
}

function imageUrlForDownload(imageUrl) {
  if (!imageUrl) return "";
  if (imageUrl.includes("Special:FilePath/")) {
    return imageUrl.replace(/^http:/, "https:") + `?width=${DEFAULT_IMAGE_WIDTH}`;
  }
  return imageUrl.replace(/^http:/, "https:");
}

function extensionForContentType(contentType) {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  return "";
}

async function downloadImage(url, baseRelativePath, options = {}) {
  const targetBase = path.join(publicRoot, baseRelativePath);
  const existing = options.force ? null : await findExistingImage(targetBase);
  if (existing) return existing;

  const normalizedUrl = url.replace(/^http:/, "https:");
  const preferredUrl = imageUrlForDownload(url);
  let response;
  try {
    response = await fetchWithRetry(preferredUrl);
  } catch (error) {
    if (preferredUrl === normalizedUrl) throw error;
    response = await fetchWithRetry(normalizedUrl);
  }
  const contentType = response.headers.get("content-type") ?? "";
  const ext = extensionForContentType(contentType);
  if (!ext) {
    throw new Error(`Unsupported image content type ${contentType} for ${url}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const outputPath = `${targetBase}${ext}`;
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, bytes);
  await delay(DEFAULT_DOWNLOAD_DELAY_MS);
  return `/${path.relative(publicRoot, outputPath).replaceAll(path.sep, "/")}`;
}

async function findExistingImage(targetBase) {
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    const candidate = `${targetBase}${ext}`;
    try {
      await fs.access(candidate);
      return `/${path.relative(publicRoot, candidate).replaceAll(path.sep, "/")}`;
    } catch {
      // keep looking
    }
  }
  return null;
}

async function fetchWithRetry(url, attempts = IMAGE_DOWNLOAD_ATTEMPTS) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "follow",
        headers: { "User-Agent": USER_AGENT },
      });
    } catch (error) {
      lastError = error;
      await delay(2500 * attempt);
      continue;
    }
    if (response.ok) return response;
    if (response.status === 429 || response.status >= 500) {
      await delay(2500 * attempt);
      continue;
    }
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  throw new Error(
    `Failed image download after ${attempts} attempts: ${url}${
      lastError instanceof Error ? ` (${lastError.message})` : ""
    }`
  );
}

function buildCityKeys(city) {
  return Array.from(new Set([city.en, city.zh, ...city.aliases, normalizeKey(city.en)]))
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function buildDescription(candidate, city) {
  if (/[\u3400-\u9fff]/.test(candidate.description)) return candidate.description;
  return `${city.zh}可安排的代表性景点，适合加入当地观光动线。`;
}

async function writeCardData(data) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await fs.writeFile(cardDataPath, text, "utf8");
      return;
    } catch (error) {
      if (attempt === 5) throw error;
      await delay(250 * attempt);
    }
  }
}

async function enrichCity(data, city) {
  if (shouldRefresh) {
    data.cities = data.cities.filter((item) => !itemHasCityKey(item, city));
    data.attractions = data.attractions.filter(
      (item) => !itemHasCityKey(item, city)
    );
  }

  const existingCityCard = getExistingCityCard(data, city);
  const existingAttractions = getExistingAttractions(data, city);
  if (
    existingCityCard &&
    existingAttractions.length >= MIN_ATTRACTIONS_PER_CITY
  ) {
    return { city, status: "skipped", reason: "already-covered" };
  }

  const cityPage = await findWikipediaCityPage(city);
  if (!cityPage) {
    return { city, status: "failed", reason: "city-page-not-found" };
  }

  const cityImagePage = await findManualCityImagePage(city, cityPage);
  let cityImageSrc = existingCityCard?.imageSrc;
  if (!cityImageSrc && cityImagePage.imageUrl) {
    cityImageSrc = await downloadImage(
      cityImagePage.imageUrl,
      `travel/cities/${slugify(city.en)}`,
      { force: shouldRefresh }
    );
  }

  if (!existingCityCard && cityImageSrc) {
    data.cities.push({
      cityKeys: buildCityKeys(city),
      cityLabel: city.zh,
      imageSrc: cityImageSrc,
      sourceUrl: cityImagePage.sourceUrl,
    });
  }

  const needed = Math.max(0, MIN_ATTRACTIONS_PER_CITY - existingAttractions.length);
  if (needed === 0) {
    return { city, status: "updated", addedAttractions: 0 };
  }

  const errors = [];
  let candidates = await fetchManualAttractionCandidates(cityPage, city);
  if (!WIKIPEDIA_FALLBACK_ONLY && candidates.length < needed) {
    try {
      candidates = uniqueAttractions([
        ...candidates,
        ...(await fetchAdministrativeAttractionCandidates(
          cityPage,
          city,
          dropdownCities
        )),
      ]);
      if (candidates.length < needed) {
        await delay(DEFAULT_QUERY_DELAY_MS);
      }
      candidates = uniqueAttractions([
        ...candidates,
        ...(await fetchAttractionCandidates(cityPage, 24, city, dropdownCities)),
      ]);
      if (candidates.length < needed) {
        await delay(DEFAULT_QUERY_DELAY_MS);
        candidates = uniqueAttractions([
          ...candidates,
          ...(await fetchAttractionCandidates(cityPage, 45, city, dropdownCities)),
        ]);
      }
      if (candidates.length < needed) {
        await delay(DEFAULT_QUERY_DELAY_MS);
        candidates = uniqueAttractions([
          ...candidates,
          ...(await fetchAttractionCandidates(cityPage, 80, city, dropdownCities)),
        ]);
      }
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  if (candidates.length < needed) {
    candidates = uniqueAttractions([
      ...candidates,
      ...(await fetchWikipediaFallbackCandidates(cityPage, city)),
    ]);
  }

  const existingNames = new Set(
    existingAttractions.map((item) => normalizeKey(item.name))
  );
  let added = 0;

  for (
    let index = 0;
    index < candidates.length && added < needed;
    index += IMAGE_DOWNLOAD_BATCH_SIZE
  ) {
    const batch = candidates
      .slice(index, index + IMAGE_DOWNLOAD_BATCH_SIZE)
      .filter((candidate) => !existingNames.has(normalizeKey(candidate.name)));

    const downloaded = await Promise.allSettled(
      batch.map(async (candidate) => {
        const imageSrc = await downloadImage(
          candidate.imageUrl,
          `travel/attractions/${slugify(city.en)}-${slugify(candidate.nameEn || candidate.name)}`,
          { force: shouldRefresh }
        );
        return { candidate, imageSrc };
      })
    );

    for (const result of downloaded) {
      if (added >= needed) break;
      if (result.status === "rejected") {
        errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
        continue;
      }

      const { candidate, imageSrc } = result.value;
      const candidateKey = normalizeKey(candidate.name);
      if (existingNames.has(candidateKey)) continue;

      data.attractions.push({
        cityKeys: buildCityKeys(city),
        cityLabel: city.zh,
        name: candidate.name,
        location: candidate.nameEn || candidate.name,
        imageSrc,
        sourceUrl: candidate.sourceUrl,
        description: buildDescription(candidate, city),
        aliases: Array.from(new Set([candidate.nameEn, candidate.name].filter(Boolean))),
        lat: Number(candidate.coord.lat.toFixed(6)),
        lng: Number(candidate.coord.lng.toFixed(6)),
      });
      existingNames.add(candidateKey);
      added += 1;
    }
  }

  return {
    city,
    status: added >= needed ? "updated" : "partial",
    addedAttractions: added,
    needed,
    errors,
  };
}

async function main() {
  const source = await fs.readFile(locationsPath, "utf8");
  const allCities = parseDropdownCities(source);
  dropdownCities = allCities;
  const data = JSON.parse(await fs.readFile(cardDataPath, "utf8"));
  const targetCities = cityFilters.length
    ? allCities.filter((city) =>
        [city.en, city.zh, city.country, ...city.aliases]
          .map(normalizeKey)
          .some((key) => cityFilters.includes(key))
      )
    : allCities;

  const report = [];
  for (const city of targetCities) {
    let result;
    try {
      result = await enrichCity(data, city);
    } catch (error) {
      result = {
        city,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
    report.push(result);
    console.log(
      `${result.status.toUpperCase()} ${city.en} (${city.country}) ${
        result.addedAttractions !== undefined
          ? `+${result.addedAttractions} attractions`
          : result.reason ?? ""
      }`
    );
    if (result.errors?.length) {
      console.log(`  ${result.errors.slice(0, 2).join(" | ")}`);
    }
    if (shouldWrite && !shouldDryRun) {
      await writeCardData(data);
    }
    await delay(DEFAULT_QUERY_DELAY_MS);
  }

  const summary = {
    write: shouldWrite && !shouldDryRun,
    requestedCities: targetCities.length,
    updated: report.filter((item) => item.status === "updated").length,
    partial: report.filter((item) => item.status === "partial").length,
    failed: report.filter((item) => item.status === "failed").length,
    skipped: report.filter((item) => item.status === "skipped").length,
    partialCities: report
      .filter((item) => item.status === "partial" || item.status === "failed")
      .map((item) => ({
        city: item.city.en,
        country: item.city.country,
        status: item.status,
        reason: item.reason,
        errors: item.errors?.slice(0, 3) ?? [],
      })),
  };

  console.log(JSON.stringify(summary, null, 2));
  if (summary.partial || summary.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
