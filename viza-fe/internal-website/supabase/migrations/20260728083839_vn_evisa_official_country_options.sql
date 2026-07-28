-- Exact nationality options returned by the official Vietnam e-Visa API.
-- Hong Kong (HKG) and Macao/Macau (MAC) are intentionally absent.
with official_source as (
  select $countries$AFG|Afghanistan
ALB|Albania
DZA|Algeria
AND|Andorra
AGO|Angola
ATG|Antigua and Barbuda
ARG|Argentina
ARM|Armenia
AUS|Australia
AUT|Austria
AZE|Azerbaijan
BHS|Bahamas
BHR|Bahrain
BGD|Bangladesh
BRB|Barbados
BLR|Belarus
BEL|Belgium
BLZ|Belize
BEN|Benin
BMU|Bermuda
BTN|Bhutan
BOL|Bolivia
BIH|Bosnia and Herzegovina
BWA|Botswana
BRA|Brazil
IOT|British India Ocean Territory
BRN|Bruney
BGR|Bulgaria
BFA|Burkina Faso
BDI|Burundi
KHM|Cambodia
CMR|Cameroon
CAN|Canada
CPV|Cape Verde
CAF|Central African Republic
TCD|Chad
CHL|Chile
CHN|China
TWN|China(Taiwan)
COL|Colombia
COM|Comoros
COG|Congo
CRI|Costa Rica
CIV|Cote d' Ivoire
HRV|Croatia
CUB|Cuba
CYP|Cyprus
CZE|Czech Republic
COD|Democratic Republic of the Congo
DNK|Denmark
DJI|Djibouti
DMA|Dominica
DOM|Dominican Republic
ECU|Ecuador
EGY|Egypt
SLV|El Salvado
GNQ|Equatorial Guinea
ERI|Eritrea
EST|Estonia
ETH|Ethiopia
FJI|Fiji
FIN|Finland
FRA|France
GAB|Gabon
GMB|Gambia
GEO|Georgia
D|Germany
GHA|Ghana
GIB|Gibraltar
GRC|Greece
GRL|Greenland
GRD|Grenada
GTM|Guatemala
GIN|Guinea
GNB|Guinea-Bissau
GUY|Guyana
HTI|Haiti
VAT|Holy See (Vatican City State )
HND|Honduras
HUN|Hungary
ISL|Iceland
IND|India
IDN|Indonesia
IRN|Iran Ilasmic Republic of
IRQ|Iraq
IRL|Ireland
ISR|Israel
ITA|Italy
JAM|Jamaica
JPN|Japan
JOR|Jordan
KAZ|Kazakhstan
KEN|Kenya
KIR|Kiribati
KOR|Korea (South)
PRK|Korea Democratic Peoples Republic of
RKS|Kosovo
KWT|Kuwait
KGZ|Kyrgyzstan
LAO|Lao Peoples Democratic Republic
LVA|Latvia
LBN|Lebanon
LSO|Lesotho
LBR|Liberia
LBY|Libyan Arab Jamahiriya
LIE|Liechtenstein
LTU|Lithuania
LUX|Luxembourg
MKD|Macedonia
MDG|Madagascar
MWI|Malawi
MYS|Malaysia
MDV|Maldives
MLI|Mali
MLT|Malta
MHL|Marshall Islands
MRT|Mauritania
MUS|Mauritius
MEX|Mexico
FSM|Micronesia
MDA|Moldova
MCO|Monaco
MNG|Mongolia
MNE|Montenegro
MSR|Montserrat
MAR|Morocco
MOZ|Mozambique
MMR|Myanmar
NAM|Namibia
NRU|Nauru
NPL|Nepal
NLD|Netherland
NZL|New Zealand
NIC|Nicaragua
NER|Niger
NGA|Nigeria
NOR|Norway
OMN|Oman
PAK|Pakistan
PLW|Palau
PSE|Palestine
PAN|Panama
PNG|Papua New Guinea
PRY|Paraguay
PER|Peru
PHL|Philippines
POL|Poland
PRT|Portugal
QAT|Qatar
ROU|Romania
RUS|Russia
RWA|Rwanda
KNA|Saint Kitts and Nevis
LCA|Saint Lucia
VCT|Saint Vincent and the Grenadines
SMR|San Marino
STP|Sao Tome and Principe
SAU|Saudi Arabia
SC-|Scotland
SEN|Senegal
SRB|Serbia
SYC|Seychelles
SLE|Sierra Leone
SGP|Singapore
SVK|Slovakia
SVN|Slovenia
SLB|Solomon Islands
SOM|Somalia
ZAF|South Africa
SSD|South Sudan
ESP|Spain
LKA|Sri Lanka
SDN|Sudan
SUR|Suriname
SWZ|Swaziland
SWE|Sweden
CHE|Switzerland
SYR|Syrian Arab Republic
TJK|Tajikistan
TZA|Tanzania United Republic of
THA|Thailand
TLS|Timor Leste
TGO|Togo
TON|Tonga
TTO|Trinidad and Tobago
TUN|Tunisia
TUR|Turkey
TKM|Turkmenistan
TUV|Tuvalu
UGA|Uganda
UKR|Ukraine
ARE|United Arab Emirates
GBD|United Kingdom British Territories Citizen
GBR|United Kingdom of Great Britain and Northern Ireland
UNO|United Nations Organization
USA|United States of America
URY|Uruguay
UZB|Uzbekistan
VUT|Vanuatu
VEN|Venezuela
VNM|Viet Nam
WSM|Western Samoa
YEM|Yemen
ZMB|Zambia
ZWE|Zimbabwe$countries$::text as rows_source
),
official_rows as (
  select
    ordinality,
    split_part(row_text, '|', 1) as code,
    substring(row_text from position('|' in row_text) + 1) as official_label
  from official_source,
  lateral regexp_split_to_table(rows_source, E'\\r?\\n')
    with ordinality as source_rows(row_text, ordinality)
),
official_options as (
  select jsonb_agg(
    jsonb_build_object(
      'value', code,
      'text', official_label,
      'label_en', official_label,
      'official_label', official_label
    )
    order by ordinality
  ) as options
  from official_rows
)
update public.visa_form_fields
set
  options = official_options.options,
  validation_rules = coalesce(visa_form_fields.validation_rules, '{}'::jsonb)
    || jsonb_build_object(
      'source', 'VN_E_VISA_OFFICIAL_COUNTRIES',
      'official_option_count', 205,
      'official_source', 'client-service/public/dm-qt/get-all?type='
    ),
  updated_at = now()
from official_options
where visa_type = 'VN_E_VISA'
  and field_name in ('nationality', 'other_nationality', 'relative_nationality');
