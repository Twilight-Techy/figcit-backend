// Fills in local development secrets in the repo-root .env (never committed): Ed25519 JWT keys,
// a master key for field encryption and VAPID keys for Web Push. Existing values are kept.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env');
if (!existsSync(envPath)) copyFileSync(resolve(root, '.env.example'), envPath);
let text = readFileSync(envPath, 'utf8');

function set(name, value) {
  const line = new RegExp(`^${name}=.*$`, 'm');
  const current = line.exec(text)?.[0]?.split('=').slice(1).join('=');
  if (current && current !== '' && !current.startsWith('<')) return;
  text = line.test(text)
    ? text.replace(line, `${name}=${value}`)
    : `${text.trimEnd()}\n${name}=${value}\n`;
}

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
set(
  'JWT_PRIVATE_KEY',
  Buffer.from(privateKey.export({ type: 'pkcs8', format: 'pem' })).toString('base64'),
);
set(
  'JWT_PUBLIC_KEY',
  Buffer.from(publicKey.export({ type: 'spki', format: 'pem' })).toString('base64'),
);
set('MASTER_KEYS', `1:${randomBytes(32).toString('base64')}`);
try {
  const webpush = createRequire(resolve(root, 'apps/api/package.json'))('web-push');
  const vapid = webpush.generateVAPIDKeys();
  set('VAPID_PUBLIC_KEY', vapid.publicKey);
  set('VAPID_PRIVATE_KEY', vapid.privateKey);
} catch {
  console.warn('web-push not installed yet; VAPID keys skipped');
}
writeFileSync(envPath, text);
console.log('.env ready');
