# mcp-to-llm

An MCP (Model Context Protocol) server that exposes LLM (Large Language Model) providers through a standardized interface. Built on top of the [AI SDK](https://sdk.vercel.ai/), this server allows you to configure and access multiple LLM providers (OpenAI, Anthropic, Google) with different API keys.

## Features

- **Multiple Provider Support**: Configure OpenAI, Anthropic, and Google AI providers
- **Multiple API Keys**: Support multiple instances of the same provider with different API keys
- **Standardized Interface**: Built on the AI SDK for consistent API interactions
- **Two MCP Tools**:
  - `list`: Lists all configured providers and their available models
  - `prompt`: Send prompts to any configured LLM instance

## Installation

```bash
npm install
npm run build
```

## Quick Start

1. Copy the example configuration:
   ```bash
   cp config.example.json config.json
   ```

2. Edit `config.json` with your API keys

3. Test your configuration:
   ```bash
   npm run test-config
   ```

4. Start the server:
   ```bash
   npm start
   ```

See [SETUP.md](SETUP.md) for detailed setup instructions and usage with MCP clients.

## Configuration

Create a `config.json` file in the project root (or specify a custom path via `MCP_LLM_CONFIG` environment variable):

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
      "id": "openai-secondary",
      "provider": "openai",
      "apiKey": "sk-...",
      "models": ["gpt-3.5-turbo"]
    },
    {
      "id": "anthropic-primary",
      "provider": "anthropic",
      "apiKey": "sk-ant-...",
      "models": ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"]
    },
    {
      "id": "google-primary",
      "provider": "google",
      "apiKey": "...",
      "models": ["gemini-1.5-pro", "gemini-1.5-flash"]
    }
  ]
}
```

### Configuration Fields

- `id` (required): Unique identifier for this provider instance
- `provider` (required): Provider type - `openai`, `anthropic`, or `google`
- `apiKey` (required): API key for the provider
- `baseURL` (optional): Custom base URL for the provider API
- `models` (optional): List of models to expose. If not specified, defaults to common models for that provider

### Alternative Configuration Methods

You can also provide configuration via the `MCP_LLM_PROVIDERS` environment variable as a JSON string:

```bash
export MCP_LLM_PROVIDERS='{"providers":[{"id":"openai-primary","provider":"openai","apiKey":"sk-...","models":["gpt-4o"]}]}'
```

Or specify a custom config file path:

```bash
export MCP_LLM_CONFIG=/path/to/custom/config.json
```

## Usage

### Running the Server

The server supports two transport modes:

#### 1. Stdio Transport (Default)

For use with MCP clients like Claude Desktop:

```bash
npm start
```

Or in development mode:

```bash
npm run dev
```

#### 2. HTTP Transport (SSE)

For hosting as a web service:

```bash
npm run start:http
```

Or in development mode:

```bash
npm run dev:http
```

By default, the HTTP server listens on `http://127.0.0.1:3000`. You can customize the port and host:

```bash
# Custom port
node dist/server.js --http --port 8080

# Custom host (bind to all interfaces)
node dist/server.js --http --host 0.0.0.0 --port 8080
```

The HTTP server provides:
- SSE endpoint: `http://host:port/sse` (for MCP client connections)
- Health check: `http://host:port/health` (for monitoring)

### MCP Tools

#### 1. `list` Tool

Lists all configured LLM providers and their available models.

**Input**: None

**Output**: JSON array of providers with their IDs, types, and available models

**Example Response**:
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
    "models": ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"]
  }
]
```

#### 2. `prompt` Tool

Send a prompt to a configured LLM and get a response.

**Input Parameters**:
- `providerId` (required): The ID of the provider instance to use
- `model` (required): The model ID to use (e.g., "gpt-4o", "claude-3-5-sonnet-20241022")
- `prompt` (required): The prompt to send to the LLM
- `systemPrompt` (optional): System prompt to set context
- `temperature` (optional): Temperature for response randomness (0.0-2.0)
- `maxTokens` (optional): Maximum number of tokens to generate

**Example**:
```json
{
  "providerId": "openai-primary",
  "model": "gpt-4o",
  "prompt": "What is the capital of France?",
  "systemPrompt": "You are a helpful geography assistant.",
  "temperature": 0.7
}
```

## Use Cases

This MCP server enables several useful scenarios:

1. **Multi-Account Access**: Use different API keys for the same provider (e.g., separate work and personal accounts)
2. **Provider Comparison**: Easily compare responses from different providers for the same prompt
3. **Cost Optimization**: Route different types of requests to different providers based on cost/performance
4. **Failover**: Configure backup providers in case one is unavailable
5. **Model Testing**: Test and compare different models from the same or different providers
6. **Web Service Deployment**: Host the server as a web service for remote access via HTTP/SSE transport

## Development

### Project Structure

```
src/
  config.ts       - Configuration loading and validation
  providers.ts    - Provider initialization and LLM interaction
  server.ts       - MCP server implementation
```

### Building

```bash
npm run build
```

### Running in Development

```bash
npm run dev
```

## License

See LICENSE file for details.
