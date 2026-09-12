#!/usr/bin/env node
/**
 * Spike Entrega 1: docker-compose → C4Model → Archify IR (sin Nest).
 * Uso: node scripts/spike-c4-archify.mjs
 */
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const { scanC4Infrastructure } = await import(
    resolve(root, 'services/ingest/dist/c4/c4-infrastructure.js')
  ).catch(() => {
    console.error('Compila ingest primero: pnpm -C services/ingest build');
    process.exit(1);
  });
  const { infrastructureSpecToC4Model, c4ModelToArchifyArchitecture } = await import(
    resolve(root, 'packages/ariadne-common/dist/index.js')
  );

  const composePath = resolve(root, 'docker-compose.yml');
  const compose = await readFile(composePath, 'utf8');
  const pathSet = new Set(['docker-compose.yml']);
  const getContent = async (p) => (p === 'docker-compose.yml' ? compose : null);

  const { spec } = await scanC4Infrastructure(pathSet, getContent, 'kreodevs/ariadne');
  const model = infrastructureSpecToC4Model(spec, 'spike-project', {
    composePath: 'docker-compose.yml',
  });
  const ir = c4ModelToArchifyArchitecture(model, 'Ariadne — C4 Container (spike)');

  console.log(JSON.stringify({ elementCount: model.elements.length, ir }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
