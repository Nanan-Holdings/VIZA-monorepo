# PH-A Worklog：官方表单与覆盖矩阵

> 第一轮状态：已完成 PH-A arrival-only 官方审计，2026-08-01（Asia/Singapore）。此文件仅 PH-A 可更新。

## 审计范围

- 本轮仅审计 `PH_ETRAVEL_ARRIVAL_CARD`：菲律宾 eTravel 入境、健康、海关、货币与最终声明。
- 明确未审计、未实现：eTravel departure、9(a) 或其他菲律宾签证申请。文中出现 departure/9(e) 仅用于证明本轮不支持或需分流。
- 唯一写入文件：`docs/philippines-launch-worklogs/PH-A.md`。

## 已读取仓库文件

- `AGENTS.md`
- `docs/AGENTS.md`
- `docs/philippines-launch-coordination.md`
- `docs/philippines-launch-worklogs/PH-A.md`
- `docs/philippines-launch-worklogs/PH-B.md`
- `docs/philippines-launch-worklogs/PH-C.md`
- `docs/philippines-launch-worklogs/PH-D.md`

## 官方来源与证据等级

观察日期均为 2026-08-01。

| 证据等级 | 含义 | 本轮证据 |
| --- | --- | --- |
| E1 官方页面直接文本 | FAQ、Data Policy、Entry Guidelines、首页可直接读取 | `https://etravel.gov.ph/frequently-asked-questions`、`https://etravel.gov.ph/entry-guidelines`、`https://customs.etravel.gov.ph/data-policy`、`https://etravel.gov.ph/` |
| E2 官方前端公开资源 | `etravel.gov.ph` Next.js `__NEXT_DATA__` / JS bundle 公开标签、页面标题、固定 options、前端校验、API path；未登录、未提交 | buildId `79dfb3348d0a0f2a798c95b2cbd450cc9201257f`; routes include `/new-travel-declaration`, `/special-travel-declaration`, `/new-cruise-travel-declaration`, `/wizard/*`; common API paths observed in JS |
| E3 官方 API path/route only | 能证明官方使用该 API 或独立路由，但本轮不能导出完整数据或到 Review | `/api/v1/common/*`, `/api/v2/traveller/registrations`, `/api/v2/traveller/special_registration`, `/api/v2/public/batch_travel_registration` |
| E4 未验证 | 需要登录、OTP、Turnstile、真实 session、Review 前交互或官方最终响应；本轮未运行 | required 标记、完整 option 枚举、Review 页面值、QR/reference、文件上传约束 |

## 已验证官方事实

1. eTravel 官方站点为 `https://etravel.gov.ph`；官方 FAQ 称 eTravel 为 arrivals/departures 单一数据收集平台，用于 border control、health surveillance、economic data analysis。
2. 官方 FAQ 明确要求注册/更新的人群包括：Arriving Filipino and foreign crewmembers、Arriving Filipino and foreign passengers、Departing Filipino passengers；但排除 foreign diplomats and dependents、foreign dignitaries/delegation、9(e) visa holders、holders of diplomatic and official/service passport。
3. eTravel 免费，不收在线付款；官方要求在抵达或出发前 72 小时内登记，并在登机前出示 eTravel QR。
4. 官方 FAQ 说明绿色 QR 代表提交资料 proper and complete；红色 QR 可由 incomplete/incorrect data，或过去 30 天生病/接触传染病相关风险触发，需 BOQ 进一步检查。
5. 官方 Data Policy 说明 eTravel 覆盖 electronic passenger registration 和 Health Declaration Checklist，使用方包括 BOQ、BI、BOC、DOT；收集字段至少包括 Email、姓名、Passport Number、Sex、Birth Date、Civil Status、Nationality、Mobile Number、Address、Date of Arrival、Airport/Seaport、Type of Traveller、Purpose、Country of Origin、Name of Airline/Vessel、Passenger Type、Flight Number，以及若干疫苗历史字段。当前官方前端提示 2023-07-22 后旅行菲律宾无 COVID test/vaccination requirement。
6. 官方前端公开标签包和 JS bundle 证明 arrival 普通表单至少包含：Personal Information、Permanent Country of Residence、Travel Details、Health Declaration、Family Member(s)、Baggage Declaration、General Declaration、Currency Declaration、Other Travel Details、Declaration Attachments、Declaration Signature、Summary。
7. 官方前端有独立路径：普通旅客 `/new-travel-declaration`；特殊登记 `/special-travel-declaration` / `/special_registration`；邮轮 `/new-cruise-travel-declaration`。因此普通 `PH_ETRAVEL_ARRIVAL_CARD` 不能默认覆盖机组、special registration 或 cruise passenger/crew。

## 官方 Arrival 字段覆盖矩阵

说明：`官方 value/code` 仅记录本轮能从官方公开资源证明的固定 value/code；API 下拉仅记录官方 API path，完整枚举本轮未验证。`必填性` 中 “官方前端校验” 表示从官方 JS validation schema 看到 required；“未知” 表示必须第二轮 stop-before-submit 验证。

| Step | 官方原始标签 / 字段键 | 类型 | 必填性 | 触发条件 | 官方 value/code / API | 文件要求 | 来源 | 证据 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Account | Email address / `email` | email input | 未验证 | eTravel account/login | unknown | 无 | auth page + Data Policy | E1/E2 |
| Account | OTP / `otp` | 6 digit OTP input | 未验证 | email sign-in/register | `/api/otp_generate`, `/api/otp_validate`, `/api/v2/traveller/check_otp` | 无 | official JS API path | E3 |
| Account | Password / `password`, `password_confirmation` | password | 未验证 | account create/reset | `/api/v2/traveller/create_password` | 无 | official JS API path | E3 |
| Start | New Travel Declaration | action | 必需进入普通 arrival | 普通 passenger | `/new-travel-declaration` | 无 | official route/title | E2 |
| Start | `flight_type` | segmented option | 必需选择交易类型 | 本轮固定 ARRIVAL | `ARRIVAL` = Entering the Philippines; `DEPARTURE` out of scope | 无 | FieldValue | E2 |
| Start | `transportation_type` | segmented option | 必需 | arrival AIR/SEA | `AIR`, `SEA` | 无 | FieldValue | E2 |
| Start | `nationality` | segmented option | 必需 | Filipino/Foreigner | `PHILIPPINE PASSPORT`, `FOREIGN PASSPORT`; stored labels show `FILIPINO`/`FOREIGNER` elsewhere | 无 | FieldValue + JS | E2 |
| Start | Traveller Type / `passenger_type` | select | 未验证 | passenger/crew type | `AIRCRAFT PASSENGER`, `FLIGHT CREW`, `CRUISE CREW`, `CRUISE PASSENGER`, `VESSEL CREW`, `VESSEL PASSENGER` | 无 | FieldValue | E2 |
| Personal | Photo / `photo_url` | upload | 官方前端校验：PH passport holder required; foreign unknown | `nationality_country_code === PH` | upload endpoint observed `https://egov-upload-ws.e.gov.ph` | 是：图片约束未知 | JS validation/upload endpoint | E2/E4 |
| Personal | Passport Number / `passport_number` | text uppercase | 官方前端校验 required, min 5 | all ordinary arrival | unknown | 无 | Field + validation | E2 |
| Personal | First Name / `first_name` | text uppercase | 未知；官方前端标签显示 optional in one bundle snippet，需交互确认 | all ordinary arrival | unknown | 无 | Field + JS snippet | E2/E4 |
| Personal | Middle Name / `middle_name` | text uppercase | 未知；标签包存在 | all ordinary arrival | unknown | 无 | Field | E2 |
| Personal | Last Name / `last_name` | text uppercase | 未知；官方前端标签显示 optional in one bundle snippet，需交互确认 | all ordinary arrival | unknown | 无 | Field + JS snippet | E2/E4 |
| Personal | Suffix / `extension_name` | select/text | optional/unknown | all ordinary arrival | unknown | 无 | Field | E2 |
| Personal | Sex / `gender` | select/radio | 官方前端完整性检查 required；完整 value 未验证 | all ordinary arrival | unknown | 无 | Field + JS completeness check | E2/E4 |
| Personal | Birth Date / `birth_date` | date | 官方前端完整性检查 required | all ordinary arrival | MM/DD/YYYY display | 无 | Field + Data Policy | E1/E2 |
| Personal | Citizenship / `nationality_country_code` | country select | 官方前端校验 required | all ordinary arrival | `/api/v1/common/countries`, labelField `nationality` | 无 | JS validation/API | E2/E3 |
| Personal | Mobile Number / `mobile_number` | phone input | 未验证 | all ordinary arrival | default country `ph` observed | 无 | Field + JS component | E2 |
| Personal | Country of Birth / `country_of_birth_code` | country select | 官方前端校验 required | all ordinary arrival | `/api/v1/common/countries` | 无 | JS validation/API | E2/E3 |
| Personal | Passport Issuing Authority / `passport_issued_country_code` | country select | 官方前端校验 required | all ordinary arrival | `/api/v1/common/countries`, labelField `name` | 无 | JS validation/API | E2/E3 |
| Personal | Passport Issued Date / `passport_issued_date` | date | 官方前端校验 required; max today observed | all ordinary arrival | MM/DD/YYYY display | 无 | JS validation | E2 |
| Personal | Occupation / `occupation_code` | select | 官方前端校验 required | all ordinary arrival | `/api/v1/common/occupations`, order/status filter | 无 | JS validation/API | E2/E3 |
| Address | Country / `country_code` | country select | 个人/家庭 profile 地址 required 条件未完全验证； completeness check requires country/street | permanent residence | `/api/v1/common/countries` | 无 | Field + JS | E2/E4 |
| Address | Region / `region_code`, Province, Municipality, Barangay | cascading selects | PH address 条件 required 未完全验证 | `country_code === PH` | `/api/v1/common/provinces`, `/municipalities`, `/barangays` | 无 | JS API path | E3 |
| Address | State/Province / `province_code` | select/text | unknown | PH/foreign address varies | API/text unknown by country | 无 | Field | E2/E4 |
| Address | House No./Bldg./Street / `street_ph` or `street` | text | completeness check requires street | PH address | unknown | 无 | Field + JS | E2 |
| Address | No./Bldg./City/State/Province / `street_foreign` | text | unknown | foreign address | unknown | 无 | Field | E2/E4 |
| Address | Address Line 2 / `street_two` | text | optional/unknown | permanent residence | unknown | 无 | Field | E2 |
| Travel | Purpose of Travel / `purpose_of_visit_code` | select | 官方前端校验 required | travel details | `/api/v1/common/purpose_of_visits?for_arrival=1`; observed special codes `OFW`, `POV001`, `POV007` in conditions, display names unknown | 无 | JS validation/API | E2/E3 |
| Travel | Date of Arrival / `arrival_date` | date | 官方前端校验 required | all arrival | date picker | 无 | JS validation | E2 |
| Travel | Country of Origin / `origin_country_code` | country select | required 条件片段可见但未完整截取；需 Review 验证 | arrival origin | `/api/v1/common/countries`, excludes `PH` | 无 | JS API | E2/E3 |
| Travel | Airport/Seaport of Origin / `origin_port`, `origin_port_code` | text/select | unknown | arrival origin | manual/API unknown | 无 | JS submit field list | E2/E4 |
| Travel | Date of Departure / `departure_date` | date | likely required for origin departure; exact required unknown | arrival origin departure date | date picker | 无 | Field + JS | E2/E4 |
| Travel | With Transit (Connecting Flight/Voyage)? / `with_transit` | checkbox | optional | arrival not special | true/false | 无 | Field + JS | E2 |
| Travel transit | Country of Transit / `transit_country_code` | country select | required when with transit; exact schema unknown | `with_transit === true` | `/api/v1/common/countries`, excludes `PH` | 无 | JS field rendering | E2/E3 |
| Travel transit | Airport/Seaport of Transit / `transit_port` | text | unknown | with transit | text/unknown | 无 | Field + JS | E2/E4 |
| Travel transit | Date of Transit / `transit_date` | date | unknown | with transit | date picker | 无 | Field + JS | E2/E4 |
| Travel | Country of Destination / `destination_country_code` | country select | departure/outbound label also present; arrival ordinary destination likely PH fixed; unknown in arrival | arrival/direct or onward conditions | `/api/v1/common/countries`, excludes PH in some outbound UI | 无 | Field + JS | E2/E4 |
| Travel | Date of Return / `return_date` | date | 官方前端条件 required | `purpose_of_visit_code in [POV001, POV007]` and ordinary foreign arrival, not batch | date picker, min today | 无 | JS validation/render | E2 |
| Travel AIR | Name of Airline / `travel_company_code` | select | unknown | `transportation_type === AIR` | `/api/v1/common/travel_companies`; flight API `/api/v1/common/flight_numbers?travel_company_code=` | 无 | JS API path | E3 |
| Travel AIR | Flight Number / `flight_number` | text/select | unknown | AIR | `/api/v1/common/flight_numbers?travel_company_code=` | 无 | Field/API | E2/E3 |
| Travel AIR | Special Flight / `is_special_flight`; Specify special flight number / `flight_number_special` | checkbox + text | unknown | special flight selected | true/false; free text | 无 | Field + JS submit list | E2/E4 |
| Travel SEA | Voyage Number / `voyage_number` | text | unknown | SEA | unknown | 无 | Field | E2 |
| Travel SEA | Vessel Name / `vessel_name` | text/select | unknown | SEA | unknown | 无 | Field + submit list | E2/E4 |
| Travel SEA | Are you disembarking? / `is_disembarking` | boolean | unknown | SEA | true/false | 无 | Field + validation condition | E2 |
| Philippine destination | Destination upon arrival in the Philippines / `stay_location_type` | select | 官方前端校验 required for AIR arrival or SEA arrival when disembarking | arrival | AIR options: `RESIDENCE`, `HOTEL`, `TRANSIT`; SEA options: `RESIDENCE`, `HOTEL`, `TRAVEL_PORT` | 无 | FieldValue + validation/render | E2 |
| Philippine destination | Same as Permanent Country of Residence / `is_destination_same_as_permanent_address` | checkbox | optional | `stay_location_type === RESIDENCE` | true/false | 无 | Field + JS | E2 |
| Philippine destination | Residence Address / `destination_upon_arrival_in_philippines` | text | required when arrival + RESIDENCE/HOTEL and applicable | RESIDENCE/HOTEL | text | 无 | JS validation/render | E2 |
| Philippine destination | Hotel, Resorts, AirBnb, Tourist destinations, etc. / `destination_upon_arrival_in_philippines` | autocomplete | required when HOTEL | HOTEL | `/api/v1/common/hotels` | 无 | Field + JS API | E2/E3 |
| Philippine transit | Airport / `transit_port_code` | fixed select | required when `stay_location_type === TRANSIT` and AIR | airport transit | observed values: `TP1000` Ninoy Aquino International Airport T1 - (MNL), `TP2000` T2; further terminal values truncated/unverified | 无 | JS render/validation | E2/E4 |
| Philippine transit | Country of Destination / `transit_destination_country_code` | country select | required when AIR transit via airport | `stay_location_type === TRANSIT` | `/api/v1/common/countries`, excludes `PH` | 无 | JS validation/API | E2/E3 |
| SEA destination | Port / `disembarking_port_code` | select | required when `stay_location_type === TRAVEL_PORT` and SEA | SEA + port destination | `/api/v1/common/travel_ports` | 无 | JS validation/API | E2/E3 |
| Health | Notice | static text | n/a | health page | "As of July 22, 2023, No Covid-19 test or Vaccination requirement when traveling to the Philippines." | 无 | Keyword | E2 |
| Health | Do you have a negative Antigen test... / `with_negative_antigen` | boolean | unknown; likely linked to vaccination/age but current UI needs interaction | health | true/false | test document requirement unknown | Field + Entry Guidelines | E1/E2/E4 |
| Health | Do you have any recent travel history in the last 30 days? / `with_recent_travel_history` | boolean | unknown; meta-driven condition observed | health | true/false | 无 | Field + JS validation | E2/E4 |
| Health | Country(ies) worked, visited and transited in the last 30 days / `visited_countries` | multi country | required if travel history meta demands | recent travel history | `/api/v1/common/countries` | 无 | JS validation/API | E2/E3 |
| Health | Exposure to sick/communicable disease in past 30 days / `is_with_history_exposure` | boolean | 官方前端校验 required | health | true/false | 无 | JS validation | E2 |
| Health | Exposed to bats or sick animals / `is_exposed_to_bats_or_sick_animals` | boolean | unknown | health | true/false | 无 | Field | E2/E4 |
| Health | Been sick in past 30 days / `is_sicked_within_thirty_days` | boolean | 官方前端校验 required | health | true/false; yes may contribute red QR per FAQ | 无 | JS validation + FAQ | E1/E2 |
| Health | Symptoms / `sickness_symptoms` | multi select | required when `is_sicked_within_thirty_days === true` | sick in past 30 days | `/api/v1/common/sickness_symptoms?order_by=name&status_by=asc&is_active=1` | 无 | JS validation/API | E2/E3 |
| Family | Family Member(s) | page/action | optional; prompt warns if no family selected | after travel summary | `/api/v2/traveller/family_members`, family page | each member separate registration per official dashboard note | Wizard/Prompt | E2 |
| Family | Accompanied family members / `accompanied_family_members.below_eighteen`, `.above_or_equal_eighteen` | number inputs | official front-end validation required on baggage/general page | customs/baggage step | numeric counts | 无 | JS validation/render | E2 |
| Family member | Relationship to account owner / `relationship` | select | required for family member profile unknown | family member profile | `MOTHER`, `FATHER`, `DAUGHTER`, `SON`, `SISTER`, `BROTHER`, `HUSBAND`, `WIFE`, `COUSIN`, `UNCLE`, `AUNT`, `NEPHEW`, `NIECE`, `GRANDFATHER`, `GRANDMOTHER`, `GRANDCHILD` | 无 | FieldValue | E2 |
| Customs confirm | Do you have baggage or currency to declare? / `with_something_to_declare_arrival` | yes/no | unknown; controls customs flow | arrival | true/false | if yes leads customs declaration | Field + JS | E2 |
| Baggage | Baggage Declaration static instructions | static text | acknowledgement unknown | customs baggage | CMTA warnings, duty thresholds, prohibited goods | no upload proved here | official `customs_baggage` content | E2 |
| Baggage | Checked-in (pcs) / `no_of_checked_in_baggages` | number | official front-end validation required | baggage/general page | numeric | 无 | JS validation/render | E2 |
| Baggage | Hand-carried (pcs) / `no_of_hand_carried_baggages` | number | official front-end validation required | baggage/general page | numeric | 无 | JS validation/render | E2 |
| Baggage | Total Amount of goods purchased/acquired abroad / `amount_of_goods_acquired.currency`, `.amount` | select + number | amount required by front-end schema when customs form shown | baggage/general page | currency fixed options `PHP`, `USD`; amount numeric | 无 | JS validation/render | E2 |
| Baggage | Quantity / Description / Amount in USD / `items[]` | repeating rows | unknown; likely when declaring goods | amount/checklist flow | numeric/text/USD | 无 | Field + JS | E2/E4 |
| General Declaration | 12 checklist items / `check_lists[].response` | yes/no list | official front-end validation requires response; if goods amount > 0, at least one item 3-12 yes | customs general | includes currency over thresholds, gambling paraphernalia, restricted goods, drugs, firearms, commercial alcohol/tobacco, food/animals/plants, excess gadgets, cremains/organs, jewelry/gems, other goods | supporting document unknown | official `customs_general` + JS validation | E2 |
| Currency Declaration | Currency Declaration static instructions | static text | acknowledgement unknown | if currency thresholds apply / currency declaration | PHP > 50,000 and/or foreign currency > USD 10,000 equivalent | manual currency form may be required | official `customs_currency`/`customs_currency_information` | E2 |
| Currency Declaration | Owner details not applicable / `owner_details_not_applicable` | checkbox | optional/conditional | transferring on behalf of another person/entity | true/false | 无 | Field + JS | E2 |
| Currency Declaration | Owner/Recipient name/business fields | text | conditional required: owner_last_name if owner_first_name; recipient_last_name if recipient_first_name | currency owner/recipient not N/A | first/middle/last/suffix/business | 无 | JS validation | E2 |
| Currency Declaration | Occupation or Principal Business Activity / owner/recipient occupation | text | conditional unknown | owner/recipient details | free text | 无 | Field | E2/E4 |
| Currency Declaration | Owner/Recipient address fields | country + PH cascading + postal | conditional unknown | owner/recipient details | `/api/v1/common/countries`, PH cascading APIs | 无 | Field + JS | E2/E3 |
| Currency Declaration | Currency / `currency_name`; Monetary Instrument / `monetary_instrument_name`; Amount / `amount` | repeating rows | front-end validation: at least 1 currency item in currency form | currency declaration | `/api/v1/common/currencies`, `/api/v1/common/monetary_instruments`; amount numeric | possible separate form attachment if space insufficient, per instructions | JS validation/API + instructions | E2/E3 |
| Currency Declaration | Date of BSP authorization / `bsp_authorization_date` | date | conditional unknown | PHP over 50,000 | date/N/A per instructions | BSP authorization document likely required but upload not proved | Field + official instructions | E2/E4 |
| Currency Declaration | Sources of currencies / `currency_sources` | select | unknown | currency declaration | `Salary`, `Business`, `Other (Specify)` | 无 | FieldValue | E2 |
| Currency Declaration | Purpose of transport / `transport_purposes` | select | unknown | currency declaration | `Leisure`, `Medical`, `Payables`, `Education`, `Other (Specify)` | 无 | FieldValue | E2 |
| Other Travel Details | Physically transferred or shipped / physical_or_shipped | radio | unknown | currency declaration Part IV | `is_physically_transferred_by_person`, `is_shipped_thru_courier_service` | 无 | FieldValue + instructions | E2 |
| Other Travel Details | No. of days in the Philippines / `no_of_days_in_philippines` | number | unknown | physical transfer by traveler | numeric | 无 | Field | E2/E4 |
| Other Travel Details | Last travel to the Philippines / `last_travel_to_philippines` | date/text unknown | unknown | physical transfer by traveler | unknown | 无 | Field | E2/E4 |
| Other Travel Details | Courier name / `courier_name`; Airway/Bill No. / `airway_bill_no`; Airway/Bill Date / `airway_bill_date` | text/date | unknown | shipped through courier | unknown | 无 | Field + instructions | E2/E4 |
| Attachments | Travel Document / `travel_document` | upload | unknown | declaration attachments | upload endpoint exists; accepted file types unknown | yes, requirement unknown | Field + upload endpoint | E2/E4 |
| Signature | Signature / `signature` | signature pad/upload | likely required before final customs declaration; exact constraints unknown | declaration signature | image/signature data unknown | yes | Field + PageTitle | E2/E4 |
| Final Declaration | Customs false declaration warning | static text/ack | acknowledgement unknown | customs final | warning on prohibited/restricted goods, false statements | 无 | official `customs_warning` | E2 |
| Final Declaration | “By Clicking Next...” certification | static declaration | user certification before next | customs declaration flow | text: declaration true/correct to best knowledge | signature may follow | Keyword | E2 |
| Summary/QR | Submit / Download QRCode / QRCode | action/result | final submit not run | after Review/Submit | official reference/QR not observed | QR artifact | FAQ + Actions | E1/E2/E4 |

## 特殊身份与豁免分流结论

| 身份 | 官方要求/排除 | 本轮产品结论 | 证据 |
| --- | --- | --- | --- |
| 普通 arriving Filipino passenger | 需要 register/update | PH arrival v1 目标用户，可以进入普通 passenger 矩阵，但 PH passport photo required 需第二轮确认文件合同 | E1/E2 |
| 普通 arriving foreign passenger | 需要 register/update | PH arrival v1 目标用户，可以进入普通 passenger 矩阵 | E1/E2 |
| Arriving Filipino/foreign crewmembers | FAQ 要求 register/update，但前端有 `FLIGHT CREW`/`VESSEL CREW`/`CRUISE CREW` 和 special/cruise routes | 不得用普通 passenger 表单默认支持；需独立 crew 分支或人工处理 | E1/E2 |
| Cruise passenger/crew | 首页有 “For Cruise Travel Registration” 与独立 `/new-cruise-travel-declaration` | 不属于普通 AIR/SEA passenger arrival v1，除非第二轮明确 cruise scope | E2 |
| Foreign diplomats and dependents | FAQ 明确 except | VIZA 应分流为不支持/人工提示，不应提交普通 arrival | E1 |
| Foreign dignitaries/delegation | FAQ 明确 except | VIZA 应分流为不支持/人工提示 | E1 |
| 9(e) visa holders | FAQ 明确 except | VIZA 应分流为不支持/人工提示；不得研究 9(a) 或签证申请 | E1 |
| Diplomatic passport holders | FAQ 明确 except | VIZA 应分流为不支持/人工提示 | E1 |
| Official/service passport holders | FAQ 明确 except | VIZA 应分流为不支持/人工提示 | E1 |

## 当前可证明分支

- Ordinary Filipino passenger + AIR arrival：字段标签、主要 required 条件、PH destination、health、customs/currency 页面存在可证明；未到 Review。
- Ordinary Foreigner passenger + AIR arrival：字段标签、travel purpose/return-date 条件、PH destination、health、customs/currency 页面存在可证明；未到 Review。
- Ordinary passenger + SEA arrival：官方标签和条件可证明 SEA/vessel/voyage/disembarking/port destination 存在；未到 Review。
- AIR transit via Philippine airport：`stay_location_type=TRANSIT`、`transit_port_code`、`transit_destination_country_code` required 条件可证明；完整 airport value 未验证。
- Hotel/Residence destination：`HOTEL`/`RESIDENCE` option、hotel API、residence address required 条件可证明。
- Health sick-in-30-days branch：`is_sicked_within_thirty_days` required，`sickness_symptoms` required on yes，可证明；FAQ 说明可能 red QR。
- Customs declaration pages：baggage/general/currency/attachment/signature page titles、instructions、fixed currency/source/purpose options 可证明。

## 缺证据分支与缺口

### P0

1. 未登录、未 OTP、未 Turnstile、未到 Review；无法证明完整官方 arrival all-fields parity、最终 required、Review 字段顺序或 reference/QR 成功路径。
2. 机组、special registration、cruise registration 与普通 passenger 路径不同；当前 `PH_ETRAVEL_ARRIVAL_CARD` 不能宣称支持 crew/special/cruise，必须先分流。
3. 外交/9(e)/diplomatic/official/service passport 是官方 FAQ 明确 except；若 VIZA 当前允许进入普通表单，属于 P0 误提交风险。
4. 文件要求未闭合：PH passport `photo_url` required 可见，但 `travel_document`、`signature`、manual customs/currency forms 的上传条件、格式、大小、过期和是否所有普通 arrival required 未验证。
5. 完整 API option value/code 未导出：countries、occupations、purpose_of_visits、travel companies、ports、hotels、currencies、monetary instruments、sickness symptoms 均只能证明 API path，不能证明当前完整枚举。

### P1

1. Personal name fields必填性不确定：官方 Data Policy 收集姓名，但前端公开片段显示 first/last 可能带 optional；需 stop-before-submit 验证真实 validation。
2. AIR/SEA 航程字段 required 未完全确认：airline、flight number、vessel name、voyage number、origin port、departure date、with transit 相关 required 需实际页面验证。
3. General Declaration 12 个 checklist 的稳定 key/code 未导出；只证明官方文本和 response 数组逻辑。
4. Currency Declaration owner/recipient/address/courier/physical transfer 分支 required 未完整确认。
5. `POV001`、`POV007` 触发 return date，但 display label 未验证；不能把代码解释为旅游/商务等具体含义。
6. Travel tax/TIEZA 逻辑出现在官方前端，但本轮 arrival scope 未验证其是否对 Filipino arrival、foreign arrival或仅 departure/OFW 触发；第二轮需防止误纳入 arrival v1。

### P2

1. `with_negative_antigen` 仍在官方字段包中，但官方 notice 称 2023-07-22 后无 COVID test/vaccination requirement；需要确认当前是否隐藏、只对特定年龄/疫苗状态触发，或历史残留。
2. `is_exposed_to_bats_or_sick_animals` 字段存在但 required/QR 影响未知。
3. Transit airport fixed options只截取到 NAIA T1/T2，需完整值表。
4. `destination_country_code` 在 arrival direct/transit/SEA 中的真实显示条件需进一步确认，避免与 departure 字段混淆。

## 第二轮官方 parity 验证清单

默认 stop-before-submit；不得记录账号、Cookie、OTP、PII 或未脱敏页面内容。

1. Foreigner ordinary passenger + AIR + hotel + no transit + no sick + no customs declaration：到 Review，记录每页字段、required、hidden fields、submit payload key（脱敏）。
2. Foreigner ordinary passenger + AIR + airport transit：验证 `TRANSIT`、airport option完整列表、destination country required。
3. Filipino ordinary passenger + AIR + residence same as permanent address：验证 PH passport photo 是否必传、地址复制、customs flow。
4. Ordinary passenger + SEA + disembarking + port/hotel/residence 三分支：验证 vessel/voyage/disembarking/port required。
5. Health yes branch：recent travel history、history exposure、sick within 30 days、symptoms、bats/sick animals；确认红 QR 前置提示或 Review 状态。
6. Family companion branch：account owner + family member，验证 relationship options、每个 family member 是否独立 declaration、accompanied counts。
7. Baggage/customs branch：goods amount 0、>0；12 checklist 全 no/某项 yes；items rows required 与 validation。
8. Currency branch：PHP > 50,000、foreign > USD 10,000、owned by declarant/third-party owner、physical/courier，验证 owner/recipient/currency item/BSP/courier required 与 file/signature要求。
9. Special identity gate：crew/passport/status/diplomat/9(e) 仅验证入口分流，不提交普通表单。
10. 完整导出官方 options/API build：记录 buildId、API endpoint、option code/name、观察日期；若 API 需要 auth，使用脱敏 stop-before-submit session。

## 第二轮建议修改路径（不实施）

- PH-B：schema/seed/document contract 必须按 PH-A matrix 冻结字段；特殊身份和 crew/cruise 不得进入普通 passenger schema。
- PH-C：runner normalize/filler 必须按官方 `stay_location_type`、customs/currency 分支和固定 value/code 一对一映射；未验证字段默认阻断 live。
- PH-D：前端 eligibility 必须增加官方 except 身份分流；用户文案明确 eTravel 免费、非签证、不保证入境；文件需求不能由 frontend fallback 单独定义。

## 接口请求

- 请求主协调者授权第三轮受控 stop-before-submit 官方验证，否则本轮只能提供 E1/E2/E3 级矩阵，不能签署 full parity。
- 请求 PH-B 提供当前 VIZA schema field inventory 后，与本矩阵逐项对齐，特别是 `photo_url/profile_photo`、`travel_document`、`signature/customs_signature_file` 是否多余或条件错误。
- 请求 PH-C 确认 runner 是否使用官方固定 values：`ARRIVAL`、`AIR`、`SEA`、`FILIPINO`/`FOREIGNER`、`AIRCRAFT PASSENGER`/`VESSEL PASSENGER`、`RESIDENCE`、`HOTEL`、`TRANSIT`、`TRAVEL_PORT`、`PHP`、`USD`。
- 请求 PH-D 在 eligibility UI 明确阻断：crew、cruise、foreign diplomats/dependents、foreign dignitaries/delegation、9(e)、diplomatic/official/service passport。

## 未运行流程与剩余不确定性

- 未登录官方账号、未注册账号、未接收 OTP、未通过 Turnstile、未创建真实 eTravel transaction。
- 未上传照片、旅行文件、签名或任何附件。
- 未进入官方 Review，未点击最终 Submit，未生成 reference 或 QR。
- 未运行 migration、seed、部署、真实账号注册、真实 OTP、付费 CAPTCHA 或官方最终提交。
- 未修改产品代码、总览或其他 worklog。

## 第二轮：canonical arrival contract

> 第二轮状态：已完成 PH-A 合同冻结整理，2026-08-01（Asia/Singapore）。

### 重新读取

- `docs/philippines-launch-coordination.md`，重点第 10-13 节。
- `docs/philippines-launch-worklogs/PH-A.md`
- `docs/philippines-launch-worklogs/PH-B.md`
- `docs/philippines-launch-worklogs/PH-C.md`
- `docs/philippines-launch-worklogs/PH-D.md`
- 当前 `git status --short`。工作区仍有台湾并行 dirty 文件和已删除的 `docs/ph-etravel-auto-submit-audit.md`；本轮未触碰。

### 新增文件

- `docs/philippines-etravel-arrival-field-contract.md`

### 合同整理结论

- 已将第一轮官方矩阵整理为 canonical contract v0.1。
- 合同状态仅使用 `verified_public`、`needs_review`、`unsupported_v1`。
- 合同覆盖 ordinary Filipino/Foreigner passenger × AIR/SEA arrival，以及 transit、destination、health、family、baggage、general declaration、currency、attachments、signature、summary/result。
- Crew、cruise、special registration、foreign diplomats/dependents、foreign dignitaries/delegation、9(e)、diplomatic/official/service passport 均标为 `unsupported_v1` 分流项，不进入普通 passenger 字段合同。
- 未知 required、完整 option code、文件格式/大小/上传条件和 Review 行为全部保留 `needs_review`，未猜测为已确认。

### 未解决字段与第二轮后续验证

- API option 完整枚举仍未确认：countries、occupations、purpose_of_visits、travel_companies、flight_numbers、travel_ports、hotels、currencies、monetary_instruments、sickness_symptoms、general declaration checklist 稳定 id。
- Requiredness 仍未确认：first/middle/last name、mobile、residence 子字段、origin port/date、AIR airline/flight、SEA vessel/voyage/disembarking、transit fields、family member selection、customs confirmation、goods items、currency owner/recipient/BSP/courier、attachments、signature、final certification。
- 文件要求仍未确认：foreign profile photo、PH profile photo format/size、`travel_document`、BSP authorization、customs/currency attachments、signature upload versus canvas。
- 官方 Review parity 仍未确认：页面顺序、隐藏字段、最终 submit 控件、reference/QR、known reference recovery。

### 给 PH-B 的接口

- 按 contract canonical key 对齐 seed/schema；现有 seed key 只能作为兼容 alias，不得作为官方真相。
- Filipino/Foreigner 与 AIR/SEA 必须是一等分支；AIR 不暴露 vessel-only 字段，SEA 不复用 airline/flight-only 合同。
- 普通 passenger schema 必须移除或分流 crew、cruise、special、diplomat、9(e)、diplomatic/official/service passport。
- API 下拉必须使用官方 API/snapshot；不得猜 `POV001`/`POV007`、checklist id、airport list 或 API enum display。
- Customs/general/currency 必须保留 12 项 checklist 和货币子分支，不得 collapse 成 aggregate boolean。
- 文件合同不得继续默认“所有用户都需要 `profile_photo` + `customs_signature_file`”；signature 是签名合同，不等于 PDF 上传合同。

### 给 PH-C 的接口

- Runner normalize 可以接受 legacy aliases，但 payload/field plan 应以 canonical keys 和官方 values 为准。
- AIR 和 SEA 必须独立 plan；SEA 不得点击 AIR 初始登记或填写 airline 控件。
- Runner 必须二次拒绝 `unsupported_v1` 身份，即使 frontend/schema 漏拦。
- Customs/currency runner 应映射 canonical 12 checklist 与 currency groups，不再只依赖 legacy aggregate fields。
- Signature 优先按官方 signature pad/canvas 自动化；PDF upload 只有官方控件证明后才能要求。
- Submitted 成功必须满足 reference + 独立 QR artifact + application/result/queue 三方一致；Review-stop 不是 submitted。

### 给 PH-D 的接口

