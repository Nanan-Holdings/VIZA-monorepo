import type { TravelField, TravelState } from "@/lib/travel/planner";

export type TravelPlannerCopy = {
  fieldQuestions: Record<TravelField, string>;
  optional: string;
  featured: string;
  otherCountry: string;
  otherCity: string;
  search: string;
  noMatch: string;
  loadingCountry: string;
  chooseCountry: string;
  customCountryPlaceholder: string;
  confirmCountry: string;
  noMoreCountries: string;
  chooseCitiesAfterCountry: string;
  loadingCity: string;
  chooseCity: string;
  customCityPlaceholder: string;
  loadedCityCount: (count: string) => string;
  confirmCity: string;
  noMoreCities: string;
  selectedDestinations: (destinations: string, suffix?: string) => string;
  addDestinations: string;
  destinationsDone: string;
  chooseAdditionalCountry: string;
  chooseAdditionalCountryPlaceholder: string;
  back: string;
  nextChooseCities: string;
  chooseAdditionalCity: string;
  chooseAdditionalCityPlaceholder: string;
  adding: (countries: string, cities: string) => string;
  previous: string;
  addTheseDestinations: string;
  flexibleTravel: string;
  fixedDate: string;
  flexibleDateHint: (date: string) => string;
  invalidDate: string;
  confirmDate: string;
  daysPlaceholder: string;
  minimumDaysHint: (count: number, days: number) => string;
  minimumDaysError: (days: number) => string;
  confirmDays: string;
  flexibleDaysLabel: (days: number) => string;
  flexibleDaysHint: (days: number) => string;
  travelersPlaceholder: string;
  travelersError: string;
  confirmTravelers: string;
  flexibleTravelersLabel: (travelers: number) => string;
  flexibleTravelersHint: (travelers: number) => string;
  budgetPlaceholder: string;
  budgetError: string;
  confirmBudget: string;
  flexibleBudgetLabel: (budget: number) => string;
  flexibleBudgetHint: (budget: number) => string;
  loadingIp: string;
  ipDetected: (location: string) => string;
  confirm: string;
  chooseDifferent: string;
  manualEndpointHint: string;
  noIpLocation: string;
  manualChoose: string;
  originCity: string;
  returnCity: string;
  chooseOriginCountry: string;
  originCountryInput: string;
  chooseOriginCountryFirst: string;
  customOriginCityHint: string;
  chooseOriginCity: string;
  loadedCities: (country: string, count: number) => string;
  originCityInput: string;
  chooseReturnCountry: string;
  returnCountryInput: string;
  chooseReturnCountryFirst: string;
  customReturnCityHint: string;
  chooseReturnCity: string;
  returnCityInput: string;
  confirmEndpoints: string;
  orderHint: string;
  orderIncomplete: string;
  orderInvalid: string;
  confirmOrder: string;
  loadingFlights: string;
  flightsUnavailable: (error: string) => string;
  noFlightLegs: string;
  skipFlight: string;
  leg: (index: number, from: string, to: string) => string;
  chooseFlight: string;
  flightSkipped: string;
  flightDetails: string;
  airline: string;
  price: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: string;
  departureAirport: string;
  arrivalAirport: string;
  cabin: string;
  flightNumber: string;
  aircraft: string;
  offerToken: string;
  bookFlight: string;
  source: string;
  unknown: string;
  nonstop: string;
  connection: (count: number) => string;
  confirmFlights: string;
  invalidFlight: (index: number) => string;
  expiredFlight: (index: number) => string;
  loadingHotels: string;
  hotelsUnavailable: (error: string) => string;
  noHotels: string;
  selfArrangeHotel: string;
  stay: (index: number, city: string, checkIn: string, checkOut: string, nights: number) => string;
  chooseHotel: string;
  hotelSelfArranged: string;
  hotelDetails: string;
  name: string;
  averageNight: string;
  totalPrice: string;
  taxes: string;
  rating: string;
  notAvailable: string;
  coordinates: string;
  distanceToCenter: string;
  checkIn: string;
  checkOut: string;
  hotelLink: string;
  confirmHotels: string;
  invalidHotel: (city: string) => string;
  expiredHotel: (city: string) => string;
  finalNote: string;
  finalNotePlaceholder: string;
  confirmNote: string;
  countryRequired: string;
  cityRequired: string;
  additionalCountryRequired: string;
  additionalCityRequired: string;
  endpointsRequired: string;
  noIpCity: string;
  ipConfirmed: (label: string) => string;
  flightFallback: (order: number) => string;
  hotelFallback: (order: number) => string;
  unknownPrice: string;
  departureUnknown: string;
  unknownRating: string;
  selfArrangeValue: string;
};

