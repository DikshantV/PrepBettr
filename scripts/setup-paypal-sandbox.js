#!/usr/bin/env node
// scripts/setup-paypal-sandbox.js

/**
 * PayPal Sandbox Setup Script
 * Creates subscription plans, configures webhooks, and sets up test environment
 */

import { Command } from 'commander';
import { config } from 'dotenv';
import paypalClient from '../lib/paypal-client.js';
import { PAYPAL_PLANS } from '../lib/paypal-config.js';
import { sandboxConfig, SANDBOX_WEBHOOK_CONFIG } from '../lib/paypal-sandbox-config.js';

// Load environment variables
config();

const program = new Command();

program
  .name('setup-paypal-sandbox')
  .description('Setup PayPal sandbox environment for testing')
  .version('1.0.0');

program
  .command('create-product')
  .description('Create PayPal product for subscription plans')
  .action(async () => {
    try {
      console.log('Creating PayPal product...');
      
      const productData = {
        name: 'PrepBettr Subscription Plans',
        description: 'AI-powered career preparation and interview coaching service',
        image_url: 'https://prepbettr.com/logo.png',
        home_url: process.env.NEXT_PUBLIC_APP_URL || 'https://prepbettr.com'
      };

      const product = await paypalClient.createProduct(productData);
      
      console.log('✅ Product created successfully:');
      console.log(`   Product ID: ${product.id}`);
      console.log(`   Name: ${product.name}`);
      console.log('');
      console.log('💡 Add this to your .env file:');
      console.log(`   PAYPAL_PRODUCT_ID=${product.id}`);
      
    } catch (error) {
      console.error('❌ Failed to create product:', error.message);
      process.exit(1);
    }
  });

program
  .command('create-plans')
  .description('Create all subscription plans')
  .requiredOption('-p, --product-id <productId>', 'PayPal product ID')
  .action(async (options) => {
    try {
      console.log('Creating subscription plans...');
      
      const productId = options.productId;
      const plans = await paypalClient.createAllPlans(productId);
      
      console.log('✅ All subscription plans created successfully:');
      console.log('');
      
      // Display results and generate env vars
      const envVars = [];
      Object.entries(plans).forEach(([planKey, plan]) => {
        const config = PAYPAL_PLANS[planKey];
        console.log(`📋 ${config.name}:`);
        console.log(`   Plan ID: ${plan.id}`);
        console.log(`   Price: $${config.price}/${config.billing_cycle.toLowerCase()}`);
        console.log(`   Trial: ${config.trial_period.duration} ${config.trial_period.unit.toLowerCase()}s`);
        console.log('');
        
        envVars.push(`PAYPAL_${planKey}_PLAN_ID=${plan.id}`);
      });
      
      console.log('💡 Add these to your .env file:');
      envVars.forEach(envVar => console.log(`   ${envVar}`));
      
    } catch (error) {
      console.error('❌ Failed to create plans:', error.message);
      process.exit(1);
    }
  });

program
  .command('setup-webhook')
  .description('Setup webhook for subscription events')
  .requiredOption('-u, --url <url>', 'Webhook URL (use ngrok for local development)')
  .action(async (options) => {
    try {
      console.log('Setting up webhook...');
      
      const webhookUrl = options.url;
      const events = SANDBOX_WEBHOOK_CONFIG.events;
      
      // Note: PayPal webhook creation via API requires additional setup
      // For now, provide manual setup instructions
      
      console.log('📝 Manual Webhook Setup Required:');
      console.log('');
      console.log('1. Go to PayPal Developer Dashboard:');
      console.log('   https://developer.paypal.com/');
      console.log('');
      console.log('2. Navigate to your app → Webhooks');
      console.log('');
      console.log('3. Create webhook with these settings:');
      console.log(`   URL: ${webhookUrl}/api/webhooks/paypal`);
      console.log('   Events to subscribe to:');
      events.forEach(event => console.log(`   - ${event}`));
      console.log('');
      console.log('4. Copy the Webhook ID and add to your .env:');
      console.log('   PAYPAL_SANDBOX_WEBHOOK_ID=<webhook-id>');
      console.log('   PAYPAL_SANDBOX_WEBHOOK_URL=' + webhookUrl + '/api/webhooks/paypal');
      console.log('');
      console.log('💡 For local development with ngrok:');
      console.log('   npx ngrok http 3000');
      console.log('   Use the https URL provided by ngrok');
      
    } catch (error) {
      console.error('❌ Failed to setup webhook:', error.message);
      process.exit(1);
    }
  });