- 前端入口必须分流所有 `unsupported_v1` 身份，不进入 ordinary passenger long form。
- 用户文案必须说明 eTravel 免费、不是签证、不保证入境。
- Live enqueue 必须 fail-closed；stop-before-submit 不得呈现为已提交。
- 动态表单按 persona/transport/destination 条件显示；不要让 AIR/SEA 与 Filipino/Foreigner 混成模糊标签。
- Documents UI 不得要求 `customs_signature_file` 或 foreign profile photo，除非 contract/official Review 证明条件。
- PH success 必须 reference + QR artifact；截图不能替代 QR。
- Scheduled/failure 文案必须菲律宾化并使用 allowlisted user message。

### 本轮未运行

- 未运行 migration、seed、部署、官方账号注册、真实 OTP、Turnstile/CAPTCHA、官方 Review 或最终 Submit。
- 未修改产品代码、协调总览、PH-B/PH-C/PH-D worklog 或任何台湾 dirty 文件。

## 第二轮修订：canonical arrival contract v0.2

> 状态：已按主协调者审查意见修订，2026-08-01（Asia/Singapore）。合同为 PH-A compiled/proposed，pending coordinator approval。

### 修改文件

- `docs/philippines-etravel-arrival-field-contract.md`
- `docs/philippines-launch-worklogs/PH-A.md`

### v0.2 修订点

1. **数据类别/owner 已补齐。** 合同每行增加 `Category/owner`，至少区分：
   - `applicant form answer`
   - `VIZA eligibility-only`
   - `account runtime secret`
   - `account runtime data`
   - `static notice/action`
   - `submission result`
2. **运行时秘密边界已明确。** `account.otp`、`account.password` 标为 `account runtime secret`，明确禁止进入 `visa_form_fields`、application answers、测试 fixture、文档示例或日志。
3. **非申请问题边界已明确。** `summary.review`、`summary.final_submit` 标为 `static notice/action`；`result.official_reference`、`result.qr_artifact` 标为 `submission result`。这些不是申请问题，不进入 `visa_form_fields`。
4. **canonical key 语义已澄清。** dotted canonical key 仅为语义路径，不是实际持久化 field_name；PH-B 不得批量重命名现有 flat DB field_name。
5. **flat key / legacy alias 映射已补齐。** 合同主表和 `PH-B / PH-C Applicant Answer Mapping` 为 applicant form answer 增加 current VIZA flat key / legacy aliases；无现有 flat key 的行标为 `none`，要求 PH-B add/gate/leave needs_review。
6. **checked baggage key 冲突已修正。** v0.1 写 `no_of_baggage`，第一轮矩阵写 `no_of_checked_in_baggages`。v0.2 将 `baggage.checked_count` 官方 key 列为候选 `no_of_checked_in_baggages` / `no_of_baggage`，状态降为 `needs_review`。
7. **其他转录 key 冲突已检查并标记。** `destination_upon_arrival_in_the_philippines` 与 `destination_upon_arrival_in_philippines`、`port_origin`/`port_transit`/specific port fields 均列入 `Official Key Conflicts Requiring Review`。
8. **首页状态已修正。** 合同头部从 “frozen by PH-A” 改为 “compiled/proposed by PH-A, pending coordinator approval”。

### v0.2 映射规则

- `applicant form answer` 才能进入 PH-B schema/`visa_form_fields` 候选。
- `VIZA eligibility-only` 只能用于前端分流和 runner guard，不作为普通 passenger 官方答案提交。
- `account runtime secret` 只在安全运行时处理，禁止出现在 answers、fixtures、examples、logs。
- `static notice/action` 与 `submission result` 由 UI/runner/result subsystem 管理，不是申请答案。
- PH-B 保留现有 flat keys；PH-C normalize 将 flat keys/legacy aliases 映射到 semantic canonical keys。
- 对 `none` flat key 的字段，PH-B 必须在第二轮决定：新增 scoped field、gate branch、或保留 `needs_review` 不实现。

### 仍需 Review 的冲突

- Checked baggage 官方键：`no_of_checked_in_baggages` vs `no_of_baggage`。
- Destination upon arrival 官方键：`destination_upon_arrival_in_the_philippines` vs `destination_upon_arrival_in_philippines`。
- Origin/transit/destination port key：specific fields vs ICU label keys `port_origin`、`port_transit`、`port_destination`。
- 未解决的完整 options、requiredness、文件条件和 Review/QR 行为仍按 v0.2 `needs_review` 处理。

### 文档检查结果

- 合同状态值仍限定为 `verified_public`、`needs_review`、`unsupported_v1`。
- 未新增或修改产品代码、协调总览、PH-B/PH-C/PH-D worklog。
- 未运行 migration、seed、部署、真实账号、OTP、CAPTCHA、官方 Review 或最终 Submit。

## 下一轮：公共官方证据补强

> 状态：已完成增量补强，2026-08-01（Asia/Singapore）。仅使用官方公开页面、公开 frontend bundle/API 路径和现有官方 snapshot；未登录、未注册、未使用 OTP/CAPTCHA、未提交、未使用申请人资料。

### 修改文件

- `docs/philippines-etravel-arrival-field-contract.md`
- `docs/philippines-launch-worklogs/PH-A.md`

### 本轮直接证据

- 当前官方公开首页 `__NEXT_DATA__` build id 为 `79dfb3348d0a0f2a798c95b2cbd450cc9201257f`；本轮仅读取公开页面与公开 JS chunk。
- 官方 label bundle 证明 `port_origin`、`port_transit`、`port_destination`、`is_disembarking`、`destination_upon_arrival_in_the_philippines`、`disembarking_port_code`、`no_of_baggage`、`currency_sources`、`transport_purposes`、`travel_document`、`signature` 等 label key。
- 官方公开 validation/render fragment 证明 arrival value/control key：
  - origin port: `origin_port`，label key `port_origin`，arrival required。
  - transit port: `transit_port`，label key `port_transit`，`with_transit === true` 时 required。
  - SEA disembark: `is_disembarking` 仅在 `transportation_type === SEA` 且 `flight_type === ARRIVAL` 显示。
  - SEA `TRAVEL_PORT`: `stay_location_type === TRAVEL_PORT` 且 SEA 时 required `disembarking_port_code`，API `/api/v1/common/travel_ports`。
  - checked baggage: value/control key `no_of_checked_in_baggages`，label/group key `no_of_baggage`。
  - destination address/hotel: value/control key `destination_upon_arrival_in_philippines`，label key `destination_upon_arrival_in_the_philippines`；hotel suggestions use `/api/v1/common/hotels`。
  - SEA voyage label: `voyage_number` label renders on a control named `flight_number` for vessel passenger branch; crew/cruise remain diverted.
  - currency sources values: `SALARY`, `BUSINESS`, `OTHER`。
  - currency purpose values: `LEISURE`, `MEDICAL`, `PAYABLES`, `EDUCATION`, `OTHER`。
  - currency transfer method values: `is_physically_transferred_by_person`, `is_shipped_thru_courier_service`。
  - attachment widget accepts `image/png`, `image/jpg`, `image/jpeg`; required condition for `travel_document` still not proved。
  - signature validation requires official `signature` in declaration signature flow, with `signature_source` default `PAD` observed; PDF/upload signature requirement not proved。

### Contract 状态变更

- 已提升为 `verified_public`：arrival `origin_country_code`、`origin_port`、transit `transit_country_code`、`transit_port`、SEA `vessel_name`、SEA `voyage_number` label/control split、SEA `is_disembarking`、destination address/hotel label/control split、SEA `disembarking_port_code`、checked baggage count、`first_time_visit`、currency items/source/purpose/transfer/traveler/courier conditional fields、signature。
- 继续 `needs_review`：完整 option payloads、ordinary arrival 是否使用 `destination_port`/`destination_port_code`、profile photo required/file rules、travel document required condition和大小、BSP authorization required/document、customs checklist stable ids、final Review/submit/reference/QR parity。

### PH-B 最小 mapping delta

- 保留现有 flat key，不批量重命名；只把 official value/control key 写入映射层。
- `checked_baggage_count` -> official `no_of_checked_in_baggages`；`no_of_baggage` 只作 label/group key。
- `destination_residence_address`、`destination_hotel_name`/`destination_hotel_address` -> official `destination_upon_arrival_in_philippines`；带 `_the_` 的 key 只作 label key。
- `airport_of_origin` -> official arrival `origin_port`；`transit_airport` -> official arrival `transit_port`；二者都是文本 value key，不是 `origin_port_code`。
- SEA 若纳入 v1，需要 scoped flat keys/aliases：`vessel_name`、`is_disembarking`、`disembarking_port_code`；Voyage Number 的 official value/control key 是 `flight_number`，但 UI/schema 可保留语义别名 `sea.voyage_number`。
- Currency branch 若纳入 v1，需要字段组：`currency_sources[]`、`currency_source_other`、`transport_purposes[]`、`transport_purpose_other`、`physical_or_shipped`、physical traveler details、courier details。

### PH-C 最小 mapping delta

- Runner payload/control selection 使用 verified value/control keys，不用 label key：`origin_port`、`transit_port`、`destination_upon_arrival_in_philippines`、`no_of_checked_in_baggages`。
- SEA Voyage Number 按官方 `flight_number` control 填写；`voyage_number` 仅用于 label/语义。
- SEA `TRAVEL_PORT` 条件：只在 SEA arrival 且 `is_disembarking` 后处理 `stay_location_type === TRAVEL_PORT` 和 `disembarking_port_code`。
- Currency values 必须使用官方公开代码：sources `SALARY|BUSINESS|OTHER`，purposes `LEISURE|MEDICAL|PAYABLES|EDUCATION|OTHER`，transfer method `is_physically_transferred_by_person|is_shipped_thru_courier_service`。
- Signature 优先填 official `signature` + `signature_source: PAD`；不得要求 PDF signature upload。

### PH-D 最小 mapping delta

- UI 显示可用 label，但提交/answer mapping 需遵循 label-vs-value split；不要向用户暴露“冲突 key”。
- AIR/SEA destination 动态：AIR 支持 `RESIDENCE`、`HOTEL`、`TRANSIT`；SEA 支持 `RESIDENCE`、`HOTEL`、`TRAVEL_PORT`，且 SEA destination 由 `is_disembarking` 触发。
- Documents UI 不得把 `travel_document`、foreign profile photo 或 `customs_signature_file` 做成全局必填；当前只证明 attachment image MIME types 和 signature pad required。
- Currency UI 需用官方 source/purpose/transfer method values；OTHER、physical、courier 子字段按条件显示。

### 未运行与未触碰

- 未登录官方账号、未注册账号、未接收 OTP、未通过 CAPTCHA、未创建真实 transaction、未进入官方 Review、未最终 Submit。
- 未运行 migration、seed、部署、真实账号注册、真实 OTP、付费 CAPTCHA。
- 未修改产品代码、协调总览、PH-B/PH-C/PH-D worklog 或其他文件。

## 下一轮：真实官网逐页核对（无账号安全边界）

> 状态：已完成无登录/无账号的官网逐页可见性核对，2026-08-01（Asia/Singapore）。仅使用 `etravel.gov.ph` 与 `customs.etravel.gov.ph` 官方域名。未输入邮箱、未创建账号、未使用 OTP/CAPTCHA、未登录、未提交、未上传文件、未使用任何真实或合成申请人资料。

### 重新读取

- `docs/philippines-launch-coordination.md`，重点第 10-13 节。
- `docs/philippines-launch-worklogs/PH-A.md`
- `docs/philippines-launch-worklogs/PH-B.md`
- `docs/philippines-launch-worklogs/PH-C.md`
- `docs/philippines-launch-worklogs/PH-D.md`
- `AGENTS.md` 与 `docs/AGENTS.md`

### 本轮修改文件

- `docs/philippines-etravel-arrival-field-contract.md`
- `docs/philippines-launch-worklogs/PH-A.md`

### 真实官网页面矩阵

| URL | 访问日期 | 页面/步骤 | 原始英文题目/可见文字 | 控件类型 | 可见选项/动作 | Required 标记 | 触发条件 | 证据等级 | 与 VIZA 合同比对 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `https://etravel.gov.ph/` | 2026-08-01 | Home | Philippine Travel Information System; Simplify your travel with eTravel; eTravel is FREE | static + buttons/links | `Click here to Sign In`; Download eGovPH app; Apple Store; Google Play; For Cruise Travel Registration; `Scan QR Code`; language selector English/Chinese/Korean/Japanese | n/a | public home | E5 | confirmed static notice/free/public entry; ordinary passenger questions unobserved |
| `https://etravel.gov.ph/signin` | 2026-08-01 | Login | Login; Enter Email address; Password; Forgot Password; Create an account | textboxes + link/button | email textbox, password textbox, Forgot Password link, Create an account button | no visible asterisk captured | user chooses sign in | E5 | confirmed `account.email`/`account.password` are account runtime surfaces, not applicant answers |
| `https://etravel.gov.ph/authentication` | 2026-08-01 | Create account | Create an account; Enter Email address; Continue; Already have an account? Login | textbox + button/link | email textbox, Continue button, Login link | no visible asterisk captured | Create account from login | E5 | confirmed registration is email-gated before travel declaration; PH-A stopped before entering email |
| `https://etravel.gov.ph/new-travel-declaration` | 2026-08-01 | Ordinary travel declaration direct route | redirected to `/?sessionExpired=true` | redirect/session gate | no form controls visible | n/a | direct unauthenticated request | E5 | unobserved: Foreign national + AIR and all ordinary passenger pages blocked before first form page |
| `https://etravel.gov.ph/wizard/public` | 2026-08-01 | Public wizard route probe | Loading... | loading only | none | n/a | direct unauthenticated request | E5 | unobserved; cannot use as form parity |
| `https://etravel.gov.ph/new-cruise-travel-declaration` | 2026-08-01 | Cruise declaration direct route | logout/sessionExpired loading state | redirect/session gate | no form controls visible | n/a | direct unauthenticated request | E5 | confirmed cruise remains separate/gated; not ordinary passenger contract |
| `https://etravel.gov.ph/special-travel-declaration` | 2026-08-01 | Special declaration direct route | logout/sessionExpired loading state | redirect/session gate | no form controls visible | n/a | direct unauthenticated request | E5 | confirmed special remains separate/gated; not ordinary passenger contract |
| `https://etravel.gov.ph/special_registration` | 2026-08-01 | Special registration route probe | Loading... | loading only | none | n/a | direct unauthenticated request | E5 | unobserved; route-only evidence, no form parity |
| `https://etravel.gov.ph/` + `Scan QR Code` | 2026-08-01 | Cruise QR public modal | Scan QR Code; Close | dialog + button | Close | n/a | user clicks public cruise QR button | E5 | confirms cruise public action exists, but no ordinary passenger field |
| `https://etravel.gov.ph/frequently-asked-questions` | 2026-08-01 | FAQ | official site, required/except populations, free registration, 72-hour registration, QR code guidance | static text/links | official `https://etravel.gov.ph`, `https://etravel.gov.ph/search` | n/a | public FAQ | E1/E5 | confirmed eligibility/free/72h/QR notices; not per-field form parity |
| `https://etravel.gov.ph/data-policy` | 2026-08-01 | Data Policy | Data Collection and Use lists Email Address, First Name, Middle Name, Last Name, Suffix, Passport Number, Sex, Birth Date, Civil Status, Nationality, Mobile Number, Address, Date of Arrival, Airport/Seaport, Type of Traveller, Purpose, Country of Origin, Name of Airline/Vessel, Passenger Type, Flight Number, vaccine fields | static text | links Home/Data Policy/FAQs/Contact/Sign In; language selector | n/a | public data policy | E1/E5 | confirmed broad collected categories; requiredness/control/page order unobserved |
| `https://customs.etravel.gov.ph/data-policy` | 2026-08-01 | Customs Data Policy | same eTravel privacy/data collection categories; footer says register within 72 hours and present eTravel QR code to flight boarding | static text | links Home/Data Policy/FAQ/Contact | n/a | public customs data policy | E1/E5 | confirmed customs domain public policy; not customs form parity |
| `https://etravel.gov.ph/entry-guidelines` | 2026-08-01 | Entry Guidelines | Entry Guidelines; Fully Vaccinated; Unvaccinated or Partially Vaccinated | static text | links Home/Data Policy/FAQs/Contact/Sign In; language selector | n/a | public health guidance | E1/E5 | confirmed public health context only; current health form controls unobserved |

### 停止位置

- 最后一个普通 passenger 尝试位置：`https://etravel.gov.ph/new-travel-declaration`。
- 官方行为：未登录/session 缺失时自动回到 `https://etravel.gov.ph/?sessionExpired=true`。
- 阻断原因：账号/session gate。继续前必须进入登录/注册、邮箱、OTP/CAPTCHA 或账号流程；本轮明确禁止。
- PH-A 未输入邮箱、密码、OTP、申请人资料或合成测试申请值；因此没有进入 Foreign national + AIR 的实际表单第一页。

### 逐字段比对结论

| 合同区域 | 真实官网可见结果 | 比对状态 | 说明 |
| --- | --- | --- | --- |
| Account login | Email address、Password、Forgot Password、Create account 可见 | confirmed | 这些是 account runtime data/secret，不是 applicant form answer。 |
| Account creation | Enter Email address + Continue 可见 | confirmed | 账号创建先于 passenger form；不得把邮箱/OTP/password 写入普通申请答案。 |
| Home/public notice | eTravel is FREE、eGovPH app、Cruise QR、language selector 可见 | confirmed | 支持 PH-D 免费/非签证边界文案的一部分；不证明 passenger fields。 |
| Ordinary passenger `new-travel-declaration` | 未登录被 sessionExpired gate 阻断 | unobserved | Foreign national + AIR、Filipino、SEA、transit、destination、health、family、customs/currency、signature、summary 全部未能实际逐页可见。 |
| Cruise/special routes | 独立 route 存在但 unauthenticated 不显示表单 | confirmed as diverted/gated | 支持普通 passenger 合同排除 cruise/special；不证明其字段。 |
| FAQ eligibility | arriving Filipino/foreign passengers、crewmembers、except identities 可见 | confirmed | 支持 unsupported/diversion identity；不证明 ordinary form控件。 |
| Data Policy field categories | broad collected categories 可见 | confirmed as broad categories | 只能证明类别，不证明 required、control type、field key、当前 Review payload。 |
| Health Entry Guidelines | public health/testing copy 可见 | confirmed context only | 不足以确认 `with_negative_antigen` 等当前控件显示条件。 |

### 不可见页面清单与屏蔽原因

- Foreign national + AIR ordinary arrival：blocked by login/session gate before first declaration page。
- Filipino + AIR ordinary arrival：blocked by login/session gate。
- SEA ordinary arrival：blocked by login/session gate。
- Transit branch：blocked by login/session gate。
- Destination Residence/Hotel/Transit/TRAVEL_PORT branches：blocked by login/session gate。
- Health declaration questions：blocked by login/session gate。
- Family member selection/accompanied counts：blocked by login/session gate。
- Baggage/general customs/currency declaration：blocked by login/session gate。
- Declaration attachments/signature：blocked by login/session gate。
- Summary/Review/final submit/reference/QR：blocked by login/session gate and final submit prohibition。

### 对 PH-B 的具体修正建议

- 不要把本轮 E5 解释为 passenger field parity；PH-B schema 仍只能把 E2 bundle/API 字段作为 proposed/needs_review contract，不能标“官网逐页已确认”。
- `account.email`、`account.password`、OTP 继续保持 runtime/account 边界，不进入 `visa_form_fields`、application answers、fixtures、文档示例或日志。
- 如果 schema/seed 或 tests 需要 “first visible official step”，应把 Account/Login gate 作为实际 first visible step；ordinary passenger pages需要后续授权 stop-before-submit session 才能升级。
- Cruise/special 继续从 ordinary passenger schema 分流；本轮真实页面只证明公开入口/route/gate，不证明可复用普通 passenger fields。
- 所有 required、option code、file rule、Review payload、hidden fields 仍需第三轮受控官方 session；PH-B 不应因 current contract 中 `verified_public` 误以为已经有 logged-in visible page proof。

### 本轮未运行

- 未登录、未创建账号、未输入邮箱、未收 OTP、未触发/求解 CAPTCHA、未进入官方申报表单。
- 未使用真实或合成申请人资料；未上传文件；未进入 Review；未最终提交；未获取 reference 或 QR。
- 未运行 migration、seed、部署、测试或任何产品代码命令。
- 未修改产品代码、协调总览、PH-B/PH-C/PH-D worklog 或其他文件。

## 下一轮：Foreigner + AIR 官网逐页核实

> 状态：已完成安全边界内的官方站点尝试，2026-08-01（Asia/Singapore）。目标路径为 ordinary Foreigner + AIR arrival。结果：官方普通申报页在未登录/session 缺失时被拦截，未能进入 Foreigner + AIR 表单第一页。本轮只写 PH-A worklog，未修改字段合同或任何产品代码。

### 重新读取

- `docs/philippines-launch-coordination.md`
- `docs/philippines-launch-worklogs/PH-A.md`
- `docs/philippines-launch-worklogs/PH-B.md`
- `docs/philippines-launch-worklogs/PH-C.md`
- `docs/philippines-launch-worklogs/PH-D.md`

### 官方访问边界

- 仅访问官方 `https://etravel.gov.ph`。
- 未使用官方测试环境以外的未知环境；未发现可公开进入 Foreigner + AIR passenger form 的官方测试入口。
- 未输入邮箱、账号、密码、OTP、Cookie、密钥、真实申请人资料或合成申请人资料。
- 未注册账号、未绕过 CAPTCHA/Turnstile、未付费解码、未付款、未上传文件、未进入 Review、未最终提交。
- 页面出现 `cf-turnstile-response` hidden input，但 PH-A 未记录其值、未解码、未尝试绕过。

### Foreigner + AIR 逐页矩阵（实际可见）

| Step order | 官方 URL | 访问日期 | 页面名称 | 英文原始题目/帮助文字 | 控件类型 | 必填标记/校验 | 显示条件 | 可见选项 label | option value | 文件上传要求 | 下一步后变化 | 对应 VIZA 字段 | 比对状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | `https://etravel.gov.ph/` | 2026-08-01 | Home | Philippine Travel Information System; Simplify your travel with eTravel; eTravel is FREE; Download eGovPH app; For Cruise Travel Registration | static text + buttons/links + language select | no required marker; n/a | public home | `Click here to Sign In`; `Scan QR Code`; `Home`; `Data Policy`; `FAQs`; `Contact`; `Sign In`; language labels `English`, `Chinese`, `Korean`, `Japanese` | language values not inspected; app store hrefs visible | none | Clicking sign-in path leads to login/account gate, not passenger form | static notice/action; not applicant answer | confirmed for public entry only |
| 1 | `https://etravel.gov.ph/signin` | 2026-08-01 | Login | Login; Enter Email address; Password; Forgot Password; Sign in to eTravel with eGovPH; Create an account | text input, password input, buttons/links; hidden Turnstile response input present | no HTML `required` attribute observed on email/password; clicking blank login shows visible `Required` under Email and Password | user chooses Sign In | `Forgot Password`; `Login`; `Sign in to eTravel with eGovPH`; `Create an account` | unknown; no account value entered | none | Blank submit stays on login and shows `Required`; no passenger form appears | `account.email`, `account.password`; runtime/account only | confirmed account gate; not applicant form |
| 2 | `https://etravel.gov.ph/authentication` | 2026-08-01 | Create an account | Create an account; Enter Email address; Continue; Already have an account? Login | text input + submit button + login link; hidden Turnstile response input present | Continue button initially disabled with blank email; blank click/attempt shows visible `Required` under Email | user chooses Create an account | `Continue`; `Already have an account? Login` | unknown; no email entered | none | No forward progress without email/account flow; PH-A stopped | `account.email`; runtime/account only | confirmed account creation gate |
| 3 | `https://etravel.gov.ph/new-travel-declaration` | 2026-08-01 | Ordinary travel declaration direct route | Redirected/landed at public home with `sessionExpired=true`; no Foreigner/AIR fields visible | redirect/session gate | n/a | unauthenticated direct access to ordinary declaration route | public home controls only after redirect | unknown | none | Final URL became `https://etravel.gov.ph/?sessionExpired=true`; no declaration step rendered | all Foreigner + AIR applicant fields | unobserved due login/session gate |

### Foreigner + AIR 目标字段核实结果

| Target area | Requested fields | Actual official-page result | Status | Notes for VIZA comparison |
| --- | --- | --- | --- | --- |
| Foreign identity | foreigner identity, nationality, passport holder type | No Foreigner/AIR passenger form page rendered before account/session gate | unobserved | Existing VIZA fields cannot be marked官网逐页 confirmed from this run. |
| Passport/personal | nationality, passport number, passport issue/expiry, names, sex, birth date, residence | Blocked before ordinary declaration page | unobserved | Public Data Policy supports broad collection categories only, not live form controls. |
| Residence | country/address fields | Blocked before ordinary declaration page | unobserved | No page-level requiredness, help text, or validation observed. |
| AIR travel | airline, flight number, origin, arrival airport, departure/arrival date | Blocked before ordinary declaration page | unobserved | Direct URL did not expose AIR step; no option labels or values confirmed in live page. |
| Transit | with transit, transit country/airport/date | Blocked before ordinary declaration page | unobserved | Cannot confirm add/remove behavior after toggling transit. |
| Purpose | purpose of travel, return date conditions | Blocked before ordinary declaration page | unobserved | Cannot confirm visible purpose options or value codes. |
| Philippines destination | accommodation type, hotel/residence/transit address | Blocked before ordinary declaration page | unobserved | Cannot confirm visible options, hotel search, address validation. |
| Health | symptoms/recent travel/exposure/antigen questions | Blocked before ordinary declaration page | unobserved | Entry Guidelines are public context only; not form evidence. |
| Family/companions | family member selection and accompanied counts | Blocked before ordinary declaration page | unobserved | No live page observed. |
| Baggage/customs | baggage counts, goods, checklist, customs declaration | Blocked before ordinary declaration page | unobserved | No live customs page observed. |
| Currency | currency thresholds, source, purpose, transfer method, BSP/courier | Blocked before ordinary declaration page | unobserved | No live currency page observed. |
| Attachments/signature/final declaration | travel document, signature, final certify/summary | Blocked before ordinary declaration page and final submit prohibited | unobserved | No file upload or signature control observed. |

### 缺失页面与屏蔽原因

- `New Travel Declaration` Step 1 for Foreigner + AIR: blocked by login/session gate.
- Account continuation after Create account: blocked by requirement to enter an email and proceed into account/OTP/CAPTCHA flow; not allowed in this task.
- Login continuation: blocked by account/password/Turnstile and unknown account; not allowed in this task.
- All subsequent pages for Foreigner + AIR arrival remain missing: traveller information, permanent residence, travel details, destination, health, family, baggage, customs, currency, attachments, signature, summary/review.

### 对现有 VIZA 表单的具体差异

- VIZA currently has a full Foreigner + AIR applicant field set, but this run cannot confirm any of those applicant questions as actually visible on the live official site because the official page requires login/session before the first ordinary declaration page.
- The first actually visible official questions are account/runtime questions: `Enter Email address` and `Password` on login, and `Enter Email address` on create account. These must stay outside `visa_form_fields` and applicant answers.
- Existing VIZA fields for airline, flight number, origin, arrival airport/date, purpose, accommodation, health, customs, currency, attachments, signature and final declaration should remain `unobserved` for “live official page walkthrough” until an approved non-sensitive account/session reaches stop-before-submit.
- PH-B should not upgrade requiredness, option values, file requirements, text length/format, or validation rules from this run; the only confirmed required validations are blank account Email/Password on login and blank Email on account creation.

### 停止位置

- Stopped at `https://etravel.gov.ph/new-travel-declaration`, which redirected to `https://etravel.gov.ph/?sessionExpired=true`.
- Last confirmed question before stop: account gate fields `Enter Email address` and `Password` on Login, plus `Enter Email address` on Create account.
- Reason for stopping: continuing requires login/account registration, email/OTP/CAPTCHA/session handling, or unknown credentials, all prohibited by this task.

### 本轮未运行

- 未修改产品代码、schema、seed、runner、前端、协调总览、字段合同或 PH-B/PH-C/PH-D worklog。
- 未运行 migration、seed、部署、测试、官方账号注册、真实 OTP、CAPTCHA 解码、付款、Review 或最终提交。
- 未记录账号、密码、OTP、Cookie、Turnstile token、密钥或任何申请人资料。

## 下一轮：Foreigner + AIR 登录 canary（IMAP alias）

> 状态：已按授权尝试运行官方登录 canary，2026-08-01（Asia/Singapore）。命令使用 `run-ph-etravel-smoke.ts` 的 IMAP plus-address 能力，并包含 `--imap-mailbox --new-imap-alias --local-browser --headless=false --travel-type arrival --transport air --passport-holder foreigner`。命令未包含 `--submit`，因此脚本处于 stop-before-submit/非最终提交模式。

### 边界与保密

- 用户已授权使用 VIZA 已配置的自动生成邮箱功能创建非真实申请人的菲律宾 eTravel 测试账号并登录，仅用于官网表单逐页核实。
- 本轮未修改任何产品代码、schema、seed、runner、前端、协调总览、字段合同或其他 worklog。
- 未在本 worklog 记录邮箱地址、密码、MPIN、OTP、Cookie、token、Turnstile 响应、密钥或任何申请人资料。
- 未使用真实申请人资料；仅允许脚本内置合成测试资料，但本次未进入申请表单填写阶段。
- 未绕过 CAPTCHA/Turnstile，未使用付费解码，未付款，未最终提交。

### 执行结果

| 项目 | 结果 |
| --- | --- |
| 账号注册 | 未成功；未到达账号创建/OTP 阶段 |
| OTP 自动读取 | 未发生；未到达 OTP 阶段 |
| 登录 | 未成功；未到达登录成功/仪表盘 |
| Foreigner + AIR 表单 | 未进入；无 passenger form 字段证据 |
| 官方停止位置 | eTravel 首页 / landing |
| CAPTCHA/Turnstile | runner 日志显示发现 Turnstile sitekey；未解码、未绕过 |
| 错误 | 本地浏览器页面/上下文在 Turnstile/landing 阶段关闭，runner 返回 `ph_etravel_unexpected_portal_error` |
| 截图 | 仅确认停在 eTravel 首页；未包含账号、OTP、申请人资料或表单页 |

### 本轮实际可见页面

| Step order | 官方 URL/步骤 | 页面名称 | 可见题目/控件 | Required/校验 | 对应 VIZA 字段 | 比对状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | eTravel landing | Home | eTravel logo, Philippine Travel Information System, eTravel is FREE, `Click here to Sign In`, eGovPH app links, Cruise QR action | n/a | static notice/action | confirmed public landing |
| 1 | Turnstile detection during runner startup | Browser challenge layer | Turnstile sitekey was detected by runner logs | user/manual handling may be required; no solving performed | account/runtime gate, not applicant answer | blocked before login/account |
| 2 | Login/account/OTP | not reached | none | n/a | account runtime data/secret | unobserved |
| 3 | Foreigner + AIR ordinary declaration | not reached | none | n/a | all applicant fields | unobserved |

### 字段证据结论

- 本次 canary 没有取得 Foreigner + AIR 官网表单逐题证据。
- 所有目标字段仍为 live page `unobserved`：外籍身份、国籍、护照、居住信息、AIR 航班/航空公司/航班号/出发地/抵达机场/日期、转机、旅行目的、菲律宾地址/住宿、健康、同行人、行李、海关、货币、附件、签名、声明和 Summary/Review。
- 现有 VIZA 表单不得因本次 canary 提升 required、option value、文件要求或控件类型状态。

### 是否需要用户手动处理 CAPTCHA

- 是。若继续此官方 canary，需要用户本人在本地浏览器中处理官方 Turnstile/CAPTCHA 或提供已授权可用的官方测试会话。
- PH-A 不会绕过、付费解码或修改脚本以规避该阻断。

### 下一步请求

- 请求协调者/用户决定是否提供一个可在本地浏览器手动通过 Turnstile 的受控窗口，或提供已授权的非敏感测试账号/session。没有该步骤，PH-A 无法完成 Foreigner + AIR 的真实官网逐页字段矩阵。


## 第二轮登录态 AIR UI 爬取：ordinary passenger + AIR + ARRIVAL（2026-08-01）

> 状态：已使用官方 `https://etravel.gov.ph` 的已登录 Chrome 会话完成可见 UI 事实采集。目标路径为普通旅客 `AIR + ARRIVAL`；本轮只写 PH-A worklog，未修改字段合同、产品代码、schema、seed、runner、前端、协调总览或其他 worklog。访问日期：2026-08-01（Asia/Singapore）。
>
> 保密边界：未记录账号、邮箱、密码、MPIN、OTP、Cookie、token、护照号、姓名、地址值、记录 UUID、截图路径或任何申请人资料。URL 中的 `id` 仅在本地浏览器使用，本文统一写作 `id=[redacted]`。未点击最终 Submit；停在签名页 `By Clicking "Next"... true and correct...` 之前，未点击该页 Next。

### 本轮官方访问与停止位置

| Step | 官方 URL | 页面/步骤 | 实际结果 | 证据等级 |
| --- | --- | --- | --- | --- |
| 0 | `https://etravel.gov.ph/dashboard` | Dashboard | 已登录 dashboard 可见 `New Travel Declaration VIA AIR or SEA (For Cargo Vessel only)`、`New Cruise Ship (郵輪) Travel Declaration`、Add Family Member、Travel History；未记录任何记录号或申请人值。 | live logged-in UI |
| 1 | `https://etravel.gov.ph/new-travel-declaration` | Travel Registration | 可见 `FOR ME (Current User)` / `FOR OTHER (Family Member)`、`AIR` / `SEA`、`ARRIVAL Entering the Philippines` / `DEPARTURE Leaving the Philippines`、Data Privacy/Affidavit 文案、Continue；选择 AIR+ARRIVAL 后出现 `Special Flight`。 | live logged-in UI |
| 2 | `https://etravel.gov.ph/wizard/me?id=[redacted]&wizard_page=0` | Travel Details - Philippine Arrival (via AIR) | 进入 AIR arrival page 0；核验 Special Flight、目的、转机、目的地三分支。 | live logged-in UI |
| 3 | `https://etravel.gov.ph/wizard/me?id=[redacted]&wizard_page=1` | Health Declaration | 核验最近 30 天旅行史、暴露史、生病史及 Yes 条件字段。 | live logged-in UI |
| 4 | `https://etravel.gov.ph/wizard/me?id=[redacted]&wizard_page=2` | Customs Declaration Confirmation | 可见核心问题 `Do you have baggage or currency to declare?`；本轮未通过按钮提交新答案，仅从已有测试记录页面号观察。 | live logged-in UI |
| 5 | `https://etravel.gov.ph/wizard/me?id=[redacted]&wizard_page=3` | Other Travel Details | 可见家庭同行人数、行李件数、首次访菲。 | live logged-in UI |
| 6 | `https://etravel.gov.ph/wizard/me?id=[redacted]&wizard_page=4` | Customs General Declaration | 可见 goods amount、12 项 general declaration、Add Item。 | live logged-in UI |
| 7 | `https://etravel.gov.ph/wizard/me?id=[redacted]&wizard_page=5` | Customs Currency Declaration | 可见 owner/recipient/currency item/BSP/source/purpose/transport method 及条件字段。 | live logged-in UI |
| 8 | `https://etravel.gov.ph/wizard/me?id=[redacted]&wizard_page=6` | Customs Declaration attachments and signature | 可见 `Take a photo or upload a file.`、canvas signature、`Clear`、certification text、Previous/Next；PH-A 停在此页，未点击 Next。 | live logged-in UI stop-before-submit |

### Start 页字段矩阵

