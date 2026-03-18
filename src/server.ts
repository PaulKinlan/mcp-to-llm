#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadConfig } from './config.js';
import { initializeProvider, promptModel, generateImageFromProvider, ProviderInstance, PromptOptions } from './providers.js';

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

// Validation schema for image generation arguments
const GenerateImageArgsSchema = z.object({
  providerId: z.string().min(1),
  model: z.string().min(1),
  prompt: z.string().min(1),
  n: z.number().int().min(1).max(10).optional(),
  size: z.string().regex(/^\d+x\d+$/).optional(),
  aspectRatio: z.string().regex(/^\d+:\d+$/).optional(),
  seed: z.number().int().optional(),
  saveTo: z.string().min(1).optional(),
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
      
      console.error(`Initialized ${this.providers.size} provider(s)`);
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
          description: 'List all configured LLM providers and their available models. Each model in modelDetails includes a capability field indicating "text" (use with prompt tool) or "image" (use with generate_image tool).',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'prompt',
          description: 'Send a prompt to a configured LLM and get a text response. Only works with models that have capability "text".',
          inputSchema: {
            type: 'object',
            properties: {
              providerId: {
                type: 'string',
                description: 'The ID of the provider instance to use',
              },
              model: {
                type: 'string',
                description: 'The model ID to use (e.g., gpt-5.4, claude-sonnet-4-6, gemini-3.1-pro-preview)',
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
        {
          name: 'generate_image',
          description: 'Generate images using a configured provider and image model. Use the list tool to find models with capability "image". Returns image content blocks.',
          inputSchema: {
            type: 'object',
            properties: {
              providerId: {
                type: 'string',
                description: 'The ID of the provider instance to use',
              },
              model: {
                type: 'string',
                description: 'The image model ID (e.g., gpt-image-1, imagen-4.0-generate-001)',
              },
              prompt: {
                type: 'string',
                description: 'The prompt describing the image to generate',
              },
              n: {
                type: 'number',
                description: 'Number of images to generate (1-10, default 1)',
              },
              size: {
                type: 'string',
                description: 'Image size as WxH (e.g., "1024x1024"). Provider-dependent.',
              },
              aspectRatio: {
                type: 'string',
                description: 'Aspect ratio as W:H (e.g., "16:9"). Provider-dependent.',
              },
              seed: {
                type: 'number',
                description: 'Optional seed for reproducible generation',
              },
              saveTo: {
                type: 'string',
                description: 'Optional file path to save the generated image to (e.g., "/path/to/file.png"). When multiple images are generated, a numeric suffix is added before the extension (e.g., file-0.png, file-1.png). Parent directories are created automatically.',
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

        case 'generate_image':
          return this.handleGenerateImage(args);

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
      modelDetails: p.modelDetails,
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

  private async handleGenerateImage(args: unknown) {
    const validationResult = GenerateImageArgsSchema.safeParse(args);

    if (!validationResult.success) {
      throw new Error(`Invalid arguments: ${validationResult.error.message}`);
    }

    const { providerId, model, prompt, n, size, aspectRatio, seed, saveTo } = validationResult.data;

    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}. Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
    }

    if (!provider.getImageModel) {
      throw new Error(`Provider ${providerId} does not support image generation.`);
    }

    const modelDetail = provider.modelDetails.find((m) => m.id === model);
    if (modelDetail && modelDetail.capability !== 'image') {
      throw new Error(`Model ${model} does not support image generation. Use the 'prompt' tool for text models.`);
    }

    try {
      const images = await generateImageFromProvider(provider, model, prompt, {
        n,
        size,
        aspectRatio,
        seed,
      });

      const mimeToExt: Record<string, string> = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/webp': '.webp',
        'image/gif': '.gif',
      };

      const savedPaths: string[] = [];

      if (saveTo) {
        // Save to user-specified path(s)
        const parsedPath = path.parse(saveTo);
        const dir = parsedPath.dir || '.';
        fs.mkdirSync(dir, { recursive: true });

        images.forEach((img, i) => {
          let filePath: string;
          if (images.length === 1) {
            filePath = saveTo;
          } else {
            filePath = path.join(dir, `${parsedPath.name}-${i}${parsedPath.ext || mimeToExt[img.mimeType] || '.png'}`);
          }
          fs.writeFileSync(filePath, Buffer.from(img.base64, 'base64'));
          savedPaths.push(filePath);
        });
      } else {
        // Fall back to temp directory
        const tmpDir = os.tmpdir();
        images.forEach((img, i) => {
          const ext = mimeToExt[img.mimeType] ?? '.png';
          const filename = `mcp-image-${Date.now()}-${i}${ext}`;
          const filePath = path.join(tmpDir, filename);
          fs.writeFileSync(filePath, Buffer.from(img.base64, 'base64'));
          savedPaths.push(filePath);
        });
      }

      const imageContent = images.map((img) => ({
        type: 'image' as const,
        data: img.base64,
        mimeType: img.mimeType,
        annotations: {
          audience: ['user'] as string[],
          priority: 0.9,
        },
      }));

      const fileList = savedPaths.map((p) => `  - ${p}`).join('\n');
      const savedLabel = saveTo ? 'Saved to:' : 'Saved to temporary file(s):';

      return {
        content: [
          ...imageContent,
          {
            type: 'text' as const,
            text: [
              `Generated ${images.length} image(s) (${images[0].mimeType}).`,
              '',
              savedLabel,
              fileList,
            ].join('\n'),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to generate image: ${error}`);
    }
  }

  async runStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP LLM Server running on stdio');
  }

  async runHttp(port: number = 3000, host: string = '127.0.0.1'): Promise<void> {
    const app = express();
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', providers: this.providers.size });
    });

    // SSE endpoint for MCP
    app.get('/sse', async (req, res) => {
      console.error('Client connected via SSE');
      const transport = new SSEServerTransport('/message', res);
      await this.server.connect(transport);
      
      transport.onclose = () => {
        console.error('Client disconnected from SSE');
      };
    });

    // Message endpoint for MCP
    app.post('/message', async (req, res) => {
      // This endpoint is handled by the SSE transport
      res.status(405).json({ 
        error: 'Direct POST to /message is not supported',
        message: 'Please connect to the SSE endpoint first',
        sseEndpoint: `http://${host}:${port}/sse`
      });
    });

    const server = app.listen(port, host, () => {
      console.error(`MCP LLM Server running on http://${host}:${port}`);
      console.error(`SSE endpoint: http://${host}:${port}/sse`);
      console.error(`Health check: http://${host}:${port}/health`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.error('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.error('Server closed');
        process.exit(0);
      });
    });
  }
}

// Parse command line arguments
function parseArgs(): { mode: 'stdio' | 'http'; port?: number; host?: string } {
  const args = process.argv.slice(2);
  const mode = args.includes('--http') ? 'http' : 'stdio';
  
  let port = 3000;
  let host = '127.0.0.1';

  const portIndex = args.indexOf('--port');
  if (portIndex !== -1 && args[portIndex + 1]) {
    const portValue = args[portIndex + 1];
    port = parseInt(portValue, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error(`Invalid port number: ${portValue}. Port must be between 1 and 65535.`);
      process.exit(1);
    }
  }

  const hostIndex = args.indexOf('--host');
  if (hostIndex !== -1 && args[hostIndex + 1]) {
    host = args[hostIndex + 1];
  }

  return { mode, port, host };
}

// Start the server
const { mode, port, host } = parseArgs();
const server = new LLMServer();

if (mode === 'http') {
  server.runHttp(port, host).catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
} else {
  server.runStdio().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}
