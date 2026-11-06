#!/usr/bin/env node
/**
 * Generate a secure master encryption key
 * Run: node scripts/generate-master-key.js
 */

const crypto = require('crypto');

const key = crypto.randomBytes(32); // 256 bits
console.log('\n🔐 Generated Master Encryption Key:\n');
console.log(key.toString('hex'));
console.log('\n⚠️  IMPORTANT:');
console.log('1. Copy this key to your .env file as MASTER_ENCRYPTION_KEY');
console.log('2. NEVER commit this key to version control');
console.log('3. Store it securely (password manager, KMS, etc.)');
console.log('4. Losing this key = losing all encrypted credentials!\n');