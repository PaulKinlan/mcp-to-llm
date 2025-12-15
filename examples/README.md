# Examples

This directory contains example code demonstrating how to use the mcp-to-llm server.

## Client Example

The `client-example.ts` demonstrates how to:
- Connect to the MCP server programmatically
- List available providers and models
- Send prompts to configured LLMs

### Running the Example

```bash
# Make sure the server is built
npm run build

# Run the example
npx tsx examples/client-example.ts
```

### What to Expect

The example will:
1. Connect to the MCP server
2. List all available tools
3. Query all configured providers
4. Attempt to send a test prompt

If you're using test API keys, the prompt call will fail with an authentication error - this is expected. With valid API keys, you'll see actual LLM responses.

## Creating Your Own Client

Here's a minimal example of using the MCP server:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Create transport
const transport = new StdioClientTransport({
  command: 'node',
  args: ['/path/to/mcp-to-llm/dist/server.js'],
  env: {
    MCP_LLM_CONFIG: '/path/to/config.json'
  }
});

// Create and connect client
const client = new Client({
  name: 'my-client',
  version: '1.0.0',
}, { capabilities: {} });

await client.connect(transport);

// Use the tools
const providers = await client.callTool({ name: 'list', arguments: {} });
const response = await client.callTool({ 
  name: 'prompt', 
  arguments: {
    providerId: 'openai-primary',
    model: 'gpt-4o',
    prompt: 'Hello!'
  }
});

await client.close();
```

## Additional Examples

For more examples of MCP integration patterns, see:
- [MCP Documentation](https://modelcontextprotocol.io/)
- [Claude Desktop Integration](../SETUP.md#using-with-claude-desktop)
