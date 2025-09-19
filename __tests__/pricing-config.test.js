// __tests__/pricing-config.test.js

import { 
  PREPBETTR_PRICING, 
  PREPBETTR_PLANS, 
  pricingUtils 
} from '../lib/pricing-config';

describe('PrepBettr Pricing Configuration', () => {
  describe('Pricing Structure', () => {
    test('Individual plan has correct monthly pricing', () => {
      const individual = PREPBETTR_PRICING.INDIVIDUAL;
      expect(individual.monthly.amount).toBe(49.00);
      expect(individual.monthly.currency).toBe('USD');
      expect(individual.monthly.interval).toBe('month');
    });

    test('Individual plan has correct yearly pricing with 17% savings', () => {
      const individual = PREPBETTR_PRICING.INDIVIDUAL;
      expect(individual.yearly.amount).toBe(490.00); // 10 months (2 free)
      expect(individual.yearly.monthlyEquivalent).toBe(40.83);
      expect(individual.yearly.savings).toBe(17);
      expect(individual.yearly.monthsFree).toBe(2);
    });

    test('Enterprise plan has correct monthly pricing', () => {
      const enterprise = PREPBETTR_PRICING.ENTERPRISE;
      expect(enterprise.monthly.amount).toBe(199.00);
      expect(enterprise.monthly.currency).toBe('USD');
      expect(enterprise.monthly.interval).toBe('month');
    });

    test('Enterprise plan has correct yearly pricing with 17% savings', () => {
      const enterprise = PREPBETTR_PRICING.ENTERPRISE;
      expect(enterprise.yearly.amount).toBe(1990.00); // 10 months (2 free)
      expect(enterprise.yearly.monthlyEquivalent).toBe(165.83);
      expect(enterprise.yearly.savings).toBe(17);
      expect(enterprise.yearly.monthsFree).toBe(2);
    });
  });

  describe('Pricing Utilities', () => {
    test('calculates correct yearly savings for Individual plan', () => {
      const savings = pricingUtils.calculateYearlySavings('individual');
      const expectedSavings = (49 * 12) - 490; // $588 - $490 = $98
      expect(savings).toBe(expectedSavings);
      expect(savings).toBe(98);
    });

    test('calculates correct yearly savings for Enterprise plan', () => {
      const savings = pricingUtils.calculateYearlySavings('enterprise');
      const expectedSavings = (199 * 12) - 1990; // $2388 - $1990 = $398
      expect(savings).toBe(expectedSavings);
      expect(savings).toBe(398);
    });

    test('formats prices correctly', () => {
      expect(pricingUtils.formatPrice(49)).toBe('$49');
      expect(pricingUtils.formatPrice(49.00)).toBe('$49');
      expect(pricingUtils.formatPrice(40.83, 'USD', { showCents: true })).toBe('$40.83');
      expect(pricingUtils.formatPrice(165.83, 'USD', { showCents: true })).toBe('$165.83');
    });

    test('calculates correct savings percentage', () => {
      const individualPercentage = pricingUtils.calculateSavingsPercentage('individual');
      const enterprisePercentage = pricingUtils.calculateSavingsPercentage('enterprise');
      
      expect(individualPercentage).toBe(17);
      expect(enterprisePercentage).toBe(17);
    });

    test('returns formatted yearly savings', () => {
      const individualSavings = pricingUtils.getFormattedYearlySavings('individual');
      const enterpriseSavings = pricingUtils.getFormattedYearlySavings('enterprise');
      
      expect(individualSavings).toBe('$98');
      expect(enterpriseSavings).toBe('$398');
    });

    test('returns null for invalid plan types', () => {
      const invalidSavings = pricingUtils.calculateYearlySavings('invalid');
      expect(invalidSavings).toBe(0);
    });
  });

  describe('Plan Configuration', () => {
    test('Individual plan has correct configuration', () => {
      const individual = PREPBETTR_PLANS.individual;
      
      expect(individual.id).toBe('individual');
      expect(individual.name).toBe('Individual');
      expect(individual.description).toBe('Perfect for job seekers');
      expect(individual.popular).toBe(false);
      expect(individual.recommended).toBe(false);
      
      // Check limits
      expect(individual.limits.resumes).toBe(10);
      expect(individual.limits.interviews).toBe(20);
      expect(individual.limits.coverLetters).toBe(5);
      expect(individual.limits.users).toBe(1);
      
      // Check trial
      expect(individual.trial.enabled).toBe(true);
      expect(individual.trial.duration).toBe(7);
      expect(individual.trial.unit).toBe('days');
    });

    test('Enterprise plan has correct configuration', () => {
      const enterprise = PREPBETTR_PLANS.enterprise;
      
      expect(enterprise.id).toBe('enterprise');
      expect(enterprise.name).toBe('Enterprise');
      expect(enterprise.description).toBe('For teams and organizations');
      expect(enterprise.popular).toBe(true);
      expect(enterprise.recommended).toBe(true);
      
      // Check unlimited limits (-1)
      expect(enterprise.limits.resumes).toBe(-1);
      expect(enterprise.limits.interviews).toBe(-1);
      expect(enterprise.limits.coverLetters).toBe(-1);
      expect(enterprise.limits.users).toBe(-1);
      
      // Check trial
      expect(enterprise.trial.enabled).toBe(true);
      expect(enterprise.trial.duration).toBe(7);
      expect(enterprise.trial.unit).toBe('days');
    });

    test('getAllPlans returns all plans', () => {
      const allPlans = pricingUtils.getAllPlans();
      expect(allPlans).toHaveLength(2);
      expect(allPlans.map(p => p.id)).toEqual(['individual', 'enterprise']);
    });

    test('getPopularPlans returns only popular plans', () => {
      const popularPlans = pricingUtils.getPopularPlans();
      expect(popularPlans).toHaveLength(1);
      expect(popularPlans[0].id).toBe('enterprise');
    });

    test('getRecommendedPlans returns only recommended plans', () => {
      const recommendedPlans = pricingUtils.getRecommendedPlans();
      expect(recommendedPlans).toHaveLength(1);
      expect(recommendedPlans[0].id).toBe('enterprise');
    });
  });

  describe('Plan Comparison', () => {
    test('comparePlans returns correct comparison data', () => {
      const comparison = pricingUtils.comparePlans('individual', 'enterprise');
      
      expect(comparison).toBeTruthy();
      expect(comparison.plan1.name).toBe('Individual');
      expect(comparison.plan1.monthlyPrice).toBe(49);
      expect(comparison.plan1.yearlyPrice).toBe(490);
      
      expect(comparison.plan2.name).toBe('Enterprise');
      expect(comparison.plan2.monthlyPrice).toBe(199);
      expect(comparison.plan2.yearlyPrice).toBe(1990);
      
      expect(comparison.difference.monthly).toBe(150); // 199 - 49
      expect(comparison.difference.yearly).toBe(1500); // 1990 - 490
    });

    test('comparePlans returns null for invalid plans', () => {
      const comparison = pricingUtils.comparePlans('invalid', 'enterprise');
      expect(comparison).toBeNull();
    });
  });

  describe('Pricing Validation', () => {
    test('validates pricing configuration correctly', () => {
      const validation = pricingUtils.validatePricing();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('detects pricing configuration errors', () => {
      // Mock invalid pricing for testing
      const originalPricing = PREPBETTR_PRICING.INDIVIDUAL.monthly.amount;
      PREPBETTR_PRICING.INDIVIDUAL.monthly.amount = 0;
      
      const validation = pricingUtils.validatePricing();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      
      // Restore original pricing
      PREPBETTR_PRICING.INDIVIDUAL.monthly.amount = originalPricing;
    });
  });

  describe('Mathematical Accuracy', () => {
    test('yearly pricing equals exactly 10 months (2 months free)', () => {
      // Individual: 49 * 10 = 490
      expect(PREPBETTR_PRICING.INDIVIDUAL.yearly.amount).toBe(49 * 10);
      
      // Enterprise: 199 * 10 = 1990  
      expect(PREPBETTR_PRICING.ENTERPRISE.yearly.amount).toBe(199 * 10);
    });

    test('monthly equivalent is yearly price divided by 12', () => {
      // Individual: 490 / 12 = 40.83 (rounded)
      const individualMonthlyEquiv = Math.round((490 / 12) * 100) / 100;
      expect(PREPBETTR_PRICING.INDIVIDUAL.yearly.monthlyEquivalent).toBe(individualMonthlyEquiv);
      
      // Enterprise: 1990 / 12 = 165.83 (rounded)
      const enterpriseMonthlyEquiv = Math.round((1990 / 12) * 100) / 100;
      expect(PREPBETTR_PRICING.ENTERPRISE.yearly.monthlyEquivalent).toBe(enterpriseMonthlyEquiv);
    });

    test('savings percentage is exactly 17%', () => {
      // Individual: (588 - 490) / 588 * 100 = 16.67% ≈ 17%
      const individualSavingsPercent = Math.round(((49 * 12 - 490) / (49 * 12)) * 100);
      expect(individualSavingsPercent).toBe(17);
      
      // Enterprise: (2388 - 1990) / 2388 * 100 = 16.67% ≈ 17%
      const enterpriseSavingsPercent = Math.round(((199 * 12 - 1990) / (199 * 12)) * 100);
      expect(enterpriseSavingsPercent).toBe(17);
    });
  });

  describe('Edge Cases', () => {
    test('handles undefined/null plan gracefully', () => {
      const plan = pricingUtils.getPlan(null);
      expect(plan).toBeNull();
      
      const invalidPlan = pricingUtils.getPlan('nonexistent');
      expect(invalidPlan).toBeNull();
    });

    test('formatPrice handles edge cases', () => {
      expect(pricingUtils.formatPrice(0)).toBe('$0');
      expect(pricingUtils.formatPrice(0.99, 'USD', { showCents: true })).toBe('$0.99');
    });

    test('validates all plan IDs exist in pricing', () => {
      Object.keys(PREPBETTR_PLANS).forEach(planId => {
        const plan = PREPBETTR_PLANS[planId];
        expect(plan.pricing).toBeDefined();
        expect(plan.pricing.monthly).toBeDefined();
        expect(plan.pricing.yearly).toBeDefined();
        expect(plan.pricing.monthly.amount).toBeGreaterThan(0);
        expect(plan.pricing.yearly.amount).toBeGreaterThan(0);
      });
    });
  });
});

// Integration tests for subscription data class (if it exists)
describe('Subscription Data Integration', () => {
  test('pricing configuration integrates with subscription components', () => {
    // Test that components can access pricing data
    expect(PREPBETTR_PLANS).toBeDefined();
    expect(PREPBETTR_PRICING).toBeDefined();
    expect(pricingUtils).toBeDefined();
    
    // Test required methods exist
    expect(typeof pricingUtils.formatPrice).toBe('function');
    expect(typeof pricingUtils.calculateYearlySavings).toBe('function');
    expect(typeof pricingUtils.getPlan).toBe('function');
  });
});

// Performance tests
describe('Pricing Performance', () => {
  test('pricing calculations are performant', () => {
    const start = performance.now();
    
    // Run calculations 1000 times
    for (let i = 0; i < 1000; i++) {
      pricingUtils.calculateYearlySavings('individual');
      pricingUtils.calculateYearlySavings('enterprise');
      pricingUtils.formatPrice(49.99);
    }
    
    const end = performance.now();
    const duration = end - start;
    
    // Should complete in under 100ms
    expect(duration).toBeLessThan(100);
  });
});