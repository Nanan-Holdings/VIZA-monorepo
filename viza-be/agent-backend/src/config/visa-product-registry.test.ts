import { describe, expect, it } from 'vitest';
import {
  VISA_PRODUCT_REGISTRY,
  canonicalProductCode,
  isAllowedOfficialProductUrl,
} from './visa-product-registry.js';

describe('visa product registry', () => {
  it('keeps internal form and official redirect products explicit', () => {
    expect(VISA_PRODUCT_REGISTRY.SG_ARRIVAL_CARD.kind).toBe('arrival_declaration');
    expect(VISA_PRODUCT_REGISTRY.SG_VISITOR_VISA.kind).toBe('visa');
    expect(VISA_PRODUCT_REGISTRY.US_ESTA.provider).toBe('official');
    expect(VISA_PRODUCT_REGISTRY.DS160.provider).toBe('viza');
  });

  it('normalizes legacy product aliases without exposing hybrid products', () => {
    expect(canonicalProductCode('tourist_b211a')).toBe('ID_C1_TOURIST');
    expect(canonicalProductCode('c3_or_keta')).toBe('KR_C39_SHORT_TERM_VISIT');
    expect(canonicalProductCode('evisa_tourism')).toBe('VN_E_VISA');
  });

  it('allows only audited official product hosts', () => {
    expect(isAllowedOfficialProductUrl(VISA_PRODUCT_REGISTRY.US_ESTA.url)).toBe(true);
    expect(isAllowedOfficialProductUrl('https://example.com/esta')).toBe(false);
    expect(isAllowedOfficialProductUrl('javascript:alert(1)')).toBe(false);
  });
});
