// lib/paypal-client.js

import { PayPalApi, LogLevel, Environment } from '@paypal/paypal-server-sdk';
import { PAYPAL_PLANS, getPlanById } from './paypal-config.js';

/**
 * PayPal Client for handling subscriptions and payments
 * Provides utilities for creating plans, subscriptions, and managing webhooks
 */

class PayPalClient {
  constructor() {
    this.client = null;
    this.environment = null;
    this.init();
  }

  /**
   * Initialize PayPal client with credentials from environment variables
   */
  init() {
    try {
      const clientId = process.env.PAYPAL_CLIENT_ID;
      const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
      const mode = process.env.PAYPAL_MODE || 'sandbox';

      if (!clientId || !clientSecret) {
        throw new Error('PayPal credentials are missing. Please check your environment variables.');
      }

      // Set environment based on mode
      this.environment = mode === 'production' ? Environment.Production : Environment.Sandbox;

      // Initialize PayPal client
      this.client = new PayPalApi({
        clientCredentialsAuthCredentials: {
          oAuthClientId: clientId,
          oAuthClientSecret: clientSecret,
        },
        timeout: 0,
        environment: this.environment,
        logging: {
          logLevel: LogLevel.Info,
          logRequest: true,
          logResponse: true,
        },
      });

      console.log(`PayPal client initialized successfully in ${mode} mode`);
    } catch (error) {
      console.error('Failed to initialize PayPal client:', error);
      throw error;
    }
  }

  /**
   * Create a PayPal product (required before creating subscription plans)
   * @param {Object} productData - Product information
   * @returns {Promise<Object>} Created product
   */
  async createProduct(productData) {
    try {
      const { catalogProductsController } = this.client;
      
      const request = {
        body: {
          name: productData.name,
          description: productData.description,
          type: 'SERVICE', // For subscription services
          category: 'SOFTWARE',
          image_url: productData.image_url || '',
          home_url: productData.home_url || process.env.NEXT_PUBLIC_APP_URL || 'https://prepbettr.com'
        }
      };

      const response = await catalogProductsController.createProduct(request);
      
      if (response.statusCode === 201) {
        console.log('Product created successfully:', response.result);
        return response.result;
      } else {
        throw new Error(`Failed to create product: ${response.statusCode}`);
      }
    } catch (error) {
      console.error('Error creating product:', error);
      throw this.handlePayPalError(error);
    }
  }

  /**
   * Create a subscription plan in PayPal
   * @param {string} planKey - Key from PAYPAL_PLANS configuration
   * @param {string} productId - PayPal product ID
   * @returns {Promise<Object>} Created plan
   */
  async createSubscriptionPlan(planKey, productId) {
    try {
      const { subscriptionsController } = this.client;
      const planConfig = PAYPAL_PLANS[planKey];
      
      if (!planConfig) {
        throw new Error(`Plan configuration not found for key: ${planKey}`);
      }

      const planData = {
        ...planConfig.paypal_plan_details,
        product_id: productId
      };

      const request = {
        body: planData
      };

      const response = await subscriptionsController.createPlan(request);
      
      if (response.statusCode === 201) {
        console.log(`Subscription plan created successfully: ${planConfig.name}`, response.result);
        return response.result;
      } else {
        throw new Error(`Failed to create subscription plan: ${response.statusCode}`);
      }
    } catch (error) {
      console.error('Error creating subscription plan:', error);
      throw this.handlePayPalError(error);
    }
  }

  /**
   * Create all subscription plans for a product
   * @param {string} productId - PayPal product ID
   * @returns {Promise<Object>} Object containing all created plans
   */
  async createAllPlans(productId) {
    try {
      const planKeys = Object.keys(PAYPAL_PLANS);
      const createdPlans = {};

      for (const planKey of planKeys) {
        try {
          const plan = await this.createSubscriptionPlan(planKey, productId);
          createdPlans[planKey] = plan;
          
          // Add a small delay between API calls to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Failed to create plan ${planKey}:`, error);
          // Continue with other plans even if one fails
        }
      }

      return createdPlans;
    } catch (error) {
      console.error('Error creating all plans:', error);
      throw error;
    }
  }

