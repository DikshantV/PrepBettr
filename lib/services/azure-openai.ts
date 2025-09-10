import { MigrationOpenAIClient as OpenAI } from '@/lib/azure-ai-foundry/clients/migration-wrapper';

// Environment variables for Azure OpenAI configuration
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT;

// Cached OpenAI client instance for reuse
let openAIClient: OpenAI | null = null;

/**
 * Initialize and cache the Azure OpenAI client
 */
async function getOpenAIClient(): Promise<OpenAI> {
  if (openAIClient) {
    return openAIClient;
  }

  // Validate required environment variables
  if (!AZURE_OPENAI_KEY) {
    throw new Error('AZURE_OPENAI_KEY environment variable is required');
  }
  if (!AZURE_OPENAI_ENDPOINT) {
    throw new Error('AZURE_OPENAI_ENDPOINT environment variable is required');
  }
  if (!AZURE_OPENAI_DEPLOYMENT) {
    throw new Error('AZURE_OPENAI_DEPLOYMENT environment variable is required');
  }

  // Create and cache the OpenAI client configured for Azure
  openAIClient = new OpenAI();
  await openAIClient.init(); // Initialize the migration client

  return openAIClient;
}

/**
 * Generate content using Azure OpenAI with centralized error handling
 * 
 * @param prompt - The prompt to send to the AI model
 * @param temperature - Controls randomness (0.0 = deterministic, 1.0 = creative). Default: 0.7
 * @returns Promise resolving to the generated text content
 * 
 * @throws Error with translated user-friendly messages for common issues:
 * - Authentication errors (401, 403)
 * - Rate limiting (429) with retry suggestions
 * - Service unavailable (500, 502, 503, 504)
 * - Content policy violations (400 with content_filter)
 */
export async function generateContent(prompt: string, temperature: number = 0.7): Promise<string> {
  try {
    const client = await getOpenAIClient();
    
    const completion = await client.chat.completions.create({
      model: AZURE_OPENAI_DEPLOYMENT!,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: 1000,
      top_p: 0.9,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content generated from Azure OpenAI');
    }

    return content;
  } catch (error: any) {
    // Centralized error translation for better user experience
    const translatedError = translateAzureOpenAIError(error);
    throw translatedError;
  }
}

/**
 * Translate Azure OpenAI errors into user-friendly messages
 */
function translateAzureOpenAIError(error: any): Error {
  // Network or connection errors
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return new Error('Unable to connect to Azure OpenAI service. Please check your network connection.');
  }

  // Azure OpenAI API errors
  if (error.status) {
    switch (error.status) {
      case 401:
        return new Error('Azure OpenAI authentication failed. Please check your API key.');
      
      case 403:
        return new Error('Access forbidden. Your Azure OpenAI subscription may not have access to this resource.');
      
      case 429:
        const retryAfter = error.headers?.['retry-after'];
        const retryMessage = retryAfter 
          ? ` Please retry after ${retryAfter} seconds.`
          : ' Please try again in a few moments.';
        return new Error(`Azure OpenAI rate limit exceeded.${retryMessage}`);
      
      case 400:
        // Check for content filtering
        if (error.message && error.message.includes('content_filter')) {
          return new Error('Content was filtered by Azure OpenAI content policy. Please modify your request.');
        }
        return new Error(`Bad request: ${error.message || 'Invalid request parameters'}`);
      
      case 404:
        return new Error('Azure OpenAI deployment not found. Please check your deployment name and endpoint.');
      
      case 500:
      case 502:
      case 503:
      case 504:
        return new Error('Azure OpenAI service is temporarily unavailable. Please try again later.');
      
      default:
        return new Error(`Azure OpenAI error (${error.status}): ${error.message || 'Unknown error'}`);
    }
  }

  // Configuration errors
  if (error.message && error.message.includes('environment variable')) {
    return new Error(`Configuration error: ${error.message}`);
  }

  // Generic fallback
  return new Error(`Azure OpenAI error: ${error.message || 'An unexpected error occurred'}`);
}

/**
 * Reset the cached client (useful for testing or credential updates)
 */
export function resetClient(): void {
  openAIClient = null;
}

/**
 * Check if Azure OpenAI is properly configured
 */
export function isConfigured(): boolean {
  return !!(AZURE_OPENAI_KEY && AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_DEPLOYMENT);
}
