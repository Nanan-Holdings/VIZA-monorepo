import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { SGAC_FORM_FIELDS } from "../../scripts/sgac/form-fields";
import { SGAC_HOTEL_NAME_OPTIONS } from "../../scripts/sgac/official-options";

const seedSource = readFileSync(
  new URL("../../scripts/sgac/form-fields.ts", import.meta.url),
  "utf8",
);
const officialOptionsSource = readFileSync(
  new URL("../../scripts/sgac/official-options.ts", import.meta.url),
  "utf8",
);
const translationCache = JSON.parse(
  readFileSync(new URL("../../scripts/sgac/option-translations.zh.json", import.meta.url), "utf8"),
) as { hotel: Record<string, string> };

function extractFieldNames(): string[] {
  return Array.from(seedSource.matchAll(/field_name:\s*"([^"]+)"/g), (match) => match[1]);
}

describe("Singapore SG Arrival Card schema seed", () => {
  test("uses a dedicated SGAC visa type with core arrival-card fields", () => {
    expect(seedSource).toContain('SGAC_VISA_TYPE = "SG_ARRIVAL_CARD"');

    const fieldNames = new Set(extractFieldNames());
    expect(fieldNames.size).toBeGreaterThanOrEqual(25);
    expect(fieldNames).toEqual(
      expect.objectContaining({
        has: expect.any(Function),
      }),
    );
    for (const requiredField of [
      "full_name",
      "date_of_birth",
      "nationality",
      "passport_number",
      "passport_expiry_date",
      "arrival_date",
      "purpose_of_travel",
      "mode_of_travel",
      "transport_number",
      "land_transport_type",
      "vehicle_number",
      "sea_transport_type",
      "cruise_name",
      "vessel_name",
      "accommodation_type",
      "email_address",
      "mobile_country_code",
      "has_health_symptoms",
      "recent_country_visit_history",
    ]) {
      expect(fieldNames.has(requiredField), `${requiredField} missing`).toBe(true);
    }
    expect(fieldNames.has("purpose_of_visit"), "legacy purpose_of_visit must not be used for SGAC").toBe(false);
  });

  test("uses the SGAC canonical purpose field and bilingual label", () => {
    expect(seedSource).toContain('field_name: "purpose_of_travel"');
    expect(seedSource).toContain('label: "Purpose of Travel"');
    expect(seedSource).toContain('validation_rules: rules("旅行目的"');
    expect(officialOptionsSource).toContain('"value": "Holiday/Sightseeing/Leisure"');
    expect(officialOptionsSource).toContain('"value": "Others"');
  });

  test("keeps hotel name aligned with ICA autocomplete options instead of free text", () => {
    expect(seedSource).toContain('field_name: "accommodation_name", label: "Hotel Name", field_type: "select"');
    expect(seedSource).toContain('options: HOTEL_NAMES');
    expect(officialOptionsSource).toContain('"value": "MARINA BAY SANDS SINGAPORE"');
    expect(officialOptionsSource).toContain('"labelEn": "MARINA BAY SANDS SINGAPORE"');
  });

  test("keeps a complete one-to-one Chinese label snapshot for every ICA hotel", () => {
    const officialHotelNames = SGAC_HOTEL_NAME_OPTIONS.map((option) => option.value);
    const translatedHotelNames = Object.keys(translationCache.hotel);

    expect(officialHotelNames).toHaveLength(469);
    expect(new Set(officialHotelNames).size).toBe(469);
    expect(translatedHotelNames).toHaveLength(469);
    expect(new Set(translatedHotelNames)).toEqual(new Set(officialHotelNames));

    for (const officialName of officialHotelNames) {
      const labelZh = translationCache.hotel[officialName];
      expect(labelZh, officialName).toMatch(/[\u3400-\u9fff]/);
      expect(labelZh, officialName).not.toMatch(/[A-Za-zＡ-Ｚａ-ｚ]/);
    }
  });

  test("keeps ICA autocomplete fields as official dropdowns instead of free text", () => {
    expect(seedSource).toContain('field_name: "nationality", label: "Nationality/Citizenship", field_type: "select"');
    expect(seedSource).toContain('options: NATIONALITIES');
    expect(seedSource).toContain('field_name: "place_of_birth_country", label: "Country/Place of Birth", field_type: "select"');
    expect(seedSource).toContain('options: BIRTH_COUNTRIES');
    expect(seedSource).toContain('field_name: "place_of_residence", label: "Place of Residence", field_type: "select"');
    expect(seedSource).toContain('field_name: "last_city_or_port_before_singapore", label: "Last City/Port of Embarkation Before Singapore", field_type: "select"');
    expect(seedSource).toContain('field_name: "next_city_or_port_after_singapore", label: "Next City/Port of Disembarkation After Singapore", field_type: "select"');
    expect(officialOptionsSource).toContain('"value": "MALAYSIA, KUALA LUMPUR, KUALA LUMPUR"');
    expect(officialOptionsSource).toContain('"value": "CHINESE"');
  });

  test("keeps arrival and departure dates together in trip information", () => {
    expect(seedSource).toContain(
      'field_name: "arrival_date", label: "Date of Arrival (DD/MM/YYYY)", field_type: "date", required: true, step_number: 2, step_name: "Trip Information", display_order: 1',
    );
    expect(seedSource).toContain(
      'field_name: "departure_date", label: "Date of Departure from Singapore", field_type: "date", required: true, step_number: 2, step_name: "Trip Information", display_order: 2',
    );
    expect(seedSource.match(/inline_group: "sgac_travel_dates"/g)?.length).toBe(2);
  });

  test("models ICA transport and health conditional branches", () => {
    expect(seedSource).toContain('field_name: "recent_high_risk_region_visit_history"');
    expect(seedSource).toContain('conditional_logic: showIf("has_health_symptoms === yes")');
    expect(seedSource).toContain('field_name: "land_transport_type", label: "Mode of Transport", field_type: "select"');
    expect(seedSource).toContain('options: LAND_TYPES');
    expect(seedSource).toContain('field_name: "vehicle_number", label: "Vehicle Number", field_type: "text"');
    expect(seedSource).toContain('field_name: "sea_transport_type", label: "Mode of Transport", field_type: "select"');
    expect(seedSource).toContain('options: SEA_TYPES');
    expect(seedSource).toContain('field_name: "cruise_name", label: "Cruise Name", field_type: "select"');
    expect(seedSource).toContain('options: CRUISE_NAMES');
    expect(seedSource).toContain('field_name: "vessel_name", label: "Vessel Name", field_type: "text"');
  });

  test("keeps residential accommodation required fields aligned with ICA", () => {
    expect(seedSource).toContain('field_name: "accommodation_block_number", label: "Block Number", field_type: "text", required: true');
    expect(seedSource).toContain('field_name: "accommodation_floor_number", label: "Floor Number", field_type: "text", required: true');
    expect(seedSource).toContain('field_name: "accommodation_unit_number", label: "Unit Number", field_type: "text", required: true');
    expect(seedSource).toContain('rules("楼层", { allow_does_not_apply: true');
    expect(seedSource).toContain('rules("单位号", { allow_does_not_apply: true');
  });

  test("does not collect VIZA-only acknowledgements or non-ICA passport fields", () => {
    const fieldNames = new Set(extractFieldNames());
    for (const extraField of [
      "passport_issuing_country",
      "passport_issue_date",
      "passport_validity_acknowledgement",
      "yellow_fever_risk_acknowledgement",
      "health_declaration",
      "sgac_is_not_visa_acknowledgement",
      "official_submission_timing_acknowledgement",
      "official_submission_acknowledgement",
      "final_declaration",
      "contact_person_in_singapore",
      "contact_phone_in_singapore",
    ]) {
      expect(fieldNames.has(extraField), `${extraField} must not appear in the SGAC form`).toBe(false);
    }
  });

  test("includes bilingual Chinese labels for every field", () => {
    const fieldNames = extractFieldNames();
    const labelZhMatches = Array.from(seedSource.matchAll(/validation_rules:\s*rules\("([^"]+)"/g));

    expect(labelZhMatches.length).toBe(fieldNames.length);
    for (const match of labelZhMatches) {
      expect(/[\u3400-\u9fff]/.test(match[1])).toBe(true);
    }
  });

  test("renders SGAC official dropdown labels as Chinese on the left side", () => {
    const optionsByField = new Map(SGAC_FORM_FIELDS.map((field) => [field.field_name, field.options ?? []]));
    const labelZh = (fieldName: string, value: string) => {
      const option = optionsByField.get(fieldName)?.find((item) => item.value === value);
      return option?.label_zh ?? "";
    };

    expect(labelZh("nationality", "BRITISH OVERSEAS TERRITORIES CITIZ")).toBe("英国海外领土公民");
    expect(labelZh("nationality", "BRITISH SUBJECT")).toBe("英国臣民");
    expect(labelZh("nationality", "CAMBODIAN")).toBe("柬埔寨籍");
    expect(labelZh("nationality", "CROATIAN")).toBe("克罗地亚籍");
    expect(labelZh("nationality", "ESTONIAN")).toBe("爱沙尼亚籍");
    expect(labelZh("nationality", "GEORGIAN")).toBe("格鲁吉亚籍");
    expect(labelZh("nationality", "KOSOVAR")).toBe("科索沃籍");
    expect(labelZh("nationality", "KYRGYZSTAN")).toBe("吉尔吉斯斯坦籍");
    expect(labelZh("nationality", "LITHUANIAN")).toBe("立陶宛籍");
    expect(labelZh("nationality", "MACEDONIAN")).toBe("北马其顿籍");
    expect(labelZh("nationality", "MICRONESIAN")).toBe("密克罗尼西亚籍");
    expect(labelZh("nationality", "MONTENEGRIN")).toBe("黑山籍");
    expect(labelZh("nationality", "REFUGEE (OTHER THAN XXB)")).toBe("难民（其他类别）");
    expect(labelZh("nationality", "REFUGEE (XXB)")).toBe("难民（指定类别）");
    expect(labelZh("nationality", "RUSSIAN")).toBe("俄罗斯籍");
    expect(labelZh("nationality", "SAMOAN")).toBe("萨摩亚籍");
    expect(labelZh("nationality", "STATELESS")).toBe("无国籍");
    expect(labelZh("nationality", "SWAZI")).toBe("斯威士兰籍");
    expect(labelZh("nationality", "TAJIKISTANI")).toBe("塔吉克斯坦籍");
    expect(labelZh("nationality", "UKRAINIAN")).toBe("乌克兰籍");
    expect(labelZh("nationality", "YEMENI")).toBe("也门籍");

    expect(labelZh("place_of_birth_country", "CAMBODIA")).toBe("柬埔寨");
    expect(labelZh("place_of_birth_country", "RUSSIA")).toBe("俄罗斯");
    expect(labelZh("place_of_birth_country", "UKRAINE")).toBe("乌克兰");

    expect(labelZh("place_of_residence", "AFGHANISTAN, KABUL, KABUL")).toBe("阿富汗，喀布尔，喀布尔");
    expect(labelZh("place_of_residence", "ALBANIA, TIRANA, TIRANA")).toBe("阿尔巴尼亚，地拉那，地拉那");
    expect(labelZh("place_of_residence", "CAMBODIA, PHNOM PENH, PHNOM PENH")).toBe("柬埔寨，金边，金边");
    expect(labelZh("place_of_residence", "CHINA, BEIJING, BEIJING")).toBe("中国，北京，北京");
    expect(labelZh("place_of_residence", "CHINA, SHANGHAI, SHANGHAI")).toBe("中国，上海，上海");
    expect(labelZh("place_of_residence", "MALAYSIA, KUALA LUMPUR, KUALA LUMPUR")).toBe("马来西亚，吉隆坡，吉隆坡");
    expect(labelZh("place_of_residence", "RUSSIA, CENTRAL, MOSCOW")).toBe("俄罗斯，中部，莫斯科");
    for (const value of [
      "AFGHANISTAN, KABUL, KABUL",
      "ALBANIA, TIRANA, TIRANA",
      "ALGERIA, ALGIERS, ALGIERS",
      "CHINA, BEIJING, BEIJING",
      "CHINA, SHANGHAI, SHANGHAI",
      "MALAYSIA, KUALA LUMPUR, KUALA LUMPUR",
    ]) {
      expect(labelZh("place_of_residence", value)).not.toMatch(/[A-Za-z]/);
    }

    expect(labelZh("purpose_of_travel", "Religion")).toBe("宗教活动");
    expect(labelZh("purpose_of_travel", "Sports event")).toBe("体育赛事");
    expect(labelZh("purpose_of_travel", "To take up residence")).toBe("定居");
    expect(labelZh("place_of_residence", "UNITED STATES, ARKANSAS, HOT SPRING")).toBe("美国，阿肯色州，温泉城");
    expect(labelZh("place_of_residence", "INDIA, WEST BENGAL, KOLKATA")).toBe("印度，西孟加拉邦，加尔各答");
    expect(labelZh("place_of_residence", "AFGHANISTAN, OTHERS IN AFGHANISTAN, OTHERS IN AFGHANISTAN")).toBe("阿富汗，阿富汗其他地区，阿富汗其他地区");
    expect(labelZh("place_of_residence", "ANGUILLA, OTHERS IN ANGUILLA, OTHERS IN ANGUILLA")).toBe("安圭拉，安圭拉其他地区，安圭拉其他地区");
    expect(labelZh("place_of_residence", "ANTIGUA, OTHERS IN ANTIGUA, OTHERS IN ANTIGUA")).toBe("安提瓜，安提瓜其他地区，安提瓜其他地区");
    expect(labelZh("place_of_residence", "BARBADOS, OTHERS IN BARNADOS, OTHERS IN BARBADOS")).toBe("巴巴多斯，巴巴多斯其他地区，巴巴多斯其他地区");
    expect(labelZh("last_city_or_port_before_singapore", "UNITED STATES, ARKANSAS, LITTLE ROCK")).toBe("美国，阿肯色州，小石城");
    expect(labelZh("next_city_or_port_after_singapore", "UNITED STATES, ARKANSAS, OTHERS IN ARKANSAS")).toBe("美国，阿肯色州，阿肯色州其他地区");
    expect(labelZh("accommodation_name", "MARINA BAY SANDS SINGAPORE")).toBe("新加坡滨海湾金沙");
    expect(labelZh("accommodation_name", "IBIS SINGAPORE ON BENCOOLEN")).toBe("新加坡明古连路宜必思酒店");
    expect(labelZh("accommodation_name", "VIBE HOTEL SINGAPORE ORCHARD")).toBe("新加坡乌节路维贝酒店");
    expect(labelZh("accommodation_name", "AMARA SINGAPORE")).toBe("新加坡阿马拉酒店");
    expect(labelZh("accommodation_name", "VILLAGE HOTEL SENTOSA")).toBe("悦乐圣淘沙酒店");
    expect(labelZh("accommodation_name", "SHANGRI-LA RASA SENTOSA, SINGAPORE")).toBe("新加坡圣淘沙香格里拉");
    expect(labelZh("cruise_name", "ADONIA")).toBe("阿多尼亚");
    expect(labelZh("cruise_name", "ADORA MEDITERRANEA")).toBe("阿多拉地中海");
    expect(labelZh("cruise_name", "QUANTUM OF THE SEAS")).toBe("海洋量子号");
    expect(labelZh("carrier_code", "NQ")).toBe("日本航空（NQ）");
    expect(labelZh("carrier_code", "NX")).toBe("澳门航空（NX）");
    expect(labelZh("carrier_code", "PX")).toBe("新几内亚航空（PX）");
    expect(labelZh("carrier_code", "AK")).toBe("亚洲航空（AK）");
    expect(labelZh("carrier_code", "D7")).toBe("亚航长途（D7）");

    for (const fieldName of [
      "place_of_residence",
      "last_city_or_port_before_singapore",
      "next_city_or_port_after_singapore",
      "accommodation_name",
      "cruise_name",
      "carrier_code",
    ]) {
      for (const option of optionsByField.get(fieldName) ?? []) {
        expect(option.label_zh.replace(/（[A-Z0-9]{2}）/g, ""), `${fieldName}: ${option.value}`).not.toMatch(/[A-Za-zＡ-Ｚａ-ｚ]/);
        expect(option.label_zh, `${fieldName}: ${option.value}`).not.toMatch(/其他人|境内/);
        expect(option.label_zh, `${fieldName}: ${option.value}`).not.toMatch(/^选项：/);
      }
    }
  });
});