program
  .command('test-connection')
  .description('Test PayPal API connection and credentials')
  .action(async () => {
    try {
      console.log('Testing PayPal API connection...');
      
      // Test by creating a minimal product (which we'll delete)
      const testProduct = {
        name: 'API Connection Test',
        description: 'Test product for API connection validation',
        type: 'SERVICE',
        category: 'SOFTWARE'
      };
      
      const { catalogProductsController } = paypalClient.client;
      const response = await catalogProductsController.createProduct({
        body: testProduct
      });
      
      if (response.statusCode === 201) {
        console.log('✅ PayPal API connection successful');
        console.log(`   Environment: ${sandboxConfig.mode}`);
        console.log(`   Client ID: ${sandboxConfig.clientId.substring(0, 8)}...`);
        
        // Clean up test product
        console.log('🧹 Cleaning up test product...');
        // Note: PayPal doesn't provide direct product deletion in sandbox
        // Test product will remain but won't interfere with anything
      } else {
        throw new Error(`API test failed with status: ${response.statusCode}`);
      }
      
    } catch (error) {
      console.error('❌ PayPal API connection failed:', error.message);
      console.log('');
      console.log('💡 Check your environment variables:');
      console.log('   PAYPAL_CLIENT_ID');
      console.log('   PAYPAL_CLIENT_SECRET');
      console.log('   PAYPAL_MODE=sandbox');
      process.exit(1);
    }
  });