const EN: TravelPlannerCopy = {
  fieldQuestions: {
    country: "Which countries would you like to visit? You can search and select multiple.",
    cities: "Which cities would you like to visit? You can search and select multiple.",
    destination_confirmation: "Would you like to add another country or city?",
    departure_date: "When will you travel? Choose flexible dates or a specific date.",
    travel_days: "How many days will this trip last? You can also plan flexibly for now.",
    travelers: "How many people are travelling? You can also use a flexible estimate for now.",
    budget: "What is your total budget (RMB)? You can also use a flexible estimate for now.",
    origin: "Where will you depart from and return to?",
    travel_order: "Adjust the order of your destinations.",
    flight_selection: "Choose a flight for each leg, or skip a leg if you will use other transport.",
    hotel_selection: "Choose a hotel for each city in your itinerary.",
    final_note: "Add any preferences, restrictions, or special requests before we build the itinerary.",
  },
  optional: "Optional",
  featured: "Popular",
  otherCountry: "Other (custom country)",
  otherCity: "Other (custom city)",
  search: "Search…",
  noMatch: "No matches found",
  loadingCountry: "Loading countries…",
  chooseCountry: "Select countries (multiple allowed)",
  customCountryPlaceholder: "Enter other countries (comma-separated)",
  confirmCountry: "Confirm countries",
  noMoreCountries: "No more countries",
  chooseCitiesAfterCountry: "Select a country first, then choose cities",
  loadingCity: "Loading cities…",
  chooseCity: "Select cities (multiple allowed)",
  customCityPlaceholder: "Enter other cities (comma-separated)",
  loadedCityCount: (count) => `Cities loaded: ${count}`,
  confirmCity: "Confirm cities",
  noMoreCities: "No more cities",
  selectedDestinations: (destinations, suffix = "") => `Selected destinations: ${destinations}${suffix}`,
  addDestinations: "Add more destinations",
  destinationsDone: "These destinations are enough",
  chooseAdditionalCountry: "Choose countries to add",
  chooseAdditionalCountryPlaceholder: "Select countries to add (multiple allowed)",
  back: "Back",
  nextChooseCities: "Next: choose cities",
  chooseAdditionalCity: "Choose cities to add",
  chooseAdditionalCityPlaceholder: "Select cities to add (multiple allowed)",
  adding: (countries, cities) => `Adding: ${countries}${cities ? ` · ${cities}` : ""}`,
  previous: "Previous",
  addTheseDestinations: "Add these destinations",
  flexibleTravel: "Flexible dates",
  fixedDate: "Specific date",
  flexibleDateHint: (date) => `Flexible planning will start with ${date} (two months from now).`,
  invalidDate: "Please choose a valid travel date.",
  confirmDate: "Confirm travel dates",
  daysPlaceholder: "Enter total trip days (positive integer)",
  minimumDaysHint: (count, days) => `${count} cities selected; the trip must be at least ${days} days.`,
  minimumDaysError: (days) => `Trip length must be at least ${days} days.`,
  confirmDays: "Confirm trip length",
  flexibleDaysLabel: (days) => `Flexible trip length: planning for ${days} days for now.`,
  flexibleDaysHint: (days) => `Flexible planning will start with ${days} days.`,
  travelersPlaceholder: "Enter number of travellers (positive integer)",
  travelersError: "The number of travellers must be a positive integer.",
  confirmTravelers: "Confirm travellers",
  flexibleTravelersLabel: (travelers) => `Flexible group size: planning for ${travelers} travellers for now.`,
  flexibleTravelersHint: (travelers) => `Flexible planning will start with ${travelers} travellers.`,
  budgetPlaceholder: "Enter budget (RMB, positive integer)",
  budgetError: "Budget must be a positive integer.",
  confirmBudget: "Confirm budget",
  flexibleBudgetLabel: (budget) => `Flexible budget: planning with RMB ${budget} for now.`,
  flexibleBudgetHint: (budget) => `Flexible planning will start with a RMB ${budget} budget.`,
  loadingIp: "Using your IP location to suggest departure and return cities…",
  ipDetected: (location) => `Your current location appears to be ${location}. Use it for both departure and return?`,
  confirm: "Confirm",
  chooseDifferent: "Choose different cities",
  manualEndpointHint: "If your location is unavailable, choose departure and return cities manually.",
  noIpLocation: "We could not identify your current city. Please choose departure and return cities manually.",
  manualChoose: "Choose manually",
  originCity: "Departure city",
  returnCity: "Return city",
  chooseOriginCountry: "Select departure country",
  originCountryInput: "Enter departure country",
  chooseOriginCountryFirst: "Select a departure country first",
  customOriginCityHint: "Choose Other to enter a departure city",
  chooseOriginCity: "Select departure city",
  loadedCities: (country, count) => `${country}: ${count} cities loaded`,
  originCityInput: "Enter departure city",
  chooseReturnCountry: "Select return country",
  returnCountryInput: "Enter return country",
  chooseReturnCountryFirst: "Select a return country first",
  customReturnCityHint: "Choose Other to enter a return city",
  chooseReturnCity: "Select return city",
  returnCityInput: "Enter return city",
  confirmEndpoints: "Confirm departure and return cities",
  orderHint: "After confirming the order, you will choose flights and then hotels.",
  orderIncomplete: "Your order must include every selected city.",
  orderInvalid: "Your order includes a city that is not selected.",
  confirmOrder: "Confirm order",
  loadingFlights: "Loading flight options…",
  flightsUnavailable: (error) => `The flight service is temporarily unavailable. Please try again later. (${error})`,
  noFlightLegs: "No flight legs are available.",
  skipFlight: "Skip this leg (other transport)",
  leg: (index, from, to) => `Leg ${index}: ${from} → ${to}`,
  chooseFlight: "Choose a flight or skip",
  flightSkipped: "This leg will be skipped.",
  flightDetails: "Flight details",
  airline: "Airline",
  price: "Price",
  departureTime: "Departure",
  arrivalTime: "Arrival",
  duration: "Duration",
  stops: "Stops",
  departureAirport: "Departure airport",
  arrivalAirport: "Arrival airport",
  cabin: "Cabin",
  flightNumber: "Flight number",
  aircraft: "Aircraft",
  offerToken: "Offer token",
  bookFlight: "Book flight",
  source: "Source",
  unknown: "Unknown",
  nonstop: "Non-stop",
  connection: (count) => `${count} connection${count === 1 ? "" : "s"}`,
  confirmFlights: "Confirm flight choices",
  invalidFlight: (index) => `The selection for leg ${index} is invalid. Please choose again.`,
  expiredFlight: (index) => `The flight for leg ${index} is no longer available. Please choose again.`,
  loadingHotels: "Loading hotel options…",
  hotelsUnavailable: (error) => `The hotel service is temporarily unavailable. Please try again later. (${error})`,
  noHotels: "No hotel options are available.",
  selfArrangeHotel: "Do not choose a hotel (arrange it yourself)",
  stay: (index, city, checkIn, checkOut, nights) => `City ${index}: ${city} (${checkIn}–${checkOut}, ${nights} nights)`,
  chooseHotel: "Choose a hotel",
  hotelSelfArranged: "You will arrange accommodation for this city yourself.",
  hotelDetails: "Hotel details",
  name: "Name",
  averageNight: "Average per night",
  totalPrice: "Total price",
  taxes: "Taxes and fees",
  rating: "Rating",
  notAvailable: "Not available",
  coordinates: "Coordinates",
  distanceToCenter: "Distance to centre",
  checkIn: "Check-in",
  checkOut: "Check-out",
  hotelLink: "Hotel website / link",
  confirmHotels: "Confirm hotel choices",
  invalidHotel: (city) => `The hotel selection for ${city} is invalid. Please choose again.`,
  expiredHotel: (city) => `The hotel selection for ${city} is no longer available. Please choose again.`,
  finalNote: "Preferences and attachments",
  finalNotePlaceholder: "For example: a slower pace; no seafood; family-friendly activities each day.",
  confirmNote: "Confirm notes and build itinerary",
  countryRequired: "Please select at least one country.",
  cityRequired: "Please select at least one city.",
  additionalCountryRequired: "Please select at least one country to add.",
  additionalCityRequired: "Please select at least one city to add.",
  endpointsRequired: "Please confirm both departure and return countries and cities.",
  noIpCity: "We could not identify a current city. Please choose manually.",
  ipConfirmed: (label) => `Departure and return cities confirmed: ${label}`,
  flightFallback: (order) => `Option ${order}`,
  hotelFallback: (order) => `Hotel option ${order}`,
  unknownPrice: "Price unknown",
  departureUnknown: "Departure time unknown",
  unknownRating: "No rating",
  selfArrangeValue: "Arrange accommodation yourself",
};

