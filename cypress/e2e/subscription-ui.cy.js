// cypress/e2e/subscription-ui.cy.js

/**
 * Cypress E2E Tests for Subscription UI States and Error Handling
 * 
 * Tests cover:
 * - Loading states during PayPal interactions
 * - Success/error state handling
 * - Component rendering and responsiveness
 * - Error boundaries and fallbacks
 * - Network error scenarios
 */

describe('Subscription UI States and Error Handling', () => {
  beforeEach(() => {
    // Set up viewport for desktop testing
    cy.viewport(1280, 720);
    
    // Mock PayPal SDK loading
    cy.window().then((win) => {
      // Mock PayPal SDK
      win.paypal = {
        Buttons: cy.stub().returns({ render: cy.stub() }),
        FUNDING: { PAYPAL: 'paypal', CARD: 'card' },
        VERSION: '6.0.0'
      };
    });

    // Intercept API calls
    cy.intercept('POST', '/api/paypal/create-subscription', {
      fixture: 'subscription-success.json'
    }).as('createSubscription');
    
    cy.intercept('POST', '/api/paypal/webhooks', {
      statusCode: 200,
      body: { success: true }
    }).as('webhook');
  });

  describe('Component Loading States', () => {
    it('displays loading spinner while processing subscription', () => {
      // Visit test subscription page
      cy.visit('/test-subscription');
      
      // Verify test page loads
      cy.get('[data-testid="subscription-testing-lab"]', { timeout: 10000 })
        .should('be.visible');
      
      // Find subscription button component
      cy.get('[data-testid="subscription-button"]')
        .should('exist')
        .within(() => {
          // Click subscription button to trigger loading state
          cy.get('button').contains('Start 7-Day Free Trial').click();
          
          // Verify loading state appears
          cy.get('[data-testid="loading-spinner"]')
            .should('be.visible');
          
          cy.get('button')
            .should('contain', 'Processing...')
            .should('be.disabled');
        });
    });

    it('shows loading state during plan selection', () => {
      cy.visit('/test-subscription');
      
      // Test plan selector loading
      cy.get('[data-testid="plan-selector"]')
        .should('exist')
        .within(() => {
          // Click on enterprise plan
          cy.get('[data-plan="enterprise"]').click();
          
          // Verify plan is selected (visual feedback)
          cy.get('[data-plan="enterprise"]')
            .should('have.class', 'selected')
            .or('have.class', 'ring-2');
        });
    });

    it('displays loading overlay during PayPal popup', () => {
      cy.visit('/test-subscription');
      
      // Mock PayPal button behavior
      cy.window().then((win) => {
        win.paypal.Buttons = cy.stub().callsFake((options) => {
          // Simulate PayPal button creation with loading state
          return {
            render: cy.stub().callsFake((selector) => {
              // Trigger loading state
              if (options.onStart) {
                options.onStart();
              }
              
              setTimeout(() => {
                if (options.onSuccess) {
                  options.onSuccess({ id: 'test-subscription-123' });
                }
              }, 2000);
            })
          };
        });
      });

      cy.get('[data-testid="subscription-button"]')
        .within(() => {
          cy.get('button').click();
          
          // Verify loading overlay appears
          cy.get('[data-testid="loading-overlay"]')
            .should('be.visible');
        });
    });
  });

  describe('Success States', () => {
    it('displays success message after successful subscription', () => {
      cy.visit('/test-subscription');
      
      // Mock successful subscription creation
      cy.intercept('POST', '/api/paypal/create-subscription', {
        statusCode: 201,
        body: {
          success: true,
          subscription: {
            id: 'sub_test_123',
            status: 'active',
            plan_id: 'individual-monthly'
          }
        },
        delay: 1000
      }).as('successfulSubscription');

      cy.get('[data-testid="subscription-button"]')
        .within(() => {
          cy.get('button').click();
          
          // Wait for success state
          cy.wait('@successfulSubscription');
          
          // Verify success message appears
          cy.get('[data-testid="success-message"]', { timeout: 5000 })
            .should('be.visible')
            .should('contain', 'Subscription activated successfully!');
          
          // Verify button shows success state
          cy.get('button')
            .should('contain', 'Subscription Active!')
            .should('have.class', 'success');
        });
    });

    it('shows success banner with subscription details', () => {
      cy.visit('/subscription/success?subscription_id=test_123&plan=individual');
      
      // Verify success banner is displayed
      cy.get('[data-testid="success-banner"]')
        .should('be.visible')
        .within(() => {
          cy.should('contain', 'Welcome to PrepBettr Individual Plan!');
          cy.should('contain', '7-day free trial');
          cy.should('contain', 'test_123');
        });
    });
  });

  describe('Error States and Handling', () => {
    it('displays error message for failed subscription creation', () => {
      cy.visit('/test-subscription');
      
      // Mock subscription creation failure
      cy.intercept('POST', '/api/paypal/create-subscription', {
        statusCode: 400,
        body: {
          success: false,
          error: 'Payment method declined'
        }
      }).as('failedSubscription');

      cy.get('[data-testid="subscription-button"]')
        .within(() => {
          cy.get('button').click();
          
          cy.wait('@failedSubscription');
          
          // Verify error state appears
          cy.get('[data-testid="error-message"]', { timeout: 5000 })
            .should('be.visible')
            .should('contain', 'Something went wrong');
          
          // Verify button shows retry state
          cy.get('button')
            .should('contain', 'Try Again')
            .should('have.class', 'error');
        });
    });

    it('handles network errors gracefully', () => {
      cy.visit('/test-subscription');
      
      // Mock network error
      cy.intercept('POST', '/api/paypal/create-subscription', {
        forceNetworkError: true
      }).as('networkError');

      cy.get('[data-testid="subscription-button"]')
        .within(() => {
          cy.get('button').click();
          
          cy.wait('@networkError');
          
          // Verify network error message
          cy.get('[data-testid="error-message"]')
            .should('contain', 'Network error. Please check your connection.');
        });
    });

    it('shows appropriate error for invalid payment method', () => {
      cy.visit('/test-subscription');
      
      // Mock PayPal error response
      cy.intercept('POST', '/api/paypal/create-subscription', {
        statusCode: 422,
        body: {
          success: false,
          error: 'INVALID_PAYMENT_METHOD',
          message: 'The payment method is invalid'
        }
      }).as('invalidPayment');

      cy.get('[data-testid="subscription-button"]')
        .within(() => {
          cy.get('button').click();
          
          cy.wait('@invalidPayment');
          
          // Verify specific error message
          cy.get('[data-testid="error-message"]')
            .should('contain', 'payment method is invalid');
        });
    });

    it('handles PayPal popup cancellation', () => {
      cy.visit('/subscription/cancel?reason=user_cancelled');
      
      // Verify cancellation message
      cy.get('[data-testid="cancel-message"]')
        .should('be.visible')
        .should('contain', 'Payment was cancelled');
      
      // Verify return to subscription button
      cy.get('[data-testid="return-to-plans"]')
        .should('be.visible')
        .click();
      
      cy.url().should('include', '/subscription');
    });
  });

  describe('Form Validation and Error Prevention', () => {
    it('prevents subscription creation with invalid user data', () => {
      cy.visit('/test-subscription');
      
      // Test with missing email
      cy.get('[data-testid="subscription-button"]')
        .should('contain', 'Sign in required')
        .should('be.disabled');
    });

    it('validates plan selection before payment', () => {
      cy.visit('/test-subscription');
      
      // Ensure a plan is selected
      cy.get('[data-testid="plan-selector"]')
        .within(() => {
          cy.get('[data-plan="individual"]').click();
        });
      
      // Verify subscription button is enabled
      cy.get('[data-testid="subscription-button"]')
        .within(() => {
          cy.get('button').should('not.be.disabled');
        });
    });
  });

  describe('Console Error Monitoring', () => {
    it('should not have uncaught JavaScript errors', () => {
      cy.visit('/test-subscription');
      
      // Check for console errors
      cy.window().then((win) => {
        const errors = [];
        
        // Capture console errors
        win.addEventListener('error', (e) => {
          errors.push(e.error);
        });
        
        // Perform subscription flow
        cy.get('[data-testid="subscription-button"]')
          .within(() => {
            cy.get('button').click();
          });
        
        // Wait a bit for any async errors
        cy.wait(2000).then(() => {
          expect(errors.length).to.equal(0);
        });
      });
    });

    it('handles React error boundaries', () => {
      // Mock a component error
      cy.visit('/test-subscription');
      
      cy.window().then((win) => {
        // Simulate component error
        const errorEvent = new Error('Test component error');
        win.dispatchEvent(new CustomEvent('react-error', { detail: errorEvent }));
      });
      
      // Verify error boundary renders fallback
      cy.get('[data-testid="error-boundary-fallback"]')
        .should('be.visible')
        .should('contain', 'Something went wrong');
    });
  });

  describe('Responsive Design and Mobile States', () => {
    it('handles loading states on mobile viewport', () => {
      cy.viewport('iphone-8');
      cy.visit('/test-subscription');
      
      // Verify components are responsive
      cy.get('[data-testid="plan-selector"]')
        .should('be.visible');
      
      // Test mobile subscription button
      cy.get('[data-testid="subscription-button"]')
        .should('be.visible')
        .within(() => {
          cy.get('button').should('be.visible').click();
          
          // Verify mobile loading state
          cy.get('[data-testid="loading-spinner"]')
            .should('be.visible');
        });
    });

    it('maintains usability on tablet viewport', () => {
      cy.viewport('ipad-2');
      cy.visit('/test-subscription');
      
      // Test plan selection on tablet
      cy.get('[data-testid="plan-selector"]')
        .within(() => {
          cy.get('[data-plan="enterprise"]').click();
        });
      
      // Test pricing toggle
      cy.get('[data-testid="pricing-toggle"]')
        .should('be.visible')
        .within(() => {
          cy.get('input[type="checkbox"]').click();
        });
    });
  });

  describe('Accessibility and State Announcements', () => {
    it('announces loading states to screen readers', () => {
      cy.visit('/test-subscription');
      
      cy.get('[data-testid="subscription-button"]')
        .within(() => {
          cy.get('button').click();
          
          // Verify aria-live regions update
          cy.get('[aria-live="polite"]')
            .should('contain', 'Processing subscription');
        });
    });

    it('provides accessible error messages', () => {
      cy.visit('/test-subscription');
      
      // Mock error response
      cy.intercept('POST', '/api/paypal/create-subscription', {
        statusCode: 400,
        body: { error: 'Test error' }
      });
      
      cy.get('[data-testid="subscription-button"]')
        .within(() => {
          cy.get('button').click();
          
          // Verify error has proper ARIA attributes
          cy.get('[data-testid="error-message"]')
            .should('have.attr', 'role', 'alert')
            .should('have.attr', 'aria-live', 'assertive');
        });
    });
  });

  describe('Performance and Optimization', () => {
    it('loads subscription components within performance budget', () => {
      // Start performance measurement
      cy.window().then((win) => {
        win.performance.mark('subscription-start');
      });
      
      cy.visit('/test-subscription');
      
      // Wait for components to load
      cy.get('[data-testid="plan-selector"]').should('be.visible');
      cy.get('[data-testid="pricing-toggle"]').should('be.visible');
      cy.get('[data-testid="subscription-button"]').should('be.visible');
      
      cy.window().then((win) => {
        win.performance.mark('subscription-end');
        win.performance.measure('subscription-load', 'subscription-start', 'subscription-end');
        
        const measure = win.performance.getEntriesByName('subscription-load')[0];
        
        // Assert loading time is under 3 seconds
        expect(measure.duration).to.be.below(3000);
      });
    });

    it('handles rapid user interactions without breaking', () => {
      cy.visit('/test-subscription');
      
      // Rapidly toggle between plans
      for (let i = 0; i < 5; i++) {
        cy.get('[data-plan="individual"]').click();
        cy.get('[data-plan="enterprise"]').click();
      }
      
      // Rapidly toggle billing cycle
      cy.get('[data-testid="pricing-toggle"]')
        .within(() => {
          for (let i = 0; i < 5; i++) {
            cy.get('input[type="checkbox"]').click();
          }
        });
      
      // Verify UI remains stable
      cy.get('[data-testid="plan-selector"]').should('be.visible');
      cy.get('[data-testid="subscription-button"]')
        .within(() => {
          cy.get('button').should('not.be.disabled');
        });
    });
  });

  describe('State Persistence and Recovery', () => {
    it('recovers gracefully from page refresh during loading', () => {
      cy.visit('/test-subscription');
      
      // Start subscription process
      cy.get('[data-testid="subscription-button"]')
        .within(() => {
          cy.get('button').click();
        });
      
      // Refresh page during loading
      cy.reload();
      
      // Verify page recovers properly
      cy.get('[data-testid="subscription-testing-lab"]')
        .should('be.visible');
      
      // Verify no stuck loading states
      cy.get('[data-testid="loading-spinner"]')
        .should('not.exist');
    });

    it('maintains selected plan after navigation', () => {
      cy.visit('/test-subscription');
      
      // Select enterprise plan
      cy.get('[data-plan="enterprise"]').click();
      
      // Navigate away and back (simulated)
      cy.get('[data-testid="debug-info"]').click();
      
      // Verify plan selection is maintained
      cy.get('[data-plan="enterprise"]')
        .should('have.class', 'selected');
    });
  });
});