| 官方步骤 | 原始英文题目/文字 | 控件类型 | 可见选项 label | option value/code | Required/校验 | 显示条件 | VIZA 对应 | 比对 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Travel Registration | `FOR ME (Current User)` / `FOR OTHER (Family Member)` | button segmented choice | FOR ME, FOR OTHER | unknown | no visible HTML required attr observed | dashboard New Travel Declaration | runtime applicant selector / family flow | confirmed |
| Travel Registration | transport selector | button segmented choice | `AIR`, `SEA` | label observed; DOM value not safely confirmed | no visible HTML required attr observed | start page | `transport_type` | confirmed |
| Travel Registration | `ARRIVAL Entering the Philippines` / `DEPARTURE Leaving the Philippines` | radio | ARRIVAL, DEPARTURE | radio name `flight_type`; value not captured | no visible HTML required attr observed | start page | arrival scope gate | confirmed |
| Travel Registration | `Special Flight` | checkbox | checked/unchecked | checkbox id/name observed as `flight_number` on start page | no visible HTML required attr observed | shown after AIR + ARRIVAL | `is_special_flight` / special flight branch | confirmed |
| Travel Registration | `By clicking "Continue", you agree to our Data Privacy and Affidavit of Undertaking` | static notice + submit button | Continue | n/a | no final submit; ordinary wizard continue only | start page | static notice/action | confirmed |

### AIR page 0 字段矩阵

| 官方步骤 | 官方 key/control | 原始英文 label/help | 控件类型 | Visible options / value | Required/校验 | 显示条件 | VIZA 对应 | 比对 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Travel Details | `purpose_of_visit_code` | `Purpose of Travel` | Headless UI combobox text input | visible labels: OFW, Business/Professional, Convention/Conference, Education/Training/Studies, Government/Official Mission, Health/Medical Reason, Holiday/Pleasure/Vacation, Incentive, Meetings, Others, Religion/Pilgrimage, Returning Resident, Trade Fair/Exhibition, Transit, Visit Friends/Relatives, Work/Employment; option codes not captured in this UI pass | no visible HTML required attr observed; Review requiredness not tested | AIR arrival page 0 | `purpose_of_travel` | confirmed labels; value codes unchanged from prior public API evidence, not re-fetched here |
| Travel Details | passenger/traveller select | `Traveller Type` | react-select combobox | field visible; dropdown option values not re-opened successfully in this pass; coordinator-known labels AIRCRAFT PASSENGER/FLIGHT CREW remain pending direct PH-A re-capture | no visible HTML required attr observed | AIR arrival page 0 | `traveller_type` / passenger guard | partially confirmed field; options needs_review in this pass |
| Travel Details | `travel_company_code` | `Name of Airline` | Headless UI combobox | label/control visible; option labels/codes not captured in this pass | no visible HTML required attr observed | AIR arrival page 0 | `airline_name` / official airline code | confirmed field; options unobserved |
| Travel Details normal flight | `flight_number` | `Flight Number` | Headless UI combobox text input | value not recorded | no visible HTML required attr observed | AIR arrival when Special Flight is not selected | `flight_number` | confirmed; key differs from special branch |
| Travel Details special flight | `flight_number_special` | `Specify special flight number`; help `Misdeclaration of special flight will cause travel delay` | text input | free text; value not recorded | no visible HTML required attr observed | start page `Special Flight` checked before Continue | `special_flight_number` | confirmed mismatch risk if runner fills normal `flight_number` in special branch |
| Travel Details | `origin_country_code` | `Country of Origin` | Headless UI combobox | country options not captured in this pass | no visible HTML required attr observed | AIR arrival page 0 | `origin_country` | confirmed field |
| Travel Details | `origin_port` | `Airport of Origin` | text input | free text; value not recorded | no visible HTML required attr observed | AIR arrival page 0 | `airport_of_origin` | confirmed official key `origin_port` |
| Travel Details | `departure_date` | `Date of Departure` | text/date picker input | date value not recorded | no visible HTML required attr observed | AIR arrival page 0 | `flight_departure_date` | confirmed official key `departure_date` |
| Travel Details | `with_transit` | `With Transit (Connecting Flight)?` | checkbox | boolean; checked state opens transit section | no visible HTML required attr observed | AIR arrival page 0 | `with_transit` | confirmed |
| Travel Details | `destination_port_code` | `Airport of Destination` | Headless UI combobox | airport options not captured in this pass | no visible HTML required attr observed | AIR arrival page 0 | `airport_of_destination` / `port_of_entry` | confirmed official key `destination_port_code` |
| Travel Details | `arrival_date` | `Date of Arrival` | text/date picker input | date value not recorded | no visible HTML required attr observed | AIR arrival page 0 | `flight_arrival_date` | confirmed official key `arrival_date` |
| Destination | `stay_location_type` | `Destination upon arrival in the Philippines` | radio group | `RESIDENCE` = Residence; `HOTEL` = Hotel/Resort; `TRANSIT` = Transit Via Airport | no visible HTML required attr observed | AIR arrival page 0 | `destination_type` | confirmed labels and DOM values |
| Destination Residence | `is_destination_same_as_permanent_address`; `destination_upon_arrival_in_philippines` | `Same as Permanent Country of Residence`; `Residence Address` | checkbox + text input | boolean + free text; value not recorded | no visible HTML required attr observed | `stay_location_type=RESIDENCE` | same-address flag + residence address | confirmed |
| Destination Hotel/Resort | `destination_upon_arrival_in_philippines` | `Hotel, Resorts, AirBnb, Tourist destinations, etc.` | text/search input | value not recorded; hotel option source not captured in this pass | no visible HTML required attr observed | `stay_location_type=HOTEL`; Residence same-address checkbox hidden | hotel/resort destination | confirmed branch; option source needs_review |
| Destination Transit Via Airport | react-select airport control; `transit_destination_country_code` | `Airport`; `Country of Destination` | react-select combobox + Headless UI country combobox | airport fixed option labels/codes not captured in this pass; country options not captured | no visible HTML required attr observed | `stay_location_type=TRANSIT`; residence/hotel text hidden | airport transit destination + onward country | confirmed branch; airport codes needs_review |

### AIR page 0 条件矩阵

| 条件 | 观察到的显示变化 | 新增/隐藏字段 | 状态 |
| --- | --- | --- | --- |
| Start `Special Flight` unchecked | AIR page 0 shows `Flight Number` as `flight_number` combobox | normal flight-number combobox visible | confirmed |
| Start `Special Flight` checked | AIR page 0 replaces normal flight number with `Specify special flight number` / `flight_number_special`; help warns misdeclaration can cause travel delay | `flight_number_special` shown; normal `flight_number` hidden | confirmed |
| `With Transit (Connecting Flight)?` checked | adds subsection `Transit (Connecting Flight)` | `transit_country_code` / `Country of Transit`; `transit_port` / `Airport of Transit`; `transit_date` / `Date of Transit` | confirmed |
| Purpose `Holiday/Pleasure/Vacation` | no `Date of Return` or other new field appeared on visible AIR page 0 during this pass | none observed | confirmed non-appearance in this session; requiredness still needs_review |
| Purpose `Transit` | no `Date of Return` or other new field appeared on visible AIR page 0 during this pass | none observed | confirmed non-appearance in this session; requiredness still needs_review |
| Purpose `Work/Employment` | no `Date of Return` or other new field appeared on visible AIR page 0 during this pass | none observed | confirmed non-appearance in this session; requiredness still needs_review |
| Purpose `OFW` | no `Date of Return` or other new field appeared on visible AIR page 0 during this pass | none observed | confirmed non-appearance in this session; Foreigner-vs-Filipino availability still needs_review |
| Destination `Residence` | shows same-as-permanent checkbox and `Residence Address` | `is_destination_same_as_permanent_address`, `destination_upon_arrival_in_philippines`; hotel/transit child fields hidden | confirmed |
| Destination `Hotel/Resort` | hides same-as-permanent checkbox; shows hotel/resort destination text/search field | `destination_upon_arrival_in_philippines`; Residence same-address hidden | confirmed |
| Destination `Transit Via Airport` | hides residence/hotel address field; shows `Airport` and `Country of Destination` | airport react-select control observed as `react-select-3-input`; country key `transit_destination_country_code` | confirmed labels; airport official value key still needs_review |

### Health page matrix

| 官方步骤 | 官方 key/control | 原始英文 label/help | 控件类型 | Visible options / values | Required/校验 | 条件 | VIZA 对应 | 比对 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Health Declaration | n/a | `Any false declaration made in this context may subject the traveler to legal penalties under applicable Philippine laws including public health, quarantine and communicable diseases regulations.` | static notice | n/a | n/a | page 1 | health static notice | confirmed |
| Health Declaration | `meta.with_recent_travel_history` | `Do you have any recent travel history in the last 30 days?` | radio | Yes/No; radio ids `meta.with_recent_travel_history0/1` | no visible HTML required attr observed | page 1 | `has_recent_travel_history` | confirmed |
| Health Declaration | recent travel child | `Country(ies) worked, visited and transited in the last 30 days`; `Add` | country row/action button | country option values not captured | no visible HTML required attr observed | `meta.with_recent_travel_history` Yes | recent travel countries | confirmed branch; values needs_review |
| Health Declaration | `is_with_history_exposure` | `Have you had any history of exposure to a person who is sick or known to have communicable/infectious disease in the past 30 days prior to travel?` | radio | Yes/No | no visible HTML required attr observed | page 1 | exposure history | confirmed |
| Health Declaration | `is_sicked_within_thirty_days` | `Have you been sick in the past 30 days?` | radio | Yes/No | no visible HTML required attr observed | page 1 | sick/symptoms gate | confirmed |
| Health Declaration | `sickness_symptoms.0..14` | `Symptoms` | checkbox list | Altered Mental Status, Colds, Cough, Diarrhea, Difficulty of Breathing, Dizziness, Fever, Headache, Loss of appetite, Loss of smell, Loss of taste, Muscle Pain, Nausea, Rashes, vesicles or blisters, Sore throat | no visible HTML required attr observed | `is_sicked_within_thirty_days` Yes | symptoms | confirmed labels and 15 controls |

### Customs / baggage / currency / signature matrix

| 官方步骤 | 官方 key/control | 原始英文 label/help | 控件类型 | Visible options / values | Required/校验 | 条件 | VIZA 对应 | 比对 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Customs Confirmation | n/a | `Do you have baggage or currency to declare?` | Yes/No buttons | labels Yes/No; values not captured | no required attr captured; branch action not re-submitted | page 2 | customs declaration gate | confirmed |
| Other Travel Details | `accompanied_family_members.below_eighteen` | `Below 18 yrs. old` | text/numeric-looking input | value not recorded | no visible HTML required attr observed | page 3 | family under 18 count | confirmed |
| Other Travel Details | `accompanied_family_members.above_or_equal_eighteen` | `18 yrs. old and above` | text/numeric-looking input | value not recorded | no visible HTML required attr observed | page 3 | family 18+ count | confirmed |
| Other Travel Details | `no_of_checked_in_baggages` | group label `No. of Baggage`; child label `Checked-in (pcs)` | text/numeric-looking input | value not recorded | no visible HTML required attr observed | page 3 | checked baggage count | confirmed official key conflict closed for UI: control key is `no_of_checked_in_baggages`; `No. of Baggage` is group label |
| Other Travel Details | `no_of_hand_carried_baggages` | `Hand-carried (pcs)` | text/numeric-looking input | value not recorded | no visible HTML required attr observed | page 3 | hand-carry baggage count | confirmed |
| Other Travel Details | `first_time_visit` | `First time visiting Philippines?` | radio | Yes/No | no visible HTML required attr observed | page 3 | first time visiting Philippines | confirmed |
| General Declaration | `amount_of_goods_acquired.currency` | `Total Amount of goods purchased and/or acquired abroad?`; `Philippine Peso`; `US Dollar` | radio | labels Philippine Peso / US Dollar; DOM values not recorded here | no visible HTML required attr observed | page 4 when customs positive flow present | goods total currency | confirmed labels |
| General Declaration | `amount_of_goods_acquired.amount` | `Amount` | text/numeric-looking input | value not recorded | no visible HTML required attr observed | page 4 | goods total amount | confirmed |
| General Declaration | `check_lists.0..11.response` | 12 numbered customs questions, including PHP currency over PhP 50,000; foreign currency over USD 10,000; gambling paraphernalia; excess cosmetics/medicines; dangerous drugs; firearms/explosives; commercial alcohol/tobacco; food/plants/animals; communications equipment; cremains/organs/tissues; jewelry/gold/metals/gems; other goods | radio pairs | Yes/No per item; index keys observed as `check_lists.{n}.response` | no visible HTML required attr observed | page 4 | `customs_checklist_1..12` | confirmed UI uses indexed official keys; stable backend ids still needs_review |
| General Declaration | goods item rows | `Add Item`; `Quantity`; `Description`; `Amount in USD`; `Action` | button + repeat row fields | values not recorded | no visible HTML required attr observed | page 4 when goods details present | goods item details | confirmed labels; repeat limits needs_review |
| Currency Declaration | owner block | `Please check if NOT APPLICABLE`; `OWNER OF CURRENCIES OR MONETARY INSTRUMENTS`; Business Name, First Name, Middle Name (optional), Last Name, Suffix (optional), Occupation or Principal Business Activity, Country, No./Bldg./City/State/Province, Postal Code | checkbox + text/combobox inputs | keys include `owner_business_name`, `owner_first_name`, `owner_middle_name`, `owner_last_name`, `owner_occupation`, `owner_country_code`, `owner_street`, `owner_postal_code` | no visible HTML required attr observed | page 5 positive currency flow | currency owner fields | confirmed |
| Currency Declaration | recipient block | `RECIPIENT OF CURRENCIES OR MONETARY INSTRUMENTS` with same personal/business/address labels | text/combobox inputs | keys include `recipient_business_name`, `recipient_first_name`, `recipient_middle_name`, `recipient_last_name`, `recipient_occupation`, `recipient_country_code`, `recipient_street`, `recipient_postal_code` | no visible HTML required attr observed | page 5 positive currency flow | currency recipient fields | confirmed |
| Currency Declaration | currency item block | `CURRENCY OR MONETARY INSTRUMENT INFORMATION`; `Add Item`; `Currency`; `Monetary Instrument`; `Amount`; `Action` | button + repeat row fields | option values not captured in this UI pass | no visible HTML required attr observed | page 5 | currency item rows | confirmed labels; option codes needs_review |
| Currency Declaration | `bsp_authorization_date` | `Date of BSP authorization if transferring Philippine Pesos in excess of PHP50,000` | text/date picker input | value not recorded | no visible HTML required attr observed | page 5 positive currency flow | BSP authorization date | confirmed label/control; document requirement still needs_review |
| Currency Declaration | `currency_sources.0..2` | `Sources of currencies or monetary instruments` | checkbox list | `SALARY` = Salary; `BUSINESS` = Business; `OTHER` = Other (Specify) | no visible HTML required attr observed | page 5 | currency source | confirmed labels and DOM values |
| Currency Declaration | `currency_source_other` | Other source text field | text input | value not recorded | no visible HTML required attr observed | `currency_sources.2` / OTHER checked | other source | confirmed condition |
| Currency Declaration | `transport_purposes.0..4` | `Purpose's of the Transport of Foreign Currencies or Other Foreign Currency-Denominated Bearer Monetary Instruments` | checkbox list | `LEISURE` = Leisure; `MEDICAL` = Medical; `PAYABLES` = Payables; `EDUCATION` = Education; `OTHER` = Other (Specify) | no visible HTML required attr observed | page 5 | currency transport purpose | confirmed labels and DOM values |
| Currency Declaration | `transport_purpose_other` | Other purpose text field | text input | value not recorded | no visible HTML required attr observed | `transport_purposes.4` / OTHER checked | other transport purpose | confirmed condition |
| Currency Declaration | `physical_or_shipped` | `REQUIRED INFORMATION BY THE BOC AND AMLC - OTHER TRAVEL DETAILS`; `If physically transferred by a person`; `If shipped through courrier services` | radio | `is_physically_transferred_by_person`; `is_shipped_thru_courier_service` | no visible HTML required attr observed | page 5 | currency transfer method | confirmed labels and DOM values |
| Currency Declaration physical | `no_of_days_in_philippines`; `last_travel_to_philippines` | `No. of days in the Philippines`; `Last travel to the Philippines` | text/date inputs | values not recorded | no visible HTML required attr observed | `physical_or_shipped = is_physically_transferred_by_person` | physical-transfer travel details | confirmed condition |
| Currency Declaration courier | `courier_name`; `airway_bill_no`; `airway_bill_date` | `Name of Courrier/ Courrier Company`; `Bill of landing/Airway Bill No.`; `Bill of landing/Airway Bill Date` | text/date inputs | values not recorded | no visible HTML required attr observed | `physical_or_shipped = is_shipped_thru_courier_service` | courier transfer details | confirmed condition; official spelling observed as `Courrier` and `Bill of landing` |
| Attachments & Signature | attachment widget | `Take a photo or upload a file.` | visible static/action area; no visible `<input type=file>` in non-value metadata pass | accept/MIME not visible in this live pass | file requiredness not confirmed | page 6 positive customs/currency flow | travel/customs attachment | partially confirmed UI text; file evidence needs_review |
| Attachments & Signature | signature canvas | `Signature`; `Clear`; `By Clicking "Next", you hereby certify under pain of falsification that this declaration is true and correct to the best of my knowledge` | canvas + Clear button + Previous/Next | no signature value recorded | no visible HTML required attr observed; did not click Next | page 6 | customs signature | confirmed canvas/signature page; final Review unobserved |

### 与当前 VIZA 表单/runner 的差异与接口建议

| Area | confirmed / mismatch / unobserved | 具体差异或建议 |
| --- | --- | --- |
| AIR special flight | mismatch risk | Official normal branch uses `flight_number` combobox; Special Flight branch uses text input `flight_number_special` with label `Specify special flight number`. PH-B/PH-C should not map special-flight free text into normal `flight_number` without branch handling. |
| AIR origin/destination keys | confirmed | Official page 0 uses `origin_port` for `Airport of Origin`, `destination_port_code` for `Airport of Destination`, `departure_date`, `arrival_date`. VIZA flat aliases may remain, but runner mapping must target these official controls. |
| With Transit | confirmed | `with_transit=true` shows `transit_country_code`, `transit_port`, `transit_date`; VIZA mapping should treat `transit_port` as the official airport text field. |
| Destination address conflict | confirmed | Both Residence and Hotel/Resort use `destination_upon_arrival_in_philippines`; label changes to `Residence Address` vs hotel/resort help text. VIZA can keep separate flat fields only as aliases into this official control. |
| Transit Via Airport | confirmed labels; value key partly needs_review | Branch shows an unlabeled react-select airport control under label `Airport` plus `transit_destination_country_code` / `Country of Destination`; airport value key/code remains needs_review because the react-select DOM did not expose a stable name/value in this pass. |
| Purpose conditional `Date of Return` | confirmed non-appearance in this session | Holiday/Pleasure/Vacation, Transit, Work/Employment, OFW did not add `Date of Return` on visible AIR page 0 in this logged-in session. Do not make return date required from this UI pass; keep any bundle/API-triggered condition under needs_review until Review validation confirms persona-specific behavior. |
| Traveller Type options | unobserved in this pass | Field is visible, but this pass did not successfully reopen its dropdown. Keep AIRCRAFT PASSENGER/FLIGHT CREW as coordinator-known/needs_review unless another PH-A capture confirms directly. Ordinary VIZA should continue diverting crew. |
| Baggage key conflict | confirmed UI key | Official control key is `no_of_checked_in_baggages`; `No. of Baggage` is the group label, not the checked-baggage answer key. |
| Customs checklist keys | mismatch risk | Live UI uses indexed keys `check_lists.0.response` through `check_lists.11.response`, not stable `customs_checklist_1` names. VIZA may use flat semantic keys, but PH-C needs index-to-question mapping and stable backend id proof before final parity. |
| Currency source/purpose/method | confirmed | DOM values observed: sources `SALARY`, `BUSINESS`, `OTHER`; purposes `LEISURE`, `MEDICAL`, `PAYABLES`, `EDUCATION`, `OTHER`; transfer `is_physically_transferred_by_person`, `is_shipped_thru_courier_service`. |
| Attachments | partially confirmed | Page 6 shows attachment action text, but no visible file input attributes/MIME/required state were observable in this pass. Keep file requirements needs_review. |
| Signature | confirmed stop-before-submit | Canvas signature and certification text visible; PH-A stopped before page-6 Next. Summary/Review/final submit/reference/QR remain unobserved. |

### 仍未确认项

- Foreigner身份页、passport/profile/photo onboarding、nationality/residence/profile photo 文件要求：本轮从已登录 dashboard/new declaration 进入时未重新经过 profile/onboarding 页；不得把 profile photo required/file rules标为 confirmed。
- Traveller Type dropdown values、airline list values、airport destination values、Transit Via Airport airport codes：本轮未成功从 live UI 捕获稳定 option value/code。
- Page 0 及后续字段的最终 requiredness：本轮只观察可见 HTML/ARIA required 标记，未通过空值 Next validation 或 Review validation证明哪些字段会阻断。
- General Declaration 12 项的稳定官方 backend ids / payload ids：只观察到 UI indexed controls `check_lists.{n}.response` 与原始题目文本。
- Attachment upload MIME、大小、是否必须、是否需要 customs/goods/currency正向时上传：Page 6 只确认 `Take a photo or upload a file.` 文案和签名 canvas。
- Summary/Review 页面、最终 Submit、official reference、QR：未进入；PH-A停在签名页 Next 之前。
- SEA、departure、cruise、crew、special registration、外交/9(e)/diplomatic/official/service passport：不属于本轮爬取范围；本轮未重新研究或实现。

### 本轮未运行 / 未触碰

- 未运行 migration、seed、部署、测试、runner smoke、真实最终提交、付款、付费 CAPTCHA、绕过 CAPTCHA、上传真实文件或获取真实回执。
- 未修改产品代码、schema、seed、runner、frontend、协调总览、PH-B/PH-C/PH-D worklog 或字段合同。
- 未记录账号、邮箱、密码、MPIN、OTP、Cookie、token、申请人资料、记录 UUID、截图路径或未脱敏页面值。


## 协调者同步：登录态 Review/Summary 证据纳入（2026-08-01）

> 来源：`docs/philippines-launch-coordination.md` 第 16 节。主协调者在用户人工完成 Cloudflare/login 与测试签名后进入官方 eTravel arrival wizard；未点击最终 `Submit`，未生成 official reference/QR，未上传真实文件，未记录账号、OTP、Cookie、护照号、手机号、姓名或其他申请人资料。PH-A 本轮仅把该脱敏事实纳入后续 evidence，不继续操作官网、不提交。

### 新增可采信事实

| 官方步骤 | 新增事实 | Evidence level | PH-A contract implication |
| --- | --- | --- | --- |
| Wizard page 5/6: Customs Declaration attachments and signature | Signature 页点击 `Next` 且未签名时，官方显示 `Required` 与 `Please make sure to fill out all required fields.` | coordinator live logged-in Review evidence | `signature` canvas 是 Review 前必填；这比上一节“仅看到 canvas/未测 required”更强。 |
| Wizard page 5/6 -> page 7 | 签名通过后不会直接进入 Review，而是进入 `Family Member(s)` 页。 | coordinator live logged-in Review evidence | wizard 顺序需插入 family member selection/confirmation step；runner 不能假设 signature Next 后直接 Summary。 |
| Wizard page 7: Family Member(s) | 页面文案：`Travel declarations will also be generated for the selected family members.`；无记录时显示 `No Record Found!` 与 `Add Family Member`。 | coordinator live logged-in Review evidence | family member 页面是 Review 前官方步骤；未选择成员不等同于无字段，只是需要确认。 |
| Wizard page 7 confirmation modal | 未选择任何成员点 `Next`，弹窗：`You haven't selected any family members for this travel registration. Are you sure you're not traveling with a companion?`；按钮为 `No` / `Yes`。 | coordinator live logged-in Review evidence | 无随行家庭成员路径需要处理确认弹窗；`Yes` 才继续，`No` 返回选择。 |
| Wizard page 8: New Travel Declaration Summary | Review 页标题 `New Travel Declaration Summary`；说明 `Kindly double check the information before submitting.`；底部按钮 `Previous` 和最终 `Submit`。 | coordinator live logged-in stop-before-submit evidence | Review/Summary 已可到达；`Submit` 是最终提交动作，仍禁止点击。 |

### Review/Summary 脱敏字段顺序

| Review group | 脱敏字段顺序 |
| --- | --- |
| Personal Information | Travel Document / passport holder type; Email address; First/Middle/Last Name/Suffix; Passport Number; Passport Issuing Authority; Passport Issued Date; Sex; Birth Date; Country of Birth; Country/nationality display; Mobile Number; Occupation |
| Permanent Country of Residence | Country; No./Bldg./City/State/Province; Address Line 2 |
| Travel Details - Philippine Arrival (via AIR) | Purpose of Travel; Traveller Type; Destination upon arrival in the Philippines; Residence Address; accompanied family members below 18 / 18 and above; First time visiting Philippines?; last departure date from the Philippines; No. of Baggage: Checked-in / Hand-carried |
| Flight Information | Name of Airline; Flight Number; Origin: Country of Origin / Airport of Origin / Date of Departure; Transit: Country of Transit / Airport of Transit / Date of Transit; Destination: Country of Destination / Airport of Destination / Date of Arrival |
| Health Declaration | Country(ies) worked, visited and transited in the last 30 days; exposure to sick/communicable disease in past 30 days; been sick in past 30 days; Symptoms |
| For Customs - General Declaration | Total Amount of goods purchased/acquired abroad: Currency, Amount; 12 customs checklist responses in official displayed order |
| For Customs - Currency Declaration | Owner of currencies or monetary instruments; Recipient of currencies or monetary instruments; BSP authorization date if over PHP50,000; Sources; Purposes; BOC/AMLC other travel details |
| Declaration Attachments | `NO ATTACHMENTS` observed in this controlled path |
| Declaration Signature | Signature image displayed |

### PH-B / PH-C / PH-D delta from coordinator evidence

- PH-B: upgrade `signature` canvas requiredness to Review-precondition for this AIR path; keep attachment upload requirements `needs_review` because Review observed `NO ATTACHMENTS` in this controlled path, not a mandatory file requirement.
- PH-C: runner must handle signature blank validation (`Required` + generic required-fields toast/message), then Family Member(s) page and no-family confirmation modal before Summary; do not click `Submit` in stop-before-submit mode.
- PH-D: applicant/result UI must distinguish `New Travel Declaration Summary` reached from final submission; Summary has final `Submit`, but no reference/QR exists before it.

### Still not proven

- Final `Submit` was not clicked; no official reference or QR evidence exists.
- Evidence covers one AIR controlled path only; SEA Review remains unverified live.
- Customs/currency positive path reached Review with incomplete values in this controlled test; do not infer final acceptance, requiredness, or validation closure for all customs/currency fields.
- No account/email/OTP/Cookie/applicant values or screenshots are stored in PH-A.


## 第三轮 SEA Review live evidence（2026-08-01）

> 状态：已使用官方 `https://etravel.gov.ph` 已登录 Chrome 会话完成 `FOR ME + SEA + ARRIVAL` 普通旅客 live UI 采集，并到达 `New Travel Declaration Summary`。未点击最终 `Submit`，未生成 official reference/QR。仅使用非敏感合成 travel placeholder 推进页面；本 worklog 不记录这些值、账号、邮箱、OTP、Cookie、护照号、手机号、真实姓名、记录 UUID、截图路径或未脱敏官方值。
>
> 本轮唯一写入：`docs/philippines-launch-worklogs/PH-A.md`。未修改代码、schema、seed、runner、frontend、协调总览、字段合同或其他 worklog。

### SEA live 页面顺序与停止位置

| Step | 官方 URL | 页面/步骤 | 观察结果 | Evidence level |
| --- | --- | --- | --- | --- |
| 0 | `https://etravel.gov.ph/dashboard` | Dashboard | 未见可复用 SEA 草稿；新建 `New Travel Declaration VIA AIR or SEA (For Cargo Vessel only)`。 | live logged-in UI |
| 1 | `https://etravel.gov.ph/new-travel-declaration` | Travel Registration | 选择 `FOR ME`、`SEA`、`ARRIVAL Entering the Philippines` 后显示 `Are you disembarking?`，control key `is_disembarking`。 | live logged-in UI |
| 2 | `https://etravel.gov.ph/wizard/me?id=[redacted]&wizard_page=0` | Travel Details - Philippine Arrival (via SEA) | SEA travel/voyage/destination fields；完成验证后进入 Health。 | live logged-in UI |
| 3 | `https://etravel.gov.ph/wizard/me?id=[redacted]&wizard_page=1` | Health Declaration | 与 AIR 同类 health 三问；本 Review path 使用健康全 No。 | live logged-in UI |
| 4 | `https://etravel.gov.ph/wizard/me?id=[redacted]&wizard_page=2` | Customs Declaration Confirmation | SEA 所选目的港路径显示手工 customs forms 提示和下载入口；没有显示 AIR 的 `Do you have baggage or currency to declare?` Yes/No。点击 Next 后进入 Family。 | live logged-in UI |
| 5 | `https://etravel.gov.ph/wizard/me?id=[redacted]&wizard_page=3` | Family Member(s) | 显示 family member 选择页；无 family member 时 Next 弹确认；确认后进入 Summary。 | live logged-in UI |
| 6 | `https://etravel.gov.ph/wizard/me?id=[redacted]&wizard_page=4` | New Travel Declaration Summary | Summary 标题和说明可见；底部按钮 `Previous` / `Submit`。PH-A 看到 `Submit` 后停止，未点击。 | live logged-in stop-before-submit |

### SEA page 0 字段矩阵

| 官方步骤 | 官方 key/control | 原始英文 label/help | 控件类型 | Visible options / value | Required/校验 | 显示条件 | VIZA 对应 | 比对 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start | `is_disembarking` | `Are you disembarking?` | checkbox | boolean; value not captured | no visible HTML required attr observed | `SEA + ARRIVAL` on start page | `is_disembarking` | confirmed live |
| Travel Details | `purpose_of_visit_code` | `Purpose of Travel` | Headless UI combobox | labels not re-expanded in SEA pass; selected Holiday path triggered `Date of Return` | page 0 accepted when filled; exact required attr not visible | SEA page 0 | `purpose_of_travel` | confirmed field; option codes rely on prior API evidence |
| Travel Details | traveller type select | `Traveller Type` | react-select combobox | `VESSEL PASSENGER` was accepted and rendered in Summary; crew option not re-captured in dropdown | page 0 accepted when filled | SEA page 0 | `traveller_type` | confirmed passenger value label in Summary; crew remains diverted/needs_review |
| Voyage Information | `vessel_name` | `Vessel Name` | text input | synthetic value accepted; not recorded | page 0 accepted when filled | SEA traveller selected | `vessel_name` | confirmed live |
| Voyage Information | `flight_number` | `Voyage Number` | text input | synthetic value accepted; not recorded | page 0 accepted when filled | after `Traveller Type` selected | `voyage_number` alias | confirmed live mismatch: official value/control key is `flight_number`, display label is `Voyage Number` |
| Origin | `origin_country_code` | `Country of Origin` | Headless UI combobox | country option selected; value not recorded | page 0 accepted when filled | SEA page 0 | `origin_country` | confirmed live |
| Origin | `origin_port` | `Seaport of Origin` | text input | synthetic seaport text accepted; not recorded | page 0 accepted when filled | SEA page 0 | `seaport_of_origin` | confirmed official key `origin_port` |
| Origin | `departure_date` | `Date of Departure` | text/date picker input | date accepted; value not recorded | page 0 accepted when filled | SEA page 0 | `voyage_departure_date` | confirmed official key `departure_date` |
| Origin/Purpose | `return_date` | `Date of Return` | text/date picker input | date accepted; value not recorded | page 0 accepted when filled | appeared after Holiday/Pleasure/Vacation purpose on SEA path | `return_date` | confirmed live for this purpose/persona path |
| Transit | `with_transit` | `With Transit (Connecting Voyage)?` | checkbox | boolean | no visible HTML required attr observed | SEA page 0 | `with_transit` | confirmed live |
| Transit child | `transit_country_code` | `Country of Transit` | Headless UI combobox | option values not captured | no visible HTML required attr observed | `with_transit=true` | `transit_country` | confirmed branch |
| Transit child | `transit_port` | `Seaport of Transit` | text input | free text; value not recorded | no visible HTML required attr observed | `with_transit=true` | `transit_seaport` | confirmed official key `transit_port` |
| Transit child | `transit_date` | `Date of Transit` | text/date picker input | value not recorded | no visible HTML required attr observed | `with_transit=true` | `transit_date` | confirmed branch |
| Destination | `destination_port_code` | `Seaport of Destination` | Headless UI combobox | selected seaport rendered in Summary with official code in display; exact option list not captured in worklog | page 0 accepted when filled | SEA page 0 | `sea_port_of_entry` / destination port | confirmed official key `destination_port_code` |
| Destination | `arrival_date` | `Date of Arrival` | text/date picker input | date accepted; value not recorded | page 0 accepted when filled | SEA page 0 | `voyage_arrival_date` | confirmed official key `arrival_date` |
| Destination branch | `stay_location_type` | `Destination upon arrival in the Philippines` | radio group | `RESIDENCE` = Residence; `HOTEL` = Hotel/Resort; `TRAVEL_PORT` = Port | no visible HTML required attr observed | shown because start `is_disembarking=true` | `destination_type` | confirmed live; SEA value is `TRAVEL_PORT`, not AIR `TRANSIT` |
| Residence branch | `is_destination_same_as_permanent_address`; `destination_upon_arrival_in_philippines` | `Same as Permanent Country of Residence`; `Residence Address` | checkbox + text input | synthetic address accepted; not recorded | page 0 accepted when filled | `stay_location_type=RESIDENCE` | residence destination fields | confirmed live |
| Hotel/Resort branch | `destination_upon_arrival_in_philippines` | `Hotel, Resorts, AirBnb, Tourist destinations, etc.` | text/search input | value not recorded | no visible HTML required attr observed | `stay_location_type=HOTEL`; same-address hidden | hotel/resort destination | confirmed live branch; hotel source still needs_review |
| Port branch | `disembarking_port_code` | label surfaced under `Port` branch; visible label text captured as branch `Port` | Headless UI combobox | port option values not captured | no visible HTML required attr observed | `stay_location_type=TRAVEL_PORT` | disembarking/travel port | confirmed live official key `disembarking_port_code` |

### SEA 条件矩阵

| 条件 | 观察到的显示变化 | 新增/隐藏字段 | 状态 |
| --- | --- | --- | --- |
| `SEA + ARRIVAL` on Start | start page adds `Are you disembarking?` | `is_disembarking` checkbox | confirmed live |
| `is_disembarking=true` then Continue | SEA page 0 includes destination upon arrival branch options | `Residence`, `Hotel/Resort`, `Port` | confirmed live |
| `Traveller Type` selected as vessel passenger | `Voyage Number` appears in Voyage Information | official key `flight_number` | confirmed live |
| Purpose Holiday/Pleasure/Vacation | `Date of Return` appears | official key `return_date` | confirmed live for this SEA Review path |
| `with_transit=true` | opens `Transit (Connecting Voyage)` | `transit_country_code`, `transit_port`, `transit_date` | confirmed live |
| Destination `Residence` | shows same-as-permanent and Residence Address | `is_destination_same_as_permanent_address`, `destination_upon_arrival_in_philippines` | confirmed live |
| Destination `Hotel/Resort` | hides same-as-permanent and shows hotel/resort destination text/search field | `destination_upon_arrival_in_philippines` | confirmed live |
| Destination `Port` | hides address fields and shows port selector | `disembarking_port_code`; `stay_location_type=TRAVEL_PORT` | confirmed live |

### SEA Health / Customs / Family / Review gates

