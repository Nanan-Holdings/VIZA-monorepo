import { describe, expect, it } from 'vitest';
import {
  buildVisaEntryRulePrompt,
  resolveReviewedVisaEntryRule,
} from '../services/visa-entry-rule.service.js';

/**
 * A Hong Kong SAR passport holder asking about Poland was told they needed a
 * Schengen visa. The exemption covers every Schengen state, and applies equally
 * to Macao SAR and Taiwan travel documents.
 */
describe('Schengen short-stay exemption for HK / Macao / Taiwan documents', () => {
  const DESTINATIONS = ['poland', 'france', 'germany', 'italy', 'spain', 'switzerland'];
  const PASSPORTS = ['HKG', 'MAC', 'TWN'];
  const PURPOSES = ['tourism', 'business', 'family_visit', 'transit'];

  for (const passportCountryIso3 of PASSPORTS) {
    for (const destinationCountry of DESTINATIONS) {
      it(`treats ${passportCountryIso3} → ${destinationCountry} tourism as visa-exempt`, () => {
        const rule = resolveReviewedVisaEntryRule({
          destinationCountry,
          passportCountryIso3,
          passportType: 'ordinary',
          tripPurpose: 'tourism',
          stayLengthDays: 10,
        });
        expect(rule?.outcome).toBe('visa_exempt');
        expect(rule?.maxStayDays).toBe(90);
      });
    }
  }

  for (const tripPurpose of PURPOSES) {
    it(`covers ${tripPurpose} for a Hong Kong SAR passport`, () => {
      const rule = resolveReviewedVisaEntryRule({
        destinationCountry: 'poland',
        passportCountryIso3: 'HKG',
        passportType: 'ordinary',
        tripPurpose,
        stayLengthDays: 10,
      });
      expect(rule?.outcome).toBe('visa_exempt');
    });
  }

  it('does not extend the exemption to work', () => {
    const rule = resolveReviewedVisaEntryRule({
      destinationCountry: 'poland',
      passportCountryIso3: 'HKG',
      passportType: 'ordinary',
      tripPurpose: 'work',
      stayLengthDays: 10,
    });
    expect(rule?.outcome).not.toBe('visa_exempt');
  });

  it('leads the answer with the exemption and forbids the Schengen C conclusion', () => {
    const rule = resolveReviewedVisaEntryRule({
      destinationCountry: 'poland',
      passportCountryIso3: 'HKG',
      passportType: 'ordinary',
      tripPurpose: 'tourism',
      stayLengthDays: 10,
    });
    const prompt = buildVisaEntryRulePrompt(rule, 'zh');
    expect(prompt).toContain('MANDATORY POLICY LEAD');
    expect(prompt).toContain('免签');
    expect(prompt).toContain('波兰');
    expect(prompt).toContain('Never state that this traveller needs a Schengen C short-stay visa');
  });
});
