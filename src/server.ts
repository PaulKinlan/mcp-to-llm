#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { loadConfig } from './config.js';
import { initializeProvider, promptModel, ProviderInstance, PromptOptions } from './providers.js';

interface PromptArgs extends PromptOptions {
  providerId: string;
  model: string;
  prompt: string;
}

// Validation schema for prompt arguments
const PromptArgsSchema = z.object({
  providerId: z.string().min(1),
  model: z.string().min(1),
  prompt: z.string().min(1),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
});

/**
 * MCP Server for LLM access via AI SDK
 */
class LLMServer {
  private server: Server;
  private providers: Map<string, ProviderInstance> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-to-llm',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    try {
      const config = loadConfig();
      
      for (const providerConfig of config.providers) {
        const provider = initializeProvider(providerConfig);
        this.providers.set(provider.id, provider);
      }
      
      console.log(`Initialized ${this.providers.size} provider(s)`);
    } catch (error) {
      console.error('Failed to load configuration:', error);
      process.exit(1);
    }
  }

  private setupHandlers(): void {
    // Handler for listing available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list',
          description: 'List all configured LLM providers and their available models',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'prompt',
          description: 'Send a prompt to a configured LLM and get a response',
          inputSchema: {
            type: 'object',
            properties: {
              providerId: {
                type: 'string',
                description: 'The ID of the provider instance to use',
              },
              model: {
                type: 'string',
                description: 'The model ID to use (e.g., gpt-4o, claude-3-5-sonnet-20241022)',
              },
              prompt: {
                type: 'string',
                description: 'The prompt to send to the LLM',
              },
              systemPrompt: {
                type: 'string',
                description: 'Optional system prompt to set context',
              },
              temperature: {
                type: 'number',
                description: 'Optional temperature for response randomness (0.0-2.0)',
              },
              maxTokens: {
                type: 'number',
                description: 'Optional maximum number of tokens to generate',
              },
            },
            required: ['providerId', 'model', 'prompt'],
          },
        },
      ],
    }));

    // Handler for tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'list':
          return this.handleList();
        
        case 'prompt':
          return this.handlePrompt(args);
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private handleList() {
    const providersList = Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      provider: p.provider,
      models: p.models,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(providersList, null, 2),
        },
      ],
    };
  }

  private async handlePrompt(args: unknown) {
    // Validate arguments with Zod schema
    const validationResult = PromptArgsSchema.safeParse(args);
    
    if (!validationResult.success) {
      throw new Error(`Invalid arguments: ${validationResult.error.message}`);
    }

    const { providerId, model, prompt, systemPrompt, temperature, maxTokens } = validationResult.data;

    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}. Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
    }

    if (!provider.models.includes(model)) {
      throw new Error(`Model ${model} not available for provider ${providerId}. Available models: ${provider.models.join(', ')}`);
    }

    try {
      const response = await promptModel(provider, model, prompt, {
        systemPrompt,
        temperature,
        maxTokens,
      });

      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to prompt model: ${error}`);
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP LLM Server running on stdio');
  }
}

// Start the server
const server = new LLMServer();
server.run().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