| Step | 原始英文 label/help | 控件/选项 | 与 AIR 对比 | 状态 |
| --- | --- | --- | --- | --- |
| Health Declaration | `Do you have any recent travel history in the last 30 days?`; exposure question; `Have you been sick in the past 30 days?` | Yes/No radio controls with same key patterns as AIR: `meta.with_recent_travel_history`, `is_with_history_exposure`, `is_sicked_within_thirty_days` | same as AIR health page in this pass | confirmed live |
| Customs Declaration Confirmation | `Kindly accomplish the manual forms for Customs Baggage Declaration and Currencies Declaration as prescribed by laws and regulations.`; links `Baggage Declaration Form`, `Currency Declaration Form` | static/link page + Previous/Next | differs from AIR positive customs flow: no `Do you have baggage or currency to declare?` Yes/No and no electronic General/Currency detail pages in this selected SEA path | confirmed live for selected SEA destination path |
| Family Member(s) | `Travel declarations will also be generated for the selected family members.`; `No Record Found!`; `Add Family Member` | Add Family Member, Previous, Next | same family gate as AIR Review evidence | confirmed live |
| Family confirmation modal | `You haven't selected any family members for this travel registration. Are you sure you're not traveling with a companion?` | `No` / `Yes` | same no-family confirmation as AIR Review evidence | confirmed live; `Yes` used to continue, not final submit |
| New Travel Declaration Summary | `Kindly double check the information before submitting.` | bottom buttons `Previous` and `Submit` | same Summary final-submit boundary as AIR; PH-A stopped at `Submit` | confirmed live stop-before-submit |

### SEA Review/Summary 脱敏字段顺序

| Review group | 脱敏字段顺序 observed |
| --- | --- |
| Personal Information | Travel Document / passport holder type; Email address; First/Middle/Last Name/Suffix; Passport Number; Passport Issuing Authority; Passport Issued Date; Sex; Birth Date; Country of Birth; Country/nationality display; Mobile Number; Occupation |
| Permanent Country of Residence | Country; No./Bldg./City/State/Province; Address Line 2 |
| Travel Details - Philippine Arrival (via SEA) | Purpose of Travel; Traveller Type; Destination upon arrival in the Philippines; Residence Address; Accompanied family members below 18 / 18 and above; First time visiting Philippines?; Your last departure date from the Philippines; No. of Baggage: Checked-in / Hand-carried |
| Voyage Information | Vessel Name; Voyage Number; Origin: Country of Origin / Seaport of Origin / Date of Departure / Date of Return; Transit (Connecting Voyage): Country of Transit / Seaport of Transit / Date of Transit; Destination: Country of Destination / Seaport of Destination / Date of Arrival |
| Health Declaration | Country(ies) worked, visited and transited in the last 30 days; exposure question; sick within 30 days question; Symptoms |

### 与 AIR Review 的差异

| Area | AIR evidence | SEA evidence in this pass | Implication |
| --- | --- | --- | --- |
| Vehicle block | AIR uses `Flight Information`, `Name of Airline`, `Flight Number`, airport labels | SEA uses `Voyage Information`, `Vessel Name`, `Voyage Number`, seaport labels | VIZA may keep semantic flat aliases, but official SEA `Voyage Number` maps to `flight_number`; official SEA dates map to `departure_date` / `arrival_date`. |
| Return date | AIR PH-A pass did not see `Date of Return` on page 0 purpose toggles | SEA Holiday path showed `Date of Return` with key `return_date` and accepted it before Review | Return-date condition is not closed globally; at least SEA Holiday Review path requires/supports it. |
| Destination option | AIR values: `RESIDENCE`, `HOTEL`, `TRANSIT` | SEA values: `RESIDENCE`, `HOTEL`, `TRAVEL_PORT` displayed as `Port` | Do not leak AIR Transit Via Airport into SEA; SEA Port branch requires `disembarking_port_code`. |
| Customs | AIR controlled path had electronic baggage/currency/customs/general/currency/signature pages | SEA selected destination path showed manual Baggage/Currency forms notice and skipped electronic customs detail/signature pages | Customs/signature gates are transport/port dependent; do not force AIR customs pages onto every SEA arrival. |
| Signature | AIR path required signature before Family and Summary | SEA selected path did not show signature page before Summary | Signature is not proven universal for all SEA arrivals; remains conditional by customs/port path. |
| Family | AIR reached Family Member(s) after signature | SEA reached Family Member(s) immediately after customs forms notice | Family gate exists for SEA and uses same no-family confirmation modal. |
| Review | AIR Summary at wizard page 8 | SEA Summary at wizard page 4 in this selected path | Runner cannot assume fixed page index across AIR/SEA/customs branches. |

### 验收结论

- SEA 是否 live 到 Review：是。`SEA + ARRIVAL + is_disembarking=true` path reached `New Travel Declaration Summary`; bottom button `Submit` observed and not clicked。
- Voyage Number 官方显示/key：official display label `Voyage Number`; live control key `flight_number`; it appears after `Traveller Type` is selected as vessel passenger。
- SEA dates/key：official controls are `departure_date` (`Date of Departure`), `arrival_date` (`Date of Arrival`), and for this Holiday path `return_date` (`Date of Return`)。
- disembarking/destination/port 条件：Start `SEA + ARRIVAL` shows `is_disembarking`; with disembarking true, page 0 shows `stay_location_type` values `RESIDENCE` / `HOTEL` / `TRAVEL_PORT`; Port branch shows `disembarking_port_code`。
- SEA Review 是否包含 same family/customs/signature gates：Family gate yes, same no-family confirmation modal yes；Customs gate exists but in this selected SEA destination path it is a manual forms notice with Baggage/Currency download links, not AIR-style electronic declaration questions；Signature gate/page was not present before Summary in this selected SEA path。

### 仍缺证据

- SEA `Traveller Type` dropdown option list was not successfully expanded/captured; Summary confirms accepted `VESSEL PASSENGER`, but crew option labels/values remain needs_review for live UI。
- SEA destination seaport full option list and `with_custom_declaration` metadata were not captured in this pass; selected path behavior proves one manual-forms SEA route, not every SEA port。
- SEA electronic customs/general/currency/signature path, if triggered by another port/customs condition, remains unverified live。
- SEA non-disembarking path was not pushed to Review in this pass; only start-page display of `is_disembarking` and disembarking=true destination branches were verified。
- Final `Submit` was not clicked；no official reference/QR evidence exists。

## 第四轮 canonical contract SEA live evidence sync（2026-08-01）

> 范围：本轮不浏览官网、不修改代码、不修改协调总览、不修改 PH-B/PH-C/PH-D worklog；只把第三轮 SEA Review live evidence 同步到 canonical arrival field contract，并追加本 PH-A worklog。未点击最终 `Submit`，未生成 reference/QR，未写入账号、邮箱、OTP、Cookie、护照号、手机号、真实姓名、记录 UUID、截图路径或未脱敏官方值。

### 本轮修改文件

- `docs/philippines-etravel-arrival-field-contract.md`
- `docs/philippines-launch-worklogs/PH-A.md`

### 已同步到 field contract 的 SEA live 结论

| Topic | Contract update | Status rule |
| --- | --- | --- |
| SEA Review boundary | 新增 E6 live evidence source，并记录 `SEA + ARRIVAL + is_disembarking=true` 已到 `New Travel Declaration Summary`；底部按钮为 `Previous` / `Submit`；`Submit` 未点击。 | observed Summary visibility = `verified_public`; final submit/reference/QR/result = `needs_review` |
| SEA voyage key | 明确官方显示 label 是 `Voyage Number`，live control/value key 是 `flight_number`。 | VIZA `voyage_number` 只能作为 alias；PH-B/PH-C 不得把 `voyage_number` 当 official payload key。 |
| SEA date keys | 明确 SEA 使用 shared official keys `departure_date` / `arrival_date`；Holiday/Pleasure/Vacation path 观察到 `return_date`。 | `voyage_departure_date` / `voyage_arrival_date` 只能是 VIZA aliases；`return_date` 只按已观察 Holiday SEA path 提升，其他 purpose/persona 继续 Review。 |
| SEA destination/disembark | 明确 start page key `is_disembarking`；`is_disembarking=true` 后 `stay_location_type` values 为 `RESIDENCE` / `HOTEL` / `TRAVEL_PORT`；Port branch key 为 `disembarking_port_code`。 | observed disembarking branch = `verified_public`; SEA non-disembarking remains `needs_review`。 |
| SEA customs | 明确本次 selected path 是 manual Baggage/Currency forms notice，不是 AIR-style electronic customs pages。 | selected manual notice path = `verified_public`; SEA electronic customs/signature possible path remains `needs_review`。 |
| SEA signature | 明确本次 selected path Review 前没有 signature page。 | signature 只在官方 signature page 出现时 required；不得设为所有 SEA arrival 的无条件必填。 |
| SEA family gate | 明确 Family Member(s) gate 与 no-companion confirmation 和 AIR 一致，并在 Summary 前出现。 | gate visibility = `verified_public`; selected family member profile semantics remain `needs_review`。 |

### 给 PH-B / PH-C / PH-D 的最小 mapping delta

| Owner | Delta |
| --- | --- |
| PH-B | 保留 dotted canonical keys 作为语义路径；SEA `voyage_number` 是 VIZA alias，official submit/control key 为 `flight_number`；SEA `voyage_departure_date` / `voyage_arrival_date` aliases 分别映射 official `departure_date` / `arrival_date`；SEA destination values 为 `RESIDENCE` / `HOTEL` / `TRAVEL_PORT`，Port child 为 `disembarking_port_code`；不要把 signature 做成所有 SEA arrival 全局必填。 |
| PH-C | 不要假设 fixed wizard page index；AIR 和 SEA 到 Summary 的页码不同。SEA selected manual forms path 不能按 AIR electronic customs pages 自动填；遇到 Summary `Submit` 仍 stop-before-submit。SEA signature 只在 signature page 存在时处理。 |
| PH-D | SEA `is_disembarking=true` destination UI 使用 `RESIDENCE` / `HOTEL` / `TRAVEL_PORT`；Summary/Review reached 仍不是 submitted；缺 reference + independent QR 时不能显示成功。不要要求 SEA manual-forms selected path 的 signature/file upload。 |

### 仍需 Review 的冲突/缺口

- Final `Submit`、official reference、official QR、result/recovery page 未验证。
- SEA non-disembarking path 未推进到 Review。
- SEA crew/cruise/special registration 仍为分流/unsupported v1，不进入普通 passenger contract。
- SEA electronic customs/general/currency/signature possible path 仍未验证；本轮只证明 selected manual forms notice path。
- Positive AIR customs/currency requiredness、modal/table selectors、full option payload 仍缺 live selector evidence。
- SEA full port option list、per-port `with_custom_declaration` metadata、family member selection semantics仍需 Review/API freeze。

### 校验与边界

- 已运行 `git diff --check`：无输出，命令未被权限/审批阻断。注意当前相关 docs 在 `git status --short` 中仍显示为未跟踪文件，因此该命令的覆盖范围按 git 当前跟踪状态解释。
- 未运行 migration、seed、部署、runner、schema tests、frontend tests、真实账号操作、OTP/CAPTCHA、付款、最终 Submit、commit 或批量 git add。
- 未修改产品代码、schema、seed、runner、frontend、协调总览或其他 worklog。

## 第五轮 AIR positive electronic customs/currency selector evidence（2026-08-01）

> 范围：本轮使用官方 `https://etravel.gov.ph` 已登录 Chrome 会话，只采集 AIR positive electronic customs/currency 页面的脱敏 selector、modal/table 行为和 requiredness/validation 文案。未点击最终 Review/Summary `Submit`，未生成 reference/QR，未上传文件，未记录账号、邮箱、OTP、Cookie、密码、真实姓名、真实护照、手机号、截图路径、记录 UUID 或未脱敏官方值。
>
> 本轮只更新：`docs/philippines-launch-worklogs/PH-A.md` 与 `docs/philippines-etravel-arrival-field-contract.md`。未修改代码、schema、seed、runner、frontend、协调总览或其他 worklog。

### 开始前读取

- 已读取 `docs/philippines-launch-coordination.md` 第 19 节：下一波重点为 PH-A 采集 AIR positive electronic customs/currency selector 与 validation evidence。
- 已读取 PH-A/PH-B/PH-C/PH-D worklog 最新尾部。
- 已读取当前 `docs/philippines-etravel-arrival-field-contract.md`。
- 已查看相关 docs 的 `git status --short`；这些 docs 仍显示为 untracked。

### 官方 live page order

| Observed order | Official page/step | URL form | Buttons/actions | Evidence level |
| --- | --- | --- | --- | --- |
| 1 | Customs Declaration Confirmation | `https://etravel.gov.ph/wizard/me?id=[redacted]&wizard_page=2` | `No`, `Yes`, `Previous`; positive path uses `Yes` | live logged-in UI |
| 2 | Customs Declaration other travel information / Other Travel Details | `...wizard_page=3` | `Previous`, `Next` | live logged-in UI |
| 3 | Customs General Declaration | `...wizard_page=4` | `Add Item`, `Previous`, `Next` | live logged-in UI |
| 4 | Customs Currency Declaration | `...wizard_page=5` | `Add Item`, `Previous`, `Next` | live logged-in UI |
| 5 | Customs Declaration attachments and signature | `...wizard_page=6` | `Clear`, `Previous`, `Next` | live logged-in UI |
| 6 | Family Member(s) | `...wizard_page=7` | `Add Family Member`, `Previous`, `Next` | live logged-in UI |
| 7 | New Travel Declaration Summary | `...wizard_page=8` | `Previous`, final `Submit`; `Submit` not clicked | live logged-in stop-before-submit |

### Customs confirmation and other travel details

| Area | Official label/help | Selector/control evidence | Requiredness/condition | Status |
| --- | --- | --- | --- | --- |
| Confirmation | `Customs Declaration Confirmation`; Baggage/General/Currency declaration notices | `No` button and `Yes` submit button visible; exact hidden payload key still relies on public bundle `with_something_to_declare_arrival` | `Yes` opens the observed AIR electronic customs sequence | confirmed live |
| Family counts | `Accompanied family members`; `Below 18 yrs. old`; `18 yrs. old and above` | Other Travel Details page visible before General Declaration | Requiredness not retested in this round | confirmed live page placement |
| Baggage counts | `No. of Baggage`; `Checked-in (pcs)`; `Hand-carried (pcs)` | Other Travel Details page visible before General Declaration | Existing selector evidence remains `no_of_checked_in_baggages` / `no_of_hand_carried_baggages` from prior live/public evidence | confirmed live page placement |
| First-time visit | `First time visiting Philippines?` | Yes/No controls visible on Other Travel Details | Requiredness not retested in this round | confirmed live page placement |

### General Declaration selector matrix

| Official field | Selector / key | Control | Values | Validation / notes | Status |
| --- | --- | --- | --- | --- | --- |
| Total goods currency | `amount_of_goods_acquired.currency` | radio | `PHP` = Philippine Peso; `USD` = US Dollar | Shown on Customs General Declaration; amount selector below | confirmed live selector/value |
| Total goods amount | `amount_of_goods_acquired.amount` | text input | numeric text | Requiredness/final acceptance not fully retested | confirmed live selector |
| Checklist 1 | `check_lists.0.response` | radio | `true` Yes / `false` No | `Philippine Currency and/or any Philippine Monetary Instrument in excess of PhP 50,000.00; (i.e. Check, Bank, Draft , etc);` | confirmed live selector/label |
| Checklist 2 | `check_lists.1.response` | radio | `true` / `false` | `Foreign Currency and/or Foreign Monetary Instrument in excess of USD 10,000.00 or its equivalent;` | confirmed live selector/label |
| Checklist 3 | `check_lists.2.response` | radio | `true` / `false` | `Gambling Paraphernalia;` | confirmed live selector/label |
| Checklist 4 | `check_lists.3.response` | radio | `true` / `false` | `Cosmetics, skin care products, food supplements and medicines in excess of quantities for personal use;` | confirmed live selector/label |
| Checklist 5 | `check_lists.4.response` | radio | `true` / `false` | `Dangerous drugs such as morphine, marijuana, opium, poppies or synthetic drugs;` | confirmed live selector/label |
| Checklist 6 | `check_lists.5.response` | radio | `true` / `false` | `Firearms, ammunitions and explosives;` | confirmed live selector/label |
| Checklist 7 | `check_lists.6.response` | radio | `true` / `false` | `Alcohol and/or tobacco products in commercial quantities;` | confirmed live selector/label |
| Checklist 8 | `check_lists.7.response` | radio | `true` / `false` | `Foodstuff(s), fruit(s), vegetable(s), live animal(s) (i.e. meat,eggs etc.), marine and aquatic products(s), plant(s) and/or the product(s) and their by-product(s);` | confirmed live selector/label |
| Checklist 9 | `check_lists.8.response` | radio | `true` / `false` | `Mobile phones, hand-held radios and similar gadgets in excess of quantities for personal use, and radio commumication equipments;` | confirmed live selector/label |
| Checklist 10 | `check_lists.9.response` | radio | `true` / `false` | `Cremains (human ashes), human organs or tissues;` | confirmed live selector/label |
| Checklist 11 | `check_lists.10.response` | radio | `true` / `false` | `Jewelry, gold, precious metals or gems` | confirmed live selector/label |
| Checklist 12 | `check_lists.11.response` | radio | `true` / `false` | `Other goods, not mentioned above;`; Yes shows Add Item table/modal | confirmed live selector/label |

### Other goods modal/table behavior

| Behavior | Selector/control | Validation/result | Status |
| --- | --- | --- | --- |
| Open modal | `Add Item` button under item 12 table | Modal title/body: `Other goods, not mentioned above;` | confirmed live |
| Modal field | `textarea[name="description"]` | Empty Add shows `Description Required` | confirmed live selector + empty validation |
| Modal field | `input[name="quantity"]` | Empty Add shows `Quantity Required` | confirmed live selector + empty validation |
| Modal field | `input[name="amount"]` | Empty Add shows `Amount in USD Required` | confirmed live selector + empty validation |
| Save row | `Add` button in modal | A saved row appears in table with columns `Quantity`, `Description`, `Amount in USD`, `Action`; row values not recorded | confirmed live behavior |
| Delete row | unlabeled row `button` containing trash icon | Clicking removes the row; table returns to headers only | confirmed live behavior |
| Page-level row requirement | item 12 Yes with row deleted, then `Next` | This pass did not reproduce a blocking error; page advanced to currency page | not confirmed; keep needs_review |

### Currency Declaration selector matrix

| Official section | Selector/control | Label/value evidence | Validation / condition | Status |
| --- | --- | --- | --- | --- |
| Owner N/A | checkbox label `Please check if NOT APPLICABLE` | Live checkbox did not expose stable `name`; public key candidate remains `owner_details_not_applicable` | Requiredness unknown | needs_review |
| Owner fields | `owner_business_name`, `owner_first_name`, `owner_middle_name`, `owner_last_name`, `owner_suffix_name`, `owner_occupation`, `owner_country_code`, `owner_street`, `owner_postal_code` | `OWNER OF CURRENCIES OR MONETARY INSTRUMENTS` | Requiredness/third-party condition not fully tested | confirmed live selectors |
| Recipient fields | `recipient_business_name`, `recipient_first_name`, `recipient_middle_name`, `recipient_last_name`, `recipient_suffix_name`, `recipient_occupation`, `recipient_country_code`, `recipient_street`, `recipient_postal_code` | `RECIPIENT OF CURRENCIES OR MONETARY INSTRUMENTS` | Requiredness not fully tested | confirmed live selectors |
| Currency item modal | `currency_id`, `monetary_instrument_id`, `amount` | Modal labels `Currency`, `Monetary Instrument`, `Amount` | Empty Add shows `Currency Required`, `Monetary Instrument Required`, `Amount Required`; page shows `At least have 1 item` when no currency item exists | confirmed live selector + validation |
| BSP date | `bsp_authorization_date` | `Date of BSP authorization if transferring Philippine Pesos in excess of PHP50,000` | Document/requiredness unknown | selector confirmed; requiredness needs_review |
| Sources | `currency_sources.0`, `.1`, `.2` | `SALARY` Salary; `BUSINESS` Business; `OTHER` Other (Specify) | Source section shows Required on Next when required branch incomplete | confirmed live selector/value |
| Source Other | `currency_source_other` | shown after `currency_sources.2=OTHER` | Empty field shows `Required` on Next | confirmed live selector + validation |
| Purposes | `transport_purposes.0`..`.4` | `LEISURE`, `MEDICAL`, `PAYABLES`, `EDUCATION`, `OTHER` | Purpose section shows Required on Next when required branch incomplete | confirmed live selector/value |
| Purpose Other | `transport_purpose_other` | shown after `transport_purposes.4=OTHER` | Empty field shows `Required` on Next | confirmed live selector + validation |
| Transfer method | `physical_or_shipped` | `is_physically_transferred_by_person`; `is_shipped_thru_courier_service` | Branch radio controls confirmed | confirmed live selector/value |
| Physical branch | `no_of_days_in_philippines`, `last_travel_to_philippines` | shown when physical transfer selected | Empty validation not separately tested | selector confirmed; requiredness needs_review |
| Courier branch | `courier_name`, `airway_bill_no`, `airway_bill_date` | labels `Name of Courrier/ Courrier Company`, `Bill of landing/Airway Bill No.`, `Bill of landing/Airway Bill Date` | Empty fields show `Required` on Next | confirmed live selector + validation |

### Attachments / signature / Review boundary

| Area | Live evidence | Contract implication |
| --- | --- | --- |
| Attachments action | Signature page displayed `Take a photo or upload a file.`; this pass found no visible `input[type=file]`; controlled Summary displayed `NO ATTACHMENTS`. | Do not mark `travel_document`/attachments as universally required. File requiredness remains needs_review. |
| Signature selector | One visible `canvas`; `Clear`; certification text `By Clicking "Next"... true and correct...`. | Signature remains canvas/pad based where signature page appears; blank requiredness relies on prior E6 coordinator evidence, not retested in this crawl. |
| Family gate | Backward page order confirmed Family Member(s) between signature and Summary. | Runner still must handle family/no-companion gate before Review/Summary. |
| Summary boundary | Summary showed final `Submit`; this task did not click it. | No reference/QR/result evidence; submitted success remains blocked. |

### PH-B / PH-C / PH-D interface delta

| Owner | Delta |
| --- | --- |
| PH-B | Can mark AIR electronic customs/currency selectors as verified evidence for the observed path: `amount_of_goods_acquired.*`, `check_lists.0..11.response`, goods modal `description/quantity/amount`, currency modal `currency_id/monetary_instrument_id/amount`, owner/recipient selectors, source/purpose arrays, `physical_or_shipped`, physical/courier children. Keep attachment requiredness, final acceptance, and final result as needs_review. |
| PH-C | Positive AIR autofill can target these selectors behind fail-closed gates. Required validation confirmed for empty goods modal, empty currency item modal, source/purpose Other details, missing currency item, and empty courier children. Do not rely on hidden ids for Owner N/A; live checkbox lacked a stable `name`. Do not require Other goods row page-level blocking; it was not reproduced after delete. |
| PH-D | UI can expose structured positive customs/currency fields without presenting them as submitted success. Attachments remain conditional; do not show mandatory upload for this path. Review/Summary and `Submit` visibility are not success without reference + QR. |

### Still needs review

- Final `Submit`, official reference, independent QR, result/recovery page, and post-submit status tracking.
- Attachment upload requiredness, file input selector, file size, and conditions; controlled path showed `NO ATTACHMENTS`.
- Owner N/A stable official selector/name and owner/recipient requiredness conditions.
- Physical branch empty validation for `no_of_days_in_philippines` and `last_travel_to_philippines`.
- General Declaration page-level no-row blocking for Other goods after deleting a saved row; this pass did not reproduce blocking.
- Complete current option lists/codes for currency and monetary instrument comboboxes.
- Final official acceptance of the positive electronic customs/currency payload; this crawl only proves selectors and validation before final Submit.

### Validation / boundary

- 已运行 `git diff --check`：无输出，命令未被权限/审批阻断。注意当前相关 docs 在 `git status --short` 中仍显示为未跟踪文件，因此该命令的覆盖范围按 git 当前跟踪状态解释。
- Not run: migration, seed, deploy, schema/runner/frontend tests, real OTP/CAPTCHA, payment, final Submit, commit, batch git add.
- Browser session finalized after evidence collection; claimed Chrome tabs released.

## 第二十八轮 E28 登录页最小证据追加（2026-08-14）

- 已根据用户提供的当前官方登录页截图，追加 `Enter Email address`、`Password`、`Forgot Password`、`Login`、`Sign in to eTravel with eGovPH`、`Create an account` 与 Cloudflare `Success!` 的可见状态。
- 合同已明确：上述均为 account/runtime/Turnstile 边界；`account.password` 是运行时秘密，所有这些项目均不是普通 arrival 的 applicant answer 或 `visa_form_fields`。
- 未访问官网、未输入或记录任何账号/秘密/申请资料，未进行 OTP、CAPTCHA、上传、导航或 final Submit。
- 同日用户提供的 Create account 与 OTP 截图补充确认：Create account 页显示 email 输入、`Continue`、已有账户登录入口及 Cloudflare `Success!`；邮件 Continue 后的 `Enter One-Time-Password` 页显示 6 个独立 OTP 格、Continue、登录入口、约两分钟的 resend 倒计时及至少等待三分钟的提示。邮箱及 OTP 均未转录或保留，且均为 runtime boundary，不是 applicant question。
- 用户提供的 OTP Continue 后密码页补充确认：`Create your Password`、`Password Confirmation` 两个密码控件各有显隐按钮和 `Continue`；可见规则为至少 12 个字符、同时有大小写字母、至少一个符号及至少一个数字。未转录或保留任何邮箱或密码；`account.password` 仍仅为 runtime secret。
- 用户提供的当前 onboarding Personal Information 截图补充确认：photo action、菲律宾/外国护照 holder radios、姓名/optional 标记、Birth Date 日历、可搜索 mobile dial-code picker、Citizenship 的 nationality/demonym 展示、Country of Birth/Passport Issuing Authority 的 country-name 展示、Passport Number、Passport Issued Date、Occupation 与 Next 均可见。Occupation 未展开，故 options 未确认。当前 Sex 下拉截图仅见 `FEMALE`/`MALE`；合同以此作为当前页面证据，历史 five-option 记录保留但不作为当前选项集。未记录任何用户值。

## 第二十九轮 E29 两层 Submit / Travel Registration / PH residence（2026-08-15）

- 固化当前实页边界：Personal Information Review 的 `Submit` 只保存 profile 并进入 Travel Registration，不是 arrival Summary 的 final Submit，也不产生 submitted/result/reference/QR 结论。
- 固化 Travel Registration 的 owner、AIR/SEA、ARRIVAL/DEPARTURE 选择与 Data Privacy/Affidavit `Continue` 同意动作；`PH_ETRAVEL_ARRIVAL_CARD` 仅允许 ARRIVAL，DEPARTURE 不进入本产品合同。
- 固化 PH residence 顺序 Province -> Municipality -> Barangay -> Street -> optional line 2，以及官方 API base `https://ws.etravel.gov.ph`、当日 85 条 provinces 快照与 parent official-code 级联。既有端点模板保持 `verified_public_bundle`；requiredness、错误、response schema 与 server acceptance 仍为 `needs_review`。
- 已读取协调记录、PH-A 至 PH-F worklog、field contract 与当前 dirty status；仅修改本 worklog 与 field contract，未触碰现有脏代码。Docs-only，无 focused test；未登录、未 final Submit。

## 第三十轮 E30 AIR Travel Details dropdown crawl（2026-08-15）

- 阻断：目标 AIR `wizard_page=0` 页面已由同一 Chrome 会话的另一控制者占用；PH-A 仅能安全访问 SEA 草稿，未将其替代为 AIR 证据。
- SEA 页仅短暂展开并关闭 Purpose 控件，未选择选项、未导航或保存；随后已释放页面。没有新增 AIR dropdown、option code、count 或父子清空结论。
- 未读取或记录账号、Cookie、URL 草稿标识或申请人资料；未点击 Next/Cancel、未触发登录/CAPTCHA/profile save/signature/final Submit。Docs-only，无 focused test。

## 第三十一轮 E31 AIR Travel Details page 0 live dropdown audit（2026-08-15）

### 边界与直接实证

- 仅认领经协调者确认的 `Travel Details - Philippine Arrival (via AIR)` 独立页面；未读取/记录草稿 URL/ID、账号、Cookie、申请人值或任何 PII。
- 只展开了 Purpose、Traveller Type、Name of Airline、Country of Origin、Airport of Destination；没有选择 option、填写文本、点击 Next/Cancel 或触发保存/提交。为避免切换会清空当前草稿 child values，本轮未切换 With Transit 或 Residence/Hotel/Transit destination parent。
- 该页所有当前 `input`/`textarea`/`select` 均没有原生 `required` / `aria-required`；未见可见 `Required` marker 或 error。由于禁止点 Next，这只能证明当前 DOM/validation display，不证明官方 requiredness 或 server acceptance。

### 当前 AIR page-0 字段矩阵

