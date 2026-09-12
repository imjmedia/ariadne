/**
 * @fileoverview Invoca Archify CLI (validate + deliver) para HTML showcase.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import type { ArchifyArchitectureIr, ArchifySequenceIr } from 'ariadne-common';
import { getC4Settings } from './c4-settings.util';

export interface ArchifyRenderResult {
  htmlPath: string;
  validated: boolean;
  archifyBin: string | null;
  stderr?: string;
}

@Injectable()
export class C4ArchifyRenderer {
  private readonly logger = new Logger(C4ArchifyRenderer.name);

  resolveArchifyBin(): string | null {
    const configured = getC4Settings().archifyBin?.trim();
    const candidates = [
      configured,
      '/opt/archify/bin/archify.mjs',
      join(homedir(), '.agents/skills/archify/bin/archify.mjs'),
      join(homedir(), '.cursor/skills/archify/bin/archify.mjs'),
    ].filter(Boolean) as string[];
    for (const c of candidates) {
      if (existsSync(c)) return resolve(c);
    }
    return null;
  }

  storageRoot(): string {
    return join(process.cwd(), 'data', 'c4-html');
  }

  async renderArchitecture(
    projectId: string,
    level: string,
    ir: ArchifyArchitectureIr,
  ): Promise<ArchifyRenderResult> {
    const root = this.storageRoot();
    await mkdir(root, { recursive: true });
    const base = join(root, projectId);
    await mkdir(base, { recursive: true });
    const jsonPath = join(base, `${level}.architecture.json`);
    const htmlPath = join(base, `${level}.architecture.html`);
    await writeFile(jsonPath, JSON.stringify(ir, null, 2), 'utf8');

    const bin = this.resolveArchifyBin();
    if (!bin) {
      this.logger.warn(
        'Archify bin not found; configura ruta en Ajustes → Sistema o instala en /opt/archify.',
      );
      return { htmlPath, validated: false, archifyBin: null };
    }

    const validate = spawnSync(
      process.execPath,
      [bin, 'validate', 'architecture', jsonPath, '--quality', 'showcase', '--json'],
      { encoding: 'utf8', timeout: 120_000 },
    );
    if (validate.status !== 0) {
      const err = validate.stderr || validate.stdout || 'validate failed';
      this.logger.warn(`Archify validate failed: ${err.slice(0, 500)}`);
      return { htmlPath, validated: false, archifyBin: bin, stderr: err };
    }

    await mkdir(dirname(htmlPath), { recursive: true });
    const deliver = spawnSync(
      process.execPath,
      [bin, 'deliver', 'architecture', jsonPath, htmlPath, '--quality', 'showcase', '--json'],
      { encoding: 'utf8', timeout: 120_000 },
    );
    if (deliver.status !== 0) {
      const err = deliver.stderr || deliver.stdout || 'deliver failed';
      this.logger.warn(`Archify deliver failed: ${err.slice(0, 500)}`);
      return { htmlPath, validated: false, archifyBin: bin, stderr: err };
    }

    return { htmlPath, validated: true, archifyBin: bin };
  }

  async compareArchitecture(
    projectId: string,
    level: string,
    baseIr: ArchifyArchitectureIr,
    headIr: ArchifyArchitectureIr,
    fromSnapshotId: string,
    toSnapshotId: string,
  ): Promise<{ htmlPath: string; validated: boolean; archifyBin: string | null }> {
    const root = this.storageRoot();
    const base = join(root, projectId);
    await mkdir(base, { recursive: true });
    const basePath = join(base, `diff-${fromSnapshotId.slice(0, 8)}.base.json`);
    const headPath = join(base, `diff-${toSnapshotId.slice(0, 8)}.head.json`);
    const htmlPath = join(base, `diff-${fromSnapshotId.slice(0, 8)}-${toSnapshotId.slice(0, 8)}.html`);

    await writeFile(basePath, JSON.stringify(baseIr, null, 2), 'utf8');
    await writeFile(headPath, JSON.stringify(headIr, null, 2), 'utf8');

    const bin = this.resolveArchifyBin();
    if (!bin) {
      return { htmlPath, validated: false, archifyBin: null };
    }

    const cmp = spawnSync(
      process.execPath,
      [bin, 'compare', 'architecture', basePath, headPath, htmlPath, '--json'],
      { encoding: 'utf8', timeout: 120_000 },
    );
    if (cmp.status !== 0) {
      const err = cmp.stderr || cmp.stdout || 'compare failed';
      this.logger.warn(`Archify compare failed: ${err.slice(0, 500)}`);
      return { htmlPath, validated: false, archifyBin: bin };
    }

    return { htmlPath, validated: true, archifyBin: bin };
  }

  async renderSequence(
    projectId: string,
    ir: ArchifySequenceIr,
  ): Promise<ArchifyRenderResult> {
    const root = this.storageRoot();
    await mkdir(root, { recursive: true });
    const base = join(root, projectId);
    await mkdir(base, { recursive: true });
    const jsonPath = join(base, 'sequence.json');
    const htmlPath = join(base, 'sequence.html');
    await writeFile(jsonPath, JSON.stringify(ir, null, 2), 'utf8');

    const bin = this.resolveArchifyBin();
    if (!bin) {
      return { htmlPath, validated: false, archifyBin: null };
    }

    const validate = spawnSync(
      process.execPath,
      [bin, 'validate', 'sequence', jsonPath, '--quality', 'showcase', '--json'],
      { encoding: 'utf8', timeout: 120_000 },
    );
    if (validate.status !== 0) {
      const err = validate.stderr || validate.stdout || 'validate failed';
      this.logger.warn(`Archify sequence validate failed: ${err.slice(0, 500)}`);
      return { htmlPath, validated: false, archifyBin: bin, stderr: err };
    }

    const deliver = spawnSync(
      process.execPath,
      [bin, 'deliver', 'sequence', jsonPath, htmlPath, '--quality', 'showcase', '--json'],
      { encoding: 'utf8', timeout: 120_000 },
    );
    if (deliver.status !== 0) {
      const err = deliver.stderr || deliver.stdout || 'deliver failed';
      this.logger.warn(`Archify sequence deliver failed: ${err.slice(0, 500)}`);
      return { htmlPath, validated: false, archifyBin: bin, stderr: err };
    }

    return { htmlPath, validated: true, archifyBin: bin };
  }
}
