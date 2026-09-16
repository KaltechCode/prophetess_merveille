import { cp, mkdir, access } from 'node:fs/promises';
await access('.next/standalone/server.js');
await mkdir('.next/standalone/.next', { recursive: true });
await cp('.next/static', '.next/standalone/.next/static', { recursive: true });
await cp('public', '.next/standalone/public', { recursive: true });
await mkdir('.next/standalone/.next/cache', { recursive: true });
console.log('Standalone release ready in .next/standalone. Keep all secrets outside this folder.');
