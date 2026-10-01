import { randomBytes } from 'node:crypto';
import { closeSync, fchmodSync, openSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

const envPath = resolve('.env');
dotenv.config({ path: envPath });

const missing = [];
if (!process.env.CALMFIT_ACCESS_TOKEN) {
  process.env.CALMFIT_ACCESS_TOKEN = randomBytes(32).toString('hex');
  missing.push(`CALMFIT_ACCESS_TOKEN=${process.env.CALMFIT_ACCESS_TOKEN}`);
}
if (!process.env.CALMFIT_DEVICE_TOKEN) {
  process.env.CALMFIT_DEVICE_TOKEN = randomBytes(32).toString('hex');
  missing.push(`CALMFIT_DEVICE_TOKEN=${process.env.CALMFIT_DEVICE_TOKEN}`);
}
if (!process.env.CALMFIT_DATA_ENCRYPTION_KEY) {
  process.env.CALMFIT_DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  missing.push(`CALMFIT_DATA_ENCRYPTION_KEY=${process.env.CALMFIT_DATA_ENCRYPTION_KEY}`);
}

if (missing.length) {
  const descriptor = openSync(envPath, 'a', 0o600);
  try {
    fchmodSync(descriptor, 0o600);
    writeFileSync(descriptor, `${missing.join('\n')}\n`);
  } finally {
    closeSync(descriptor);
  }
  console.log('CALM FIT 보안 설정을 만들고 안전하게 저장했습니다.');
}

console.log(`CALM FIT을 시작합니다. 브라우저에서 http://localhost:${process.env.PORT || 3000} 을 여세요.`);
await import('../server.ts');