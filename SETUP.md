# Setup Guide

This guide will help you set up and use the mcp-to-llm server with various MCP clients.

## Initial Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/PaulKinlan/mcp-to-llm.git
   cd mcp-to-llm
   npm install
   npm run build
   ```

2. **Create Configuration File**
   
   Copy the example configuration:
   ```bash
   cp config.example.json config.json
   ```

   Edit `config.json` with your API keys:
   ```json
   {
     "providers": [
       {
         "id": "openai-primary",
         "provider": "openai",
         "apiKey": "sk-...",
         "models": ["gpt-4o", "gpt-4o-mini"]
       },
       {
         "id": "anthropic-primary",
         "provider": "anthropic",
         "apiKey": "sk-ant-...",
         "models": ["claude-3-5-sonnet-20241022"]
       }
     ]
   }
   ```

## Using with Claude Desktop

Add the server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcp-to-llm": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-to-llm/dist/server.js"],
      "env": {
        "MCP_LLM_CONFIG": "/absolute/path/to/mcp-to-llm/config.json"
      }
    }
  }
}
```

After updating the configuration, restart Claude Desktop.

## Using with Other MCP Clients

The server supports two transport modes: **stdio** (for local processes) and **HTTP/SSE** (for web services).

### Stdio Transport

The server uses stdio transport and can be integrated with any MCP-compatible client. Here's a generic example:

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/path/to/mcp-to-llm/dist/server.js'],
  env: {
    MCP_LLM_CONFIG: '/path/to/config.json'
  }
});

const client = new Client({
  name: 'my-client',
  version: '1.0.0',
}, {
  capabilities: {}
});

await client.connect(transport);

// List available providers
const listResult = await client.callTool({
  name: 'list',
  arguments: {}
});

// Send a prompt
const promptResult = await client.callTool({
  name: 'prompt',
  arguments: {
    providerId: 'openai-primary',
    model: 'gpt-4o',
    prompt: 'Hello, how are you?',
    temperature: 0.7
  }
});
```

### HTTP/SSE Transport

For hosting as a web service, use the HTTP transport mode:

```bash
# Start server on default port (3000)
npm run start:http

# Or with custom port and host
node dist/server.js --http --port 8080 --host 0.0.0.0
```

The HTTP server provides:
- **SSE endpoint**: `http://host:port/sse` - Connect MCP clients here
- **Health check**: `http://host:port/health` - Monitor server status

To connect an MCP client to the HTTP server, use the SSE endpoint URL instead of stdio transport. The exact integration depends on your MCP client implementation.

**Example with curl (health check)**:
```bash
curl http://127.0.0.1:3000/health
```

Response:
```json
{
  "status": "ok",
  "providers": 2
}
```

## Usage Examples

### Listing Available Providers

Use the `list` tool to see all configured providers:

```json
{
  "name": "list",
  "arguments": {}
}
```

Response:
```json
[
  {
    "id": "openai-primary",
    "provider": "openai",
    "models": ["gpt-4o", "gpt-4o-mini"]
  },
  {
    "id": "anthropic-primary",
    "provider": "anthropic",
    "models": ["claude-3-5-sonnet-20241022"]
  }
]
```

### Sending a Prompt

Use the `prompt` tool to interact with an LLM:

```json
{
  "name": "prompt",
  "arguments": {
    "providerId": "openai-primary",
    "model": "gpt-4o",
    "prompt": "Explain quantum computing in simple terms",
    "systemPrompt": "You are a helpful science teacher",
    "temperature": 0.7,
    "maxTokens": 500
  }
}
```

## Configuration Options

### Provider Configuration

Each provider in your `config.json` supports these fields:

- `id` (required): Unique identifier for this provider instance
- `provider` (required): One of `openai`, `anthropic`, or `google`
- `apiKey` (required): Your API key for the provider
- `baseURL` (optional): Custom API endpoint URL
- `models` (optional): Array of model IDs to expose

### Environment Variables

- `MCP_LLM_CONFIG`: Path to the configuration file (default: `./config.json`)
- `MCP_LLM_PROVIDERS`: JSON string of the configuration (alternative to file)

## Advanced Configuration

### Using Multiple API Keys for the Same Provider

You can configure multiple instances of the same provider with different API keys:

```json
{
  "providers": [
    {
      "id": "openai-work",
      "provider": "openai",
      "apiKey": "sk-work-key...",
      "models": ["gpt-4o"]
    },
    {
      "id": "openai-personal",
      "provider": "openai",
      "apiKey": "sk-personal-key...",
      "models": ["gpt-4o-mini"]
    }
  ]
}
```

### Using Custom Base URLs

For providers that support custom endpoints (e.g., Azure OpenAI):

```json
{
  "providers": [
    {
      "id": "azure-openai",
      "provider": "openai",
      "apiKey": "your-azure-key",
      "baseURL": "https://your-resource.openai.azure.com/openai/deployments/your-deployment",
      "models": ["gpt-4"]
    }
  ]
}
```

## Transport Modes

The server supports two transport modes to suit different deployment scenarios:

### Stdio Transport (Default)

- **Use case**: Local integration with MCP clients like Claude Desktop
- **Advantages**: Simple setup, no network configuration needed
- **How to run**: `npm start` or `npm run dev`
- **Configuration**: Via Claude Desktop config or similar client configuration files

### HTTP/SSE Transport

- **Use case**: Hosting as a web service, remote access, containerized deployments
- **Advantages**: Can be accessed over the network, supports multiple simultaneous clients
- **How to run**: `npm run start:http` or `npm run dev:http`
- **Configuration**: Command-line flags (`--port`, `--host`)

**Command-line options for HTTP mode**:
```bash
node dist/server.js --http [--port PORT] [--host HOST]
```

Options:
- `--http`: Enable HTTP/SSE transport mode
- `--port PORT`: Specify port number (default: 3000)
- `--host HOST`: Specify bind address (default: 127.0.0.1)

Examples:
```bash
# Run on default port 3000, localhost only
npm run start:http

# Run on port 8080
node dist/server.js --http --port 8080

# Run on all interfaces (accessible from network)
node dist/server.js --http --host 0.0.0.0 --port 8080
```

## Troubleshooting

### Server Won't Start

1. Check that your `config.json` is valid JSON
2. Verify that all required fields are present in each provider config
3. Check the console output for specific error messages

### Provider Not Found

Make sure the `providerId` in your prompt matches an `id` in your configuration.

### Model Not Available

Use the `list` tool to see which models are available for each provider.

### Authentication Errors

Verify that your API keys are correct and have not expired. Check that you have sufficient credits/quota with the provider.

## Security Notes

- Never commit your `config.json` file with real API keys to version control
- The `config.json` is already in `.gitignore` to prevent accidental commits
- Consider using environment variables in production environments
- Rotate your API keys regularly
- Use separate API keys for different environments (development, staging, production)
