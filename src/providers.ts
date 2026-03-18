import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, LanguageModel } from 'ai';
import { ModelConfig, ProviderConfig } from './config.js';

export interface ModelDetails {
  id: string;
  description?: string;
}

export interface ProviderInstance {
  id: string;
  provider: string;
  models: string[];
  modelDetails: ModelDetails[];
  getModel: (modelId: string) => LanguageModel;
}

type ProviderFactory = (modelId: string) => LanguageModel;

/**
 * Default models for each provider if not specified in config
 */
const DEFAULT_MODELS: Record<string, ModelDetails[]> = {
  openai: [
    {
      id: 'gpt-5.4',
      description: 'OpenAI flagship for complex reasoning, coding, and agentic workflows.',
    },
    {
      id: 'gpt-5.4-mini',
      description: 'Lower-cost GPT-5.4 variant for faster high-throughput tasks.',
    },
    {
      id: 'gpt-5.4-nano',
      description: 'Cheapest GPT-5.4 variant for lightweight summarization and classification.',
    },
  ],
  anthropic: [
    {
      id: 'claude-opus-4-1',
      description: 'Anthropic flagship for advanced reasoning and complex coding work.',
    },
    {
      id: 'claude-sonnet-4-0',
      description: 'Balanced Claude 4 model with strong reasoning and better latency-cost tradeoffs.',
    },
    {
      id: 'claude-3-5-haiku-latest',
      description: 'Fast, lower-cost Anthropic model for simpler high-volume tasks.',
    },
  ],
  google: [
    {
      id: 'gemini-3.1-pro-preview',
      description: 'Latest Gemini 3.1 preview for advanced reasoning, coding, and multimodal work.',
    },
    {
      id: 'gemini-3-flash-preview',
      description: 'Lower-latency Gemini 3 preview for fast multimodal and agentic tasks.',
    },
    {
      id: 'gemini-3.1-flash-lite-preview',
      description: 'Lowest-cost Gemini 3.1 preview for high-volume general-purpose workloads.',
    },
  ],
};

function resolveModels(models: ModelConfig[] | undefined, provider: string): ModelDetails[] {
  const sourceModels = models ?? DEFAULT_MODELS[provider];

  if (!sourceModels) {
    return [];
  }

  return sourceModels.map((model) =>
    typeof model === 'string' ? { id: model } : { ...model }
  );
}

/**
 * Initialize a provider instance based on configuration
 */
export function initializeProvider(config: ProviderConfig): ProviderInstance {
  const modelDetails = resolveModels(config.models, config.provider);
  
  if (modelDetails.length === 0) {
    throw new Error(`No models configured for provider ${config.id} and no default models available`);
  }

  const models = modelDetails.map((model) => model.id);
  
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
    modelDetails,
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
