#!/usr/bin/env node
/**
 * Lee el log estructurado de producción (server/logs/combined.log, formato JSON de
 * winston — ver server/src/utils/logger.js) y resume el uso real de
 * `POST /api/auth/register`, instrumentado en server/src/controllers/authController.js
 * (evento `legacy_register_endpoint_used`) como parte de la decisión pendiente en
 * AUDITORIA_CREACION_USUARIOS.md sobre si retirar ese endpoint.
 *
 * Uso: node scripts/register-usage-report.js <ruta-a-combined.log>
 *   (en el servidor: node scripts/register-usage-report.js server/logs/combined.log)
 */
const fs = require('fs');
const readline = require('readline');

const logPath = process.argv[2];
if (!logPath) {
  console.error('Uso: node scripts/register-usage-report.js <ruta-a-combined.log>');
  process.exit(1);
}

async function main() {
  const rl = readline.createInterface({ input: fs.createReadStream(logPath) });

  const calls = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // línea no-JSON (p.ej. arranque de un logger previo a rotación); se ignora
    }
    if (entry.event === 'legacy_register_endpoint_used') calls.push(entry);
  }

  if (calls.length === 0) {
    console.log('Sin llamadas registradas a POST /api/auth/register en este archivo.');
    return;
  }

  const success = calls.filter((c) => c.result === 'success');
  const failed = calls.filter((c) => c.result !== 'success');
  const manual = calls.filter((c) => c.likelyManualClient);
  const fromPanel = calls.filter((c) => c.fromAdminPanel);

  const byActor = new Map();
  for (const c of calls) {
    const key = `${c.actorName || 'desconocido'} (id=${c.actorId ?? '?'}, rol=${c.actorRole ?? '?'})`;
    byActor.set(key, (byActor.get(key) || 0) + 1);
  }

  console.log(`Total de llamadas: ${calls.length}`);
  console.log(`  Exitosas (2xx):  ${success.length}`);
  console.log(`  Fallidas:        ${failed.length}`);
  console.log(`  Desde el panel admin (origin permitido por CORS): ${fromPanel.length}`);
  console.log(`  Probable llamada manual (curl/Postman/Insomnia/Thunder Client): ${manual.length}`);
  console.log('\nPor usuario que lo invocó:');
  for (const [actor, count] of [...byActor.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(4)}  ${actor}`);
  }

  console.log('\nÚltimas 10 llamadas:');
  for (const c of calls.slice(-10)) {
    console.log(
      `  ${c.timestamp} | ${c.result} (${c.statusCode}) | actor=${c.actorName ?? '?'} | ` +
        `ip=${c.ip} | target=${c.targetEmail ?? '?'} | manual=${c.likelyManualClient} | panel=${c.fromAdminPanel}`
    );
  }
}

main();
