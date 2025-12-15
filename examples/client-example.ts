#!/usr/bin/env node

/**
 * Example MCP client that demonstrates how to use the mcp-to-llm server
 * 
 * This example shows:
 * 1. How to connect to the server
 * 2. How to list available providers
 * 3. How to send prompts to different LLMs
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function main() {
  console.log('Starting MCP client example...\n');

  // Create transport to the server
  const transport = new StdioClientTransport({
    command: 'node',
    args: [join(projectRoot, 'dist', 'server.js')],
    env: {
      ...process.env,
      MCP_LLM_CONFIG: join(projectRoot, 'config.json')
    }
  });

  // Create client
  const client = new Client({
    name: 'mcp-to-llm-example-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  try {
    // Connect to server
    console.log('Connecting to MCP server...');
    await client.connect(transport);
    console.log('✓ Connected to server\n');

    // List available tools
    console.log('Listing available tools...');
    const tools = await client.listTools();
    console.log('Available tools:');
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log();

    // Example 1: List all providers
    console.log('Example 1: Listing all configured providers');
    console.log('='.repeat(50));
    const listResult = await client.callTool({
      name: 'list',
      arguments: {}
    });
    
    if (listResult.content[0].type === 'text') {
      const providers = JSON.parse(listResult.content[0].text);
      console.log('Configured providers:');
      providers.forEach((provider: any) => {
        console.log(`\n  Provider: ${provider.id}`);
        console.log(`  Type: ${provider.provider}`);
        console.log(`  Models: ${provider.models.join(', ')}`);
      });
      console.log('\n');

      // Example 2: Send a prompt (if providers are configured)
      if (providers.length > 0) {
        const firstProvider = providers[0];
        const firstModel = firstProvider.models[0];
        
        console.log('Example 2: Sending a prompt');
        console.log('='.repeat(50));
        console.log(`Using provider: ${firstProvider.id}`);
        console.log(`Using model: ${firstModel}`);
        console.log('Prompt: "What is 2+2?"');
        console.log();

        try {
          const promptResult = await client.callTool({
            name: 'prompt',
            arguments: {
              providerId: firstProvider.id,
              model: firstModel,
              prompt: 'What is 2+2? Answer in one sentence.',
              temperature: 0.1
            }
          });

          if (promptResult.content[0].type === 'text') {
            console.log('Response:');
            console.log(promptResult.content[0].text);
            console.log();
          }
        } catch (error) {
          console.log('Note: Prompt call failed (expected if using test API keys)');
          console.log(`Error: ${error}`);
          console.log();
        }
      }
    }

    console.log('✓ Example completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
