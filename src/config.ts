import { z } from 'zod';
import fs from 'fs';

/**
 * Configuration schema for LLM providers
 */
export const ModelConfigSchema = z.union([
  z.string(),
  z.object({
    id: z.string().describe('Model ID to expose'),
    description: z.string().optional().describe('Optional human-readable description of model capabilities'),
    capability: z.enum(['text', 'image']).optional().describe('Model capability type: text generation or image generation (defaults to text)'),
  }),
]);

export const ProviderConfigSchema = z.object({
  id: z.string().describe('Unique identifier for this provider instance'),
  provider: z.enum(['openai', 'anthropic', 'google']).describe('Provider type'),
  apiKey: z.string().describe('API key for the provider'),
  baseURL: z.string().optional().describe('Optional custom base URL'),
  models: z.array(ModelConfigSchema).optional().describe('Optional list of models to expose'),
});

export const ConfigSchema = z.object({
  providers: z.array(ProviderConfigSchema).describe('List of configured LLM providers'),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

/**
 * Load configuration from environment or file
 */
export function loadConfig(): Config {
  const configPath = process.env.MCP_LLM_CONFIG || './config.json';
  
  // Basic path validation to prevent path traversal
  if (configPath.includes('..')) {
    throw new Error('Invalid configuration path: path traversal not allowed');
  }
  
  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    
    // Validate file size (limit to 1MB to prevent DoS)
    if (configData.length > 1024 * 1024) {
      throw new Error('Configuration file is too large (max 1MB)');
    }
    
    const config = JSON.parse(configData);
    return ConfigSchema.parse(config);
  } catch (error) {
    // If no config file, try to load from environment
    if (process.env.MCP_LLM_PROVIDERS) {
      try {
        const envConfig = process.env.MCP_LLM_PROVIDERS;
        
        // Validate environment variable size (limit to 100KB)
        if (envConfig.length > 100 * 1024) {
          throw new Error('MCP_LLM_PROVIDERS environment variable is too large (max 100KB)');
        }
        
        const config = JSON.parse(envConfig);
        return ConfigSchema.parse(config);
      } catch (e) {
        throw new Error(`Failed to parse MCP_LLM_PROVIDERS environment variable: ${e}`);
      }
    }
    
    throw new Error(`Failed to load configuration from ${configPath}: ${error}`);
  }
}
