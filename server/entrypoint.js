/**
 * pkg entrypoint — this file is loaded first by the packaged exe.
 * All process.env vars that Prisma reads at PrismaClient() construction
 * time must be set HERE, before dist/index.js is required.
 */

'use strict';

const path = require('path');
const fs   = require('fs');

if (process.pkg) {
  const exeDir = path.dirname(process.execPath);

  // ── Config file (editable by user next to the exe) ──────────────────────
  const configFile = path.join(exeDir, 'config.env');
  if (fs.existsSync(configFile)) {
    // Simple dotenv-style parser (avoids an extra require before dotenv loads)
    fs.readFileSync(configFile, 'utf8')
      .split('\n')
      .forEach(line => {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      });
  }

  // ── Prisma paths ─────────────────────────────────────────────────────────
  process.env.DATABASE_URL = `file:${path.join(exeDir, 'data.db')}`;

  // Locate the Prisma query-engine binary that sits next to the exe
  const engineFile = fs.readdirSync(exeDir).find(
    f => f.endsWith('.dll.node') || (f.endsWith('.node') && f.includes('query_engine'))
  );
  if (engineFile) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(exeDir, engineFile);
  }

  // ── Defaults ─────────────────────────────────────────────────────────────
  if (!process.env.PIN)  process.env.PIN  = '1234';
  if (!process.env.PORT) process.env.PORT = '3001';
}

// Load the compiled app — all Prisma singletons are created inside here
require('./dist/index');
