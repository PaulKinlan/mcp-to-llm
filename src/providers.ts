import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, LanguageModel } from 'ai';
import { ProviderConfig } from './config.js';

export interface ProviderInstance {
  id: string;
  provider: string;
  models: string[];
  getModel: (modelId: string) => LanguageModel;
}

type ProviderFactory = (modelId: string) => LanguageModel;

/**
 * Default models for each provider if not specified in config
 */
const DEFAULT_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
};

/**
 * Initialize a provider instance based on configuration
 */
export function initializeProvider(config: ProviderConfig): ProviderInstance {
  const models = config.models || DEFAULT_MODELS[config.provider] || [];
  
  let provider: ProviderFactory;
  
  switch (config.provider) {
    case 'openai':
      provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
      break;
    
    case 'anthropic':
      provider = createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
      break;
    
    case 'google':
      provider = createGoogleGenerativeAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
      break;
    
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
  
  return {
    id: config.id,
    provider: config.provider,
    models,
    getModel: (modelId: string) => provider(modelId),
  };
}

export interface PromptOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Generate text using a specific provider and model
 */
export async function promptModel(
  providerInstance: ProviderInstance,
  modelId: string,
  prompt: string,
  options?: PromptOptions
): Promise<string> {
  const model = providerInstance.getModel(modelId);
  
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  
  if (options?.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });
  
  const generateOptions: Parameters<typeof generateText>[0] = {
    model,
    messages,
    ...(options?.temperature !== undefined && { temperature: options.temperature }),
    ...(options?.maxTokens !== undefined && { maxTokens: options.maxTokens }),
  };
  
  const result = await generateText(generateOptions);
  
  return result.text;
}
