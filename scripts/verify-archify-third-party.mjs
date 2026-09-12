#!/usr/bin/env node
/**
 * Compliance check: Archify third-party notice + pinned Dockerfile + optional LICENSE on disk.
 * CI: node scripts/verify-archify-third-party.mjs
 * Post-build Docker: docker run --rm <ingest-image> cat /opt/archify/LICENSE
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
let failed = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failed += 1;
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

const notice = readFileSync(join(root, 'NOTICE'), 'utf8');
if (!/Archify/i.test(notice) || !/MIT/i.test(notice)) {
  fail('NOTICE must document Archify and MIT license');
} else {
  ok('NOTICE mentions Archify (MIT)');
}

const dockerfile = readFileSync(join(root, 'services/ingest/Dockerfile'), 'utf8');
const versionMatch = dockerfile.match(/ARG ARCHIFY_VERSION=(v[\d.]+)/);
if (!versionMatch) {
  fail('services/ingest/Dockerfile must define ARG ARCHIFY_VERSION=vX.Y.Z');
} else {
  ok(`Dockerfile pins ARCHIFY_VERSION=${versionMatch[1]}`);
}

if (!/--branch "\$\{ARCHIFY_VERSION\}"/.test(dockerfile)) {
  fail('Dockerfile must git clone Archify with --branch "${ARCHIFY_VERSION}"');
} else {
  ok('Dockerfile clones Archify with pinned branch');
}

if (!/test -f \/opt\/archify\/LICENSE/.test(dockerfile)) {
  fail('Dockerfile must verify /opt/archify/LICENSE at build time');
} else {
  ok('Dockerfile asserts Archify LICENSE at build');
}

const localLicense = '/opt/archify/LICENSE';
if (existsSync(localLicense)) {
  const text = readFileSync(localLicense, 'utf8');
  if (!/MIT License/i.test(text)) {
    fail(`${localLicense} does not look like MIT`);
  } else {
    ok('Local /opt/archify/LICENSE present (MIT)');
  }
} else {
  console.log('SKIP: /opt/archify/LICENSE not on host (expected outside Docker image)');
}

if (failed > 0) {
  process.exit(1);
}

console.log('verify-archify-third-party: all checks passed');