  /**
   * Create a subscription
   * @param {Object} subscriptionData - Subscription details
   * @returns {Promise<Object>} Created subscription
   */
  async createSubscription(subscriptionData) {
    try {
      const { subscriptionsController } = this.client;

      const request = {
        body: subscriptionData
      };

      const response = await subscriptionsController.createSubscription(request);
      
      if (response.statusCode === 201) {
        console.log('Subscription created successfully:', response.result);
        return response.result;
      } else {
        throw new Error(`Failed to create subscription: ${response.statusCode}`);
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw this.handlePayPalError(error);
    }
  }

  /**
   * Get subscription details
   * @param {string} subscriptionId - PayPal subscription ID
   * @returns {Promise<Object>} Subscription details
   */
  async getSubscription(subscriptionId) {
    try {
      const { subscriptionsController } = this.client;

      const request = {
        subscriptionId: subscriptionId
      };

      const response = await subscriptionsController.getSubscription(request);
      
      if (response.statusCode === 200) {
        return response.result;
      } else {
        throw new Error(`Failed to get subscription: ${response.statusCode}`);
      }
    } catch (error) {
      console.error('Error getting subscription:', error);
      throw this.handlePayPalError(error);
    }
  }

  /**
   * Cancel a subscription
   * @param {string} subscriptionId - PayPal subscription ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<boolean>} Success status
   */
  async cancelSubscription(subscriptionId, reason = 'User requested cancellation') {
    try {
      const { subscriptionsController } = this.client;

      const request = {
        subscriptionId: subscriptionId,
        body: {
          reason: reason
        }
      };

      const response = await subscriptionsController.cancelSubscription(request);
      
      if (response.statusCode === 204) {
        console.log('Subscription cancelled successfully:', subscriptionId);
        return true;
      } else {
        throw new Error(`Failed to cancel subscription: ${response.statusCode}`);
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw this.handlePayPalError(error);
    }
  }

  /**
   * Suspend a subscription
   * @param {string} subscriptionId - PayPal subscription ID
   * @param {string} reason - Suspension reason
   * @returns {Promise<boolean>} Success status
   */
  async suspendSubscription(subscriptionId, reason = 'Temporary suspension') {
    try {
      const { subscriptionsController } = this.client;

      const request = {
        subscriptionId: subscriptionId,
        body: {
          reason: reason
        }
      };

      const response = await subscriptionsController.suspendSubscription(request);
      
      if (response.statusCode === 204) {
        console.log('Subscription suspended successfully:', subscriptionId);
        return true;
      } else {
        throw new Error(`Failed to suspend subscription: ${response.statusCode}`);
      }
    } catch (error) {
      console.error('Error suspending subscription:', error);
      throw this.handlePayPalError(error);
    }
  }

  /**
   * Activate a suspended subscription
   * @param {string} subscriptionId - PayPal subscription ID
   * @param {string} reason - Activation reason
   * @returns {Promise<boolean>} Success status
   */
  async activateSubscription(subscriptionId, reason = 'Reactivating subscription') {
    try {
      const { subscriptionsController } = this.client;

      const request = {
        subscriptionId: subscriptionId,
        body: {
          reason: reason
        }
      };

      const response = await subscriptionsController.activateSubscription(request);
      
      if (response.statusCode === 204) {
        console.log('Subscription activated successfully:', subscriptionId);
        return true;
      } else {
        throw new Error(`Failed to activate subscription: ${response.statusCode}`);
      }
    } catch (error) {
      console.error('Error activating subscription:', error);
      throw this.handlePayPalError(error);
    }
  }

  /**
   * List subscription transactions
   * @param {string} subscriptionId - PayPal subscription ID
   * @param {string} startTime - Start time for transaction list (ISO 8601)
   * @param {string} endTime - End time for transaction list (ISO 8601)
   * @returns {Promise<Object>} Transaction list
   */
  async getSubscriptionTransactions(subscriptionId, startTime, endTime) {
    try {
      const { subscriptionsController } = this.client;

      const request = {
        subscriptionId: subscriptionId,
        startTime: startTime,
        endTime: endTime
      };

      const response = await subscriptionsController.listTransactionsForSubscription(request);
      
      if (response.statusCode === 200) {
        return response.result;
      } else {
        throw new Error(`Failed to get subscription transactions: ${response.statusCode}`);
      }
    } catch (error) {
      console.error('Error getting subscription transactions:', error);
      throw this.handlePayPalError(error);
    }
  }

  /**
   * Handle PayPal API errors
   * @param {Error} error - Original error
   * @returns {Error} Formatted error
   */
  handlePayPalError(error) {
    if (error.result && error.result.details) {
      // PayPal API error with details
      const details = error.result.details.map(detail => 
        `${detail.issue}: ${detail.description}`
      ).join(', ');
      
      return new Error(`PayPal API Error: ${details}`);
    } else if (error.result && error.result.error_description) {
      // OAuth error
      return new Error(`PayPal OAuth Error: ${error.result.error_description}`);
    } else if (error.message) {
      // Generic error
      return new Error(`PayPal Error: ${error.message}`);
    } else {
      // Unknown error
      return new Error('Unknown PayPal error occurred');
    }
  }

  /**
   * Verify webhook signature (for webhook endpoints)
   * @param {Object} request - Express request object
   * @param {string} webhookId - PayPal webhook ID
   * @returns {Promise<boolean>} Verification result
   */
  async verifyWebhookSignature(request, webhookId) {
    try {
      const { webhooksController } = this.client;

      const headers = request.headers;
      const body = request.body;

      const verifyRequest = {
        body: {
          auth_algo: headers['paypal-auth-algo'],
          cert_id: headers['paypal-cert-id'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: webhookId,
          webhook_event: body
        }
      };

      const response = await webhooksController.verifyWebhookSignature(verifyRequest);
      
      return response.statusCode === 200 && response.result.verification_status === 'SUCCESS';
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }
}

// Create and export singleton instance
const paypalClient = new PayPalClient();

export default paypalClient;

// Export utility functions
export const createSubscriptionPayload = (planId, subscriberInfo, returnUrl, cancelUrl) => {
  return {
    plan_id: planId,
    subscriber: {
      name: subscriberInfo.name ? {
        given_name: subscriberInfo.name.split(' ')[0] || '',
        surname: subscriberInfo.name.split(' ').slice(1).join(' ') || ''
      } : undefined,
      email_address: subscriberInfo.email
    },
    application_context: {
      brand_name: 'PrepBettr',
      locale: 'en-US',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      payment_method: {
        payer_selected: 'PAYPAL',
        payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
      },
      return_url: returnUrl,
      cancel_url: cancelUrl
    }
  };
};

export const getApprovalUrl = (subscription) => {
  const approvalLink = subscription.links?.find(link => link.rel === 'approve');
  return approvalLink?.href || null;
};
