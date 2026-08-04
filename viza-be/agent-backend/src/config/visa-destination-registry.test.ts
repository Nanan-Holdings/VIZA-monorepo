import { describe, expect, it } from 'vitest';
import {
  VISA_DESTINATION_REGISTRY,
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
  ] as const)('uses the canonical default for %s', (country, visaType) => {
    expect(getDefaultVisitorVisaType(country)).toBe(visaType);
  });

  it('keeps visa and arrival declarations as separate products', () => {
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
  });

  it.each([
    ['indonesia', 'tourist_b211a', 'ID_C1_TOURIST'],
    ['vietnam', 'evisa_tourism', 'VN_E_VISA'],
    ['south_korea', 'c3_or_keta', 'KR_C39_SHORT_TERM_VISIT'],
    ['us', 'b1_b2', 'DS160'],
    ['france', 'schengen_short_stay_tourism', 'EU_SCHENGEN_C_SHORT_STAY'],
    ['uk', 'standard_visitor', 'UK_STANDARD_VISITOR'],
    ['taiwan', 'TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT', 'TW_ENTRY_PERMIT'],
  ] as const)('normalizes legacy %s/%s to %s', (country, legacy, canonical) => {
    expect(canonicalVisaType(country, legacy)).toBe(canonical);
    expect(countrySupportsVisaType(country, legacy)).toBe(true);
  });

  it('does not apply a country alias to another country', () => {
    expect(canonicalVisaType('malaysia', 'evisa_tourism')).toBe('evisa_tourism');
    expect(countrySupportsVisaType('malaysia', 'evisa_tourism')).toBe(false);
    expect(countrySupportsVisaType('vietnam', 'evisa_tourism')).toBe(true);
  });
});
