import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, generateImage, LanguageModel } from 'ai';
import type { ImageModelV3 } from '@ai-sdk/provider';
import { ModelConfig, ProviderConfig } from './config.js';

export interface ModelDetails {
  id: string;
  description?: string;
  capability: 'text' | 'image';
}

export interface ProviderInstance {
  id: string;
  provider: string;
  models: string[];
  modelDetails: ModelDetails[];
  getModel: (modelId: string) => LanguageModel;
  getImageModel?: (modelId: string) => ImageModelV3;
}

type ProviderFactory = (modelId: string) => LanguageModel;
type ImageProviderFactory = (modelId: string) => ImageModelV3;

/**
 * Default models for each provider if not specified in config
 */
const DEFAULT_MODELS: Record<string, ModelDetails[]> = {
  openai: [
    {
      id: 'gpt-5.4',
      description: 'OpenAI flagship for complex reasoning, coding, and agentic workflows.',
      capability: 'text',
    },
    {
      id: 'gpt-5.4-mini',
      description: 'Lower-cost GPT-5.4 variant for faster high-throughput tasks.',
      capability: 'text',
    },
    {
      id: 'gpt-5.4-nano',
      description: 'Cheapest GPT-5.4 variant for lightweight summarization and classification.',
      capability: 'text',
    },
    {
      id: 'gpt-image-1',
      description: 'OpenAI flagship image generation model.',
      capability: 'image',
    },
  ],
  anthropic: [
    {
      id: 'claude-opus-4-6',
      description: 'Anthropic flagship for the most complex reasoning, coding, and agentic work.',
      capability: 'text',
    },
    {
      id: 'claude-sonnet-4-6',
      description: 'Anthropic balanced model with the best speed-intelligence tradeoff for general use.',
      capability: 'text',
    },
    {
      id: 'claude-haiku-4-5',
      description: 'Anthropic fastest model for lower-cost, high-volume tasks with strong baseline intelligence.',
      capability: 'text',
    },
  ],
  google: [
    {
      id: 'gemini-3.1-pro-preview',
      description: 'Latest Gemini 3.1 preview for advanced reasoning, coding, and multimodal work.',
      capability: 'text',
    },
    {
      id: 'gemini-3-flash-preview',
      description: 'Lower-latency Gemini 3 preview for fast multimodal and agentic tasks.',
      capability: 'text',
    },
    {
      id: 'gemini-3.1-flash-lite-preview',
      description: 'Lowest-cost Gemini 3.1 preview for high-volume general-purpose workloads.',
      capability: 'text',
    },
    {
      id: 'gemini-2.5-flash-image',
      description: 'Gemini Nano Banana — fast, low-cost native image generation and editing.',
      capability: 'image',
    },
    {
      id: 'gemini-3-pro-image-preview',
      description: 'Gemini Nano Banana Pro — highest-quality native image generation with advanced reasoning.',
      capability: 'image',
    },
    {
      id: 'gemini-3.1-flash-image-preview',
      description: 'Gemini Nano Banana 2 — native image generation with 4K resolution support.',
      capability: 'image',
    },
    {
      id: 'imagen-4.0-generate-001',
      description: 'Google Imagen 4 standard dedicated image generation.',
      capability: 'image',
    },
  ],
};

function resolveModels(models: ModelConfig[] | undefined, provider: string): ModelDetails[] {
  const sourceModels = models ?? DEFAULT_MODELS[provider];

  if (!sourceModels) {
    return [];
  }

  return sourceModels.map((model) =>
    typeof model === 'string'
      ? { id: model, capability: 'text' as const }
      : { id: model.id, description: model.description, capability: model.capability ?? 'text' }
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

  let languageProvider: ProviderFactory;
  let imageProvider: ImageProviderFactory | undefined;

  switch (config.provider) {
    case 'openai': {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
      languageProvider = openai;
      imageProvider = (modelId: string) => openai.image(modelId);
      break;
    }

    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
      languageProvider = anthropic;
      break;
    }

    case 'google': {
      const google = createGoogleGenerativeAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
      languageProvider = google;
      imageProvider = (modelId: string) => google.image(modelId);
      break;
    }

    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }

  return {
    id: config.id,
    provider: config.provider,
    models,
    modelDetails,
    getModel: (modelId: string) => languageProvider(modelId),
    ...(imageProvider && { getImageModel: imageProvider }),
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

export interface GenerateImageOptions {
  n?: number;
  size?: string;
  aspectRatio?: string;
  seed?: number;
}

export interface GeneratedImageResult {
  base64: string;
  mediaType: string;
}

/**
 * Generate images using a specific provider and image model
 */
export async function generateImageFromProvider(
  providerInstance: ProviderInstance,
  modelId: string,
  prompt: string,
  options?: GenerateImageOptions,
): Promise<GeneratedImageResult[]> {
  if (!providerInstance.getImageModel) {
    throw new Error(`Provider ${providerInstance.id} does not support image generation`);
  }

  const model = providerInstance.getImageModel(modelId);

  const result = await generateImage({
    model,
    prompt,
    ...(options?.n !== undefined && { n: options.n }),
    ...(options?.size !== undefined && { size: options.size as `${number}x${number}` }),
    ...(options?.aspectRatio !== undefined && { aspectRatio: options.aspectRatio as `${number}:${number}` }),
    ...(options?.seed !== undefined && { seed: options.seed }),
  });

  return result.images.map((img) => ({
    base64: img.base64,
    mediaType: img.mediaType,
  }));
}
