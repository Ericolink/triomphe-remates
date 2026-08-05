#!/usr/bin/env node
/**
 * Corre automáticamente después de `npm run build` (ver "postbuild" en package.json).
 * `server/` es exactamente la carpeta que se sube por FTP a SmarterASP, así que
 * cualquier respaldo/script suelto que caiga ahí puede terminar publicado por accidente
 * (ver AUDITORIA_CTO_EXTREMA.md y AUDITORIA_SMARTERASP_DEPLOY.md).
 * Bloquea el build con exit code 1 si encuentra alguno de estos patrones dentro de server/.
 */
const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..', 'server');

const FORBIDDEN_PATTERNS = [
  /\.tar\.gz$/i,
  /\.tar\.gz\.backup$/i,
  /\.backup$/i,
  /\.bak$/i,
  /\.sql$/i,
  /^update-admin\.js$/i,
  /^version-check.*\.js$/i,
  /web\.config\.version-check$/i,
];

const SKIP_DIRS = new Set(['node_modules', 'client', 'uploads', '.git']);

function findForbidden(dir) {
  const hits = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      hits.push(...findForbidden(path.join(dir, entry.name)));
      continue;
    }
    if (FORBIDDEN_PATTERNS.some((re) => re.test(entry.name))) {
      hits.push(path.relative(process.cwd(), path.join(dir, entry.name)));
    }
  }
  return hits;
}

const hits = findForbidden(SERVER_DIR);

if (hits.length > 0) {
  console.error('\n🚫 Archivos prohibidos para deploy encontrados en server/:\n');
  hits.forEach((f) => console.error(`   - ${f}`));
  console.error(
    '\nEstos archivos nunca deben subirse por FTP a SmarterASP. Elimínalos o muévelos fuera de server/ antes de desplegar.\n'
  );
  process.exit(1);
}

console.log('✅ check-deploy-safety: sin archivos prohibidos en server/.');
