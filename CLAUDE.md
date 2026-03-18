# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

`mcp-to-llm` is a TypeScript MCP server that exposes configured LLM providers through a common MCP interface. The codebase uses ESM, builds with `tsc`, and supports both stdio and HTTP/SSE transports.

## Repository Layout

- `src/server.ts`: MCP server entrypoint, tool definitions, stdio and HTTP transport handling
- `src/config.ts`: Configuration loading and validation
- `src/providers.ts`: Provider initialization and prompt execution
- `src/test-config.ts`: Local configuration validation script
- `examples/client-example.ts`: stdio client example
- `examples/http-client-example.ts`: HTTP/SSE example client
- `README.md` and `SETUP.md`: user-facing setup and runtime documentation

## Working Rules

- Keep documentation in sync with behavior changes. If you change setup, commands, configuration shape, transports, examples, or tool behavior, update `README.md`, `SETUP.md`, and `examples/README.md` as needed in the same change.
- Respect local uncommitted changes. The working tree may already contain user edits.
- Prefer small, targeted changes. Do not refactor unrelated files while updating provider logic or server wiring.
- Preserve ESM import style and existing TypeScript conventions.

## Commit Expectations

- Commit completed work unless the user explicitly asks you not to commit or to leave changes unstaged.
- Use a descriptive commit message that states what changed and why. Avoid vague messages such as `updates` or `fix`.
- Prefer conventional prefixes when they fit, such as `feat:`, `fix:`, `docs:`, `refactor:`, or `chore:`.
- Do not include unrelated user changes in the commit. If the working tree contains unrelated edits, stage and commit only the files relevant to your task.

## Core Workflows

### Install and Build

```bash
npm install
npm run build
```

Use `npm run build` after any code change. This is the primary compile-time verification step.

### Validate Configuration

```bash
cp config.example.json config.json
npm run test-config
```

`npm run test-config` validates config loading and provider initialization without making live model calls. Run this whenever you change configuration loading, provider setup, or documented config examples.

### Run the Server

Stdio mode:

```bash
npm start
```

Development stdio mode:

```bash
npm run dev
```

HTTP/SSE mode:

```bash
npm run start:http
```

Development HTTP/SSE mode:

```bash
npm run dev:http
```

Custom HTTP host and port:

```bash
node dist/server.js --http --host 0.0.0.0 --port 8080
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```

### Run Examples

Build before running examples:

```bash
npm run build
```

Stdio example:

```bash
npm run example
```

HTTP example:

```bash
npx tsx examples/http-client-example.ts
```

Run the HTTP example only after starting the server in HTTP mode.

## Verification Expectations

Choose the smallest useful verification set for the change, and state what you ran.

- For TypeScript or runtime changes: run `npm run build`
- For config or provider wiring changes: run `npm run test-config`
- For HTTP transport changes: verify `npm run start:http` and `curl http://127.0.0.1:3000/health`
- For example or integration changes: run the relevant example command when practical

## Command Notes

- `npm test` is currently a placeholder command that exits with an error. Do not report it as the project test suite.
- `dist/` is generated output. Prefer editing `src/` files unless the user explicitly asks otherwise.
- The server reads configuration from `config.json` by default, or from `MCP_LLM_CONFIG` / `MCP_LLM_PROVIDERS`.

## Common Change Patterns

### Adding or Changing Provider Behavior

Update:

- `src/providers.ts`
- `src/config.ts` if config shape or validation changes
- `README.md` and `SETUP.md` if supported providers, fields, or examples change

Then verify with:

```bash
npm run build
npm run test-config
```

### Changing MCP Tools or Server Transport

Update:

- `src/server.ts`
- relevant docs in `README.md` and `SETUP.md`
- example files if connection flow changes

Then verify with:

```bash
npm run build
curl http://127.0.0.1:3000/health
```

### Changing Examples or Developer Commands

Update:

- `examples/`
- `examples/README.md`
- `README.md` if top-level usage changes
- this file if the standard workflow or command set changes

## When Updating This File

Revise `AGENTS.md` whenever build commands, verification steps, server startup flows, examples, or required docs change. Keep it operational and specific to the current repo state.