| Section | Live label / key | Control and current branch evidence | Option/value/code evidence | Requiredness / condition | Status |
| --- | --- | --- | --- | --- | --- |
| Travel | `Purpose of Travel` / `purpose_of_visit_code` | Headless UI combobox; 16 rendered options. | Full live labels: OFW; Business/Professional; Convention/Conference; Education/Training/Studies; Government/Official Mission; Health/Medical Reason; Holiday/Pleasure/Vacation; Incentive; Meetings; Others; Religion/Pilgrimage; Returning Resident; Trade Fair/Exhibition; Transit; Visit Friends/Relatives; Work/Employment. DOM exposes no option `value`/`data-value`. Existing E13 official public API mapping remains: `OFW`, `POV006`, `POV002`, `POV003`, `POV004`, `POV005`, `POV001`, `POV010`, `POV017`, `POV999`, `POV009`, `POV011`, `POV018`, `POV012`, `POV007`, `POV008`, in the same label order. | No native required/error visible; no purpose branch was selected in E31. | live labels/count `confirmed_live`; code mapping `verified_public` |
| Travel | `Traveller Type` / hidden `passenger_type` | React-select combobox `#react-select-2-input`; 2 rendered options. | Live labels: `AIRCRAFT PASSENGER`, `FLIGHT CREW`; DOM exposes no option value. Existing public-bundle codes are `AIRCRAFT PASSENGER` and `FLIGHT CREW`. Crew remains diverted from ordinary VIZA v1. | No native required/error visible. | labels/count `confirmed_live`; values `verified_public_bundle` |
| Flight | `Name of Airline` / `travel_company_code` | Headless UI combobox; 105 currently rendered labels. | Complete rendered label snapshot: ADVANCE JET AVIATION; Aero K Airlines; AERO MONGOLIA; Air Busan; AIR CANADA; Air China; AIR FRANCE; Air France; Air Hongkong; Air India; AIR MACAU; Air Niugini; Air Seoul; AirAsia; AirSWIFT; All Nippon Airways; AMERICAN AIRLINES; Asiana; ATLAS AIR; BAMBOO AIRWAYS; BANGKOK AIRWAYS; Bulldog; Cathay Pacific; Cebu Pacific; Central Airlines; China Airlines; China Eastern Flight; China Southern Airlines; Deer Jet; Delta Air Lines Inc.; Emirates Airlines; Ethiopian Airlines; Etihad Airlines; EVA Air; FEDEX; FIREFLY AIRLINES; Fly Gangwon; GARUDA INDONESIA; Greater Bay Airlines; Gulf Air; Hong Kong Airlines; Hongkong Express; Hunnu Air; Icelandair; ICELANDAIR; IMPERIALP CLUB; IrAero Airlines; Japan Airlines; Jeju Air; JETSTAR AIRLINES; Jetstar Asia; Jetstar Japan; Jin Air; JUNEYAO AIRLINES; KLM Royal Dutch Airlines; Korean Air; Kuwait Air; LOONG AIR; Malaysia Airlines; MEDIC89; My Indo Airlines; MyWay Airlines; NA; Nauru Airlines; OK Air; OKAY AIRWAYS; Oman Air; PAF 215; PAF 5157; PAL Express; Pan Pacific Airlines; Philippine Airlines; Private; Qantas Airways; Qatar Airways; Qatar Executive; QINGDAO AIRLINES; RAAF; Royal Air; Royal Brunei; Saudia; Scoot Flight; SEAIR INTERNATIONAL INC.; Shenzhen Airlines; Singapore Airlines; Skyjet Airlines; SKYWAY AIRLINES; STARLUX Airlines; SUNLIGHT EXPRESS AIRWAYS CORP.; TERRA AVIA; Thai AirAsia; Thai Airways; THAI LION AIR; Tianjin Air Cargo; Tigerair Taiwan; Turkish Airlines; Tway Airlines; United Airlines; United Parcel Service; VietJet Air; Vietjet Aviation; VIETNAM AIRLINES; WAMOS AIR; Xiamen; Zipair. DOM exposes no code. The official dynamic source remains E22 public endpoint `/api/v1/common/travel_companies` with `transportation_type=AIR`; no current code snapshot is claimed. | No native required/error visible. Public clear graph: airline change clears normal flight, special-flight detail and AIR arrival destination port; not re-triggered live in E31. | labels/count `confirmed_live`; code/clear behavior `verified_public_bundle` / `needs_review` |
| Flight | `Flight Number` / `flight_number` | Headless UI combobox present. | Parent-dependent official source remains `/api/v1/common/flight_numbers?travel_company_code={official code}`. No airline was selected or changed, so no flight list/count/value is frozen or inferred. A selected flight may carry `travel_port_code` metadata in the public component, but this was not re-triggered live. | AIR normal-flight branch; current DOM has no native required/error. | control `confirmed_live`; options/dependency values `needs_review` with `verified_public_bundle` source |
| Origin | `Country of Origin` / `origin_country_code` | Headless UI combobox; 249 options rendered. First visible entries are Afghanistan, Åland Islands, Albania, Algeria, American Samoa. | DOM exposes no code. Existing official countries source is `/api/v1/common/countries?paginate=0&q=`; the 250-row public catalog uses `code` as value and `name` as label. The live origin selector renders 249, consistent with excluding Philippines; this is a dated UI observation, not a permanent filter promise. | No native required/error visible. | count/render `confirmed_live`; value source `verified_public` |
| Origin | `Airport of Origin` / `origin_port` | Text input, not a dropdown. | Free text; no option code. | AIR arrival field; no native required/error visible. | `confirmed_live` control |
| Origin | `Date of Departure` / `departure_date` | Text/date-style input. | No dropdown/value code. | No native required/error visible. | `confirmed_live` control |
| Transit | `With Transit (Connecting Flight)?` / `with_transit` | Checkbox. | Boolean control; no option code. | Current transit child controls were not opened in E31 to avoid clearing draft data. Existing direct live evidence remains `Country of Transit` / `transit_country_code` combobox, `Airport of Transit` / `transit_port` text input, and `Date of Transit` / `transit_date` input when checked. | parent `confirmed_live`; child labels are earlier live evidence; current branch behavior remains `needs_review` |
| Arrival | `Airport of Destination` / `destination_port_code` | Headless UI combobox; 20 options rendered. | Complete live labels: Bacolod Airport; Bicol International Airport; Bohol-Panglao International Airport (New Bohol Int'l.); Cagayan North International Airport; Caticlan Airport (MPH); Clark International Airport (CRK); Davao International Airport (DVO); General Santos Airport; Iloilo International Airport (ILO); Kalibo International Airport (KLO); Laguindingan Airport - Cagayan de Oro; Laoag International Airport (LAO); Mactan-Cebu International Airport (CEB); Ninoy Aquino International Airport T1 - (MNL); Ninoy Aquino International Airport T2 - (MNL); Ninoy Aquino International Airport T3 - (MNL); Ninoy Aquino International Airport T4 - (MNL); Puerto Princesa International Airport (PPS); Subic Bay International Airport (SFS); Zamboanga International Airport. DOM exposes no code. Existing official dynamic source is `/api/v1/common/travel_ports?...&transportation_type=AIR`; response `code` is the official option value, but no current label-to-code pair is claimed. | No native required/error visible. | labels/count `confirmed_live`; code pairs `needs_review` |
| Arrival | `Date of Arrival` / `arrival_date` | Text/date-style input. | No dropdown/value code. | No native required/error visible. | `confirmed_live` control |
| Destination | `Destination upon arrival in the Philippines` / `stay_location_type` | Radio group. | Direct DOM value/label pairs: `RESIDENCE` / Residence; `HOTEL` / Hotel/Resort; `TRANSIT` / Transit Via Airport. | No native required/error visible. Changing parent is known to clear child state in the public component; not re-triggered live. | values `confirmed_live`; clear graph `verified_public_bundle` |
| Destination Residence | `Same as Permanent Country of Residence` / `is_destination_same_as_permanent_address`; `Residence Address` / `destination_upon_arrival_in_philippines` | Checkbox and text input were visible in the current rendered Residence branch. | No dropdown/value code. | Residence branch only; no native required/error visible. | visible controls `confirmed_live` |
| Destination Hotel | hotel/autocomplete child / `destination_upon_arrival_in_philippines` | Not switched in E31. | Existing official source `/api/v1/common/hotels`; public component label is `name` and selected display concatenates name/region/city, with no proved stable hotel code. | Only `stay_location_type=HOTEL`; live branch/validation not re-run. | `needs_review` with prior live/public evidence |
| Destination Transit | `Airport` / `transit_port_code`; `Country of Destination` / `transit_destination_country_code` | Not switched in E31. | Existing public fixed airport pairs: `TP1000` / Ninoy Aquino International Airport T1 (MNL); `TP2000` / T2 (MNL); `TP3000` / T3 (MNL); `TP001` / Clark International Airport (CRK). Country source is `/api/v1/common/countries`, excludes PH, code/name. | Only `stay_location_type=TRANSIT`; live branch/validation not re-run. | `needs_review` with prior live/public evidence |
| Conditional absence | `flight_number_special`, `return_date`, transit child controls, Hotel and destination-Transit children | Not rendered in this non-destructive E31 state. | No value/code inferred. | Respectively special-flight, purpose/persona, With Transit, HOTEL and TRANSIT conditions remain page-state dependent. | `needs_review` |

### 未确认项与等待用户逐页验收

- `travel_company_code` 的 105 个 live labels 没有在 DOM 暴露 code；flight list 取决于其 parent official code，不能永久冻结。当前安全读 API 失败且 web read was unavailable, so no fresh code snapshot was added.
- Country and airport DOM likewise do not expose option codes. The prior E13 official API contracts remain the value-source evidence; E31 only confirms the current rendered counts/labels and the PH-excluded origin count.
- 本轮未触发 Next，因此无逐字段 `Required` error；未切换 With Transit、Hotel/Resort 或 Transit Via Airport，以免清空现有 child state。其 current live requiredness、clear timing、server acceptance 继续 `needs_review`。
- 等待用户逐页验收：请在不保存的前提下交接一个空白或可安全切换的 AIR page-0 草稿，以完成 airline -> flight、With Transit、Hotel/Resort、Transit Via Airport 与 Special Flight 的 live condition/validation 验收；继续禁止 Next/Cancel/final Submit。

## 第三十二轮 E32 用户提供 Health Declaration 截图证据（2026-08-15）

- 不访问官网。用户提供的完整截图确认 AIR/SEA 共用同一 Health Declaration 页面；静态 false-declaration 法律警告仅为 notice，不是申请问题。
- 三道基础 Yes/No 均为 required：recent travel history（UI key `meta.with_recent_travel_history`）、exposure history（`is_with_history_exposure`）、been sick（`is_sicked_within_thirty_days`）。Exposure Yes 没有截图证明的 child question。
- Recent-travel Yes 显示可重复的 `Country(ies) worked, visited and transited in the last 30 days`：Add 增行、Delete 删行，至少一行且每行必选；列表含 Philippines 在内全部国家，切 No 清空。Sick Yes 显示 Symptoms 多选，至少选一项而非全部；切 No 清空。15 项标签已逐项写入 field contract。
- 本轮只提升截图可见 UI requiredness/条件/清空行为；country/symptom code、服务端 payload/acceptance 与 final progression 仍 `needs_review`。未记录健康答案、会话或草稿信息；无测试、无 Next/Submit、无代码或总览修改。

## 第三十三轮 E33 用户提供 AIR Customs Declaration Confirmation 截图证据（2026-08-15）

- 不访问官网。四张 AIR 截图确认页面是 `Customs Declaration Confirmation` / `Important Information`；Baggage Declaration、General Declaration 的 12 类、Currency Declaration、sanctions/warnings 与 `By continuing...` 都是必须展示的静态法律说明，不是 applicant answers。
- 唯一申请人回答控件是 required 问题 `Do you have baggage or currency to declare?`，两个分支按钮 `No` / `Yes`。没有独立 Next，点选答案才是分支动作；截图未暴露 submitted value/code，因此未把标签猜成 boolean code。
- 不从此截图推断 No/Yes 后页序。既有 AIR/SEA route 结论只保留其独立证据范围，其他路径继续 `needs_review`。完整静态英文文案和边界已按截图写入 field contract。
- 未记录会话、草稿或申请人资料；未 Next/Submit、未改代码/总览、无测试。

## 第三十四轮 E34 用户提供 AIR Other Travel Details 截图证据（2026-08-15）

- 不操作页面。AIR `Other Travel Details` 截图确认五个回答控件：`accompanied_family_members.below_eighteen` / Below 18 yrs. old；`accompanied_family_members.above_or_equal_eighteen` / 18 yrs. old and above；`no_of_checked_in_baggages` / Checked-in (pcs)；`no_of_hand_carried_baggages` / Hand-carried (pcs)；`first_time_visit` / First time visiting Philippines? Yes/No。
- 四个 count 控件在截图中均为 `0`，仅记为呈现默认值和非负整数候选；不猜 input type、min/max、error、requiredness 或 server acceptance。`No` 在 first-time 截图中被选中，但不视为通用 default 或 submitted code。
- `Accompanied family members`、`No. of Baggage` 是分组标题，Previous/Next 是页面动作。未点击，未从 AIR 截图外推 SEA 或后续路由。字段合同已追加 E34；等待用户逐页验收临时 count/radio 修改后的校验和恢复行为。B/C/D 暂不处理。

## 第三十五轮 E35 AIR Customs Declaration Signature 页面边界（2026-08-15）

- 用户截图确认本页标题 `For Customs - Declaration Signature`、`Signature` 空白签名区、`Clear`、`Previous`、`Next`，以及 `By Clicking "Next"... true and correct...` 的认证文案。认证文案是静态 action/notice，不是独立申请问题或最终 Submit。
- 按授权尝试认领当前官方页面前，Chrome 受管安全策略未能验证并阻断访问；因此未读取 DOM/canvas selector 或尺寸，未点空白 Next，未画 synthetic test stroke，未点 Clear，也未上传、保存或提交。未绕过或重试该策略。
- 已有独立 E6 live 证据仍确认空白签名点击 Next 会显示 `Required` 与 `Please make sure to fill out all required fields.`；本轮没有重复该动作。当前 AIR 的 Clear 实际清空画布/表单状态、signed-Next、payload 和后续 Family/Summary 边界仍为 `needs_review`。
- 字段合同已追加 E35。等待用户逐页验收：浏览器策略恢复后，只记录 selector/尺寸，空白状态点一次 Next，再画一条合成测试线并点 Clear 确认恢复为空白；签名存在时绝不点 Next，继续禁止上传、保存和 final Submit。

## 第三十六轮 E36 用户提供 Family Member(s) 桥接页截图证据（2026-08-16）

- 不浏览、不 Add、不选择、不点 Previous/Next。截图确认：`Family Member(s)`、`Travel declarations will also be generated for the selected family members.`、空态 `No Record Found!`、`Add Family Member`、`Previous`、`Next`。
- AIR 与 SEA 已观察到到达该页的对应路径在此汇合；仅限这些已观察路径，不外推任意 customs/manual/electronic variant。该页是已有 family profile 到独立 trip declaration 的桥接选择，不是重新录入家属个人资料；被选 profile 各自生成一份 travel declaration，`Add Family Member` 属 profile management。
- Other Travel Details 中 `below_eighteen` / `above_or_equal_eighteen` 是 customs 统计，绝不等同本页实际 profile selection。既有独立证据仍为：无选择点 Next 会出现 no-companion confirmation modal；本轮未触发，modal 文案、确认后的路由和 server acceptance 继续 `needs_review`。
- 字段合同已追加 E36；等待用户逐页验收 profile 添加、选择/取消选择和 no-companion confirmation 的实际行为。未改代码、总览或其他 worklog，未提交。

### E36a 用户提供无同行确认模态行为（2026-08-16）

- 用户截图与明确路由确认：Family 页未选择任何 profile 时点 Next，弹出 `You haven't selected any family members for this travel registration. Are you sure you're not traveling with a companion?`。
- Modal `No` 关闭弹窗并保留/返回 Family Member(s) 页；`Yes` 进入 Review。该 Yes/No 是 runtime navigation confirmation，不是 applicant answer，不进入 schema 或 payload。
- 已选 existing family profiles 各自生成 travel declaration；仍不得把 Other Travel Details 的年龄人数统计映射为 selected profile ids。已在字段合同 E36a 标为 `confirmed-user-provided behavior`；未浏览、未点击、未改代码或总览、未提交。

## 第三十七轮 E37 用户提供 AIR 最终结果页脱敏结构证据（2026-08-16）

- 用户提供一次手工完成 AIR final Submit 后的官方 eTravel result/confirmation 页面截图。只记录脱敏结构：同页呈现 `QR` 与 `Reference Number` `[redacted]`；`Flight Details` 有 `ARRIVAL - VIA AIR`、日期及 origin/destination `[redacted]`；页面包含护照交 Immigration Officer、QR 交 Customs officer 的提示，以及 Immigration Officer / E-Gates、customs、baggage、status badges 和 `Back to Home`。
- 不记录实际 reference、QR、日期、航班、机场、个人或行程值。该证据仅证明一次用户手工完成的 AIR 结果页同页呈现 reference 与 QR；不证明独立 QR 扫描、SEA 结果、runner 自动成功、下载/恢复、重试/幂等或 API 合同。
- 字段合同已追加 E37。PH-A 未浏览、未提交、未扫描或操作该页面；未改代码、总览或其他 worklog。

## 第三十八轮 E38 FOR ME / FOR OTHER 两段式流程纠正（2026-08-16）

- 用户当前截图与说明确认：`FOR ME` 复用 account owner 已完成的 Profile 后进入所选 AIR/SEA arrival declaration；`FOR OTHER` 先为另一位 traveller 完整填写 Profile，再进入同一 AIR/SEA arrival declaration 页面。FOR OTHER 不是另一套 trip declaration，也不是新产品；不得重复 Health/Customs schema。
- FOR OTHER Profile 的截图字段已在字段合同逐项列为：photo、passport-holder、姓名/optional 中间名/姓氏/suffix、Sex、Birth Date、Mobile/calling-code、Citizenship、Country of Birth、Passport、issuing authority、issued date、Occupation，以及 Permanent Country of Residence 的 Country、`No./Bldg./City/State/Province`、optional Address Line 2。`Copy account owner address` 是 runtime convenience action，不是 applicant answer；复制出的 residence values 仍属该 traveller Profile。
- `FOR OTHER + AIR + ARRIVAL` 也可有 `Special Flight`；启用后 Flight Number 位置显示 `Specify special flight number` 与 warning。其 key、requiredness、清空和 server rules 尚未证明。
- 字段合同 E38 已固化 canonical flow；未浏览、未改代码/总览/其他 worklog，未提交。

## 第三十九轮 E39 Add Family Member Profile / Relationship 证据（2026-08-16）

- 用户截图确认 `Add Family Member` 复用完整 traveller Profile：Personal Information + Permanent Country of Residence；完成后回到 family-profile/selection 语义，不是另一套 trip declaration。它与 FOR OTHER inline Profile 共用同一 Profile contract，仅在末尾额外有 required `Relationship` dropdown，关系相对 account owner。
- 截图确认的 16 个显示标签及顺序：`MOTHER`, `FATHER`, `DAUGHTER`, `SON`, `SISTER`, `BROTHER`, `HUSBAND`, `WIFE`, `COUSIN`, `UNCLE`, `AUNT`, `NEPHEW`, `NIECE`, `GRANDFATHER`, `GRANDMOTHER`, `GRANDCHILD`。本轮截图只证明 labels/order/requiredness；没有从标签自行推断 submitted code。既有 E2 public-bundle value evidence 与本轮截图证据在字段合同中分开标注。
- `family.relationship` 已改归 `family profile field`，不是 per-trip declaration answer；selected family Profile 才各自生成 travel declaration，仍不等同 Other Travel Details 的年龄人数统计。未浏览、未点击、未改代码/总览/其他 worklog，未提交。

## 第四十轮 E40 用户提供共享 AIR Travel Details 条件分支证据（2026-08-16）

- 用户明确 FOR ME/FOR OTHER 的 AIR Arrival 最终进入同一份 Travel Details 合同，不产生另一套问题。Travel Registration 的 `FOR ME + AIR + ARRIVAL` 可启用 `Special Flight`；它是 AIR declaration start 条件，不是另一产品或 `registration_for`。
- `With Transit (Connecting Flight)?` 勾选后展开 `Country of Transit`、`Airport of Transit`、`Date of Transit`。同页还固定显示 `Airport of Destination`、`Date of Arrival`，并有 `Destination upon arrival in the Philippines` 的 `Residence` / `Hotel/Resort` / `Transit Via Airport` 分支。
- Residence 分支内 `Same as Permanent Country of Residence` 已勾选时呈现已保存 `Residence Address`，未勾选时呈现可编辑 `Residence Address`。这些均为同一 AIR 条件子字段，不产生 FOR OTHER-only schema；未从 UI checkbox/action 推断 submitted code。
- E40 在字段合同中标为 `confirmed-user-provided behavior`，只关闭“问题存在和条件结构”；server requiredness、payload/code acceptance、clear behavior 和生产提交仍按既有 `needs_review`。未浏览、未改代码/总览/其他 worklog，未做测试或提交。

## 第四十一轮 E41 协调者纠正：AIR Special Flight 非普通航班字段（2026-08-16）

- 协调者纠正此前可能将 Special Flight 与普通 Flight Number 视为同一控件的概括。最新截图确认：页面仍是 `Travel Details - Philippine Arrival (via AIR)`；Special Flight 启用时，普通 Flight Number 的选择/自动填充位置被自由文本 `Specify special flight number` 替代，空值显示 `Required`，并显示 `Misdeclaration of special flight will cause travel delay`。
- 截图同屏当前状态为 Purpose `Business/Professional`、Traveller Type `FLIGHT CREW`、Airline `Aero K Airlines`。只记录当前状态；不能据此声称 Special Flight 自动强制 FLIGHT CREW，因果关系继续 `needs_review`。
- `flight_number_special` 仅引用既有 E22 public-bundle key 证据；本轮不从可见 label 推断新的 submitted code、payload 或 server acceptance。Transit/destination E40 结构不变。字段合同已追加 E41，消费者不得沿用“Special Flight 与普通航班字段相同”的错误结论；未浏览、未改代码/总览/其他 worklog，未提交。

## 第四十二轮 E42 用户提供 AIR For Customs - General Declaration 完整页证据（2026-08-16）

- 此页此前 PH-E 因浏览器策略未能读取；现由用户完整截图和交互说明补齐。页面为 `For Customs - General Declaration`：`Total Amount of goods purchased and/or acquired abroad?`、`Philippine Peso` / `US Dollar`、初始 `0` 的可编辑 Amount，以及既有 canonical wording/order 的 12 个独立 Yes/No 问题。
- 蓝色 `If YES` 的 BSP、Customs Arrival Area、PAGCOR、FDA、PDEA、FEO/PNP、plant/veterinary quarantine、Bureau of Quarantine 与 `please enumerate` 文案均是静态许可/说明，不建为 answer、modal child 或 upload/file requirement。
- 截图直接确认 item 11 Jewelry 和 item 12 Other goods 取 Yes 时均显示 `Add Item` 与表格。Add Item modal 有 `Description` textarea、`Quantity`、`Amount in USD`、`Cancel` / `Add`；表格列为 Quantity/Description/Amount in USD/Action，行有垃圾桶删除控件。合成行的具体值未记录。其他有动态反应的 Yes 曾被用户检查后恢复 No，但不能据此写死所有 12 项都出现 modal。
- 只确认 US Dollar 可选、Amount 可编辑；不猜用户未完成的 “if US Dollar” 含义。E42 标为 `confirmed-user-provided behavior`，E7 仍是 selector/value/empty-modal validation 的独立依据；server/page-level/final acceptance 继续 `needs_review`。未浏览、未改代码/总览/其他 worklog，未提交。

### E42 证据修正（2026-08-16）

- 用户当前官方页确认 Philippine Peso 切换为 US Dollar 后，没有新增或改变其他页面字段/结构，仍是同一个可编辑 Amount；不推断汇率、转换或额外字段。
- General Declaration 的 Q3–Q12 任何一项选 Yes 都显示同一 Add Item repeater；Q1/Q2 不显示 Add Item，属于货币门槛/后续 Currency Declaration 逻辑。这替代此前“仅直接确认 11/12、不可泛化”的旧边界；每项 Yes 是否必须成功保存一行仍未知。
- 截图状态 Amount=1,000、Q1=Yes、Q2=No、Q3=No（Q3–Q12 无 Yes）显示 toast：`Please answer yes atleast one of 3 to 12 questions due to indicated Total Amount of goods purchased and/or acquired abroad!`。因此仅记录为：显示 Amount 为正/非零时，Q3–Q12 至少一项须 Yes，Q1/Q2 Yes 不满足该页面校验；不外推金额单位/转换/阈值/负数或小数、服务端或 final acceptance。

## 第四十三轮 E43 用户提供 AIR General Declaration 后附件/签名分支证据（2026-08-16）

- 用户确认 Q3–Q12 只要任一 Yes，下一页为 `For Customs - Declaration Attachments and Signature`，同时出现 `Take a photo or upload a file.`、Signature、`Clear`、认证文案、Previous/Next。Q3–Q12 全 No 的既有电子 customs 路径则为 signature-only 版本，不显示上传控件。
- 这只关闭附件页出现条件；不推断 attachment 必传、格式/数量/大小、许可文件对应关系、上传成功或 server acceptance。附件 requiredness 继续 `needs_review`，最小闭环仍是该正向分支下空附件 + 有效合成签名的一次普通 Next，看到后续页即停，继续禁止 final Submit。

## 第四十四轮 E44 已打开 AIR Currency Declaration 实时只读爬取（2026-08-16）

- PH-A 接管用户已打开的官方 AIR Currency Declaration 页，而非新开登录页。未读取或记录 draft id、账号/会话、申请人或现有填写值；未改任何字段、未点 Previous/Next、未上传/签名/提交。
- 实页确认 Owner N/A checkbox，Owner/Recipient 的 Business/姓名/suffix/occupation/country/address/postal 控件和对应 DOM names；`Add Item` 的 Currency / Monetary Instrument / Amount modal（`currency_id`、`monetary_instrument_id`、`amount`）；BSP `bsp_authorization_date`；来源 Salary/Business/Other；用途 Leisure/Medical/Payables/Education/Other；`physical_or_shipped` 的 physically transferred/courrier services radios，及 `no_of_days_in_philippines`、`last_travel_to_philippines`。
- 仅打开一次 Add Item 后按 Cancel，未保存行。未读取 options/current values/checked states，未测试 required/error/条件/Other detail/row persistence。采样控件没有 native HTML `required` 属性，但这不等于官方 optional。字段合同已追加 E44，未改代码、总览或其他 worklog。

## 第十九轮 E18 S1 profile/persona/residence 受控验证（2026-08-04）

### 范围与安全边界

- 已读取适用 `AGENTS.md`、协调总览第 31 节、field contract E17/E18 及 PH-A/PH-B/PH-C/PH-D 最新段。
- PH-A 作为唯一浏览器 owner，在现有安全测试登录态中新建普通 `FOR OTHER + AIR + ARRIVAL` 合成路径；只停留至空白 `Personal Information` 页，未进入 Travel Details 或 E18 S2。
- 未输入或记录任何申请人资料，未选择/上传照片或文件，未记录账号、Cookie、OTP、密码、签名、路由标识或页面截图路径；未执行 final `Submit`、付款、迁移、seed、部署、测试或危险 Git 操作。

### 实测页面矩阵

| 页面 / canonical row | 英文原始 UI、控件与安全 selector/key | 空值验证 / 条件 | 结果 |
| --- | --- | --- | --- |
| Start / `registration.application_for` | `FOR ME (Current User)`、`FOR OTHER (Family Member)`；本轮选 `FOR OTHER` 以隔离合成路径。 | 未完成 Start 选择时 Continue 显示通用 `Required`，但不能安全归因到某一单独控件。 | labels confirmed；官方提交 key/value 与逐字段 requiredness 仍 `needs_review`。 |
| Personal / `traveller.passport_holder_type` | radio group `nationality`；`PHILIPPINE PASSPORT Holder`、`FOREIGN PASSPORT Holder`；实测 value `FILIPINO`、`FOREIGNER`。 | 已分别观察空白 Filipino 与 Foreigner view；默认 Filipino 选择下无法获取未选 persona 错误。 | confirmed live key/label/value。 |
| Personal / `profile.photo_url` | `Take a photo or upload a file.`；自定义 image-style trigger。未调用该控件，live DOM 未暴露 `input[type=file]`、`accept`、大小或数量元数据。 | 空白 Filipino 和空白 Foreigner 验证均在该 widget 显示 `Required`。 | 仅确认 blank required marker；上传方式、格式、大小、服务端规则仍 `needs_review`。 |
| Personal / `traveller.first_name` | `First Name`，文本控件 `first_name`。 | Foreigner 空值：`First Name Required`。 | confirmed live；canonical `verified_public`。 |
| Personal / `traveller.middle_name` | `Middle Name (optional)`，文本控件 `middle_name`。 | visible label 明确 optional。 | confirmed live；canonical `verified_public`。 |
| Personal / `traveller.last_name` | `Last Name (optional)`，文本控件 `last_name`。 | visible label 明确 optional。 | confirmed live；canonical `verified_public`。 |
| Personal / `traveller.suffix` | `Suffix (optional)`，control key candidate `extension_name`。 | visible label 明确 optional；未展开选项。 | confirmed live；canonical `verified_public`。 |
| Personal / `traveller.sex` | `Sex`；React-select visible input `react-select-3-input`、hidden key `gender`。 | Foreigner 空值：`Sex Required`。 | confirmed live；canonical `verified_public`。 |
| Personal / `traveller.mobile_number` | `Mobile Number` label 可见。 | 未安全暴露稳定 underlying control/key 或独立 empty/format error。 | `needs_review`。 |

### 交叉观察与停止点

- 同一空白页还显示 `Birth Date (MM/DD/YYYY)`、`Citizenship`、`Country of Birth`、`Passport Number`、`Passport Issuing Authority`、`Passport Issued Date (MM/DD/YYYY)`、`Occupation`；空值验证显示 Birth Date、Country of Birth、Passport Number、Passport Issuing Authority、Passport Issued Date 与 Occupation 的 `Required`。本轮没有打开 option/cascade，也没有新增格式结论。
- 照片 widget 的 blank `Required` 是本轮第一个安全 stop point。遵守 S1 边界，没有以照片上传或填写资料推进，因此没有到达 foreign/Philippine residence 分支。
- `Traveller Type` 是 Travel Details 中的后续字段，不能与本轮 `nationality` passport-holder radio 混同；`traveller.passenger_type` 未关闭。

### 合同与接口增量

- Field contract 新增 E19 并将 five S1 rows（`first_name`、`middle_name`、`last_name`、`suffix`、`sex`）纳入 live evidence；coverage 更新为 confirmed-live 56、official-public non-live 19、`needs_review` 36、diverted 8。
- PH-B：`nationality` 采用实测 `FILIPINO`/`FOREIGNER` radio values；个人字段 key 为 `first_name`、`middle_name`、`last_name`、`extension_name`、`gender`。不得据此加入 photo file contract 或批量重命名。
- PH-C：只可消费 `First Name Required`、`Sex Required` 与三个 optional label 证据；不得自动化照片、mobile、residence 或 Travel Details。
- PH-D：区分 passport-holder `nationality` 与后续 Traveller Type；照片继续显示为 action-required / upload unknown，不宣称文件要求。

### 未关闭项与文档检查

- 仍需实测：`registration.application_for` 官方提交值与逐字段错误、`traveller.passenger_type`、照片上传控件/accept/size/server rule、mobile control/validation，以及 foreign/Philippine residence 的全部 cascade/requiredness。
- 已运行 `git diff --check` 与两份允许文档的 `--no-index --check` 空白检查：均未报告内容错误。覆盖计数继续采用 field contract E17 的 canonical 审计口径，未用会重复计入历史/说明表的整份 Markdown 机械匹配替代它。未修改 PH-A.md 与 field contract 之外的文件。

## 第二十轮 E18 S1b profile photo/mobile/residence continuation（2026-08-04）

### 范围与前置读取

- 已读取适用 `AGENTS.md`、协调总览第 32 节、field contract E18/E19 与 PH-A/PH-B/PH-C/PH-D 最新段，并查看当前 dirty worktree。其他所有既有改动均保持不动。
- PH-A 作为唯一 browser owner，继续 E19 已释放的安全 ordinary `FOR OTHER + AIR + ARRIVAL` Foreign passport-holder 空白 Personal Information 页面；本轮只获准尝试照片 gate，原计划的 mobile/residence 只在照片成功后才会观察。
- 未使用或记录真实资料、账号、Cookie、OTP、密码、付款、签名、照片内容、文件路径、路由标识或截图路径；未运行 migration、seed、deploy、测试或危险 Git 操作，未进入 Health/Customs/Signature/Summary，也没有 final `Submit`。

### 实测照片入口与阻断点

| 项目 | 脱敏 live evidence | 结论 |
| --- | --- | --- |
| 官方页面 | `Personal Information`，Foreign passport-holder 空白 profile，照片文案 `Take a photo or upload a file.` | 与 E19 同一受控 S1 路径；未进入 Travel Details。 |
| 测试图 | 准备并在尝试后删除一个无人物、无文字、无 PII 的惰性 PNG；未选择、未上传、未传输，且未记录其内容或路径。 | 符合本轮 synthetic image 边界。 |
| 可见控件 | 自定义 image-style trigger；交互前后均未发现普通 `input[type=file]`、`accept`、size/count 或可见 MIME 提示。 | 暂无可自动消费的 upload selector/rule。 |
| 一次标准交互 | 对该 trigger 的一次标准 Chrome 点击没有产生 browser file chooser，也没有新增 live file input 或官方 validation message。 | 这是 UI-access boundary，不是服务器拒绝，也不能被解释为 accept/size/face/required server rule。 |
| 停止点 | 照片仍显示既有 `Required`，无法安全完成该 gate。 | 按任务要求立即停止；没有填写 profile、mobile 或 residence 合成值。 |

### S1b 结果与未关闭项

- `profile.photo_url` 只新增“标准 chooser path 未暴露”的 live evidence，仍为 `needs_review`；E20 不提升文件类型、大小、数量、照片内容、服务器 requiredness 或上传成功结论。
- `traveller.mobile_number` 仅保留 E19 的 visible label；稳定 control/key、country cascade、empty/format validation 仍未观察。
- Foreign residence 与 Filipino/Philippine residence 的 labels、keys/selectors、option source/cascade 与 required validation 均未到达；七个 `residence.*` rows 全部保持 `needs_review`。
- 本轮未关闭 canonical row，coverage 维持：confirmed-live 56、official-public non-live 19、`needs_review` 36、diverted 8。

### 给 PH-B / PH-C / PH-D 的最小增量

| Owner | 可消费结论 |
| --- | --- |
| PH-B | 不得为 `profile.photo_url` 新增或假设 file metadata；其 current flat key 仍不存在。保留 photo/mobile/residence 为 action-required。 |
| PH-C | 不得把 custom image trigger 当作普通 file input，也不得自动尝试 upload、填写 mobile/residence 或绕过照片 gate。 |
| PH-D | 照片 UI 继续标记为 required marker observed、upload mechanism unknown；不得展示 accept/size 或把 mobile/residence 变成已验证表单。 |

### 检查与释放

- 已更新 field contract E20；只修改本 PH-A worklog 和 arrival field contract。
- 已运行 `git diff --check` 与两份允许文档的 `--no-index --check`：均未报告 whitespace/content error；浏览器页随后释放交接，不保留未完成的上传状态。

## 第二十一轮 E20 零登录 public-bundle profile widget/mobile/residence wiring 审计（2026-08-04）

### 边界与公开来源

- 已读取适用 `AGENTS.md`、协调总览第 33 节、field contract E18-E20 和四份 worklog 最新段；第 33 节明确本轮只能补静态客户端合同，不能把它写成 live/server 证据。
- 只读官方 `etravel.gov.ph` 当前公开 build `79dfb3348d0a0f2a798c95b2cbd450cc9201257f` 的 build manifest 和静态 chunks。关键文件：`pages/wizard/other-e1a69aa001f77079.js`、profile component `1684-cbde5fd701e2a9ab.js`、generic upload widget `2273-84153505764d4b93.js`、field controls `5351-f14f9d0667eccffd.js`。
- 相应公开 source map 请求返回 404。未操作 Chrome 草稿、未登录、未上传、未调用官网写接口、未使用账号/OTP/Cookie/密码/密钥/真实资料，也未 final `Submit`。

### Profile photo widget：static evidence

| 主题 | `verified_public_bundle` 证据 | 保持 unknown / `needs_review` |
| --- | --- | --- |
| Field wiring | Profile Yup schema 要求非空 `photo_url`；widget callback 只把 `target.value.url` 写到 `photo_url`，delete 清空该值。 | 仅证明客户端 URL field；不证明 registration server 的文件/required contract。 |
| Trigger mode | call-site 在 `auth_with_mobile` 为真时传 `file`，否则传 `camera` + `file`；未传 profile-specific `fileTypes`、`accept`、crop 或显式 size。 | 未读 config 当前值；未证明 E20 页面实际 mode、accept/MIME、camera/crop success。 |
| Size/default | generic widget 默认 `maxFileSize=5242880` bytes（当 caller 未传值）。 | 这是 library default，不是官方 profile 文件规则，更不能外推服务器接受、count、photo-content 或上传时点。 |
| E20 对照 | E20 正常点击没有 chooser/native file input。 | 不能称 server rejection，也不能声称上述默认值曾在 live 执行。 |

### Mobile / residence：static evidence

| Canonical row(s) | `verified_public_bundle` 证据 | 未关闭点 |
| --- | --- | --- |
| `traveller.mobile_number` | Component `name=mobile_number`、固定 initial/preferred `ph`、PH mask `... ... ....`、可搜索国家选择、返回值去空格。Profile client Yup shape 未包含 mobile；同一 form/payload list 未见独立 `mobile_country_code`。 | live blank/format error、最终 string shape、client/server requiredness 和 server country field 仍未知。 |
| `residence.country_code` | `/api/v1/common/countries`；client Yup required。country 变更清空 region/province/municipality/barangay/street/street_two。 | 只证明 client clear/validation，不证明 server 或 live options。 |
| `residence.region_code`, `province_code` | branch 是 residence `country_code === PH`，而不是 Filipino/Foreigner passport-holder。province endpoint `/api/v1/common/provinces`、`order_by=name`；selected province 写入 `region_code`。未发现独立 Region selector。 | response metadata 和 live/server semantics 未验证。 |
| `residence.municipality_code`, `barangay_code` | municipality endpoint 依赖 province；其变化清空 barangay；barangay endpoint 依赖 municipality。PH branch 内 client Yup required。 | live request timing、option values、errors/server acceptance 未验证。 |
| `residence.address_line1`, `address_line2` | official keys `street`、`street_two`；street label 随 PH/foreign branch 切换，client requires street in both branches，street_two optional。 | live English labels 和 server rules 未验证。 |

### Ownership / payload boundary

- ordinary wizard 的 personal 与 residence form 都在 `is_applied_for_others=false` 时写 profile route，随后写 registration route；`FOR OTHER` 跳过 profile route 但仍进入 registration-route field object。
- 这只证明客户端 route branching：不得把 `FOR OTHER` 解释为 account/profile persistence，也不得添加 account secret/runtime field 或臆测 server waiver。

### S1 映射与给 B/C/D 的增量

- S1 的 `profile.photo_url`、`traveller.mobile_number` 和七个 `residence.*` 全部新增 static selector/condition/clear graph evidence，但不关闭任何 41-gap row，coverage 仍为 56 confirmed-live、19 official-public non-live、36 `needs_review`、8 diverted。
- PH-B：使用 flat keys `photo_url`、`mobile_number`、`country_code`、`region_code`、`province_code`、`municipality_code`、`barangay_code`、`street`、`street_two`；不要创造 `mobile_country_code` 或 profile photo file field。
- PH-C：client endpoints/clear graph 仅可用于 selector preparation；不得上传照片、放开 preflight 或从 static requiredness 推断 server result。
- PH-D：photo/server 与 mobile/residence live validation 继续 review-gated；`street_two` client optional 不是 launch authorization。

### 文档检查与浏览器状态

- E21 已写入 field contract；本轮仅修改该合同与 PH-A worklog。
- 已执行 `git diff --check` 与两份允许文档的 `--no-index --check`，均未报告 whitespace/content error。没有为本轮打开或推进浏览器页面；若前轮 handoff 页仍被系统保留，只会在结束时释放，不做任何页面交互。

## 第二十二轮 E22 S2 AIR/destination 零登录 public-bundle 审计（2026-08-04）

### 范围与来源

- 已读取适用 `AGENTS.md`、协调总览第 35 节、field contract E18-E21 与 PH-A/PH-B/PH-C/PH-D 最新段。第 35 节要求本轮只补 S2 的公开静态准备证据，不能将任何结果标成 live/server 验收。
- 只读取官方 `etravel.gov.ph` 当前公开 build `79dfb3348d0a0f2a798c95b2cbd450cc9201257f` 的 build manifest 与 `/wizard/other` travel-details dependency `static/chunks/5446-84c6936f6033944f.js`。对应 source map 仍不可用。
- 未打开 Chrome、未登录、未恢复或操作草稿、未上传、未调用官网写接口，未使用账号、OTP、Cookie、密码、密钥、申请人资料或合成表单值；未签名、未点 `Next` 或 final `Submit`。

### AIR travel details：`verified_public_bundle` 证据

| Canonical row(s) | 公开客户端事实 | 仍为 unknown / `needs_review` 的边界 |
| --- | --- | --- |
| `travel.purpose_code` | `purpose_of_visit_code` 请求 `/api/v1/common/purpose_of_visits?for_arrival=1`；Foreigner priority 为空，其他 persona priority 为 `OFW`。 | live order/filter、server acceptance 与 required error 未观察；E13 是 option snapshot 的唯一完整来源。 |
| `traveller.passenger_type` | AIR static options 是 `AIRCRAFT PASSENGER`、`FLIGHT CREW`；client 把二者都列为带 `flight_number` 的 type。 | ordinary v1 仍只允许 passenger；crew 继续分流，不能把 static option 当作普通合同支持。 |
| `air.airline_code` | official key `travel_company_code`，source 为 transport-filtered AIR `travel_companies`；change 会清 normal flight、special detail、AIR arrival destination port。 | live options、required error 与 server rule 未观察。 |
| `air.flight_number` | official key `flight_number`，normal source 为 `flight_numbers?travel_company_code={code}`；selected option 可由 `travel_port_code` 回填 `destination_port_code`，清空 flight 也清 destination port。 | option values、metadata 完整性和服务端接受未观察。 |
| `air.is_special_flight`, `air.special_flight_number` | Special Flight 是 `flight_number === SPECIAL FLIGHT` 的 derived UI state，不是本轮发现的 persisted official boolean；child key `flight_number_special`，uppercase、client min 5、client conditional required。 | sentinel 与 validation 未做 live/server 复核；不得发送 `special_flight` boolean。 |
| Origin/date | AIR arrival uses `origin_country_code` (countries excludes PH)、uppercase `origin_port`、`departure_date` / `arrival_date`；public client schema requires them and dates use today through today + 4 days. | date timezone、error text、server rule 未观察。 |
| Transit | checkbox `name/id=with_transit`；true 时 client requires `transit_country_code`、uppercase `transit_port`、`transit_date`。该 handler 未清 child value。 | rendered validation、stale submit/server behavior 未观察。 |
| Return date | AIR renderer 条件为 `FOREIGNER + AIR + ARRIVAL + purpose code POV001/POV007`；client UI min today。Yup 用同一 codes 但 min `travel_date`。 | 这是 public static 内部 render/schema 差异，必须 live 核验；不可推断 label、server requiredness 或 universal rule。 |

### Philippine destination / accommodation：`verified_public_bundle` 证据

| Canonical row(s) | 公开客户端事实 | 仍为 unknown / `needs_review` 的边界 |
| --- | --- | --- |
| `destination.stay_location_type` | AIR values 为 `RESIDENCE`、`HOTEL`、`TRANSIT`。切换时清 `destination_upon_arrival_in_philippines`、`transit_port_code`、`transit_destination_country_code`、`is_destination_same_as_permanent_address`。 | 不解决 SEA false/omitted UI 或 server requiredness。 |
| `destination.same_as_residence`, `destination.address_text` | Residence true 会将 profile `region_name`、`province_name`、`municipality_name`、`barangay_name`、`street`、`street_two` 拼接写入 shared official key `destination_upon_arrival_in_philippines`；false 清空。无独立 destination province/city/barangay cascade。 | live output format/editability/required error 与 server handling 未观察。 |
| `destination.hotel_name_or_address` | HOTEL 使用同一个 official value key 的 autocomplete，source `/api/v1/common/hotels`；label 是 `name`，client value 为 name/region/city display 拼接，未见独立 stable hotel code。 | 不得造 hotel id/code；live/server acceptance 未观察。 |
| `destination.transit_port_code` | AIR TRANSIT static values：`TP1000`、`TP2000`、`TP3000`、`TP001`，分别是 NAIA T1/T2/T3 与 Clark。 | live rendered options、required error 与 future stability 未观察。 |
| `destination.transit_destination_country_code` | countries endpoint，excludes `PH`，client conditional required。 | live/server behavior 未观察。 |
| AIR port/customs boundary | AIR `destination_port_code` source is transport-filtered `travel_ports`; normal flight metadata may write it. Regular wizard client later consumes `registration.travel_port.with_custom_declaration` for conditional customs steps. | 这不是 AIR port-to-manual/electronic flow 的 live mapping；不得从 metadata 单独决定 runner flow。 |

### S2 状态与给 B/C/D 的最小增量

- E22 不关闭 S2 的七个 `needs_review` rows，也不改变 E17/第 35 节计数：56 confirmed-live、19 official-public non-live、36 `needs_review`、8 diverted。
- 对上述 rows 的证据分层为：已有 E2 的页面/label 是 confirmed-live，E22 selector/condition/clear graph 是 `verified_public_bundle`，required-error/server acceptance 是 unknown。
- PH-B：保持 `airline_name -> travel_company_code`、`flight_number -> flight_number`、`destination_same_as_residence -> is_destination_same_as_permanent_address`、`destination_transit_airport -> transit_port_code`、`destination_country -> transit_destination_country_code`。`is_special_flight` 仅为 UI derived state，special detail 才映射 `flight_number_special`。
- PH-C：仅可准备 E22 endpoints/clear graph；airline/flight/hotel 缺 option 时 fail closed，不得由 `with_custom_declaration` metadata 直接推定 AIR customs path。
- PH-D：Special Flight 呈现为 derived branch；实现 destination branch 的 clear behavior，但所有 S2 requiredness/server states 继续 review-gated。

### 文档检查

- 已更新 field contract E22 与本 PH-A worklog；未修改协调总览、产品代码或其他 worklog。
- `git diff --check -- <two allowed docs>` 无输出、退出码 0。两份允许文档在当前 worktree 都是 untracked，因此另以 `git diff --no-index --check /dev/null <doc>` 检查；两者只报告预期的 untracked content diff（退出码 1），无 whitespace error。

## 第二十三轮 E23 S3 Health 零登录 public-bundle 审计（2026-08-04）

### 范围与公开来源

- 已读取适用 `AGENTS.md`、协调总览第 36 节、field contract E18-E22 以及 PH-A/PH-B/PH-C/PH-D 最新段。第 36 节要求 Health 本轮只补 static contract，不能改变 live/server 计数或启用提交。
- 只读官方 build `79dfb3348d0a0f2a798c95b2cbd450cc9201257f` 的 Health component `46906`（`5446-84c6936f6033944f.js`）、regular-wizard handler `26455`（`8565-1c2f634abccf81f0.js`）与 `/wizard/me` 的公开 English translation payload；source map 不可用。
- 未打开 Chrome、未登录、未恢复或操作草稿、未填写/上传、未调用写接口；未使用账号、OTP、Cookie、密码、密钥、真实或合成申请人资料；未签名、未点 `Next` 或 final `Submit`。

### Health 页面与条件矩阵：`verified_public_bundle`

| 顺序 | 原始英文题目 / key | Control / value | 条件、clear、client required | unknown boundary |
| --- | --- | --- | --- | --- |
| 页面 | `Health Declaration` | static title；wizard Previous/Next；false-declaration legal notice | E15 static sequence 为 Travel Details 后、Customs Confirmation 前；page index 来自动态 wizard array。 | 未 live 核对 AIR/SEA、Filipino/Foreigner 的实际 page index 或文案。 |
| 1，条件 | `Do you have a negative Antigen test taken within 24 hours prior to departure from your port of origin?` / `with_negative_antigen` | yes/no radio；`true`/`false` | only when `is_fully_vaccinated !== true` 且由 `birth_date` 算出的年龄至少 15；change 会设 `is_with_history_exposure=false`。Yup 未包含该 field。 | rendered marker/error、medical/server meaning、文件要求、upload 与 server acceptance 均未知。 |
| 2 | `Do you have any recent travel history in the last 30 days?` / `meta.with_recent_travel_history` | yes/no radio；`true`/`false` | client Yup required；No 清 `visited_countries`。 | nested control 的 server payload shape 与 live error 未观察。 |
| 3，Yes child | `Country(ies) worked, visited and transited in the last 30 days` / `visited_countries` | API multi-select | only recent-travel Yes；client requires nonempty nonempty-string array。source `/api/v1/common/countries`，component 无 exclude filter。 | E13 证明 current `code`/`name` identity；live options/server acceptance 未观察。 |
| 4 | `Have you had any history of exposure to a person who is sick or known to have communicable/infectious disease in the past 30 days prior to travel?` / `is_with_history_exposure` | yes/no radio；`true`/`false` | always rendered；client Yup required；本 module 无 child。 | live error、server acceptance 未观察。 |
| 5 | `Have you been sick in the past 30 days?` / `is_sicked_within_thirty_days` | yes/no radio；`true`/`false` | always rendered；client Yup required；每次 change 清 `sickness_symptoms`。 | live error、server acceptance 未观察。 |
| 6，Yes child | `Symptoms` / `sickness_symptoms` | API multi-select | only sick Yes；client requires min 1 nonempty string。source `/api/v1/common/sickness_symptoms?order_by=name&status_by=asc&is_active=1`，bundle maps `name` label / `code` value。 | 本轮没有刷新/冻结动态 symptom list；live options/server acceptance 未观察。 |
| 未渲染 | `Have you been exposed to bats or sick animals prior to travel?` / translation-key candidate `is_exposed_to_bats_or_sick_animals` | unknown | 只在 public English translation 中出现；当前 Health component 没有 control、schema、condition 或 clear handler。 | translation key 不等于页面字段；保持 `needs_review`。 |

### 路径与 payload 边界

- 当前 Health component 不含 `transportation_type`、`passenger_type`、`nationality` 或 passport-holder 分支；其显示条件只依赖 vaccination、age 和 Health answer state。此项只说明 component-local static wiring，不能外推 live AIR/SEA/persona parity。
- `is_fully_vaccinated`、`is_single_dosage`、`birth_date` 只作为 initial state/predicate 读取，`health_declaration` 是空 client schema object；当前 module 没有为它们渲染独立问题。不得把它们作为 E23 新 applicant question。
- 静态 handler 在构造 registration-update object 时排除了 `meta`、`visited_countries`、`sickness_symptoms`、`is_with_history_exposure`、`is_sicked_within_thirty_days` 和 `health_declaration`。这不证明官方 server 丢弃这些数据，但足以禁止 PH-C 猜测发送方式或放开 Health preflight。

### S3 状态与给 B/C/D 的最小增量

- E23 不关闭 E18 S3 的五个 `needs_review` rows，不改变计数：56 confirmed-live、19 official-public non-live、36 `needs_review`、8 diverted。
- 分层：E2/E6 已有的页面/label 仍为 confirmed-live；本轮 selector/condition/clear/static schema 是 `verified_public_bundle`；live required marker/error、option interaction 与 server acceptance 是 unknown。
- PH-B：不新增 bats/animals 或 antigen test-document schema；`meta.with_recent_travel_history` 仅是 public client control path，不是已确认 server payload rename。
- PH-C：不得猜测静态 handler 排除字段的提交方式，也不得自动化任何 Health positive branch；继续 fail closed 直到 live/server parity。
- PH-D：countries/symptoms 必须呈现为各自 Yes child；可将 clear graph 用作 UI hint，但不得展示为 server 规则或将 antigen/bats/animals标成 launch-ready。

### 文档检查

- 已更新 field contract E23 与本 PH-A worklog；未修改协调总览、产品代码或其他 worklog。
- `git diff --check -- <two allowed docs>` 无输出、退出码 0。两份允许文档仍是 untracked，因此另以 `git diff --no-index --check /dev/null <doc>` 检查；两者只报告预期的 untracked content diff（退出码 1），无 whitespace error。

## 第二十四轮 E24 S4 SEA explicit-false / manual customs 零登录 public-bundle 审计（2026-08-04）

### 范围与边界

- 已读取适用 `AGENTS.md`、协调总览第 37 节、field contract E18-E23 与 PH-A/PH-B/PH-C/PH-D 最新段。第 37 节将本轮限定为 S4 静态分支合同，不能把 E6 manual 或 E8/E9 electronic 的现场证据互相外推。
- 仅只读官方公开 build `79dfb3348d0a0f2a798c95b2cbd450cc9201257f`：new-declaration 页面、Travel Details module `52920`、regular `/wizard/me`、shortcut `/wizard/declaration` 与公开 English translation payload；source map 不可用。
- 未打开 Chrome、未登录、未恢复/推进草稿、未填写/上传、未调用官网写接口；未使用账号、OTP、Cookie、密码、密钥或申请人资料；未签名、未点 `Next` 或 final `Submit`。本节全部是 `verified_public_bundle`，不是 live continuation 或 server acceptance。

### SEA disembarking / port 静态矩阵

| Subject | Public client evidence | Retained boundary |
| --- | --- | --- |
| `is_disembarking` | Start form initial value is `false`; checkbox renders only when `transportation_type === SEA` and `flight_type === ARRIVAL`; public label is `Are you disembarking?`. Switching to AIR or DEPARTURE writes `false`. | 未证明显式 false/unchecked 可以 live 继续、server 接受，或所有 entry/reopen state 都会显示该 checkbox。 |
| falsey SEA stay UI | Travel Details computes truthiness of `is_disembarking`; SEA stay-location subtree only renders when it is truthy. Falsey state omits `stay_location_type`、Residence/Hotel/Port children 与 `disembarking_port_code`. | 不得把 E8 的 omitted UI 写成用户显式选择 false；也不能由此推断最终 customs/manual/electronic flow。 |
| destination clear graph | Changing `stay_location_type` clears `destination_upon_arrival_in_philippines`、`transit_port_code`、`transit_destination_country_code`、`is_destination_same_as_permanent_address`. | 未发现 start-page `is_disembarking` 的单独 clear callback；不得虚构 server payload 或 clear rule。 |
| `disembarking_port_code` | `TRAVEL_PORT` child requests `/api/v1/common/travel_ports` without `transportation_type`; current unfiltered E14 response snapshot is 73 rows, value `code`, label `name`. | 这是动态 option retrieval，不证明所有 73 项对 live SEA disembark 都有效。 |
| `destination_port_code` | Separate voyage-destination selector; E13/E14 SEA-filtered source carries dynamic `with_custom_declaration` metadata. | 与 `disembarking_port_code` 不互为 alias；metadata 不证明 port -> manual/electronic 的 server rule。 |

### Regular 与 declaration shortcut 的页面构造

| Route | `verified_public_bundle` construction | Non-inference rule |
| --- | --- | --- |
| Regular `/wizard/me` | Base Travel Details -> Summary. ARRIVAL inserts Health + Customs Declaration Confirmation. Nested `registration.travel_port.with_custom_declaration` inserts Other Travel Details; truthy declaration answer then General; truthy currency answer then Currency; then Attachments/Signature. `Family Member(s)` goes immediately before Summary only with `registration.status === INCOMPLETE`. | 这是页面数组而非 live reachability。`wizard_page` 是当前动态数组 index，不能硬编码。 |
| Falsey electronic metadata | Static regular array lacks Other Travel Details / General / Currency / Attachments/Signature when nested metadata is falsey, but retains Health + Customs Confirmation before Summary. | 不能凭此证明 false/unchecked SEA 会显示 E6 manual Baggage/Currency notice、一定到 Summary、一定跳过 Family 或被 server 接受。 |
| Shortcut `/wizard/declaration` | Base Customs Declaration Confirmation -> Summary; same metadata gate may add Other Travel Details / General / Currency / Attachments/Signature. It has no Travel Details, Health, or Family insertion. | 不得把 shortcut 的步骤号或 Summary 可达性移植到 ordinary passenger `/wizard/me`；未知官方如何选 route，亦不等同 manual path。 |
| Metadata shape | Regular array reads nested `registration.travel_port.with_custom_declaration`; a customs hook receives top-level `registration.with_custom_declaration`. | 仅静态 source-shape 差异，不是 defect，也不能让 VIZA 推导、alias 或提交任一 metadata。 |

### S4 gap 映射与最小接口增量

- `sea.is_disembarking`：关闭 public default、visibility 与 AIR/DEPARTURE clear 的静态问题；explicit false live continuation / server acceptance 仍是 `needs_review`。最小现场动作是新普通 SEA ARRIVAL 草稿观察 unchecked/false 后的下一服务器渲染页，只记录 label/selector/route，final Submit 前停止。
- SEA manual/electronic：E24 仅确认 `with_custom_declaration` 是动态电子页面数组 gate。E6 是一条 selected manual-notice live path；E8/E9 是一条 selected electronic live path。尚无可证明 port -> flow metadata mapping。最小现场动作是比较两个 SEA port/metadata state 的渲染页，不能由 falsey static gate 推定 manual notice。
- Other Travel Details / Family / Summary：static contract 现已区分 ordinary regular 与 declaration shortcut；regular Family 只在 `INCOMPLETE` state 插入，shortcut 无 Family。普通 live no-companion 与 Summary 仍须按实际 state 观察，final Submit 继续禁止。
- PH-B：保留 `is_disembarking`、`destination_port_code`、`disembarking_port_code` 三个独立 key；不得将 `with_custom_declaration` 或猜测的 manual/electronic flag 持久化为申请答案。
- PH-C：以实际页面内容分支，并区分 `/wizard/me` 与 `/wizard/declaration`；不得使用固定 `wizard_page`，不得从 metadata false 推断 E6 manual notice；false-path/server acceptance 继续 fail closed。
- PH-D：SEA stay destination 仅在实际 disembarking branch 出现时显示；不得由静态构造承诺通用 customs、Family 或 signature 顺序。

### 文档检查

- 已更新 field contract E24 与本 PH-A worklog；未修改协调总览、产品代码或其他 worklog。
- `git diff --check -- <two allowed docs>` 无输出、退出码 0。两份允许文档均为 untracked，因此另以 `git diff --no-index --check /dev/null <doc>` 检查；两者只报告预期的 untracked content diff（退出码 1），无 whitespace error。

## 第二十六轮 E26 S1 Profile 真实官网 parity crawl（2026-08-06）

### 范围与边界

- 已读取适用 `AGENTS.md`、协调总览第 39 节、arrival field contract E17-E25，以及 PH-A/PH-B/PH-C/PH-D 最新 worklog 段落。
- 本轮唯一现场来源是官方 `https://etravel.gov.ph` 的已登录 Chrome 会话；未以 public bundle 替代页面观察。使用新的隔离 ordinary 路径 `FOR OTHER + AIR + ARRIVAL`，随后在 Personal Information 选择 `FOREIGN PASSPORT Holder`。未记录账号、邮箱、OTP、Cookie、密码、token、申请人资料、草稿标识、截图路径或未脱敏页面值。
- 继续边界后来获扩展为可用合成值推进至 Summary 前，但本次仍在 profile photo gate 被浏览器政策阻断，故没有填入或保留任何合成 profile/residence 值，也没有进入 Travel Details、Health、Customs、Currency、attachments/signature、Family、Summary、CAPTCHA 或 final `Submit`。

### 实际页面顺序与 S1 字段矩阵

| 页面/步骤 | 实际可见内容或控件 | 直接证据与对应 VIZA 合同 | 状态 |
| --- | --- | --- | --- |
| New Travel Declaration | `FOR ME (Current User)`、`FOR OTHER (Family Member)`、`AIR`、`SEA`、`ARRIVAL`、`DEPARTURE`、`Continue` | normal UI 选择 `FOR OTHER + AIR + ARRIVAL` 后进入 Personal Information；未捕获或推测 submitted code。对应 `registration.application_for`、`registration.transport_type`、`registration.flight_type`。 | entry labels confirmed；owner code remains `needs_review` |
| Personal Information / passport holder | `PHILIPPINE PASSPORT Holder`、`FOREIGN PASSPORT Holder`；实际 radio `name=nationality`，页面 DOM 暴露 values `FILIPINO`、`FOREIGNER` | `traveller.passport_holder_type`；本次仅选择 Foreign branch。 | direct live confirmation |
| Personal Information / names and demographics | `First Name` (`first_name`)、`Middle Name (optional)` (`middle_name`)、`Last Name (optional)` (`last_name`)、`Suffix (optional)` (`extension_name` UI control)、`Sex` (`gender` UI control)、`Birth Date (MM/DD/YYYY)` (`birth_date`) | Existing profile rows live re-confirmed. Empty `Next` 后 First Name、Sex、Birth Date 出现 `Required`。 | direct live control/blank validation |
| Personal Information / citizenship and passport | `Citizenship` (`nationality_country_code` combobox)、`Country of Birth` (`country_of_birth_code` combobox)、`Passport Number` (`passport_number`)、`Passport Issuing Authority` (`passport_issued_country_code` combobox)、`Passport Issued Date (MM/DD/YYYY)` (`passport_issued_date`)、`Occupation` (`occupation_code` combobox) | Empty `Next` 后 Country of Birth、Passport Number、Passport Issuing Authority、Passport Issued Date、Occupation 出现 `Required`。未展开或记录任何 option value。Citizenship 本次没有 `Required` 标记，但不能由此推定 optional。 | direct live labels/controls; option and server behavior remain scoped by contract |
| Personal Information / mobile | `Mobile Number`，实际为 `input[type=tel]`；本次 DOM 未暴露稳定 name。 | Empty pass 没有显示 `Required`；照片 gate 前无法测试 prefix、格式或非法值。对应 `traveller.mobile_number` 仍 `needs_review`。 | partial direct live only |

### Photo widget：实测 normal UI 路径与停止点

| 项目 | 实际观察 | 结论 |
| --- | --- | --- |
| Visible label and blank validation | `Take a photo or upload a file.`；empty `Next` 显示 `Required`，页面也显示 `Please make sure to fill out all required fields.` | 这是 blank-page 的直接 UI validation；不等同于 server requiredness。 |
| Normal photo action | 通过官方可见控件的一次正常激活，出现一个可见 `input[type=file]`；`accept=image/jpeg,image/png,image/jpg`，`multiple=false`，并见到 `Camera` 文本。 | 真实页面直接确认单文件 image control metadata；没有触发相机动作或推断其行为。 |
| Authorized inert image selection | 浏览器系统文件选择流程对已授权的无人物、无文字 inert PNG 选择返回 managed-browser policy block。 | 无文件选择成功、无上传/传输、无官网 server error。不得改用 hidden-input 注入、直接 upload/API 或重试绕过。 |

### 未达页面与精确原因

- `FOREIGNER` residence：country/street/postal 及所有实际条件字段、option/cascade、empty validation 未达。
- `FILIPINO` / Philippine residence：province/municipality/barangay/postal cascade、clear-on-hide/clear-on-change 与 empty validation 未达；没有创建或混用第二条草稿。
- mobile prefix/format/illegal-value validation、profile photo 的 server acceptance/size/content/camera behavior 也未达。
- 阻断点是 profile photo 的正常文件选择被受管浏览器安全策略拦截，不是登录、OTP、CAPTCHA 或 eTravel 表单服务器校验。

### 合同与接口增量

- 已更新 `docs/philippines-etravel-arrival-field-contract.md` E26：新增真实 profile page labels/controls、passport holder values、blank `Required` 证据，以及 photo control 的 live `accept`/single-file metadata；旧 E20 “未显现 input”观察已标为被 E26 的 UI-access 观察取代。
- PH-B：保留既有 flat mapping；不要从 `accept` 或当前不完整 empty pass 增加 profile file rule，也不要把 mobile/citizenship 标记为 optional。
- PH-C：仅可通过可见官方 photo widget 与一次正常 chooser 路径继续；当前必须 fail closed，不得注入 hidden input 或调用 upload API。
- PH-D：可以呈现 passport-holder labels 和 blank-page photo `Required`，但不得承诺 camera/file success、server file acceptance、mobile validation、residence 或后续页面可达。

### 用户手动交接与检查

- 继续本场景所需的唯一用户动作：在当前可见 Personal Information 页的官方 photo 控件中，手动选择已授权的无人物、无文字 inert PNG；不得选择真实人员照片。完成后 PH-A 可从同一页面继续逐页采集。
- 未运行 migration、seed、deploy、测试、付款、真实 OTP/CAPTCHA、final `Submit`、危险 Git 操作、commit 或批量 `git add`。
- `git diff --check -- <two allowed docs>` 无输出。两份允许文档在当前工作树均为 untracked，故另以 `git diff --no-index --check /dev/null <doc>` 检查；两命令均仅以 exit 1 表示预期的 untracked content diff，且无 whitespace error 输出。Chrome 页面已保持在 profile photo gate 交接，不再由 PH-A 操作。

### E26 continuation handoff check（2026-08-06）

- 用户表示已通过当前官方 Personal Information 页的可见 photo control 完成选择后，PH-A 重新接管同一 handoff 页面；只检查 widget 是否处于可继续状态，未读取、截图、导出、描述或记录图像、文件名、路径、URL 或内容。
- 当前可见 widget 仍为 `Take a photo or upload a file.` 并保留 `Required`；没有可确认的 selected/ready 状态，`Next` 的 enabled 状态也不能证明 photo field 已通过。PH-A 因此未填任何 synthetic profile 值、未点击 `Next`、未进入 Travel Details 或后续页面。
- 这不是对文件本身、上传结果或 eTravel server rejection 的判断；仅证明当前页面无法安全确认 photo gate 已解除。Chrome 已再次以 handoff 状态释放。
- 所需用户动作：在当前可见官方 photo 控件内重新完成选择，并确认 widget 的 `Required` 标记消失或官方页面出现明确的已选择状态；不要提供、导出或描述该图片。完成后再通知 PH-A 继续。

## 第二十七轮 E27 字段合同冻结准备（2026-08-13）

### 边界与输入

- 已读取适用 `AGENTS.md`、协调总览当前第 39 节、PH-A 至 PH-F worklog、arrival field contract E17-E26，以及当前 `visa_form_fields` 通用 schema、PH form-field seed/manifest、PH-only frontend coverage、normalizer 与 customs form-filler/action-plan。
- 本轮完全离线：未访问官网、未登录、未打开 Chrome、未填写/上传、未调用写接口、未运行 migration/seed/deploy/test/Git 操作，也未处理账号、OTP/CAPTCHA、Cookie、秘密、申请人资料或 final Submit。
- 仅更新本 PH-A worklog 和 arrival field contract。数据库 `visa_form_fields` / `visa_application_answers` 是通用 `field_name` 存储表；本轮审计的是当前 seed/manifest 和代码，不声称已读取部署数据库状态。

### 已完成

- 在 field contract 新增 E27：将既有 111 个 canonical semantic key 与 current VIZA flat `field_name`/owner、类型/条件/requiredness 与 option-source 边界、中文显示来源、normalizer key、runner plan 状态逐项关联。原 canonical table 保留 raw official label/key/type/condition/evidence；E27 只补 implementation join，不把 bundle 推升成 live evidence。
- 明确采用四层 evidence/disposition：`confirmed_live`、`verified_public_bundle`、`needs_review`、`unsupported/diverted`。现有 `verified_public` 仍是 public-source 文档状态，不等同 live。
- 重申 8 个 diversion：crew、cruise、special registration、外交/9(e)/diplomatic/official/service passport 均不进入普通 arrival schema/runner。

### 冲突表（供 PH-B / PH-C / PH-D 消费）

| Priority | Conflict | Precise current locations | Required follow-up owner |
| --- | --- | --- | --- |
| P0 | Normalizer requires non-canonical `final_declaration`, but canonical certification is static copy/action, not an answer. | `viza-be/submission-service/src/ph-etravel/normalize.ts:632-637`; `viza-be/agent-backend/scripts/ph-etravel/form-fields.ts:678` | PH-C remove or gate pending future real evidence; PH-B/PH-D must not add/render an applicant checkbox. |
| P0 | Normalizer requires `mobile_country_code`; E21 found no separate official applicant key. | `normalize.ts:809-817`; `form-fields.ts:89-109` | PH-C runtime-boundary/fail-closed decision; PH-B/PH-D no new field. |
| P0 | SEA entry-port naming does not join: seed `sea_port_of_entry`, normalizer `destination_port_code` only. | `form-fields.ts:432,637`; `normalize.ts:721-723,856-858` | PH-B/PH-C coordinated one-way alias review; never alias `disembarking_port_code`. |
| P0 | Normalizer defaults absent passport-holder/passenger answers to Foreigner/passenger. | `normalize.ts:284-305,598-605` | PH-C fail closed on absent explicit answers; PH-B/PH-D retain explicit review-gated input. |
| P1 | SEA transit flat key is `transit_seaport`, normalizer requires `transit_airport`. | `form-fields.ts:435-437,645-646`; `normalize.ts:879-882` | PH-B/PH-C transport-aware alias before SEA enablement. |
| P1 | Missing `is_disembarking` is inferred true from destination data despite false/omitted branch still unresolved. | `normalize.ts:710-727`; `form-fields.ts:125-153` | PH-C require page classification/explicit answer; PH-D remains path-specific. |
| P1 | Seed required flags are stronger than canonical official-requiredness evidence for registration/travel/customs rows. | `form-fields.ts:601,630,636-637,664-668` | PH-B separates product completeness from official requiredness; PH-D stays review-gated. |
| P1 | Customs/currency selector plans remain `actionRequired` with blockers; plan existence is not authority to automate. | `form-filler.ts:333-505,553-620` | PH-C maintains blockers; PH-D never shows plan-ready as success. |
| P2 | `destination_hotel_address` has no official E22 input key but normalization can consume it. | `form-fields.ts:652`; `normalize.ts:731-743` | PH-B/D keep product-only; PH-C do not require as official. |
| P2 | `passport_expiry_date` is normalizer-required but absent from ordinary seed/E26 evidence. | `normalize.ts:762-765`; no matching seed field | PH-C ownership/fail-closed decision; no speculative PH-B/D field. |

### 尚待用户未来真实爬取的最小场景

1. S1：Profile photo 后的 mobile、Foreign/Philippine residence 级联、实际 payload/validation。
2. S2：AIR airline/flight/Special Flight/transit/destination 的 live error、option value 与 selector。
3. S3：Health positive arrays/options/errors。
4. S4/S5：SEA explicit false、manual/electronic content classification、SEA transit、electronic-Yes post-signature。
5. S6/S7：currency owner/recipient、physical/courier、attachment server rule、signature Clear/acceptance。
6. S8：仅在另行明确授权后，final Submit/reference/reopen/derived QR；本轮不授权。

### 内部文档检查

- 已执行只读脚本检查，不运行 Git 命令，也不写入代码或任何外部状态：
  - `coverage-parity.ts` 的 canonical key 数为 `111`，E27 section 覆盖 `111/111`；无缺失 canonical key。
  - diverted key 数为 `8`，E27 section 覆盖 `8/8`；无缺失 diverted key。
  - canonical keys 与 `NEEDS_REVIEW_KEYS` 均无重复；`NEEDS_REVIEW_KEYS=36`、`PUBLIC_BUNDLE_KEYS=19`，故与现有 `56 confirmed_live / 19 verified_public_bundle / 36 needs_review / 8 unsupported/diverted` tally 相符。
  - 实际 `PH_ETRAVEL_FORM_FIELDS` 定义段的 `69` 个字面 `field_name` 无重复；12 项 checklist 是生成式 family，未用该字面扫描错误地宣称完整 field total。

## 第二十五轮 E25 S5 SEA electronic-positive Currency 后链路零登录 public-bundle 审计（2026-08-04）

### 范围与公开来源

- 已读取适用 `AGENTS.md`、协调总览第 38 节、field contract E10-E24 与 PH-A/PH-B/PH-C/PH-D 最新段。第 38 节将本轮限定为 SEA electronic-Yes 的 Currency 后静态链路；不得把静态 wiring 当作 live continuation 或 final acceptance。
- 只读官方 build `79dfb3348d0a0f2a798c95b2cbd450cc9201257f` 的 regular `/wizard/me`、shortcut `/wizard/declaration`、Currency module `47297`、Attachments/Signature module `71931`、signature pad `51097`、Family module `60491`、custom-declaration handler `66859` 与 Summary module `72484`。source map 不可用。
- 未打开 Chrome、未登录、未恢复或推进草稿、未填写/上传、未调用官网写接口；未使用账号、OTP、Cookie、密码、密钥或申请人资料；未签名、未点 `Next` 或 final `Submit`。所有本轮结论仅为 `verified_public_bundle`。

### SEA regular electronic-Yes post-Currency 静态链路

| Stage | Public client condition / action | Boundary |
| --- | --- | --- |
| Currency present | Regular ARRIVAL array requires nested `registration.travel_port.with_custom_declaration`、`registration.with_something_to_declare` 与 fetched `custom_declaration.is_with_currency_declaration` truthy 才插入 Currency。E10 仅 live 证明一个 SEA electronic-Yes draft 到过 Currency。 | 不证明任意 SEA port、答案或 server state 都会构造 Currency。 |
| Currency `Next` | Existing Currency Yup checks run first；public handler sends current custom-declaration object and only on client-observed `200`/`201` increments current dynamic `wizard_page`. | 只证明 client dispatch gate；无请求实际发生，server validation/persistence/next page 均未知。 |
| Attachments/Signature | Same electronic metadata gate makes regular array place Attachments/Signature immediately after Currency。component's `travel_registration.with_something_to_declare` controls whether attachment widget/title appears；signature surface remains rendered either way。 | E11 仍是唯一 scoped SEA-positive live attachment/signature page evidence；E25 不证明该静态页在 live Currency 后可达。 |
| Attachment state | `attachments` values map to `{description, url, mime_type}`；image MIME/per-file-size hint remains client-only；parent schema contains `signature` only，没发现 attachment array min/max/required。 | 不新增 attachment source/count/upload/server acceptance 结论；没有文件交互。 |
| Signature `Next` | Initial state contains `signature`、`signature_source:"PAD"`、privacy/certification booleans。Yup requires nonempty `signature`; Next also checks the client certification boolean. Handler posts current custom-declaration object and only after `200`/`201` advances. A fetched profile signature, when present, is statically overlaid into posted form state. | 不记录或复用任何签名；overlay 不证明 server precedence、Clear behavior、signature acceptance 或 live continuation。 |
| Family / no-family | Regular route inserts Family immediately before Summary only when `registration.status === INCOMPLETE`. Empty `family_members` opens the no-companion confirmation callback; selected member's signature has client `Required` schema. | 不证明 positive SEA status、modal acceptance、family persistence 或 next Summary。E9 live Family/Summary 仅适用于 selected electronic-No path。 |
| Summary boundary | Regular array ends at Summary. Its separately scoped final action uses runtime CAPTCHA/family state; shortcut's Summary is not evidence that regular final action is reachable. | 未触发 final action；不闭合 Summary visibility、CAPTCHA、final acceptance、reference、QR 或 recovery。 |

### regular 与 shortcut 的隔离、S5 gap

- Shortcut `/wizard/declaration` 的 ARRIVAL electronic-positive 静态数组可构造 Other Travel Details -> General -> Currency -> Attachments/Signature -> Summary，但不含 Travel Details、Health、Family。不得将其步骤号或 no-Family 行为套到 ordinary regular `/wizard/me`；route selection 仍未知。
- E25 不改变 E17 coverage 计数，也不关闭 S5 live gap。S5 最小 controlled action：fresh SEA electronic-Yes ordinary regular draft，前段与 E10/E11 匹配；仅在另行授权后画 synthetic signature，一次正常 Next 后记录 Family/no-companion/Summary 的 route/title/action，并在可见 Submit 立即停止。
- 附件 requiredness 另需授权 inert-file 场景才可验证；不得记录文件路径/内容，且不签名或 Submit。Family 只观察是否出现和 no-companion modal，不选择 family member。

### 给 B/C/D 的最小增量

- PH-B：`attachments`/`signature` 仍是 page-scoped；不得将 Summary、no-companion modal、`signature_source`、privacy/certification booleans 或 `with_custom_declaration` metadata 持久化成普通 applicant answer。公开 schema 不支持因附件为空而拒绝。
- PH-C：SEA regular electronic-positive 的预期 client-only order 是 Currency -> attachment/signature -> conditional Family -> Summary；按 rendered route/content 而非固定 `wizard_page` 判定。无单独签名授权时停在 signature；有授权也必须停在 Summary Submit 前。
- PH-D：attachments/signature、Family/no-companion、Summary 只能展示为 conditional action/review gate；不得将 E25 静态证据显示为上传成功、family 完成、Review 可达或 submitted/result success。

### 文档检查

- 已更新 field contract E25 与本 PH-A worklog；未修改协调总览、产品代码或其他 worklog。
- `git diff --check -- <two allowed docs>` 无输出、退出码 0。两份允许文档均为 untracked，因此另以 `git diff --no-index --check /dev/null <doc>` 检查；两者只报告预期的 untracked content diff（退出码 1），无 whitespace error。

## 第十三轮官方选项与 SEA port/customs-flow 只读证据（2026-08-04）

### 开始前读取与边界

- 已读取适用 `AGENTS.md`、协调总览第 25 节、当前 field contract，以及 PH-A/PH-B/PH-C/PH-D 最新 worklog 段落。第 25 节明确要求停止重复尝试被管理浏览器拦截的签名页，转为安全的只读官方选项与港口/海关流证据。
- 本轮没有打开、恢复或推进任何 eTravel 申请草稿；没有登录、账号、OTP、Cookie、申请人资料、上传、签名、CAPTCHA 或 final `Submit` 操作。
- 仅访问官方公开 `etravel.gov.ph` 前端 build 与 `ws.etravel.gov.ph` API。所有请求均为无凭据 `GET`；没有记录或输出任何账号、Cookie、密钥或申请人数据。
- 本节以 E13 的 2026-08-04 只读响应为准，取代本 worklog 较早段落中“SEA port 完整列表 / `with_custom_declaration` 元数据未抓取”的缺口表述；不改变那些段落的 live-browser 事实。

### E13 official source and retrieval result

| Source | Evidence |
| --- | --- |
| Public frontend build | `https://etravel.gov.ph/` current build `79dfb3348d0a0f2a798c95b2cbd450cc9201257f`. Its HTTP client has public base `https://ws.etravel.gov.ph/`; its reusable select sends `q` and `paginate=0` plus field filters. |
| Public API envelope | Each listed endpoint returned HTTP 200 and `{data: [...]}` with no pagination meta for the exact `paginate=0` request. |
| Data minimization | Responses were static reference data only. Large lists are represented by endpoint, schema, count, and reproducibility facts rather than copied wholesale. |

### Complete/current option evidence

| Official request | Response schema | Result | VIZA conclusion |
| --- | --- | --- | --- |
| `GET /api/v1/common/travel_ports?paginate=0&q=&order_by=name&status_by=asc&transportation_type=SEA` | `id`, `transportation_type`, `code`, `name`, `theme`, `with_custom_declaration`, `is_active` | 53 SEA ports. 13 returned `with_custom_declaration=1`; 40 returned `0`. | `destination_port_code` uses official `code` value. Complete SEA code/label list and the exact split are in the field contract E13. |
| Same travel-port request, `transportation_type=AIR` | same | 20 AIR ports; 11 `with_custom_declaration=1`, 9 `0`. | Confirms shared schema only; no AIR flow behavior was newly exercised. |
| `GET /api/v1/common/purpose_of_visits?for_arrival=1&q=&paginate=0&order_by=name&status_by=asc` | `id`, `code`, `name`, `for_arrival`, `for_departure`, `is_exclusive_for_filipino`, `order`, `theme`, `with_cfo`, `with_oec` | 16 rows. | Official purpose value is `code`; full code/label list added to field contract. |
| `GET /api/v1/common/countries?paginate=0&q=` | `id`, `code`, `alpha_3_code`, `name`, `nationality`, watch/eVisa flags | 250 rows, 250 distinct codes. | Persist official `code`, not label; nationality display uses `nationality` where the bundle requests it. |
| `GET /api/v1/common/occupations?paginate=0&q=&order_by=name&status_by=asc` | `id`, `code`, `name`, `for_arrival`, `for_departure` | 15 rows. | Persist `code`; returned data includes `for_arrival`, so UI availability must not be guessed from label alone. |
| `GET /api/v1/common/currencies?paginate=0&q=` | `id`, `name`, `shorten_name`, `display_name`, country/exchange/status fields | 263 rows; ids 1..263; 215 distinct names. | Persist numeric `currency_id`: labels are not unique. |
| `GET /api/v1/common/monetary_instruments?paginate=0&q=` | `id`, `name`, `is_active` | 16 rows. | Persist numeric `monetary_instrument_id`; complete list added to field contract. |

### SEA port -> customs-flow evidence

| Evidence | Confirmed fact | Limit |
| --- | --- | --- |
| API row metadata | Every SEA port row exposes `with_custom_declaration` as `0` or `1`; the exact full SEA mapping is now in the field contract E13. Manila South Harbor / `TP0103`, the E8/E10 live port, is `1`. | This is current retrieved metadata, not a permanent catalogue. |
| Public wizard bundle | For arrival, the wizard reads `travel_port.with_custom_declaration`. When truthy it inserts Other Travel Details, then conditional General Declaration, Currency Declaration, and Attachments/Signature around the base Health/Confirmation path. | Evidence level is `verified_public_bundle`; it matches E8/E10 but cannot establish server final acceptance. |
| `0` rows | The bundle does not insert those electronic pages for a falsey flag. E6 separately observed a manual Baggage/Currency notice on one SEA path. | Do not assert all `0` ports have one identical manual flow or the same final page order. That remains `needs_review`. |

### Bundle-only control evidence

| Area | Verified public-bundle evidence | Status / restraint |
| --- | --- | --- |
| Owner N/A | Form state key is `owner_details_not_applicable`; checking it clears and disables owner/recipient controls. Rendered checkbox has no explicit `name` or `id`. | `needs_review`: usable semantic mapping, not a stable live selector or owner/recipient requiredness proof. |
| Attachment widget | `attachments` stores `{description, url, mime_type}`; widget permits `image/png`, `image/jpg`, `image/jpeg`; normal web mode offers camera/file and mobile-auth mode file. Component client schema requires signature but has no attachments-array rule. | `needs_review`: no unconditional attachment, size, server upload, or final-acceptance claim. No widget credential-like value was recorded. |
| Currency item modal | `currency_id` and `monetary_instrument_id` take numeric ids and populate display fields `currency_name` / `monetary_instrument_name`. | Confirmed public mapping; existing E7/E10/E11 live evidence remains the source for observed validation. |

### PH-B / PH-C / PH-D precise delta

| Owner | Directly consumable delta |
| --- | --- |
| PH-B | Use E13 exact purpose, occupation, country, currency, instrument, and SEA page-0 port values. Persist currency/instrument numeric ids. Keep `sea.voyage_number` as alias mapped to official `flight_number`; do not reuse SEA destination list for `disembarking_port_code`. |
| PH-C | Fetch/select through documented public endpoints (`q`, `paginate=0`, filters). For SEA electronic eligibility inspect returned `travel_port.with_custom_declaration` and actual page content together; false flag does not prove one universal manual sequence. |
| PH-D | Render the exact static purpose/occupation/passenger/source/purpose values and port metadata state. Keep attachments optional/unknown and crew/cruise diverted from ordinary passenger UI. |

### Remaining gaps and validation

- Still `needs_review`: unfiltered `disembarking_port_code` list, hotels, airlines, flight numbers, sickness symptoms, checklist item payloads, owner/recipient server requiredness, attachment size/server rule, explicit SEA non-disembarking false, positive SEA post-signature Family/Summary, final Submit/reference/QR/result.
- No live browser steps were run in this round; no submission occurred.
- `git diff --check` passed with no output. Because both permitted docs are currently untracked in this worktree, additional `git diff --no-index --check /dev/null <each-doc>` checks also produced no whitespace errors.
- No migrations, seeds, deployments, tests, commits, batch staging, or dangerous Git actions were run.

## 第十四轮 E13 后公开附件、Owner N/A 与 SEA port 证据（2026-08-04）

### 开始前读取与边界

- 已读取适用 `AGENTS.md`、协调总览第 27 节、field contract E13，以及 PH-A/PH-B/PH-C/PH-D 最新 worklog 段落。第 27 节要求在不重开草稿的前提下补附件组件、Owner N/A 与港口字段语义。
- 本轮完全零登录、只读：仅对官方 `ws.etravel.gov.ph` 作无凭据 `GET`，并检查官方公开 frontend build。没有恢复或推进任何申请草稿；没有账号、OTP、Cookie、申请人资料、上传、相机、签名、`Next`、CAPTCHA 或 final `Submit`。
- `verified_public_bundle` 在本节仅表示公开静态实现证据，不是合同第四种状态；线上 requiredness、服务端接受、最终提交一律不由静态 bundle 推断。

### E14 attachment widget public-bundle matrix

| 采集点 | 已直接证实的公开实现 | 可消费结论 | 保留缺口 |
| --- | --- | --- | --- |
| 状态与组件 | 附件/签名父组件使用 form state `attachments`，项目结构为 `{description, url, mime_type}`，并动态加载公开 multi-file module `68346`。源码符号被压缩，未公开稳定组件名。 | `attachments` 是语义/状态键；不能把组件内部 DOM id 当作 VIZA field name。 | 线上 DOM、服务端字段兼容性和 final parity 未验证。 |
| 上传入口 | 该 multi-file widget 有隐藏 `input#file[type=file]`、`multiple` 和 MIME accept；正常 web 配置为 camera + file，mobile-auth 配置为 file。 | 可以说明公开组件的来源分支，但 `#file` 是通用内部标记，不得作为跨页稳定 selector。 | 未进行真实文件选择或上传。 |
| MIME / size / count | 父组件传入 `image/png`、`image/jpg`、`image/jpeg`。widget 默认逐个文件检查 5,242,880 bytes（5.00 MB），逐个上传后追加。检查范围内未发现 parent override、最大附件数或总大小限制。 | 仅能作为客户端提示：PNG/JPG/JPEG、每个文件 5.00 MB。 | 不代表服务端上限、总量上限、无限附件或要求上传。 |
| 变换与必填 | 检查的 parent/widget 路径未发现调用端 crop/resize/compress/canvas quality 配置。parent client schema 仅明确 required `signature`，没有 `attachments` rule；附件 widget 仅在 registration `with_something_to_declare` 为 truthy 时渲染。 | 静态证据证明附件展示条件与签名必填 schema 分离。 | 不能将其提升为 live attachment requiredness，也不能推断上游服务不做图片转换。 |

### Owner N/A public-bundle matrix

| 项目 | 已直接证实的公开实现 | VIZA / runner 边界 |
| --- | --- | --- |
| key / value / DOM | `owner_details_not_applicable` 是 boolean Formik state。Checkbox 没有明确 `name`、`id` 或 string `value`；checked 由 boolean 控制。 | 可作 `currency.owner_not_applicable` 的一对一语义映射，不能作为自动化 selector。 |
| check 行为 | 选中时清空并禁用 owner 13 项：`owner_business_name`, `owner_first_name`, `owner_middle_name`, `owner_last_name`, `owner_suffix_name`, `owner_occupation`, `owner_country_code`, `owner_region_code`, `owner_province_code`, `owner_municipality_code`, `owner_barangay_code`, `owner_street`, `owner_postal_code`；以及 recipient 对应的 13 项字段。取消选中只重置该 boolean。 | 仅在官方 Currency Declaration 分支实际出现时，B/C 可据此清空或忽略这些字段；不得由此猜测未选中时的服务端 requiredness。 |
| 分支 | 控件属于 Currency Declaration 组件；该组件仅在电子 customs 流实际进入 currency 页面时出现。静态读取没有证明 person/business 的独立条件。 | 普通到达路径、Owner/Recipient 条件与 server validation 继续 `needs_review`。 |

### SEA port request / metadata integrity matrix

| 项目 | 可复现官方请求与结果 | 结论 / 限制 |
| --- | --- | --- |
| Page-0 `destination_port_code` | `GET /api/v1/common/travel_ports?paginate=0&q=&order_by=name&status_by=asc&transportation_type=SEA` 返回 53 行；page-0 bundle 明确提供 `transportation_type=SEA`。 | 官方 option value 为 `code`，label 为 `name`；这是 SEA voyage destination 的过滤列表。 |
| `TRAVEL_PORT` `disembarking_port_code` | bundle 请求同一 endpoint，但只带 `paginate=0&q=&order_by=name&status_by=asc`，不带 transport filter；该精确请求返回 73 行，恰为 53 SEA + 20 AIR。 | 虽然外层显示条件是 SEA ARRIVAL + `is_disembarking=true` + `stay_location_type=TRAVEL_PORT`，公开组件仍未把下拉请求限制为 SEA。不得用 53 行列表替代该字段，也不得声称其 UI 只有 SEA。 |
| 73 行快照完整性 | 73 行的 `id`、`transportation_type`、`code`、`name`、`theme`、`with_custom_declaration`、`is_active` 均非空；`is_active` 全为 `1`；`with_custom_declaration` 值域只有 `0` / `1`。SEA 有 13 个 `1`、40 个 `0`。SEA/AIR 两个过滤数组的并集与 73 行无过滤数组逐 id 完全一致。 | 这是 2026-08-04 该精确公开请求的可复现快照校验，不是永久官方目录或最终流程授权。 |
| 唯一性 | 53 个 SEA row 的 `id` 与 `code` 都唯一；有一个 label 重复：`Port of Legazpi` 对应 `TP120` 和 `LEGAZPI`。全部 73 行 id/code 唯一、name 为 72 个 distinct 值。 | B/C/D 必须按 `code` 身份化和持久化，不得以 label 唯一匹配或互换两个同名港口。 |
| customs-flow linkage | bundle 读取 registration 嵌套 `travel_port.with_custom_declaration`；arrival flight selection 可把所选 flight object's `travel_port_code` 写入 `destination_port_code`。E8/E10 已 live 关联 `TP0103` / Manila South Harbor 与 electronic path。 | 不能外推为“任一 submitted `destination_port_code` 唯一直接决定 flow”；仍须以渲染页面验证，0 值港口的完整 manual 语义继续 `needs_review`。 |

### 给 PH-B / PH-C / PH-D 的最小精确增量

| Owner | 本轮可直接消费 | 不可外推 |
| --- | --- | --- |
| PH-B | 保持 `sea.destination_port_code -> destination_port_code` 与 `destination.disembarking_port_code -> disembarking_port_code` 两条独立映射；使用 `code` 而非 label。Currency 分支中把 `currency.owner_not_applicable` 映射为 boolean `owner_details_not_applicable`，在该官方分支出现时清空/忽略列出的 owner/recipient 字段。 | 不批量重命名 flat key；不使用内部 `#file`；不把附件或 Owner N/A 设为无条件必填。 |
| PH-C | SEA voyage destination 用 `transportation_type=SEA`；TRAVEL_PORT child 按公开组件不带该筛选。附件 client hint 仅 PNG/JPG/JPEG + 每文件 5.00 MB。 | 不把 `with_custom_declaration` 当作最终提交逻辑，不推断服务端附件限制、附件数量或 Owner N/A requiredness。 |
| PH-D | 用 code 区分港口，允许同名 label；将附件显示为条件未知，且仅在相应 UI 出现时呈现公开 bundle 支持的类型/单文件大小提示。 | 不呈现“全部是 SEA 港口”“附件必传”“label 唯一”的错误断言。 |

### Remaining gaps and check

- 继续 `needs_review`：附件线上 requiredness、服务器 MIME/size/count/aggregate/transform 行为、正式上传结果；Owner/Recipient 未勾选时 requiredness；`disembarking_port_code` 无过滤请求的产品语义；SEA `with_custom_declaration=0` 的完整流程；任何 final `Submit`、reference、QR 或结果页面。
- 未运行 migration、seed、deploy、测试、commit、批量暂存、危险 Git 操作或任何官方提交动作。
- 已运行 `git diff --check`，无输出。两份允许文档因当前均为未跟踪文件，另分别运行 `git diff --no-index --check /dev/null <doc>`；两次均无 whitespace 输出（退出码 `1` 仅表示与空文件存在内容差异）。未跟踪文档空白检查也无输出。

## 第十五轮公开 bundle post-signature / validation wiring 证据（2026-08-04）

### 开始前读取与边界

- 已读取适用 `AGENTS.md`、协调总览第 28 节、field contract E13/E14 和 PH-A/PH-B/PH-C/PH-D 最新 worklog 段。第 28 节限定本轮不得重开草稿，只补 Family/Summary、附件、签名和 Owner N/A 的公开实现证据。
- 本轮只读取现有官方 `etravel.gov.ph` public frontend build；零登录、零账号、零 Cookie、零申请人资料。没有恢复草稿、签名、上传、`Next`、CAPTCHA、付款或 final `Submit`。
- 下列 `verified_public_bundle` 全部是证据类别，不冒充 live observed 或最终提交成功。只更新本 PH-A worklog 和 arrival field contract。

### E15 regular-wizard post-signature construction

| Public route / condition | Static construction evidence | 可消费结论 | 不可外推 |
| --- | --- | --- | --- |
| Regular `/wizard/me` ARRIVAL | 基础数组为 Travel Details 与 Summary；依 profile 状态可先插个人资料/地址。ARRIVAL 再插 Health、Customs Declaration Confirmation；所有步骤均是当前数组项。 | `wizard_page` 是当前动态数组 index，不是全路径固定页号；页面显示使用 index + 1/array length。 | 不可用 E9 的 `wizard_page=6` 作为所有 AIR/SEA 的固定 index。 |
| SEA electronic No-shaped state | nested `travel_port.with_custom_declaration` truthy 时插 Other Travel Details；`with_something_to_declare` false 时不插 General，但仍插 signature page，且该 page 只显示 signature，不显示附件 widget。 | 解释 E9 no-declaration path 的公开构造边界。 | 不能把 state 名称外推为所有港口/所有 UI 响应的线上页面成功。 |
| SEA electronic Yes-shaped state | 同一 electronic flag 下，truthy `with_something_to_declare` 插 General；truthy fetched `custom_declaration.is_with_currency_declaration` 再插 Currency；随后插 attachments/signature。 | 与 E10/E11 已观察到的 SEA positive 页面至签名边界相符。 | positive 签名后的 Family/Summary 仍无 live evidence。 |
| AIR positive | `/wizard/me` 对 ARRIVAL 的 electronic flag、`with_something_to_declare`、currency state、attachments/signature、Family/Summary 使用同一构造器。 | AIR/SEA 不存在另一套独立正向 step 算法的公开代码证据。 | 不能据此证明每个 AIR 端口的线上 flow/requiredness/接受结果。 |
| Family before Summary | 仅在 registration `status === INCOMPLETE` 时，regular wizard 把 Family Member(s) 插到 Summary 正前方；否则 Summary 直接接前一步。 | 这是 post-signature Family/Summary 相对顺序的源码来源。 | 不证明任何 registration status 的服务端语义、modal 选择或最终 Review 内容。 |
| Short `/wizard/declaration` | 此路由 base 只有 Customs Confirmation 与 Summary；ARRIVAL electronic 可插 Other/General/Currency/attachments-signature，但没有 Family insertion。 | 不同路由需独立解析。 | 不得将短 customs-only route 的页号/顺序套到 `/wizard/me`。 |

### Family and no-companion bundle evidence

| Area | Static evidence | Boundary |
| --- | --- | --- |
| Family form state | `family_members` 为对象数组，每项有 `family_member_id` / `signature`；Yup 只要求已选项的 `signature`，没有 array `.min`/`.required`。 | 零成员在客户端可走确认门；不证明服务器接受空 family payload。 |
| No-companion modal | 空数组提交时 dispatch `Promft.confirm_continue_without_family_member` 确认 modal；其 callback 才把同一 `wizard_page` 加一。 | public bundle 证明 gate wiring，不证明用户确认、翻译文案、服务端状态或随后的 Summary 成功。 |
| Selected companion | 未完成 profile 的选择框被禁用；选择时写入 `{family_member_id, signature:""}` 并出现 signature pad。 | 每位选中成员的签名仅有 client `Required` 证据；不写入/记录任何签名值。 |

### Attachment and signature validation wiring

| Area | Static evidence | Status / restraint |
| --- | --- | --- |
| Attachments count / requiredness | attachment/signature parent Yup schema 仅有 `signature: required`；`attachments` 没有发现 `.required`、`.min`、`.max`。multi-file widget 可 multiple 选择，沿用 E14 的 MIME 与逐文件 5.00 MB client check。 | `needs_review`：没有附件最小/最大数量、总大小、server rule 或 live requiredness 证据。 |
| Attachment payload boundary | widget 写 `attachments[]` `{description, url, mime_type}`；parent submit handler 将当前 form object 送往官方 custom-declaration client route，检查范围内没有剥离 `attachments`。 | `verified_public_bundle`：只证明客户端对象/dispatch，绝不证明上传时序、server schema/validation 或接受。 |
| Signature fields | 初始 fields 是 `signature`、`signature_source="PAD"`、`data_privacy_agreement=true`、`correct_declaration_confirmation=true`。canvas `endStroke` 调用 `toDataURL("image/png")` 写回 `signature`。 | `verified_public_bundle`：该 data URL 属于 runtime secret-like applicant output，不进入 fixture、日志或文档示例。 |
| Empty/continue/clear | Yup 要求非空 `signature`。Next disabled 只检查 submitting/`correct_declaration_confirmation`，其后由 Formik schema 阻断空签名。Clear handler 仅调用 pad clear，检查到的代码没有直接 `setFieldValue("signature", "")`。 | 空签名 client validation 是可证实的；Clear 后的 live payload/continue 行为、server signature acceptance 仍 `needs_review`。 |

### Owner N/A precise client-condition evidence

| Area | Static evidence | Boundary |
| --- | --- | --- |
| Owner/recipient required schema | `owner_last_name` 仅在 `owner_first_name` truthy 时 required；`recipient_last_name` 同理。检查到的 schema 没有 owner/recipient 无条件 identity rule。 | 不能由客户端 schema 推断 server 允许空 owner/recipient。 |
| N/A clear / disabled | `owner_details_not_applicable=true` 清空 E14 记录的 26 个 direct owner/recipient fields，并禁用 primary controls；它清空 first names，使两个 last-name 条件不再触发。schema 没有 `when(owner_details_not_applicable)` 分支。 | 可解释 client clear/disable；不是 server waiver 或稳定 DOM selector 证据。 |
| Person/business / physical/courier | owner/recipient business 与个人字段同时渲染，未发现 person/business discriminator。physical/courier validation 只依赖 `is_physically_transferred_by_person` / `is_shipped_thru_courier_service`，不引用 Owner N/A 或 owner/recipient。 | 不得新造 owner/recipient 类型或 physical/courier dependent N/A 规则。 |

### 给 PH-B / PH-C / PH-D 的最小精确增量

| Owner | 可直接消费 | 必须继续 live/fail-closed |
| --- | --- | --- |
| PH-B | Family/no-companion/Summary/final Submit 保持 non-answer action gates；仅在官方 signature page 出现时使用 `signature` + `signature_source=PAD` 语义映射；Currency 页面内 Owner N/A 才可清空已列字段。 | 不把 signature data URL 写入字段示例/fixture/log；不设附件数量规则或 Summary success。 |
| PH-C | 以当前页面语义/route 和动态 array 解释 `wizard_page`，不要固定 index；signature 是 page-scoped required runtime value，attachments 是 optional array state。 | 不自动确认 no-companion、Clear-and-continue、upload、signature、final Submit，亦不猜 server owner/recipient validation。 |
| PH-D | Family/no-companion/Summary 仅是条件 action/review 状态；附件 hints 仅出现在已证实的条件组件，不增加 owner/recipient type selector。 | 不显示固定 post-signature 页号、attachment min/max/server rule 或 submitted status。 |

### Remaining gaps and validation

- 继续 `needs_review`：所有 live post-signature Family/no-companion/Summary 行为，附件 upload/server MIME-size-count/aggregate/requiredness，Clear 的实际 payload 效果，Owner/Recipient server requiredness，以及 final Submit/reference/QR/result。
- 未运行 migration、seed、deploy、测试、账号/OTP/Cookie 流程、付款、commit、批量暂存、危险 Git 或官方提交。
- 已运行 `git diff --check`，无输出。两份允许文档仍为当前 worktree 的未跟踪文件，分别运行 `git diff --no-index --check /dev/null <doc>` 均无 whitespace 输出；退出码 `1` 仅表示与空文件存在内容差异。敏感值扫描未发现组件凭据式配置或签名数据进入本轮新增内容。

## 第十六轮公开 bundle final-submit / result / recovery 静态合同审计（2026-08-04）

### 开始前读取与边界

- 已读取适用 `AGENTS.md`、协调总览第 29 节、arrival field contract E15、PH-A/PH-B/PH-C/PH-D 最新段。本轮严格限于官方 public frontend build 的零登录静态阅读。
- 未恢复或推进草稿，未签名、上传、点击 `Next` 或 final `Submit`，未发送提交请求；未接触账号、OTP、Cookie、申请人资料、密钥、付款或真实结果。
- 以下 `verified_public_bundle` 是公开源码静态证据类别，不是第四种合同状态，绝不等同于 live final success、reference 生成、QR 可扫描、下载或恢复成功。

### E16 Summary final-submit 静态矩阵

| Static area | Official public-bundle finding | 条件 / 风险边界 | Contract outcome |
| --- | --- | --- | --- |
| Regular Summary request | Summary handler 构造 `POST /api/v2/traveller/registrations/{route id}/submit`。body 仅含 privacy acknowledgement、runtime `family_members` array（或空数组）和 runtime CAPTCHA value；registration id 来自 route。 | 这些均是 action/runtime data，不是申请问题，不能进入 `visa_form_fields`、application answers、fixture、示例或日志；E16 未发送请求。 | `verified_public_bundle`; action contract 可记录，server acceptance `needs_review`。 |
| Visible button gate | CAPTCHA runtime state 初始为空；Previous 与 Submit 控件均在其为空时 disabled。Submit 接收 local loading state。 | 这是客户端 pre-click gate；不证明 CAPTCHA 或服务端接受。 | `verified_public_bundle`; live requiredness/acceptance `needs_review`。 |
| Success handling | handler 只在 `response.status === 200` 时清 transient client state 并路由 `/preparing-qr-code?id={route id}`。未读取/解析 POST success body。 | 不能由路由跳转推断已签发 reference、transaction 或 QR。 | `verified_public_bundle`; result `needs_review`。 |
| Existing-complete branch | 已获取 registration 标记 complete 时，handler 跳过 POST 并去 preparing route。 | 仅是 client re-open shortcut，不证明已存在可用 reference/QR。 | `verified_public_bundle`; recovery `needs_review`。 |
| Failure/retry/double action | 检查到的 handler 未见 `try/catch`、retry/backoff、idempotency key 或显式 `if loading return`。未取得通用 Button 内部实现，不能断言它是否抑制重复 click。 | 非 200/throw 后的显示、loading reset、server idempotency 和重复提交保护都不能猜；这是静态风险，不是服务端无保护的结论。 | `verified_public_bundle`; fail-closed `needs_review`。 |

### E16 result / QR / recovery 静态矩阵

| Static route / component | Official public-bundle finding | 可证明与不可证明 |
| --- | --- | --- |
| `/preparing-qr-code` | 重新 `GET /api/v2/traveller/registrations/{route id}`；两秒 client timeout 后，`children.length > 0` 路由 `/registration-slips`，否则 `/qr-code`。检查到的代码没有以 completion、`reference_number` 或 QR artifact 作 gate。 | `verified_public_bundle`：路由/children 条件。`needs_review`：loading/error/missing-data、是否完成、真实结果完整性和两条实际落地路径。 |
| `/qr-code` | 再取 registration；QR component 的 value 为 `reference_number`，同时显示该 reference text。 | `verified_public_bundle`：QR 在浏览器中由 fetched reference 渲染，非 Summary POST body 解析。`needs_review`：reference 格式/签发、QR 扫描性、保存和用户可见成功。 |
| `/public-qr-code` | 存在单独 public-registration fetch route，使用 runtime access query。 | 不记录/保留 query；不能据此认定 regular arrival 成功会给出独立 QR artifact。仍 `needs_review`。 |
| Transaction / artifact / print | 检查的 final/result modules 中未找到 `transaction_number` consumer，未找到 result-page QR artifact endpoint、print invocation 或 QR download invocation。相关页面唯一下载链接是 manual customs forms，非 QR。 | 这是 inspected-scope absence，不等于服务端永远不返回 transaction 或没有 artifact；不得承诺下载/打印。全部 `needs_review`。 |
| Dashboard / reopen | Dashboard card 公开显示 status 与（存在时）`reference_number`；clearance/cleared status 的 QR action 路由 `/qr-code?id={id}`。View/Manage 对符合的 incomplete/clearance 状态可回 regular wizard；某些 electronic customs state 走短 customs route。 | `verified_public_bundle`：客户端路由选择。`needs_review`：服务端是否允许 edit/recovery、reference-without-QR、状态一致性。 |

### 对现有合同的修订

- 只更新了允许的 [arrival field contract](/Users/mmmytooo/Github/VIZA-monorepo-git/docs/philippines-etravel-arrival-field-contract.md)：新增 E16，明确 Summary final POST 的 method/path/payload 类别和 HTTP-200-only client branch。
- 将旧的 `result.qr_artifact` “QR image / owner-downloadable”写法收紧为：公开 QR 页面由 fetched `reference_number` client-render；未找到独立 artifact、download 或 print 的公开证据。`result.official_reference`、QR artifact、recovery 仍为 `needs_review`。
- 未修改产品代码、schema、seed、协调总览或其他 worklog；本轮也未把 runtime CAPTCHA/family 数据升级为申请字段。

### 给 PH-B / PH-C / PH-D 的最小精确增量

| Owner | 可直接消费 | 必须继续 fail-closed / live 验证 |
| --- | --- | --- |
| PH-B | final action 可建模为 route id + runtime CAPTCHA + ephemeral family array；仅在已验证的 result GET 中映射 `reference_number`。 | 不持久化 CAPTCHA/family runtime data，不新增 `transaction_number` mapping，不假设 POST body 含 QR/reference 或可下载 QR。 |
| PH-C | HTTP `200` 只表示 inspected client 的跳转条件；中断后需要显式 safe recovery state。 | 不自动 retry/resubmit，不以固定两秒或 children 缺失推断 QR ready，不自动化 final action。 |
| PH-D | Summary/Submit 是 static action；只从 verified result record 显示 reference/QR，缺 reference/QR 进入 action-required UI。 | 不将 client-rendered QR 标成 downloadable/printable/confirmed。 |

### 仍需受控 live 验证的最小清单

1. 在另行批准的 synthetic controlled environment 中观察一次最终 POST 后的 HTTP/result、reference format、QR render/scanability、single/children result routing 和 dashboard status；本项目继续禁止 official final Submit。
2. 观察 non-200、CAPTCHA failure、网络中断/reload、已有 reference 但缺 QR、重复 action 的 UI 与 server recovery/idempotency，且不得制造第二个真实声明。
3. 确认 result-page 是否存在未被本次静态路径捕获的独立 QR artifact/download/print 支持。

### 文档检查

- 已运行 `git diff --check`，无输出。两份允许文档仍为未跟踪文件，分别运行 `git diff --no-index --check /dev/null <doc>` 均无 whitespace 输出；退出码 `1` 仅表示与空文件存在内容差异。旧的 “owner-downloadable QR”承诺已不再作为当前合同结论出现。
- 工作区同时存在大量其他文件的既有修改/未跟踪内容；本轮未修改它们。未运行 migration、seed、deploy、测试、commit、批量暂存、危险 Git 操作或官方 final `Submit`。

## 第十七轮 arrival field contract 全量一致性审计（2026-08-04）

### 范围、输入与边界

- 已读取适用 `AGENTS.md`、协调总览第 30 节、arrival field contract 全文、以及 PH-A/PH-B/PH-C/PH-D 最新段和当前 `git status --short`。本轮只以 E1-E16、公开 bundle/API 与既有 stop-before-submit live evidence 做合同复核。
- 未访问或恢复草稿，未签名、上传、`Next`、CAPTCHA、最终 `Submit` 或发送官方请求；未记录账号、OTP、Cookie、申请人资料、密钥、付款或任何未脱敏页面值。
- 只更新本 PH-A worklog 和 arrival field contract。工作区另有大量既有变更/未跟踪文件，本轮未触碰。

### 全表完整性与覆盖计数

- 对 canonical table 的机械审计结果：111 行、无重复 semantic key、无缺列/畸形行。每行均具备 section、data category/owner、semantic key、flat key/alias、official key/label、control、value/option、required、condition、persona/transport、file boundary、source/evidence、status。
- 计数（111 canonical 加 8 diverted eligibility rows）：`confirmed_live=51`（E6-E12 actual official stop-before-submit evidence）、`verified_public_bundle / official-public non-live=19`、`needs_review=41`、`unsupported_v1/diverted=8`。计数包含 3 account runtime、2 Summary action、2 result 行，目的是防止它们被误当成申请问题。
- `verified_public_bundle` 在计数中只是证据层描述，不新增第四个合同 status；合同 status 仍只使用 `verified_public`、`needs_review`、`unsupported_v1`。

### 发现并关闭的内部矛盾

| Finding | 修订 | 结论 |
| --- | --- | --- |
| Result 旧术语 | `result.qr_artifact` 改为 canonical `result.reference_qr_render`；原 key 仅作为 non-applicant legacy alias。 | QR 是 public client 从 authoritative result read 的 `reference_number` 渲染；没有独立/downloadable/printable official artifact 证据。 |
| PH-C / PH-D contract wording | 成功条件改为 authoritative post-submit result read + stable official reference + reference-driven QR render/validation。 | HTTP 200、跳转、Summary、Submit 可见、本地 QR 或 reference-shaped string 单独都不能标 submitted。 |
| SEA destination branch | Residence/Hotel 行不再把 E8 omission 说成 SEA non-disembarking 的 not-required 证明。 | E6 true stay UI 与 E8 omission 并存；显式 false 仍 `needs_review`。 |
| SEA baggage scope | 三项 Other Travel Details 从 “all electronic paths”收紧为 AIR positive 与 E8 SEA electronic No 已观察路径。 | SEA manual、其他 electronic 和 Yes continuation 不再被串线。 |
| E16 live checklist | 删除“观察 final POST 而不点击”的自相矛盾表达。 | 任何 final POST 观察都须另行批准的 controlled environment；本项目继续 stop-before-submit。 |

### 路径隔离审计

- regular `/wizard/me` 与 short `/wizard/declaration` 分开；Family/no-companion 只可按 regular 的条件静态证据理解，短 route 不继承。
- E6 SEA manual、E8/E9 SEA electronic No、E10/E11 SEA electronic Yes 互不外推；Yes 的签名后 continuation 仍 P0 证据缺口。
- `destination_port_code` 是 page-0 voyage destination/metadata，`disembarking_port_code` 是 `TRAVEL_PORT` child，二者不是别名，后者不得分流 manual/electronic customs。
- signature 仅在 signature page 出现时 required；SEA manual Review 没有 signature page。attachment UI/MIME hint 不是附件 requiredness 或 server acceptance。

### 41 个 `needs_review` 的最小验证清单

- Account runtime：`account.email`、`account.otp`、`account.password` 只需安全 account-policy review，永久不入申请答案。
- Start/profile/residence：`registration.application_for`、passenger type/photo、姓名/性别/手机、7 项 residence 字段需 controlled synthetic UI/validation observation。
- Travel/destination：AIR airline/flight/special-flight 四项、SEA explicit `is_disembarking=false`、same-residence/AIR Transit child branches需独立观察，不能从现有路径反推。
- Health：negative-antigen、recent-history/countries、bats/animals、symptoms 的 Yes 分支需只记录 labels/conditions/errors 的合成观察。
- Customs/currency/files：official information acknowledgement、currency threshold/Owner N/A/BSP、attachment server/client requiredness、两条 final acknowledgement 各需对应页面/validation evidence。
- Result：`result.official_reference` 与 `result.reference_qr_render` 只有在另行批准 controlled final-result observation 后才能关闭；需覆盖 authoritative read、render/scan、re-open/interruption/retry，当前仍严禁 final `Submit`。

### 给 PH-B / PH-C / PH-D 的精确增量

| Owner | 必须消费 | 发布影响 |
| --- | --- | --- |
| PH-B | `result.reference_qr_render` 为 canonical result semantic；`result.qr_artifact` 仅 legacy non-applicant alias。保持 account/Summary/result 不进 `visa_form_fields`，不 flatten SEA manual/electronic 条件。 | P0：不得以 UI/HTTP/local QR 写 submitted。P1：可选 residence/transit/special-flight 字段等待 live branch。 |
| PH-C | 删除 independent-QR 成功 predicate；只以 authoritative result read 的 stable reference 加 reference-driven QR render/validation 判断 result presentation，并继续 no-retry/no-resubmit。 | P0：result/recovery 与 SEA Yes post-signature fail-closed。 |
| PH-D | 删除 independent/downloadable QR 成功文案/判断；reference 或 QR render 缺失即 action-required。不得把 E8 omission 表现为 SEA false branch。 | P0：无 authoritative result read 不显示 submitted；P1：optional destination/file polish。 |

### 仍为发布 blocker / 后续增强

- P0：final Submit 与 authoritative result/reference/QR/recovery、ambiguous-POST idempotency/retry、SEA electronic Yes signature 后 continuation、所有启用 profile/residence/AIR/Health 正向 branch 的未闭合 requiredness。
- P1：attachment server rules、Owner/Recipient server requiredness、BSP/physical branch、SEA manual completeness、disembarking false semantics、Family server semantics。
- 后续增强：在对应 branch 未启用时，可暂缓 optional same-residence/AIR Transit/Special Flight 细节、酒店/航空/症状 option refresh 与 result download/print UX；它们不可被伪装成已验证功能。

### 文档检查

- 已运行 `git diff --check`，无输出。两份允许文档仍为未跟踪文件，分别运行 `git diff --no-index --check /dev/null <doc>` 均无 whitespace 输出；退出码 `1` 仅表示与空文件存在内容差异。
- canonical scan 复核为 `total=111 live=51 public_nonlive=19 needs_review=41 malformed=0 duplicate=0`。当前 contract-rule scan 未发现仍要求 independent QR、QR artifact 或 owner-scoped artifact 的 success predicate；保留的相关文本均为明确否定或 legacy-alias 边界。
- 未运行 migration、seed、deploy、测试、commit、批量暂存、危险 Git 操作或官方 final Submit。

## 第十八轮 41 项 needs_review synthetic stop-before-submit 验证运行手册（2026-08-04）

### 范围与安全边界

- 已读取适用 `AGENTS.md`、协调总览第 31 节、field contract E17 与 PH-A/PH-B/PH-C/PH-D 最新段。本轮只设计 E18 runbook；没有打开草稿、官网、浏览器、账号或任何官方流程。
- E18 不授权账号创建、OTP/CAPTCHA、签名、上传、请求、final `Submit`、付款或真实申请人。未来每次 live 场景均需要 coordinator 已批准的 controlled test session，且只用 generated non-identifying values。
- 记录模板仅允许 scenario/date/role、transport/path class、route pathname 无 query/id、title、selector/label、requiredness、validation、option metadata/source、stop point 和 blocker class。永久禁止记录申请资料、账号、密码、OTP、Cookie、token、签名数据/图、文件内容/路径、金额或截图路径。

### 场景覆盖设计

| Scenario | 覆盖范围 | Priority / stop rule |
| --- | --- | --- |
| S0 | 3 项 account runtime boundary。 | P1；只做 policy/UI boundary review，不登录、不处理秘密。 |
| S1 | `registration.application_for`、passenger/photo、6 项 profile、7 项 residence，共 16 项。 | P0；profile/travel entry；无 file selection/upload。 |
| S2 | AIR airline/flight/Special Flight 与 Residence/Transit destination children，共 7 项。 | P0 AIR；每个 branch validation 后停止。 |
| S3 | 5 项 Health positive branches。 | P0；只录 label/condition/error，绝不填真实健康资料。 |
| S4 | SEA explicit false/unchecked 与 manual-path boundary。 | P0 SEA；manual notice/Summary 前停止，不能外推 electronic。 |
| S5 | SEA electronic Yes post-signature continuation。 | P0 path-only blocker；无明确 synthetic-signature authorization 时止于签名页，授权后止于 Summary/visible Submit。 |
| S6 | Currency threshold/Owner N/A/BSP 与 attachment boundary，共 4 项。 | P0；默认不触文件；D7 inert image 需额外 file-interaction authorization。 |
| S7 | Customs/signature/final acknowledgement 共 3 项。 | P1；只确认真实 control/requiredness，不能制造 ack 或进 Submit。 |
| S8 | authoritative final result/reference/derived QR/recovery 共 2 项。 | P0，**需用户/coordinator 另行明确授权**；E18 不授权 final Submit、retry、reload in-flight 或第二个申请。 |

- 上表将 E17 的 41 个 `needs_review` 行全部且仅一次分入 S0-S4、S6-S8；S5 是额外的 SEA electronic-Yes path-only P0 证据场景，不重复计数。

### 串行与并行规则

- 官网浏览只允许 PH-A 单一 owner：同一 AIR 草稿最多依页面状态串行复用 S1 -> S2 -> S3；S4、S5、S6 使用互不混用的 SEA/AIR draft，且绝不并行开两个官方 tab/draft。
- S5 synthetic signature 仅在 user/coordinator 明确授权时由 PH-A 进行，不能与任何其他官网场景并行。S8 只能在新授权与独立 controlled environment 下进行，不能与任一草稿/retry 操作重叠。
- PH-B/PH-C/PH-D 可以并行做非浏览器工作：B 仅 crosswalk schema/options，C 仅保持 runner/result/retry fail-closed，D 仅保持 coverage/action-required UI；三者均不得抢占 Chrome、根据 runbook 造证据或启用未验证字段。

### 可直接复制的下一波边界

| Assignee | Boundary |
| --- | --- |
| PH-A | 仅在已批准官方 test session 顺序执行 E18 S1-S7；按模板记录；到每个 stop point 立即停；没有新授权绝不执行 S8/final Submit。 |
| PH-B | 只读取 E18 和 PH-A 后续 evidence；不把 account/Summary/result/QR/signature runtime 值放入 applicant schema。 |
| PH-C | 只读取 E18；继续禁止 signature/upload/Family/modal/final Submit 和自动 retry/resubmit；仅消费已落盘证据。 |
| PH-D | 只读取 E18；planned scenario 继续是 action-required coverage gap，不得显示为 verified form/result/success。 |

### 文档检查

- 已运行 `git diff --check`，无输出。两份允许文档仍为未跟踪文件，分别运行 `git diff --no-index --check /dev/null <doc>` 均无 whitespace 输出；退出码 `1` 仅表示与空文件存在内容差异。
- E18 coverage scan：`needs_review=41 e18_missing=0`。S8 scan 复核其为 separate explicit authorization 且明确不授权 final Submit；copyable next-wave boundaries 已存在。
- 未运行 migration、seed、deploy、测试、commit、批量暂存、危险 Git 操作或官方 final Submit。

## 第十轮 SEA electronic customs `Yes` 正向分支 live evidence（2026-08-03）

> 仅使用官方 `https://etravel.gov.ph` 已登录测试会话及合成值。目标 ordinary `SEA + ARRIVAL + VESSEL PASSENGER + Manila South Harbor` electronic variant；未记录账号、OTP、Cookie、密码、申请人资料、截图路径或签名图，未上传文件、未点击最终 `Submit`、未取得 reference/QR/result。

### E10 实际页面顺序

| Order | Official page | URL form | Directly observed result |
| --- | --- | --- | --- |
| 0 | Travel Details - Philippine Arrival (via SEA) | `...wizard_page=0` | confirmed controlled ordinary passenger SEA draft. |
| 1 | Health Declaration | `...wizard_page=1` | existing negative health answers allowed progression. |
| 2 | Customs Declaration Confirmation | `...wizard_page=2` | `Do you have baggage or currency to declare?`; selecting `Yes` entered electronic positive flow. |
| 3 | Other Travel Details | `...wizard_page=3` | family count, checked/hand-carried baggage, first-time visit fields. |
| 4 | Customs General Declaration | `...wizard_page=4` | 12-item checklist and Other goods modal/table directly observed. |
| 5 | Customs Currency Declaration | `...wizard_page=5` | owner/recipient, currency item, BSP date, source/purpose, physical/courier controls directly observed. |

### E10 selector and condition matrix

| Area | Direct evidence | Status |
| --- | --- | --- |
| SEA General Declaration | `amount_of_goods_acquired.currency` values `PHP`/`USD`, `amount_of_goods_acquired.amount`, and `check_lists.0.response` through `check_lists.11.response` with `true`/`false` radios. | confirmed |
| Other goods | checklist item 12 `Yes` rendered `Add Item` and Quantity / Description / Amount in USD table/modal. SEA row persistence, delete, and page-level no-row blocking were not re-tested. | confirmed surface; behavior needs_review |
| Currency owner/recipient | owner/recipient groups appeared; direct examples `owner_first_name`, `recipient_first_name`. `Please check if NOT APPLICABLE` disabled both groups but exposed no stable name/id. | confirmed conditional UI; requiredness needs_review |
| Currency item | modal exposed `currency_id`, `monetary_instrument_id`, `amount`; visible monetary-instrument labels included `CASH`, `BONDS`, `COMMERCIAL PAPERS`, `CONFIRMATION OF SALE/INVESTMENT`, `COSTUDIAL RECEIPTS`, `DEPOSIT CERTIFICATES`, `DEPOSIT SUBSTITUTE INSTRUMENTS`, `DRAFTS`, `MONEY ORDERS`. | confirmed selectors/visible labels; complete payloads needs_review |
| Source/purpose/method | `currency_sources.0..2` = `SALARY`/`BUSINESS`/`OTHER`; `transport_purposes.0..4` = `LEISURE`/`MEDICAL`/`PAYABLES`/`EDUCATION`/`OTHER`; `physical_or_shipped` = `is_physically_transferred_by_person` / `is_shipped_thru_courier_service`. | confirmed |
| Attachment/signature/Family/Summary | Not reached for SEA positive path. E9 no-declaration Summary is not positive-branch evidence. | needs_review |

### B/C/D precise delta

- PH-B: SEA electronic positive path can use structured 12 checklist answers and currency groups; do not aggregate to free text. Keep positive downstream attachment/signature conditional.
- PH-C: page-content plan may recognize `wizard_page=2` confirmation -> `3` Other Travel Details -> `4` General -> `5` Currency after `Yes`; fail closed beyond E10 currency completion.
- PH-D: SEA electronic positive customs can be rendered as structured conditional data, never as completed/submitted status.

### Boundary and validation

- An initial draft was identified at Summary as AIR and was not counted as SEA evidence; no Submit was clicked. E10 evidence above was captured only after resuming the verified SEA draft.
- Not run: migration, seed, deployment, tests, payment, CAPTCHA bypass, real OTP, final Submit, commit, batch git add.
- `git diff --check -- docs/philippines-launch-worklogs/PH-A.md docs/philippines-etravel-arrival-field-contract.md` completed with no output (passed).

## 第十二轮 SEA electronic positive signature handoff attempt（2026-08-04）

> 范围：仅尝试续接 E11 已释放的安全测试 handoff；未读取 Cookie/密码/OTP/真实资料，未上传文件、未点击最终 `Submit`，未记录敏感数据。

### E12 result

- 交接 tab 在访问前仍指向此前受控 SEA positive `wizard_page=6` signature page；未混入 AIR 或 customs `No` draft。
- 在 claim/读取该官方页面时，受管理浏览器安全校验再次不可用。由于 DOM 无法访问，未执行合成签名、Next、上传、Family、no-companion 或 Summary 操作。
- 按任务边界，没有重试、绕过、替代浏览器或间接访问；该阻断不是官方表单校验，不能提升任何字段状态。
- Chrome tab 已以 handoff 方式释放；未发生最终提交。

### E12 evidence delta

| Area | Result | Contract status |
| --- | --- | --- |
| Positive signature continuation | No action due browser policy block before page access. | needs_review |
| Upload input/camera/attachment requiredness | No new DOM evidence. E11 observations unchanged. | needs_review |
| Currency/monetary option count/value source | No new DOM evidence. | needs_review |
| Family/no-companion/Summary/Submit | Not reached. | needs_review |

### B/C/D delta

- PH-B: no schema metadata promotion from E12; preserve E11 attachment and post-signature gaps.
- PH-C: keep SEA positive post-signature phase fail-closed; do not treat browser-policy block as an official negative response.
- PH-D: retain action-required state; do not show upload requirement or submitted result.

### Validation

- No migration, seed, deploy, tests, payment, CAPTCHA bypass, real OTP, final Submit, commit, or batch git add.
- `git diff --check -- docs/philippines-launch-worklogs/PH-A.md docs/philippines-etravel-arrival-field-contract.md` completed with no output (passed).

## 第十一轮 SEA electronic customs `Yes` post-Currency live evidence（2026-08-04）

> 只使用 E10 既有官方测试草稿、合成测试值与合成签名。先以受控草稿标识与当前 `wizard_page=5` Currency Declaration 续接验证目标 SEA path；未记录账号、OTP、Cookie、密码、申请人资料、签名图或截图路径。未上传文件，未点击最终 `Submit`，未取得 reference/QR/result。

### E11 confirmed evidence

| Area | Direct evidence | Status |
| --- | --- | --- |
| Owner N/A | `Please check if NOT APPLICABLE` checked state disabled all owner/recipient groups. The control has no stable `id`/`name`; direct visible-input toggle did not change its state. | needs_review selector and full owner/recipient requiredness |
| Currency item/source/purpose | Synthetic currency row saved; source `SALARY`, purpose `LEISURE`, and physical transfer selected on the E10 SEA draft. | confirmed continuation |
| Physical branch | Empty `No. of days in the Philippines` (`no_of_days_in_philippines`) and `Last travel to the Philippines` (`last_travel_to_philippines`) each showed `Required` plus page-level required-fields message. | confirmed requiredness |
| Positive attachment/signature | `wizard_page=6` `Customs Declaration attachments and signature` displayed `Take a photo or upload a file.`, `642x398` canvas, `Clear`, certification text and Next. DOM exposed no file input, MIME/size rule, or upload required marker. | confirmed page; attachment rules needs_review |
| Signature validation | Empty Next showed `Required`. A synthetic test signature was drawn, but signed Next was blocked by managed browser-security policy before Family/Summary. | signature required confirmed; positive Family/Summary needs_review |

### Unresolved after E11

- Owner/recipient person-versus-business condition and empty requiredness; stable Owner N/A selector.
- Courier-child requiredness; BSP date/document condition; source/purpose `Other` detail requiredness; full current currency/monetary option payloads.
- Positive-path attachment upload selector, MIME/size/requiredness.
- Positive-path Family Member(s), no-companion confirmation, Summary, final Submit/reference/QR/result/recovery. The browser policy block is not official-page evidence.

### B/C/D exact delta

- PH-B: add requiredness metadata only for positive SEA physical `no_of_days_in_philippines` and `last_travel_to_philippines`; keep N/A selector, owner/recipient, courier, BSP, Other detail and upload rules conservative.
- PH-C: SEA positive plan may continue Currency -> `wizard_page=6` attachment/signature. It must require a signature gate, and remain fail-closed before positive-path Family/Summary.
- PH-D: show SEA positive signature as required/action-required; do not render any upload as mandatory and do not present browser-policy stop as official refusal or submission success.

### Boundary and validation

- Managed browser policy blocked the signed continuation. No CAPTCHA bypass, indirect workaround, or retry was attempted; tab was released at the signature gate.
- Not run: migration, seed, deployment, tests, payment, real OTP, final Submit, commit, or batch git add.
- `git diff --check -- docs/philippines-launch-worklogs/PH-A.md docs/philippines-etravel-arrival-field-contract.md` completed with no output (passed).

## 第七轮 SEA electronic customs post-signature stop-before-submit evidence（2026-08-01）

> 范围：本轮使用官方 `https://etravel.gov.ph` 已登录 Chrome 会话，继续 E8 `SEA + VESSEL PASSENGER + Manila South Harbor` electronic customs no-declaration path。仅使用 synthetic/test signature 推进 signature gate；未保存或记录签名图、截图路径、账号、邮箱、OTP、Cookie、密码、真实姓名、真实护照、手机号、记录 UUID 或未脱敏官方值。
>
> 本轮只更新：`docs/philippines-launch-worklogs/PH-A.md` 与 `docs/philippines-etravel-arrival-field-contract.md`。未修改代码、schema、seed、runner、frontend、协调总览或其他 worklog。未点击最终 `Submit`，未生成 reference/QR/result。

### 开始前读取

- 已读取 `docs/philippines-launch-coordination.md` 第 20 节：当前 blocker 包含 SEA electronic customs variant post-signature Family/Summary evidence。
- 已读取 PH-A/PH-B/PH-C/PH-D worklog 最新尾部。
- 已读取当前 `docs/philippines-etravel-arrival-field-contract.md`。

### Live path boundary

| Item | Evidence |
| --- | --- |
| Official route | `https://etravel.gov.ph/dashboard` -> latest incomplete `ARRIVAL VIA SEA` draft -> `View/Manage` -> `Continue` -> `https://etravel.gov.ph/wizard/me?id=[redacted]&wizard_page=...` |
| Path | `FOR ME + SEA + ARRIVAL + VESSEL PASSENGER + Manila South Harbor`, electronic customs no-declaration branch |
| Signature | Synthetic/test signature only; no signature image data, screenshot, file path, or applicant value recorded |
| Stop point | `wizard_page=6`, `New Travel Declaration Summary`, bottom buttons `Previous` / `Submit` |
| Submit boundary | Final `Submit` visible and not clicked; no reference/QR/result |

### E9 page order observed

| Order | Official page/step | URL form | Visible actions/controls | Status |
| --- | --- | --- | --- | --- |
| 0 | Dashboard / View Travel Details modal | `/dashboard` | `View/Manage`, modal `Continue` | used only to resume draft; personal/modal values not recorded |
| 1 | Travel Details - Philippine Arrival (via SEA) | `...wizard_page=0` | `Next`; page showed existing SEA passenger page-0 fields | resumed at page 0 |
| 2 | Health Declaration | `...wizard_page=1` | negative radios already selected; `Previous`, `Next` | confirmed path continuity |
| 3 | Customs Declaration Confirmation | `...wizard_page=2` | `No`, `Yes`, `Previous` | electronic customs confirmation variant re-confirmed |
| 4 | Other Travel Details | `...wizard_page=3` | accompanied family counts, checked/hand-carried baggage, first-time visit, `Previous`, `Next` | customs `No` branch re-confirmed |
| 5 | Customs Declaration attachments and signature | `...wizard_page=4` | `canvas` width `642` height `398`, `Clear`, `Previous`, `Next`, certification copy | synthetic/test signature used to continue |
| 6 | Family Member(s) | `...wizard_page=5` | `Add Family Member`, `Previous`, `Next`; `No Record Found!` | confirmed after signature |
| 7 | No-companion confirmation | `...wizard_page=5` modal | `You haven't selected any family members for this travel registration. Are you sure you're not traveling with a companion?`; buttons `No` / `Yes` | confirmed after Family `Next` |
| 8 | New Travel Declaration Summary | `...wizard_page=6` | bottom buttons `Previous` / `Submit`; `Submit` not clicked | confirmed Summary stop-before-submit |

### Field/control evidence delta

| Area | Live evidence | Contract impact |
| --- | --- | --- |
| Signature selector | `canvas` visible with width `642`, height `398`; `Clear`, `Previous`, `Next`; certification copy `By Clicking "Next"... true and correct...`. | SEA electronic path signature page is a canvas/pad gate, not a document upload. |
| Signature requiredness | Synthetic/test signature allowed `Next` to Family. Blank requiredness was already known from prior E6 coordinator evidence; not retested here. | Signature required where this page appears; still not universal SEA. |
| Attachments | E9 signature page did not show `Take a photo or upload a file.` or visible file input in captured controls/text. | Attachment/travel document requiredness remains `needs_review`. |
| Family gate | `Family Member(s)` page after signature, with `Add Family Member` and no records. | SEA electronic no-declaration path uses family gate before Summary. |
| No-companion modal | Family `Next` with no selection displayed no-companion confirmation and required `Yes` to continue. | Same family/no-companion gate pattern as AIR/E6 SEA. |
| Summary | `New Travel Declaration Summary`, `Kindly double check the information before submitting.`, bottom `Previous` and final `Submit`. | Review/Summary reached is not submitted success; final result remains blocked. |
| Summary customs display | Summary displayed all-negative Customs General Declaration and `Declaration Signature` for the no-declaration branch. | Confirms no-declaration Summary content for this SEA electronic path; does not prove positive `Yes` branch. |

### SEA electronic positive branch decision

- 本轮未测试 customs `Yes` positive branch。
- Reason：目标主线是 post-signature Family/Summary evidence；positive branch would require additional General/Currency data and could materially lengthen or change the official draft before final stop.
- Status：SEA electronic customs positive `Yes` branch remains `needs_review`; do not assume it fully reuses AIR selectors until directly observed.

### PH-B / PH-C / PH-D interface delta

| Owner | Delta |
| --- | --- |
| PH-B | Add E9 as evidence that SEA electronic no-declaration path reaches Family and Summary after signature. Keep `summary.review` / `summary.final_submit` as static notice/action, not applicant answers. Keep attachments `needs_review`; no file input/upload was proved. |
| PH-C | SEA electronic no-declaration runner page order for this path is `wizard_page=2` confirmation -> `wizard_page=3` Other Travel Details -> `wizard_page=4` signature -> `wizard_page=5` Family/no-companion -> `wizard_page=6` Summary. Stop at Summary; `Submit` visible is not success. |
| PH-D | UI/status may now distinguish SEA electronic no-declaration as Review-reached/action-required after signature/family, but must not show submitted success without official reference + independent QR. |

### Still needs review

- SEA electronic customs `Yes` positive branch and whether General/Currency selectors exactly match AIR for SEA.
- Final `Submit`, official reference, independent QR, result/recovery page.
- Attachment upload requiredness/file input/file size/conditions.
- Explicit `is_disembarking=false/unchecked` official behavior and per-port customs/manual/electronic metadata.
- Crew route after `VESSEL CREW`; cruise route remains separate and outside ordinary passenger contract.

### Validation / boundary

- 已运行 `git diff --check`：无输出，命令未被权限/审批阻断。注意当前相关 docs 在 `git status --short` 中仍显示为未跟踪文件，因此该命令的覆盖范围按 git 当前跟踪状态解释。
- Not run: migration, seed, deploy, schema/runner/frontend tests, real OTP/CAPTCHA, payment, final Submit, commit, batch git add.
- Browser session finalized after evidence collection; claimed Chrome tabs released.

## 第六轮 SEA remaining branch official evidence crawl（2026-08-01）

> 范围：本轮使用官方 `https://etravel.gov.ph` 已登录 Chrome 会话，只采集 SEA ordinary passenger 剩余分支的脱敏 live evidence。未点击最终 Review/Summary `Submit`，未生成 reference/QR，未签名，未上传文件，未记录账号、邮箱、OTP、Cookie、密码、真实姓名、真实护照、手机号、截图路径、记录 UUID 或未脱敏官方值。
>
> 本轮只更新：`docs/philippines-launch-worklogs/PH-A.md` 与 `docs/philippines-etravel-arrival-field-contract.md`。未修改代码、schema、seed、runner、frontend、协调总览或其他 worklog。

### 开始前读取

- 已读取 `docs/philippines-launch-coordination.md` 第 19.4 节：B/C/D 已消费 AIR positive selector evidence；当前 remaining launch blocker 包含 SEA non-disembarking、other SEA port/customs combinations、crew/cruise/special routes。
- 已读取 PH-A/PH-B/PH-C/PH-D worklog 最新尾部。
- 已读取当前 `docs/philippines-etravel-arrival-field-contract.md`。
- 已查看相关 docs 的 `git status --short`；这些 docs 仍显示为 untracked。

### Live path boundary

| Item | Evidence |
| --- | --- |
| Official site | `https://etravel.gov.ph/dashboard` -> `https://etravel.gov.ph/new-travel-declaration` -> `https://etravel.gov.ph/wizard/me?id=[redacted]&wizard_page=...` |
| Persona/path | `FOR ME + SEA + ARRIVAL + VESSEL PASSENGER`; ordinary AIR/SEA declaration tile |
| Destination port query | Live dropdown query captured a visible option label `Manila South Harbor`; DOM did not expose stable option code/value, so value remains `unknown` |
| Stop point | `wizard_page=4`, `Customs Declaration attachments and signature`; stopped because signature page appeared and no user-drawn test signature was provided in this turn |
| Submit boundary | Did not reach Review/Summary for this E8 path; did not click final `Submit`; no reference/QR/result |

### Page order observed in this SEA path

| Order | Official page/step | URL form | Visible actions | Status |
| --- | --- | --- | --- | --- |
| 0 | Dashboard | `https://etravel.gov.ph/dashboard` | `New Travel Declaration VIA AIR or SEA (For Cargo Vessel only)`, `New Cruise Ship Travel Declaration` | login state available; sensitive dashboard values not recorded |
| 1 | Travel Registration | `/new-travel-declaration` | `FOR ME`, `FOR OTHER`, `AIR`, `SEA`, `ARRIVAL`, `DEPARTURE`, Data Privacy/Affidavit copy, `Continue` | no visible `is_disembarking` in this pass |
| 2 | Travel Details - Philippine Arrival (via SEA) | `...wizard_page=0` | `Cancel`, `Next` | page 0 fields captured below |
| 3 | Health Declaration | `...wizard_page=1` | `Previous`, `Next` | negative health branch used to proceed |
| 4 | Customs Declaration Confirmation | `...wizard_page=2` | `No`, `Yes`, `Previous` | proves SEA electronic customs confirmation variant for this port/path |
| 5 | Customs Declaration other travel information / Other Travel Details | `...wizard_page=3` | `Previous`, `Next` | reached after selecting customs `No` |
| 6 | Customs Declaration attachments and signature | `...wizard_page=4` | `Clear`, `Previous`, `Next` | stopped here; no signature drawn |

### SEA page 0 field matrix

| Official label | Selector/key evidence | Control | Visible options/value evidence | Requiredness/condition | Status |
| --- | --- | --- | --- | --- | --- |
| Purpose of Travel | `purpose_of_visit_code` | Headless UI combobox | Visible labels: OFW, Business/Professional, Convention/Conference, Education/Training/Studies, Government/Official Mission, Health/Medical Reason, Holiday/Pleasure/Vacation, Incentive, Meetings, Others, Religion/Pilgrimage, Returning Resident, Trade Fair/Exhibition, Transit, Visit Friends/Relatives, Work/Employment. Stable option codes not captured. | Requiredness not retested; Holiday selected for crawl | confirmed labels; codes needs_review |
| Traveller Type | React select input `react-select-2-input`; official key candidate remains `passenger_type` | react-select combobox | Visible labels: `VESSEL CREW`, `VESSEL PASSENGER` | `VESSEL PASSENGER` selected for ordinary crawl; crew appears in dropdown but is not VIZA v1 ordinary passenger | confirmed labels; crew routing needs_review/unsupported |
| Vessel Name | `vessel_name` | text input | free text; synthetic value used and not recorded | visible only after SEA passenger route | confirmed selector |
| Voyage Number | `flight_number` | text input | displayed label `Voyage Number`; official control key still `flight_number`, not `voyage_number` | visible after `VESSEL PASSENGER` | confirmed selector/key conflict |
| Country of Origin | `origin_country_code` | Headless UI combobox | Query showed visible label `Singapore`; stable code/value not exposed in DOM | option value unknown | confirmed label only |
| Seaport of Origin | `origin_port` | text input | synthetic text used and not recorded | requiredness not retested | confirmed selector |
| Date of Departure | `departure_date` | text/date input | date text accepted | visible in SEA page 0 | confirmed selector |
| Date of Return | `return_date` | text/date input | appears after Holiday/Pleasure/Vacation | purpose-specific branch | confirmed selector |
| With Transit (Connecting Voyage)? | `with_transit` | checkbox | checked/unchecked | checked branch observed then unset for main crawl | confirmed selector |
| Country of Transit | `transit_country_code` | Headless UI combobox | shown only when `with_transit` checked | option value not captured | confirmed selector |
| Seaport of Transit | `transit_port` | text input | shown only when `with_transit` checked | requiredness not retested | confirmed selector |
| Date of Transit | `transit_date` | text/date input | shown only when `with_transit` checked | requiredness not retested | confirmed selector |
| Seaport of Destination | `destination_port_code` | Headless UI combobox | Query showed visible label `Manila South Harbor`; stable code/value not exposed in DOM | full option list and port metadata unknown | confirmed selector; value needs_review |
| Date of Arrival | `arrival_date` | text/date input | date text accepted | visible in SEA page 0 | confirmed selector |

### Disembarking / destination observation

| Question | Live evidence | Contract impact |
| --- | --- | --- |
| Was `is_disembarking` visible on Start? | No. Start page displayed only registration owner, transport, flight type, privacy/affidavit, and Continue. | Do not document `is_disembarking` as a universal Start-page field. |
| Was `is_disembarking` visible on SEA page 0? | No. Page 0 displayed voyage/origin/transit/destination seaport fields; no `is_disembarking` checkbox/radio was visible. | Explicit `is_disembarking=false/unchecked` remains unverified. |
| Did destination/stay UI appear? | No `Destination upon arrival in the Philippines`, `stay_location_type`, Residence, Hotel, Travel Port, or `disembarking_port_code` appeared in this E8 path before Health. | Proves one SEA passenger/destination-port path can skip stay destination UI; does not invalidate E6 disembarking=true branch. |

### SEA customs/signature variant matrix

| Area | E8 live evidence | Status |
| --- | --- | --- |
| Customs confirmation | After Health, `Customs Declaration Confirmation` displayed Baggage/General/Currency notices plus `No`, `Yes`, and `Previous`. | confirmed SEA electronic customs confirmation variant |
| Customs `No` branch | Selecting `No` went to `Other Travel Details`, not directly to Family/Review. | confirmed for E8 path |
| Other Travel Details | Visible selectors: `accompanied_family_members.below_eighteen`, `accompanied_family_members.above_or_equal_eighteen`, `no_of_checked_in_baggages`, `no_of_hand_carried_baggages`, `first_time_visit` true/false. | confirmed SEA electronic/no-declaration details |
| Signature page | Next displayed `Customs Declaration attachments and signature`, `For Customs - Declaration Signature`, `Signature`, `Clear`, and certification copy `By Clicking "Next"... true and correct...`. | confirmed SEA electronic signature page exists |
| Attachments | This E8 signature page did not show `Take a photo or upload a file.` or a visible file input in the captured text/control list. | attachment requiredness remains needs_review |
| Review | Not reached because signature appeared and PH-A did not draw/sign without user action. | E8 Review remains unverified |

### SEA traveller type / route conclusions

- Ordinary AIR/SEA declaration route SEA Traveller Type dropdown live labels: `VESSEL CREW`, `VESSEL PASSENGER`.
- `VESSEL PASSENGER` is confirmed as the ordinary passenger route used for this crawl.
- `VESSEL CREW` appears in the ordinary route dropdown, but PH-A did not select/advance it because crew is outside VIZA v1 ordinary passenger scope; keep as unsupported/diverted until coordinator approval.
- `CRUISE PASSENGER` / `CRUISE CREW` did not appear in the ordinary SEA dropdown; cruise remains the separate dashboard `New Cruise Ship Travel Declaration` route.
- No SEA `Special Flight`/special registration control appeared in this ordinary SEA route.

### Comparison with prior E6 SEA Review path

| Topic | E6 observed SEA path | E8 observed SEA path | Contract rule |
| --- | --- | --- | --- |
| Disembarking/destination | `is_disembarking=true` branch showed `RESIDENCE` / `HOTEL` / `TRAVEL_PORT`; Port child `disembarking_port_code`; reached Summary. | No visible `is_disembarking` or stay destination UI before Health. | SEA destination/disembarking is path-specific; false/omitted behavior still needs Review. |
| Customs | Manual Baggage/Currency forms notice and links; not AIR-style electronic pages. | Electronic Customs Declaration Confirmation appeared; `No` then Other Travel Details. | SEA customs is port/path-dependent; do not hardcode manual or electronic globally. |
| Signature | No signature page before Summary. | Signature page appeared after Other Travel Details; stopped before signing. | Signature is path-specific, not universal SEA and not absent for all SEA. |
| Review | Reached Summary, bottom `Previous`/`Submit`, Submit not clicked. | Did not reach Review due signature stop. | E8 alone proved pre-Review electronic branch only; E9 below supersedes this by reaching Summary after synthetic/test signature. |

### PH-B / PH-C / PH-D interface delta

| Owner | Delta |
| --- | --- |
| PH-B | Add/retain SEA `destination_port_code` as page-0 destination seaport key separate from `disembarking_port_code`; keep option value/code `needs_review` because DOM exposed only labels. Update `sea.is_disembarking` applicability to path-specific/needs_review rather than universal SEA start field. Add E8 evidence for SEA electronic customs/no-declaration Other Travel Details and signature page. |
| PH-C | SEA runner must branch by actual page content, not only transport. For SEA, both manual forms path and electronic customs confirmation path exist. E8 electronic path uses `wizard_page=2` confirmation -> `wizard_page=3` Other Travel Details -> `wizard_page=4` signature; E9 below adds post-signature Family/Summary order. Do not assume SEA always has Family/Review immediately after Health. |
| PH-D | UI/status should not say all SEA is manual-forms/no-signature. Show SEA customs/signature as path-specific action states; E9 below adds Review/Summary evidence for this electronic no-declaration path, but still not submitted success. |

### Still needs review

- Explicit `is_disembarking=false/unchecked` official behavior: E8 proved omission of the visible field in one path, not a user-selected false value.
- SEA electronic customs positive `Yes` branch, including whether General Declaration/Currency pages match AIR selectors for SEA.
- E8 post-signature Family/Summary order is resolved by E9 below; final `Submit`, reference, QR, and result remain unverified.
- SEA destination seaport full option list, stable option values/codes, and per-port customs/manual/electronic metadata.
- Crew route after selecting `VESSEL CREW`; cruise route remains separate and outside ordinary passenger contract.
- Final `Submit`, official reference, independent QR, result/recovery page.

### Validation / boundary

- 已运行 `git diff --check`：无输出，命令未被权限/审批阻断。注意当前相关 docs 在 `git status --short` 中仍显示为未跟踪文件，因此该命令的覆盖范围按 git 当前跟踪状态解释。
- Not run: migration, seed, deploy, schema/runner/frontend tests, real OTP/CAPTCHA, payment, final Submit, commit, batch git add.
- Browser session finalized after evidence collection; claimed Chrome tabs released.

## 第四十五轮 E45 AIR Currency + Attachments 最小 live 闭环（2026-08-16）

- 在已打开的官方 AIR Currency Declaration 安全测试草稿中完成受控核验；只使用合成、非敏感输入。未读取/记录账号、会话、草稿标识、现有答案、文件、签名内容或最终结果；未操作 Family、Review 或最终 `Submit`。
- Currency 下拉实页渲染 `United States Dollar`，但 DOM 未暴露官方提交 code；沿用 E13 官方 API 的 263 条 numeric `id` 合同。Monetary Instrument 实页完整 16 label 已核验，DOM 同样无 code，numeric `id` 继续以 E13 API 为准。
- Owner N/A 在空字段状态会禁用直接渲染的 owner/recipient 名称、业务、职业、地址和邮编输入；取消后恢复。Country combobox 内部输入没有 native disabled。未测试已填写后的清空。N/A 未勾选、owner/recipient 仍为空的本路径可通过普通 Next，故不能把这些字段作为本路径无条件 client-required。
- 本路径普通 Next 的空值校验只直接报 `no_of_days_in_philippines` 与 `last_travel_to_philippines` Required；填写合成值后可继续。BSP date 在本次外币/CASH测试中未阻断，PHP 阈值/BSP 正向条件仍未核验。Source/Purpose 的 `Other (Specify)` 当前实页临时切换没有展开可见子输入，与旧 E7/E13 静态 wiring 冲突，保留 `needs_review`。
- Q3-Q12-positive 的 attachments + signature 页：附件保持为空，以测试笔划完成签名后点一次普通 Next，直接到 `Family Member(s)`。因此此 AIR 正向电子 customs 路径未见附件必传拦截；上传格式/大小/数量、服务器接受、SEA parity 和所有正向项仍未验证。到达 Family 后立即停止。
- 字段合同已追加 E45 与 B/C/D 最小接口：numeric option-id 边界、owner/attachment 非无条件必填、物理转运两个 client-required 字段，以及 live/static Other-detail 冲突。未改代码、总览或其他 worklog；未运行 migration、seed、deploy、测试、付款或最终 Submit。
