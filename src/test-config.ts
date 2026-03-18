#!/usr/bin/env node

/**
 * Configuration validation script
 * Tests that the configuration file is valid without making API calls
 */

import { loadConfig } from './config.js';
import { initializeProvider } from './providers.js';

console.log('Testing configuration...\n');

try {
  // Load configuration
  const config = loadConfig();
  console.log(`✓ Configuration loaded successfully`);
  console.log(`  Found ${config.providers.length} provider(s)\n`);

  // Initialize each provider
  for (const providerConfig of config.providers) {
    console.log(`Testing provider: ${providerConfig.id}`);
    console.log(`  Type: ${providerConfig.provider}`);
    console.log(`  API Key: ${providerConfig.apiKey ? '***' : '(not set)'}`);
    
    if (providerConfig.baseURL) {
      console.log(`  Base URL: ${providerConfig.baseURL}`);
    }
    
    try {
      const provider = initializeProvider(providerConfig);
      console.log(`  Models: ${provider.models.join(', ')}`);
      for (const model of provider.modelDetails) {
        if (model.description) {
          console.log(`    - ${model.id}: ${model.description}`);
        }
      }
      console.log('  ✓ Provider initialized successfully\n');
    } catch (error) {
      console.error(`  ✗ Failed to initialize provider: ${error}\n`);
      process.exit(1);
    }
  }

  console.log('✓ All providers configured correctly!');
  console.log('\nYou can now start the server with: npm start');
  process.exit(0);
} catch (error) {
  console.error('✗ Configuration error:', error);
  console.error('\nPlease check your configuration file and try again.');
  console.error('See SETUP.md for configuration instructions.');
  process.exit(1);
}