const ZH: TravelPlannerCopy = {
  ...EN,
  fieldQuestions: {
    country: "请选择要去的国家（可搜索并多选）。",
    cities: "请选择要去的城市（可搜索并多选）。",
    destination_confirmation: "还要添加其他国家或城市吗？",
    departure_date: "请选择出行日期：可以灵活出行，也可以指定日期。",
    travel_days: "请输入本次旅行的总天数，也可以先按灵活方案规划。",
    travelers: "请输入旅行人数，也可以先按灵活人数规划。",
    budget: "请输入总预算（人民币），也可以先按灵活预算规划。",
    origin: "请填写出发城市和返程城市。",
    travel_order: "请调整游玩顺序。",
    flight_selection: "请为每段行程选择航班；如使用其他交通方式，也可以跳过该段。",
    hotel_selection: "请按游玩顺序为每个城市选择酒店。",
    final_note: "可补充偏好、禁忌或特殊需求，再生成行程。",
  },
  optional: "可选",
  featured: "热门",
  otherCountry: "其他（自定义国家）",
  otherCity: "其他（自定义城市）",
  search: "搜索…",
  noMatch: "没有匹配项",
  loadingCountry: "正在加载国家…",
  chooseCountry: "请选择国家（可多选）",
  customCountryPlaceholder: "输入其他国家（可填写多个，用逗号分隔）",
  confirmCountry: "确认国家",
  noMoreCountries: "没有其他国家了",
  chooseCitiesAfterCountry: "请先选择国家，再选择城市",
  loadingCity: "正在加载城市…",
  chooseCity: "请选择城市（可多选）",
  customCityPlaceholder: "输入其他城市（可填写多个，用逗号分隔）",
  loadedCityCount: (count) => `已加载城市：${count}`,
  confirmCity: "确认城市",
  noMoreCities: "没有其他城市了",
  selectedDestinations: (destinations, suffix = "") => `已选目的地：${destinations}${suffix}`,
  addDestinations: "继续添加目的地",
  destinationsDone: "以上就是全部目的地",
  chooseAdditionalCountry: "先选择要追加的国家",
  chooseAdditionalCountryPlaceholder: "选择要追加的国家（可多选）",
  back: "返回",
  nextChooseCities: "下一步：选择城市",
  chooseAdditionalCity: "再选择要追加的城市",
  chooseAdditionalCityPlaceholder: "选择要追加的城市（可多选）",
  adding: (countries, cities) => `正在添加：${countries}${cities ? ` · ${cities}` : ""}`,
  previous: "上一步",
  addTheseDestinations: "加入这些目的地",
  flexibleTravel: "灵活出行",
  fixedDate: "指定日期",
  flexibleDateHint: (date) => `灵活出行会先按 ${date}（两个月后）规划。`,
  invalidDate: "请选择有效的出行日期。",
  confirmDate: "确认出行日期",
  daysPlaceholder: "请输入总出行天数（正整数）",
  minimumDaysHint: (count, days) => `已选 ${count} 个城市，出行天数至少为 ${days} 天。`,
  minimumDaysError: (days) => `出行天数必须不少于 ${days} 天。`,
  confirmDays: "确认出行天数",
  flexibleDaysLabel: (days) => `天数先灵活，暂按 ${days} 天规划。`,
  flexibleDaysHint: (days) => `天数灵活，先按 ${days} 天规划。`,
  travelersPlaceholder: "请输入旅行人数（正整数）",
  travelersError: "旅行人数必须是正整数。",
  confirmTravelers: "确认人数",
  flexibleTravelersLabel: (travelers) => `人数先灵活，暂按 ${travelers} 人规划。`,
  flexibleTravelersHint: (travelers) => `人数灵活，先按 ${travelers} 人规划。`,
  budgetPlaceholder: "请输入预算（人民币，正整数）",
  budgetError: "预算必须是正整数。",
  confirmBudget: "确认预算",
  flexibleBudgetLabel: (budget) => `预算先灵活，暂按 ${budget} 元规划。`,
  flexibleBudgetHint: (budget) => `预算灵活，先按 ${budget} 元规划。`,
  loadingIp: "正在根据 IP 默认填入出发和返程城市…",
  ipDetected: (location) => `已根据当前 IP 识别到你在${location}，是否将出发和返程城市都设为这里？`,
  confirm: "确认",
  chooseDifferent: "另选城市",
  manualEndpointHint: "如果没有识别到当前位置，请手动选择出发和返程城市。",
  noIpLocation: "暂时没有识别到当前城市，请手动选择出发和返程城市。",
  manualChoose: "手动选择",
  originCity: "出发城市",
  returnCity: "返程城市",
  chooseOriginCountry: "选择出发国家",
  originCountryInput: "输入出发国家",
  chooseOriginCountryFirst: "请先选择出发国家",
  customOriginCityHint: "可选“其他”后输入出发城市",
  chooseOriginCity: "选择出发城市",
  loadedCities: (country, count) => `${country} 已加载 ${count} 个城市`,
  originCityInput: "输入出发城市",
  chooseReturnCountry: "选择返程国家",
  returnCountryInput: "输入返程国家",
  chooseReturnCountryFirst: "请先选择返程国家",
  customReturnCityHint: "可选“其他”后输入返程城市",
  chooseReturnCity: "选择返程城市",
  returnCityInput: "输入返程城市",
  confirmEndpoints: "确认出发和返程城市",
  orderHint: "顺序确认后会进入航班选择，再进入酒店选择。",
  orderIncomplete: "旅行顺序必须覆盖全部已选城市。",
  orderInvalid: "旅行顺序中有不在已选列表的城市。",
  confirmOrder: "确认顺序",
  loadingFlights: "正在加载航班选项…",
  flightsUnavailable: (error) => `航班服务暂时不可用，请稍后重试。（${error}）`,
  noFlightLegs: "当前没有可选航段。",
  skipFlight: "跳过此航段（其他交通）",
  leg: (index, from, to) => `航段 ${index}：${from} → ${to}`,
  chooseFlight: "选择航班或跳过",
  flightSkipped: "该航段已选择跳过。",
  flightDetails: "航班详情",
  airline: "航空公司",
  price: "价格",
  departureTime: "出发时间",
  arrivalTime: "到达时间",
  duration: "时长",
  stops: "经停",
  departureAirport: "出发机场",
  arrivalAirport: "到达机场",
  cabin: "舱位",
  flightNumber: "航班号",
  aircraft: "机型",
  offerToken: "报价编号",
  bookFlight: "前往预订",
  source: "数据来源",
  unknown: "未知",
  nonstop: "直飞",
  connection: (count) => `${count} 次中转`,
  confirmFlights: "确认航班选择",
  invalidFlight: (index) => `航段 ${index} 的选择无效，请重新选择。`,
  expiredFlight: (index) => `航段 ${index} 的航班已失效，请重新选择。`,
  loadingHotels: "正在加载酒店选项…",
  hotelsUnavailable: (error) => `酒店服务暂时不可用，请稍后重试。（${error}）`,
  noHotels: "当前没有可选酒店。",
  selfArrangeHotel: "不选择酒店（自行安排）",
  stay: (index, city, checkIn, checkOut, nights) => `城市 ${index}：${city}（${checkIn}～${checkOut}，${nights} 晚）`,
  chooseHotel: "选择酒店",
  hotelSelfArranged: "该城市住宿由您自行安排。",
  hotelDetails: "酒店详情",
  name: "名称",
  averageNight: "均价/晚",
  totalPrice: "总价",
  taxes: "税费",
  rating: "评分",
  notAvailable: "暂无",
  coordinates: "坐标",
  distanceToCenter: "距市中心",
  checkIn: "入住时间",
  checkOut: "离店时间",
  hotelLink: "酒店官网/链接",
  confirmHotels: "确认酒店选择",
  invalidHotel: (city) => `${city} 的酒店选择无效，请重新选择。`,
  expiredHotel: (city) => `${city} 的酒店选项已失效，请重新选择。`,
  finalNote: "偏好与附件",
  finalNotePlaceholder: "例如：希望节奏慢一些；不吃海鲜；每天安排亲子活动。",
  confirmNote: "确认备注并生成行程",
  countryRequired: "请至少选择一个国家。",
  cityRequired: "请至少选择一个城市。",
  additionalCountryRequired: "请至少选择一个要添加的国家。",
  additionalCityRequired: "请至少选择一个要添加的城市。",
  endpointsRequired: "请完整确认出发和返程国家、城市。",
  noIpCity: "暂时无法识别当前城市，请手动填写。",
  ipConfirmed: (label) => `已确认出发和返程城市：${label}`,
  flightFallback: (order) => `方案 ${order}`,
  hotelFallback: (order) => `酒店方案 ${order}`,
  unknownPrice: "价格未知",
  departureUnknown: "出发时间未知",
  unknownRating: "暂无评分",
  selfArrangeValue: "自行安排",
};

export function getTravelPlannerCopy(isZh: boolean): TravelPlannerCopy {
  return isZh ? ZH : EN;
}

export function getTravelFieldQuestion(
  isZh: boolean,
  state: TravelState,
  field: TravelField,
): string {
  const copy = getTravelPlannerCopy(isZh);
  if (field === "country" && state.seed_country) {
    return isZh
      ? `你想去${state.seed_country}的哪些城市？`
      : `Which cities in ${state.seed_country} would you like to visit?`;
  }
  if (field === "cities" && state.seed_country) {
    return isZh
      ? `请选择${state.seed_country}的城市（可搜索并多选）。`
      : `Choose cities in ${state.seed_country} (search and select multiple).`;
  }
  return copy.fieldQuestions[field];
}
