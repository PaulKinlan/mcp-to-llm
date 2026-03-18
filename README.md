# mcp-to-llm

An MCP (Model Context Protocol) server that exposes LLM (Large Language Model) providers through a standardized interface. Built on top of the [AI SDK](https://sdk.vercel.ai/), this server allows you to configure and access multiple LLM providers (OpenAI, Anthropic, Google) with different API keys.

## Features

- **Multiple Provider Support**: Configure OpenAI, Anthropic, and Google AI providers
- **Multiple API Keys**: Support multiple instances of the same provider with different API keys
- **Standardized Interface**: Built on the AI SDK for consistent API interactions
- **Optional Model Metadata**: Add per-model descriptions so `list` can surface capabilities and intended use
- **Image Generation**: Generate images via OpenAI (gpt-image-1) and Google (Gemini Nano Banana, Imagen 4)
- **Three MCP Tools**:
  - `list`: Lists all configured providers, their available models, capabilities, and descriptions
  - `prompt`: Send prompts to any configured text LLM instance
  - `generate_image`: Generate images using configured image models

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
      "models": [
        {
          "id": "gpt-5.4",
          "description": "OpenAI flagship for complex reasoning, coding, and agentic workflows."
        },
        {
          "id": "gpt-5.4-mini",
          "description": "Lower-cost GPT-5.4 variant for faster high-throughput tasks."
        }
      ]
    },
    {
      "id": "anthropic-primary",
      "provider": "anthropic",
      "apiKey": "sk-ant-...",
      "models": [
        {
          "id": "claude-opus-4-6",
          "description": "Anthropic flagship for the most complex reasoning, coding, and agentic work."
        },
        {
          "id": "claude-sonnet-4-6",
          "description": "Anthropic balanced model with the best speed-intelligence tradeoff for general use."
        }
      ]
    },
    {
      "id": "google-primary",
      "provider": "google",
      "apiKey": "...",
      "models": [
        {
          "id": "gemini-3.1-pro-preview",
          "description": "Latest Gemini 3.1 preview for advanced reasoning, coding, and multimodal work.",
          "capability": "text"
        },
        {
          "id": "gemini-3-flash-preview",
          "description": "Lower-latency Gemini 3 preview for fast multimodal and agentic tasks.",
          "capability": "text"
        },
        {
          "id": "gemini-2.5-flash-image",
          "description": "Gemini Nano Banana — fast, low-cost native image generation.",
          "capability": "image"
        }
      ]
    }
  ]
}
```

### Configuration Fields

- `id` (required): Unique identifier for this provider instance
- `provider` (required): Provider type - `openai`, `anthropic`, or `google`
- `apiKey` (required): API key for the provider
- `baseURL` (optional): Custom base URL for the provider API
- `models` (optional): List of models to expose. Each entry can be either a string model ID or an object with `id`, optional `description`, and optional `capability` (`"text"` or `"image"`, defaults to `"text"`)
- `capability` (optional): Set to `"image"` for image generation models. The `list` tool surfaces this so callers know to use `generate_image` instead of `prompt`

If you omit `models`, the server uses built-in defaults that include both text and image models for each provider. If you specify custom models, include image models explicitly if you want image generation support.

### Alternative Configuration Methods

You can also provide configuration via the `MCP_LLM_PROVIDERS` environment variable as a JSON string:

```bash
export MCP_LLM_PROVIDERS='{"providers":[{"id":"openai-primary","provider":"openai","apiKey":"sk-...","models":[{"id":"gpt-5.4","description":"Flagship reasoning model"}]}]}'
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

Lists all configured LLM providers, their available model IDs, and any optional model descriptions.

**Input**: None

**Output**: JSON array of providers with their IDs, types, available model IDs, and optional `modelDetails`

**Example Response**:
```json
[
  {
    "id": "openai-primary",
    "provider": "openai",
    "models": ["gpt-5.4", "gpt-5.4-mini"],
    "modelDetails": [
      {
        "id": "gpt-5.4",
        "description": "OpenAI flagship for complex reasoning, coding, and agentic workflows."
      },
      {
        "id": "gpt-5.4-mini",
        "description": "Lower-cost GPT-5.4 variant for faster high-throughput tasks."
      }
    ]
  },
  {
    "id": "anthropic-primary",
    "provider": "anthropic",
    "models": ["claude-opus-4-6", "claude-sonnet-4-6"],
    "modelDetails": [
      {
        "id": "claude-opus-4-6",
        "description": "Anthropic flagship for the most complex reasoning, coding, and agentic work."
      },
      {
        "id": "claude-sonnet-4-6",
        "description": "Anthropic balanced model with the best speed-intelligence tradeoff for general use."
      }
    ]
  }
]
```

#### 2. `prompt` Tool

Send a prompt to a configured LLM and get a response.

**Input Parameters**:
- `providerId` (required): The ID of the provider instance to use
- `model` (required): The model ID to use (e.g., "gpt-5.4", "claude-sonnet-4-6", "gemini-3.1-pro-preview")
- `prompt` (required): The prompt to send to the LLM
- `systemPrompt` (optional): System prompt to set context
- `temperature` (optional): Temperature for response randomness (0.0-2.0)
- `maxTokens` (optional): Maximum number of tokens to generate

**Example**:
```json
{
  "providerId": "openai-primary",
  "model": "gpt-5.4",
  "prompt": "What is the capital of France?",
  "systemPrompt": "You are a helpful geography assistant.",
  "temperature": 0.7
}
```

#### 3. `generate_image` Tool

Generate images using a configured image model.

**Input Parameters**:
- `providerId` (required): The ID of the provider instance to use
- `model` (required): The image model ID (e.g., "gpt-image-1", "gemini-2.5-flash-image", "imagen-4.0-generate-001")
- `prompt` (required): The prompt describing the image to generate
- `n` (optional): Number of images to generate (1-10)
- `size` (optional): Image size as WxH (e.g., "1024x1024"). Provider-dependent.
- `aspectRatio` (optional): Aspect ratio as W:H (e.g., "16:9"). Provider-dependent.
- `seed` (optional): Seed for reproducible generation
- `saveTo` (optional): File path to save the generated image to (e.g., `"/path/to/output.png"`). Parent directories are created automatically. When generating multiple images, a numeric suffix is added before the extension (e.g., `output-0.png`, `output-1.png`). If omitted, images are saved to the system temp directory.

**Example**:
```json
{
  "providerId": "google-primary",
  "model": "gemini-2.5-flash-image",
  "prompt": "A serene mountain landscape at sunset",
  "aspectRatio": "16:9",
  "saveTo": "./landscape.png"
}
```

**Available Image Models**:
- **OpenAI**: `gpt-image-1`
- **Google**: `gemini-2.5-flash-image` (Nano Banana), `gemini-3-pro-image-preview` (Nano Banana Pro), `gemini-3.1-flash-image-preview` (Nano Banana 2), `imagen-4.0-generate-001` (Imagen 4)
- **Anthropic**: No image generation support

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
