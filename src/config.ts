import { z } from 'zod';
import fs from 'fs';

/**
 * Configuration schema for LLM providers
 */
export const ProviderConfigSchema = z.object({
  id: z.string().describe('Unique identifier for this provider instance'),
  provider: z.enum(['openai', 'anthropic', 'google']).describe('Provider type'),
  apiKey: z.string().describe('API key for the provider'),
  baseURL: z.string().optional().describe('Optional custom base URL'),
  models: z.array(z.string()).optional().describe('Optional list of models to expose'),
});

export const ConfigSchema = z.object({
  providers: z.array(ProviderConfigSchema).describe('List of configured LLM providers'),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load configuration from environment or file
 */
export function loadConfig(): Config {
  const configPath = process.env.MCP_LLM_CONFIG || './config.json';
  
  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    return ConfigSchema.parse(config);
  } catch (error) {
    // If no config file, try to load from environment
    if (process.env.MCP_LLM_PROVIDERS) {
      try {
        const config = JSON.parse(process.env.MCP_LLM_PROVIDERS);
        return ConfigSchema.parse(config);
      } catch (e) {
        throw new Error(`Failed to parse MCP_LLM_PROVIDERS environment variable: ${e}`);
      }
    }
    
    throw new Error(`Failed to load configuration from ${configPath}: ${error}`);
  }
}
