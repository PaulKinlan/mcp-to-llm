/**
 * Example: Connecting to MCP server via HTTP/SSE transport
 * 
 * This example demonstrates how to connect to the mcp-to-llm server
 * when it's running in HTTP mode.
 * 
 * Prerequisites:
 * 1. Start the server in HTTP mode:
 *    npm run start:http
 * 
 * 2. Run this example:
 *    npx tsx examples/http-client-example.ts
 */

import { EventSource } from 'eventsource';
import fetch from 'node-fetch';

const SERVER_URL = 'http://127.0.0.1:3000';

async function checkHealth() {
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await response.json();
    console.log('Server health:', data);
    return true;
  } catch (error) {
    console.error('Failed to connect to server:', error);
    return false;
  }
}

async function connectToSSE() {
  console.log(`\nConnecting to SSE endpoint: ${SERVER_URL}/sse`);
  
  const eventSource = new EventSource(`${SERVER_URL}/sse`);
  
  eventSource.onopen = () => {
    console.log('✓ Connected to SSE stream');
  };
  
  eventSource.onmessage = (event) => {
    console.log('Received message:', event.data);
    try {
      const data = JSON.parse(event.data);
      console.log('Parsed:', JSON.stringify(data, null, 2));
    } catch (e) {
      // Not JSON, that's ok
    }
  };
  
  eventSource.onerror = (error) => {
    console.error('SSE error:', error);
    eventSource.close();
  };
  
  // Keep connection open for 10 seconds
  setTimeout(() => {
    console.log('\nClosing connection...');
    eventSource.close();
  }, 10000);
}

async function main() {
  console.log('=== MCP HTTP Client Example ===\n');
  
  // Check if server is running
  const isHealthy = await checkHealth();
  
  if (!isHealthy) {
    console.error('\nPlease start the server first:');
    console.error('  npm run start:http');
    process.exit(1);
  }
  
  // Connect to SSE endpoint
  await connectToSSE();
}

main().catch(console.error);
