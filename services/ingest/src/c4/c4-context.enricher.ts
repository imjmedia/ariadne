/**
 * @fileoverview Enriquecimiento opcional C4 Context vía LLM (actores + descripciones).
 * No inventa topología: solo narrativa sobre elementos ya presentes en el modelo.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { C4ContextSpec, C4Element, C4Model, C4Relationship } from 'ariadne-common';
import { hashC4ModelPayload } from 'ariadne-common';
import { resolveLlmApiKey, resolveLlmBaseUrl, resolveLlmChatModel, llmDefaultHeaders } from '../llm/llm-config';
import { IndexedFile } from '../repositories/entities/indexed-file.entity';
import { RepositoriesService } from '../repositories/repositories.service';
import { FileContentService } from '../repositories/file-content.service';

interface LlmC4ContextPayload {
  persons?: Array<{ name: string; description?: string; usesSystemName?: string }>;
  descriptions?: Record<string, string>;
}

@Injectable()
export class C4ContextEnricher {
  private readonly logger = new Logger(C4ContextEnricher.name);

  constructor(
    private readonly repos: RepositoriesService,
    private readonly fileContent: FileContentService,
    @InjectRepository(IndexedFile)
    private readonly indexedFiles: Repository<IndexedFile>,
  ) {}

  async enrich(model: C4Model, spec: C4ContextSpec): Promise<C4Model> {
    const apiKey = resolveLlmApiKey();
    if (!apiKey) {
      this.logger.warn('C4 context LLM: sin API key — se omite narrativa');
      return model;
    }

    const readme = await this.collectReadmeExcerpt(spec.projectId);
    const systems = model.elements.filter((e) => e.kind === 'system');
    const externals = model.elements.filter((e) => e.kind === 'external');
    const depsBlock = spec.dependencies
      .map(
        (d) =>
          `- ${d.domainName} (${d.connectionType})${d.description ? `: ${d.description}` : ''}`,
      )
      .join('\n');

    const userPrompt = `Proyecto: ${spec.projectName}
Dominio propio: ${spec.domain?.name ?? '(sin dominio)'}
${spec.domain?.description ? `Descripción dominio: ${spec.domain.description}\n` : ''}
Sistemas software (NO inventar más):
${systems.map((s) => `- ${s.name}`).join('\n')}

Sistemas externos declarados (NO inventar más):
${externals.map((e) => `- ${e.name}`).join('\n') || '(ninguno)'}

Whitelist de dominios:
${depsBlock || '(vacía)'}

Extracto README (si hay):
${readme.slice(0, 6000) || '(sin README indexado)'}

Responde SOLO JSON válido:
{
  "persons": [{ "name": "...", "description": "...", "usesSystemName": "nombre exacto de un sistema listado" }],
  "descriptions": { "nombre exacto del elemento": "1-2 frases" }
}
Máximo 3 personas. descriptions solo para nombres ya listados arriba.`;

    try {
      const raw = await this.callLlm(userPrompt);
      const parsed = this.parseJsonPayload(raw);
      return this.applyPayload(model, parsed);
    } catch (err) {
      this.logger.warn(
        `C4 context LLM falló: ${err instanceof Error ? err.message : String(err)}`,
      );
      return model;
    }
  }

  private async collectReadmeExcerpt(projectId: string): Promise<string> {
    const linked = await this.repos.findAll(projectId);
    const chunks: string[] = [];
    for (const repo of linked) {
      const rows = await this.indexedFiles.find({
        where: { repositoryId: repo.id },
        select: ['path'],
      });
      const readmePath = rows
        .map((r) => r.path)
        .find((p) => /^readme\.md$/i.test(p) || /\/readme\.md$/i.test(p));
      if (!readmePath) continue;
      try {
        const text = await this.fileContent.getFileContent(repo.id, readmePath);
        if (text) chunks.push(`### ${repo.repoSlug}\n${text.slice(0, 4000)}`);
      } catch {
        /* ignore */
      }
    }
    return chunks.join('\n\n');
  }

  private async callLlm(userPrompt: string): Promise<string> {
    const baseUrl = resolveLlmBaseUrl().replace(/\/$/, '');
    const model = resolveLlmChatModel();
    const apiKey = resolveLlmApiKey();
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(llmDefaultHeaders() ?? {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Eres un arquitecto C4. Solo añades actores (person) y descripciones breves. PROHIBIDO inventar sistemas, dominios o integraciones no listadas en el prompt.',
          },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM ${res.status}: ${text.slice(0, 400)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  private parseJsonPayload(raw: string): LlmC4ContextPayload {
    const trimmed = raw.trim();
    const jsonText = trimmed.startsWith('{')
      ? trimmed
      : trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1);
    return JSON.parse(jsonText) as LlmC4ContextPayload;
  }

  private applyPayload(model: C4Model, payload: LlmC4ContextPayload): C4Model {
    const elements: C4Element[] = [...model.elements];
    const relationships: C4Relationship[] = [...model.relationships];
    const nameToId = new Map(elements.map((e) => [e.name.toLowerCase(), e.id] as const));
    let changed = false;

    for (const p of payload.persons ?? []) {
      const name = p.name?.trim();
      if (!name) continue;
      const personId = `person_${name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24).toLowerCase()}`;
      if (elements.some((e) => e.id === personId)) continue;
      elements.push({
        id: personId,
        kind: 'person',
        name,
        description: p.description?.trim(),
        evidence: [{ source: 'llm', reason: 'Actor inferido desde README/dominios' }],
      });
      changed = true;

      const targetName = p.usesSystemName?.trim().toLowerCase();
      const targetId = targetName ? nameToId.get(targetName) : elements.find((e) => e.kind === 'system')?.id;
      if (targetId) {
        relationships.push({
          id: `${personId}_uses_${targetId}`,
          from: personId,
          to: targetId,
          label: 'usa',
          evidence: [{ source: 'llm', reason: 'Relación actor → sistema' }],
        });
      }
    }

    for (const [elName, desc] of Object.entries(payload.descriptions ?? {})) {
      const id = nameToId.get(elName.trim().toLowerCase());
      const text = desc?.trim();
      if (!id || !text) continue;
      const idx = elements.findIndex((e) => e.id === id);
      if (idx < 0) continue;
      const prev = elements[idx]!;
      elements[idx] = {
        ...prev,
        description: text,
        evidence: [
          ...prev.evidence,
          { source: 'llm', reason: 'Descripción narrativa' },
        ],
      };
      changed = true;
    }

    if (!changed) return model;

    const contentHash = hashC4ModelPayload({
      projectId: model.projectId,
      level: 'context',
      elements,
      relationships,
    });

    return {
      ...model,
      generator: 'hybrid',
      contentHash,
      elements,
      relationships,
      generatedAt: new Date().toISOString(),
    };
  }
}