// Test fixtures and utilities
describe('Subscription UI Test Utilities', () => {
  beforeEach(() => {
    // Create test fixtures
    cy.task('createTestFixtures');
  });

  it('validates test environment setup', () => {
    cy.visit('/test-subscription');
    
    // Verify test page is accessible in development only
    cy.get('[data-testid="environment-banner"]')
      .should('contain', 'SANDBOX Environment');
    
    // Verify PayPal SDK mock is working
    cy.window().should('have.property', 'paypal');
  });

  it('provides comprehensive component testing interface', () => {
    cy.visit('/test-subscription');
    
    // Verify all test controls are available
    cy.get('[data-testid="test-configuration"]')
      .should('be.visible')
      .within(() => {
        cy.get('select[name="testScenario"]').should('exist');
        cy.get('input[name="billingCycle"]').should('exist');
        cy.get('[data-testid="viewport-controls"]').should('exist');
      });
    
    // Test component preview areas
    cy.get('[data-testid="component-preview"]')
      .should('be.visible')
      .within(() => {
        cy.get('[data-testid="plan-selector-preview"]').should('exist');
        cy.get('[data-testid="pricing-toggle-preview"]').should('exist');
        cy.get('[data-testid="subscription-button-preview"]').should('exist');
        cy.get('[data-testid="subscription-status-preview"]').should('exist');
      });
  });
});

// Custom Cypress commands for subscription testing
Cypress.Commands.add('mockPayPalSDK', () => {
  cy.window().then((win) => {
    win.paypal = {
      Buttons: cy.stub().returns({ render: cy.stub() }),
      FUNDING: { PAYPAL: 'paypal', CARD: 'card' }
    };
  });
});

Cypress.Commands.add('selectSubscriptionPlan', (planType, billingCycle = 'monthly') => {
  cy.get('[data-testid="plan-selector"]')
    .within(() => {
      cy.get(`[data-plan="${planType}"]`).click();
    });
  
  if (billingCycle === 'yearly') {
    cy.get('[data-testid="pricing-toggle"]')
      .within(() => {
        cy.get('input[type="checkbox"]').click();
      });
  }
});

Cypress.Commands.add('waitForSubscriptionProcessing', () => {
  cy.get('[data-testid="loading-spinner"]', { timeout: 10000 })
    .should('be.visible');
  cy.get('[data-testid="loading-spinner"]', { timeout: 30000 })
    .should('not.exist');
});

Cypress.Commands.add('verifyNoConsoleErrors', () => {
  cy.window().then((win) => {
    expect(win.console.error).not.to.have.been.called;
  });
});