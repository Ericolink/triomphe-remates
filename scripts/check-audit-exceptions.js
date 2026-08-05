#!/usr/bin/env node
/**
 * Filtra el resultado de `npm audit --json` contra una lista de excepciones documentadas
 * (advisories high/critical ya evaluados y aceptados porque no aplican al uso real de la
 * app o porque no existe todavía un fix no-breaking). Cualquier vulnerabilidad high/critical
 * que NO esté en la lista sigue bloqueando el workflow con exit code 1.
 *
 * Uso: node scripts/check-audit-exceptions.js <ruta-al-json-de-npm-audit>
 */
const fs = require('fs');

// source: el ID numérico de advisory que aparece en `via[].source` del JSON de npm audit
// para el hallazgo raíz (no para los paquetes que solo lo heredan por dependencia).
const EXCEPTIONS = [
  {
    source: 1124282,
    ghsa: 'GHSA-qwww-vcr4-c8h2',
    package: 'react-router',
    reason:
      'CSRF bypass exclusivo del modo RSC (unstable) de react-router. Esta app usa ' +
      '<BrowserRouter> clásico (ver client/src/App.jsx), no las APIs de RSC, así que la ' +
      'ruta de código vulnerable no es alcanzable. No existe fix no-breaking: la versión ' +
      'parcheada (8.3.0) todavía no está publicada en npm; el único fix disponible fuerza ' +
      'un downgrade a react-router-dom@7.11.0 (breaking, pierde ~7 meses de fixes). ' +
      'Revisar y quitar esta excepción en cuanto npm publique una versión parcheada ' +
      'dentro del rango ^7.15.0 o superior.',
  },
];

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Uso: node check-audit-exceptions.js <ruta-al-json-de-npm-audit>');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const vulnerabilities = report.vulnerabilities || {};
const ignoredSources = new Set(EXCEPTIONS.map((e) => e.source));

// Un paquete queda cubierto por una excepción si su propio advisory está en la lista, o si
// TODA su cadena `via` son nombres de paquetes que ya quedaron cubiertos (propagación
// transitiva: p.ej. react-router-dom hereda la excepción de react-router).
const ignoredPackages = new Set();
let changed = true;
while (changed) {
  changed = false;
  for (const [name, vuln] of Object.entries(vulnerabilities)) {
    if (ignoredPackages.has(name)) continue;
    const via = Array.isArray(vuln.via) ? vuln.via : [];
    const directlyIgnored = via.some(
      (v) => typeof v === 'object' && v !== null && ignoredSources.has(v.source)
    );
    const transitivelyIgnored =
      via.length > 0 && via.every((v) => typeof v === 'string' && ignoredPackages.has(v));
    if (directlyIgnored || transitivelyIgnored) {
      ignoredPackages.add(name);
      changed = true;
    }
  }
}

const unresolved = Object.entries(vulnerabilities).filter(
  ([name, vuln]) =>
    (vuln.severity === 'high' || vuln.severity === 'critical') && !ignoredPackages.has(name)
);

if (unresolved.length > 0) {
  console.error('\n🚫 Vulnerabilidades high/critical sin excepción documentada:\n');
  console.error(JSON.stringify(Object.fromEntries(unresolved), null, 2));
  process.exit(1);
}

if (ignoredPackages.size > 0) {
  console.log('⚠️  Vulnerabilidades ignoradas por excepción documentada:');
  for (const name of ignoredPackages) {
    const exception = EXCEPTIONS.find((e) => e.package === name) ?? EXCEPTIONS[0];
    console.log(`   - ${name} (${exception.ghsa}): ${exception.reason}`);
  }
}

console.log('\n✅ check-audit-exceptions: sin vulnerabilidades high/critical sin justificar.');
