import { describe, expect, it } from 'vitest';
import { resolveReviewedVisaEntryRule } from '../services/visa-entry-rule.service.js';
import { createEmptyVisaConversationState } from '../services/visa-conversation-state.service.js';
import {
  buildApplicationRedirectPromptNote,
  buildRuleProductRecommendationBlocks,
  buildVizaServiceCapabilityPrompt,
} from './visa-namespace.js';

function reviewedRule(destinationCountry: string, passportCountryIso3: string) {
  return resolveReviewedVisaEntryRule({
    destinationCountry,
    passportCountryIso3,
    passportType: 'ordinary',
    tripPurpose: 'tourism',
    stayLengthDays: 10,
  });
}

describe('reviewed visa product recommendation blocks', () => {
  it('recommends only the independent arrival declaration for exempt China-to-Singapore travel', () => {
    const blocks = buildRuleProductRecommendationBlocks(
      reviewedRule('singapore', 'CHN'),
      'zh'
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      productCode: 'SG_ARRIVAL_CARD',
      productKind: 'arrival_declaration',
      provider: 'viza',
      redirectUrl: '/client/application?country=singapore&visaType=SG_ARRIVAL_CARD',
      ctaLabel: '开始填写',
    });
    expect(blocks[0].title).toContain('新加坡电子入境卡');
    expect(blocks[0].title).not.toContain('SG');
  });

  it('keeps VIZA routes and product codes out of assistant prose when a card is emitted', () => {
    const blocks = buildRuleProductRecommendationBlocks(
      reviewedRule('singapore', 'CHN'),
      'zh'
    );
    const state = createEmptyVisaConversationState();
    state.destinationCountries = ['singapore'];
    state.mainDestination = 'singapore';

    const promptNote = buildApplicationRedirectPromptNote(blocks, state, 'zh');

    expect(promptNote).toContain('请使用下方申请卡片继续填写');
    expect(promptNote).toContain('填写新加坡电子入境卡');
    expect(promptNote).not.toContain('/client/');
    expect(promptNote).not.toContain('SG_ARRIVAL_CARD');
    expect(promptNote).not.toContain('form link');
  });

  it('describes VIZA arrival-card capability without exposing the internal route', () => {
    const capabilityPrompt = buildVizaServiceCapabilityPrompt(
      '我应该填写哪个入境表单？',
      'singapore',
      'zh'
    );

    expect(capabilityPrompt).toContain('clickable application card');
    expect(capabilityPrompt).not.toContain('/client/application');
    expect(capabilityPrompt).not.toContain('SG_ARRIVAL_CARD');
  });

  it('keeps visa and arrival declaration products isolated', () => {
    const requiredVisa = buildRuleProductRecommendationBlocks(
      reviewedRule('us', 'CHN'),
      'zh'
    );
    const exemptArrivalDeclaration = buildRuleProductRecommendationBlocks(
      reviewedRule('thailand', 'CHN'),
      'zh'
    );

    expect(requiredVisa.map((block) => block.productCode)).toEqual(['DS160']);
    expect(exemptArrivalDeclaration.map((block) => block.productCode)).toEqual([
      'TH_TDAC_ARRIVAL_CARD',
    ]);
    expect(exemptArrivalDeclaration.some((block) => block.productKind === 'visa')).toBe(false);
  });

  it('does not emit CTAs for conditional, unknown, or not-applicable outcomes', () => {
    expect(
      buildRuleProductRecommendationBlocks(reviewedRule('taiwan', 'CHN'), 'zh')
    ).toEqual([]);
    expect(
      buildRuleProductRecommendationBlocks(reviewedRule('us', 'USA'), 'zh')
    ).toEqual([]);
    expect(buildRuleProductRecommendationBlocks(null, 'zh')).toEqual([]);
  });

  it('uses official metadata for external product recommendations', () => {
    const blocks = buildRuleProductRecommendationBlocks(
      reviewedRule('uk', 'SGP'),
      'zh'
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      productCode: 'UK_ETA',
      provider: 'official',
      supportLevel: 'official_redirect',
      ctaLabel: '打开官方页面',
    });
    expect(blocks[0].redirectUrl).toMatch(/^https:\/\/www\.gov\.uk\//);
  });
});