program
  .command('validate-config')
  .description('Validate current PayPal configuration')
  .action(async () => {
    try {
      console.log('Validating PayPal configuration...');
      
      // Check environment variables
      const requiredVars = [
        'PAYPAL_CLIENT_ID',
        'PAYPAL_CLIENT_SECRET'
      ];
      
      const missingVars = requiredVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        console.error('❌ Missing required environment variables:');
        missingVars.forEach(varName => console.log(`   ${varName}`));
        process.exit(1);
      }
      
      // Validate sandbox config
      try {
        sandboxConfig.validateConfig();
        console.log('✅ Configuration validation passed');
      } catch (error) {
        console.warn('⚠️  Configuration validation warnings:');
        console.log(`   ${error.message}`);
      }
      
      // Check plan IDs
      console.log('');
      console.log('📋 Plan ID Configuration:');
      Object.entries(PAYPAL_PLANS).forEach(([key, plan]) => {
        const hasEnvVar = process.env[`PAYPAL_${key}_PLAN_ID`];
        const status = hasEnvVar ? '✅' : '❌';
        console.log(`   ${status} ${plan.name}: ${hasEnvVar || 'Not configured'}`);
      });
      
      // Check webhook configuration
      console.log('');
      console.log('🔗 Webhook Configuration:');
      const webhookId = process.env.PAYPAL_SANDBOX_WEBHOOK_ID;
      const webhookUrl = process.env.PAYPAL_SANDBOX_WEBHOOK_URL;
      
      console.log(`   ${webhookId ? '✅' : '❌'} Webhook ID: ${webhookId || 'Not configured'}`);
      console.log(`   ${webhookUrl ? '✅' : '❌'} Webhook URL: ${webhookUrl || 'Not configured'}`);
      
    } catch (error) {
      console.error('❌ Configuration validation failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('create-test-subscription')
  .description('Create a test subscription for manual testing')
  .requiredOption('-p, --plan <plan>', 'Plan key (INDIVIDUAL_MONTHLY, INDIVIDUAL_YEARLY, etc.)')
  .option('-a, --account <account>', 'Test account type (BUYER_US, BUYER_EU)', 'BUYER_US')
  .action(async (options) => {
    try {
      console.log(`Creating test subscription for plan: ${options.plan}`);
      
      const { PayPalTestUtils } = await import('../tests/factories/subscription-factories.js');
      
      const result = await PayPalTestUtils.createTestSubscription(
        options.plan,
        options.account
      );
      
      console.log('✅ Test subscription created successfully:');
      console.log(`   Subscription ID: ${result.subscription.id}`);
      console.log(`   Status: ${result.subscription.status}`);
      console.log(`   Plan: ${options.plan}`);
      console.log(`   Account: ${options.account}`);
      console.log('');
      console.log('🔗 Complete subscription approval:');
      console.log(`   ${result.approvalUrl}`);
      console.log('');
      console.log('💡 Use PayPal sandbox test credentials to complete payment');
      
    } catch (error) {
      console.error('❌ Failed to create test subscription:', error.message);
      process.exit(1);
    }
  });

program
  .command('generate-env-template')
  .description('Generate .env template with all required PayPal variables')
  .action(() => {
    console.log('# PayPal Configuration');
    console.log('# Copy this template to your .env file and fill in the values');
    console.log('');
    console.log('# PayPal API Credentials');
    console.log('PAYPAL_CLIENT_ID=your_paypal_client_id');
    console.log('PAYPAL_CLIENT_SECRET=your_paypal_client_secret');
    console.log('PAYPAL_MODE=sandbox');
    console.log('');
    console.log('# PayPal Product ID (created with setup-paypal-sandbox create-product)');
    console.log('PAYPAL_PRODUCT_ID=your_product_id');
    console.log('');
    console.log('# PayPal Subscription Plan IDs (created with setup-paypal-sandbox create-plans)');
    Object.keys(PAYPAL_PLANS).forEach(planKey => {
      console.log(`PAYPAL_${planKey}_PLAN_ID=your_plan_id`);
    });
    console.log('');
    console.log('# PayPal Webhook Configuration');
    console.log('PAYPAL_SANDBOX_WEBHOOK_ID=your_webhook_id');
    console.log('PAYPAL_SANDBOX_WEBHOOK_URL=https://your-domain.com/api/webhooks/paypal');
    console.log('');
    console.log('# PayPal Test Account Credentials');
    console.log('PAYPAL_SANDBOX_BUSINESS_EMAIL=your_business_test_email');
    console.log('PAYPAL_SANDBOX_BUSINESS_PASSWORD=your_business_test_password');
    console.log('PAYPAL_SANDBOX_BUYER_US_EMAIL=your_buyer_us_test_email');
    console.log('PAYPAL_SANDBOX_BUYER_US_PASSWORD=your_buyer_us_test_password');
    console.log('PAYPAL_SANDBOX_BUYER_EU_EMAIL=your_buyer_eu_test_email');
    console.log('PAYPAL_SANDBOX_BUYER_EU_PASSWORD=your_buyer_eu_test_password');
    console.log('');
    console.log('# Testing Configuration');
    console.log('RUN_PAYPAL_LIVE_TESTS=false');
    console.log('PAYPAL_TEST_SUBSCRIPTION_ID=existing_test_subscription_id');
  });

program
  .command('setup-all')
  .description('Complete setup: product, plans, and webhook instructions')
  .option('-w, --webhook-url <url>', 'Webhook URL for setup')
  .action(async (options) => {
    try {
      console.log('🚀 Starting complete PayPal sandbox setup...');
      console.log('');
      
      // Step 1: Create product
      console.log('Step 1: Creating product...');
      const productData = {
        name: 'PrepBettr Subscription Plans',
        description: 'AI-powered career preparation and interview coaching service',
        image_url: 'https://prepbettr.com/logo.png',
        home_url: process.env.NEXT_PUBLIC_APP_URL || 'https://prepbettr.com'
      };
      
      const product = await paypalClient.createProduct(productData);
      console.log(`✅ Product created: ${product.id}`);
      console.log('');
      
      // Step 2: Create all plans
      console.log('Step 2: Creating subscription plans...');
      const plans = await paypalClient.createAllPlans(product.id);
      console.log(`✅ Created ${Object.keys(plans).length} subscription plans`);
      console.log('');
      
      // Step 3: Display results
      console.log('📋 Setup Summary:');
      console.log('');
      console.log('Environment Variables:');
      console.log(`PAYPAL_PRODUCT_ID=${product.id}`);
      
      Object.entries(plans).forEach(([planKey, plan]) => {
        console.log(`PAYPAL_${planKey}_PLAN_ID=${plan.id}`);
      });
      console.log('');
      
      // Step 4: Webhook setup instructions
      if (options.webhookUrl) {
        console.log('Step 3: Webhook Setup Instructions:');
        console.log('');
        console.log('Manual webhook setup required:');
        console.log('1. Go to https://developer.paypal.com/');
        console.log('2. Navigate to your app → Webhooks');
        console.log(`3. Create webhook with URL: ${options.webhookUrl}/api/webhooks/paypal`);
        console.log('4. Subscribe to these events:');
        SANDBOX_WEBHOOK_CONFIG.events.forEach(event => console.log(`   - ${event}`));
        console.log('5. Copy the Webhook ID to your .env file');
        console.log('');
      }
      
      console.log('🎉 Setup complete! Update your .env file with the values above.');
      
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    }
  });

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Parse command line arguments
program.parse();