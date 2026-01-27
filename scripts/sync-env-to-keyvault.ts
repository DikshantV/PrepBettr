import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

const envPathArgIndex = process.argv.indexOf("--env");
const vaultArgIndex = process.argv.indexOf("--vault");
const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

const envPath = envPathArgIndex >= 0 ? process.argv[envPathArgIndex + 1] : ".env.local";
const vaultUri = vaultArgIndex >= 0 
  ? process.argv[vaultArgIndex + 1] 
  : process.env.AZURE_KEY_VAULT_URI || "https://prepbettr-keyvault-083.vault.azure.net/";

if (!vaultUri) {
  console.error("❌ Missing Key Vault URI. Pass --vault https://... or set AZURE_KEY_VAULT_URI");
  process.exit(1);
}

const envFile = path.resolve(process.cwd(), envPath);
if (!fs.existsSync(envFile)) {
  console.error(`❌ Env file not found: ${envFile}`);
  process.exit(1);
}

console.log(`📄 Reading environment from: ${envPath}`);
console.log(`🔐 Key Vault URI: ${vaultUri}`);
console.log(`🔧 Mode: ${dryRun ? "DRY RUN" : force ? "FORCE OVERWRITE" : "SKIP EXISTING"}\n`);

dotenv.config({ path: envFile });

// Mapping from .env.local variable names to Key Vault secret names
const map: Record<string, string[]> = {
  // Azure OpenAI
  AZURE_OPENAI_KEY: ["azure-openai-key"],
  AZURE_OPENAI_ENDPOINT: ["azure-openai-endpoint"],
  AZURE_OPENAI_DEPLOYMENT: ["azure-openai-deployment"],
  NEXT_PUBLIC_AZURE_OPENAI_API_KEY: ["next-public-azure-openai-api-key"],
  NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT: ["next-public-azure-openai-endpoint"],
  
  // Azure Speech Services
  NEXT_PUBLIC_SPEECH_KEY: ["azure-speech-key", "speech-key", "NEXT-PUBLIC-SPEECH-KEY"],
  NEXT_PUBLIC_SPEECH_ENDPOINT: ["azure-speech-endpoint", "speech-endpoint", "NEXT-PUBLIC-SPEECH-ENDPOINT"],
  NEXT_PUBLIC_SPEECH_REGION: ["azure-speech-region", "speech-region", "NEXT-PUBLIC-SPEECH-REGION"],
  
  // Azure Document Intelligence / Form Recognizer
  AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: ["azure-form-recognizer-endpoint", "form-recognizer-endpoint", "azure-foundry-docint-endpoint"],
  AZURE_DOCUMENT_INTELLIGENCE_KEY: ["azure-form-recognizer-key", "form-recognizer-key", "azure-foundry-docint-key"],
  AZURE_FOUNDRY_PROJECT_ID: ["azure-foundry-project-id"],
  
  // SendGrid
  SENDGRID_API_KEY: ["sendgrid-api-key"],
  SENDGRID_FROM_EMAIL: ["sendgrid-from-email"],
  SENDGRID_WEBHOOK_SECRET: ["sendgrid-webhook-secret"],
  
  // Dodo Payments
  DODO_API_KEY: ["dodo-api-key"],
  
  // Firebase Admin SDK
  FIREBASE_PROJECT_ID: ["firebase-project-id"],
  FIREBASE_CLIENT_EMAIL: ["firebase-client-email"],
  FIREBASE_PRIVATE_KEY: ["firebase-private-key"],
  FIREBASE_SERVICE_ACCOUNT_KEY: ["firebase-service-account-key"],
  
  // Firebase Client (Public)
  NEXT_PUBLIC_FIREBASE_API_KEY: ["next-public-firebase-api-key", "NEXT-PUBLIC-FIREBASE-CLIENT-KEY"],
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ["next-public-firebase-auth-domain"],
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: ["next-public-firebase-project-id"],
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: ["next-public-firebase-storage-bucket"],
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ["next-public-firebase-messaging-sender-id"],
  NEXT_PUBLIC_FIREBASE_APP_ID: ["next-public-firebase-app-id"],
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: ["next-public-firebase-measurement-id"],
  
  // Azure Storage
  AZURE_STORAGE_ACCOUNT: ["azure-storage-account", "storage-account-name"],
  AZURE_STORAGE_ACCOUNT_KEY: ["azure-storage-account-key", "storage-account-key"],
  AZURE_STORAGE_CONNECTION_STRING: ["azure-storage-connection-string", "storage-connection-string"],
  AZURE_STORAGE_CONTAINER: ["azure-storage-container"],
  STORAGE_PROVIDER: ["storage-provider"],
  
  // Google OAuth
  GOOGLE_CLIENT_ID_SUFFIX: ["google-client-id"],
  GOOGLE_CLIENT_SECRET: ["google-client-secret"],
  
  // PayPal
  PAYPAL_CLIENT_ID: ["paypal-client-id"],
  PAYPAL_CLIENT_SECRET: ["paypal-client-secret"],
  PAYPAL_MODE: ["paypal-mode"],
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: ["next-public-paypal-client-id"],
  
  // Application Settings
  NEXT_PUBLIC_APP_URL: ["next-public-app-url"],
  NEXTAUTH_URL: ["nextauth-url"],
  
  // Node/Runtime Settings
  GRPC_VERBOSITY: ["grpc-verbosity"],
  NODE_OPTIONS: ["node-options"],
  FIRESTORE_PREFER_REST: ["firestore-prefer-rest"],
  NEXT_PUBLIC_BYPASS_FIREBASE_NETWORK_CHECK: ["next-public-bypass-firebase-network-check"],
  
  // Azure Key Vault (for reference)
  AZURE_KEY_VAULT_URI: ["azure-key-vault-uri"],
};

