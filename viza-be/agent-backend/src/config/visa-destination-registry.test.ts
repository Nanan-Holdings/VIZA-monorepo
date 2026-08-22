import { describe, expect, it } from 'vitest';
import {
  VISA_DESTINATION_REGISTRY,
  VISA_SERVICE_COUNTRIES,
  canonicalVisaType,
  countrySupportsVisaType,
  getDefaultVisitorVisaType,
} from './visa-destination-registry.js';

describe('visa destination registry canonical products', () => {
  it.each([
    ['indonesia', 'ID_C1_TOURIST'],
    ['vietnam', 'VN_E_VISA'],
    ['singapore', 'SG_ARRIVAL_CARD'],
    ['malaysia', 'MY_MDAC_ARRIVAL_CARD'],
    ['thailand', 'TH_TDAC_ARRIVAL_CARD'],
    ['south_korea', 'KR_C39_SHORT_TERM_VISIT'],
    ['us', 'DS160'],
    ['france', 'EU_SCHENGEN_C_SHORT_STAY'],
    ['philippines', 'PH_ETRAVEL_ARRIVAL_CARD'],
    ['uk', 'UK_STANDARD_VISITOR'],
    ['taiwan', 'TW_ENTRY_PERMIT'],
    ['canada', 'CA_TRV'],
    ['india', 'IN_E_VISA'],
    ['saudi_arabia', 'SA_E_VISA'],
    ['turkey', 'TR_E_VISA'],
    ['united_arab_emirates', 'AE_TOURIST_VISA'],
    ['japan', 'short_term_tourism_evisa'],
    ['kenya', 'KE_ETA'],
  ] as const)('uses the canonical default for %s', (country, visaType) => {
    expect(getDefaultVisitorVisaType(country)).toBe(visaType);
  });

  it('keeps visa and arrival declarations as separate products', () => {
    expect(VISA_DESTINATION_REGISTRY.japan.supportedVisaTypes).toEqual([
      'short_term_tourism_evisa',
      'JP_VISIT_JAPAN_WEB',
    ]);
    expect(VISA_DESTINATION_REGISTRY.kenya.supportedVisaTypes).toEqual(['KE_ETA']);
    expect(VISA_DESTINATION_REGISTRY.singapore.supportedVisaTypes).toEqual([
      'SG_ARRIVAL_CARD',
      'SG_VISITOR_VISA',
    ]);
    expect(VISA_DESTINATION_REGISTRY.vietnam.supportedVisaTypes).toEqual([
      'VN_E_VISA',
      'VN_PREARRIVAL_DECLARATION',
    ]);
    expect(VISA_DESTINATION_REGISTRY.philippines.supportedVisaTypes).toEqual([
      'PH_ETRAVEL_ARRIVAL_CARD',
      'PH_ETRAVEL_DEPARTURE_CARD',
      'PH_TEMPORARY_VISITOR_VISA',
    ]);
    expect(VISA_DESTINATION_REGISTRY.south_korea.supportedVisaTypes).toEqual([
      'KR_C39_SHORT_TERM_VISIT',
      'KR_E_ARRIVAL_CARD',
    ]);
  });

  it.each([
    ['indonesia', 'tourist_b211a', 'ID_C1_TOURIST'],
    ['vietnam', 'evisa_tourism', 'VN_E_VISA'],
    ['south_korea', 'c3_or_keta', 'KR_C39_SHORT_TERM_VISIT'],
    ['south_korea', 'korea_e_arrival_card', 'KR_E_ARRIVAL_CARD'],
    ['us', 'b1_b2', 'DS160'],
    ['france', 'schengen_short_stay_tourism', 'EU_SCHENGEN_C_SHORT_STAY'],
    ['uk', 'standard_visitor', 'UK_STANDARD_VISITOR'],
    ['taiwan', 'TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT', 'TW_ENTRY_PERMIT'],
    ['canada', 'visitor_visa', 'CA_TRV'],
    ['india', 'regular_tourist_visa', 'IN_E_VISA'],
    ['saudi_arabia', 'tourist_evisa', 'SA_E_VISA'],
    ['turkey', 'evisa_tourism_business', 'TR_E_VISA'],
    ['united_arab_emirates', 'visa_free_or_tourist_visa', 'AE_TOURIST_VISA'],
    ['japan', 'vjw', 'JP_VISIT_JAPAN_WEB'],
    ['kenya', 'kenya_eta', 'KE_ETA'],
  ] as const)('normalizes legacy %s/%s to %s', (country, legacy, canonical) => {
    expect(canonicalVisaType(country, legacy)).toBe(canonical);
    expect(countrySupportsVisaType(country, legacy)).toBe(true);
  });

  it('does not apply a country alias to another country', () => {
    expect(canonicalVisaType('malaysia', 'evisa_tourism')).toBe('evisa_tourism');
    expect(countrySupportsVisaType('malaysia', 'evisa_tourism')).toBe(false);
    expect(countrySupportsVisaType('vietnam', 'evisa_tourism')).toBe(true);
  });

  it('does not recommend the removed Russia route', () => {
    expect(VISA_SERVICE_COUNTRIES.has('russia')).toBe(false);
  });
});