const credential = new DefaultAzureCredential();
const client = new SecretClient(vaultUri, credential);

let successCount = 0;
let skipCount = 0;
let errorCount = 0;

async function setIfPresent(envKey: string, targetNames: string[]) {
  const val = process.env[envKey];
  if (!val) {
    console.log(`⏭️  Skip (not set in .env.local): ${envKey}`);
    return;
  }

  for (const name of targetNames) {
    try {
      // Check if secret already exists
      if (!force) {
        try {
          const existing = await client.getSecret(name);
          if (existing && existing.value !== undefined) {
            if (!dryRun) {
              console.log(`✓ Skip (exists): ${name}`);
              skipCount++;
            } else {
              console.log(`[DRY RUN] Would skip (exists): ${name}`);
            }
            continue;
          }
        } catch (err: any) {
          // Secret doesn't exist, continue to create it
          if (err.code !== "SecretNotFound") {
            throw err;
          }
        }
      }

      if (dryRun) {
        console.log(`[DRY RUN] Would set: ${name} from ${envKey}`);
      } else {
        await client.setSecret(name, val);
        console.log(`✅ Set: ${name} from ${envKey}`);
        successCount++;
      }
    } catch (err: any) {
      console.error(`❌ Failed to set ${name} from ${envKey}:`, err?.message || err);
      errorCount++;
    }
  }
}

(async () => {
  console.log("🚀 Starting Key Vault sync...\n");

  for (const [envKey, targets] of Object.entries(map)) {
    await setIfPresent(envKey, targets);
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Sync Summary:");
  console.log("=".repeat(60));
  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes were made");
  } else {
    console.log(`✅ Secrets set: ${successCount}`);
    console.log(`⏭️  Secrets skipped: ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
  }
  console.log("=".repeat(60));

  if (errorCount > 0) {
    console.error("\n❌ Sync completed with errors");
    process.exit(1);
  } else {
    console.log("\n✅ Sync completed successfully");
  }
})();
