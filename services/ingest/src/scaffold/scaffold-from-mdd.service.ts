/**
 * @fileoverview Scaffold Nest/React/Prisma skeleton from persisted or live MDD.
 */
import { Injectable } from '@nestjs/common';
import type { MddEvidenceDocument } from '../chat/mdd-document.types';
import { MddPersistenceService } from '../mdd-persistence/mdd-persistence.service';
import { ChatService } from '../chat/chat.service';

export type ScaffoldTarget = 'nest' | 'react' | 'prisma';

export interface ScaffoldFile {
  path: string;
  content: string;
}

export interface ScaffoldResult {
  targets: ScaffoldTarget[];
  files: ScaffoldFile[];
  warnings: string[];
}

@Injectable()
export class ScaffoldFromMddService {
  constructor(
    private readonly mddPersistence: MddPersistenceService,
    private readonly chat: ChatService,
  ) {}

  async resolveMdd(
    repositoryId: string,
    projectId: string,
    mddOverride?: MddEvidenceDocument,
  ): Promise<MddEvidenceDocument> {
    if (mddOverride) return mddOverride;
    const snap = await this.mddPersistence.getLatest(repositoryId);
    if (snap?.mddJson) return snap.mddJson as unknown as MddEvidenceDocument;
    return this.chat.buildMddEvidenceForRepository(
      repositoryId,
      projectId,
      'Scaffold from MDD',
      '',
      [],
      false,
    );
  }

  async generate(
    repositoryId: string,
    projectId: string,
    targets: ScaffoldTarget[],
    mddOverride?: MddEvidenceDocument,
  ): Promise<ScaffoldResult> {
    const mdd = await this.resolveMdd(repositoryId, projectId, mddOverride);
    const files: ScaffoldFile[] = [];
    const warnings: string[] = [];
    const tset = new Set(targets.length ? targets : (['nest', 'react', 'prisma'] as ScaffoldTarget[]));

    if (tset.has('prisma')) {
      files.push(...this.scaffoldPrisma(mdd));
    }
    if (tset.has('nest')) {
      files.push(...this.scaffoldNest(mdd, warnings));
    }
    if (tset.has('react')) {
      files.push(...this.scaffoldReact(mdd, warnings));
    }

    return { targets: [...tset], files, warnings };
  }

  private scaffoldPrisma(mdd: MddEvidenceDocument): ScaffoldFile[] {
    const entities = mdd.entities ?? [];
    if (!entities.length) {
      return [
        {
          path: 'prisma/schema.prisma',
          content: `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n`,
        },
      ];
    }
    const lines = [
      'generator client {',
      '  provider = "prisma-client-js"',
      '}',
      '',
      'datasource db {',
      '  provider = "postgresql"',
      '  url      = env("DATABASE_URL")',
      '}',
      '',
    ];
    for (const e of entities) {
      const name = String((e as Record<string, unknown>).name ?? 'Model');
      lines.push(`model ${name} {`);
      lines.push('  id String @id @default(uuid())');
      lines.push('  createdAt DateTime @default(now())');
      lines.push('  updatedAt DateTime @updatedAt');
      lines.push('}');
      lines.push('');
    }
    return [{ path: 'prisma/schema.prisma', content: lines.join('\n') }];
  }

  private scaffoldNest(mdd: MddEvidenceDocument, warnings: string[]): ScaffoldFile[] {
    const contracts = mdd.api_contracts ?? [];
    const byTag = new Map<string, Array<Record<string, unknown>>>();
    for (const c of contracts) {
      const row = c as Record<string, unknown>;
      const tag = String(row.tag ?? row.controller ?? 'App');
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(row);
    }
    if (byTag.size === 0) {
      warnings.push('No api_contracts in MDD; generated minimal AppModule only.');
      return [
        {
          path: 'src/app.module.ts',
          content: `import { Module } from '@nestjs/common';\n\n@Module({\n  imports: [],\n  controllers: [],\n  providers: [],\n})\nexport class AppModule {}\n`,
        },
      ];
    }
    const files: ScaffoldFile[] = [];
    const moduleImports: string[] = [];
    const moduleNames: string[] = [];
    for (const [tag, ops] of byTag) {
      const modName = `${tag}Module`;
      const ctrlName = `${tag}Controller`;
      moduleNames.push(modName);
      moduleImports.push(`import { ${modName} } from './${tag.toLowerCase()}/${tag.toLowerCase()}.module';`);
      const routes = ops
        .map((op) => {
          const method = String(op.method ?? 'get').toLowerCase();
          const path = String(op.path ?? '/').replace(/^\//, '');
          const fn = `${method}${path.replace(/[^a-zA-Z0-9]/g, '_') || 'root'}`;
          return `  @${method.charAt(0).toUpperCase()}${method.slice(1)}('${path}')\n  ${fn}() {\n    return { ok: true, stub: true };\n  }`;
        })
        .join('\n\n');
      files.push({
        path: `src/${tag.toLowerCase()}/${tag.toLowerCase()}.controller.ts`,
        content: `import { Controller${ops.some((o) => o.method) ? ', Get, Post, Put, Patch, Delete' : ', Get'} } from '@nestjs/common';\n\n@Controller('${tag.toLowerCase()}')\nexport class ${ctrlName} {\n${routes || '  @Get()\n  list() {\n    return [];\n  }'}\n}\n`,
      });
      files.push({
        path: `src/${tag.toLowerCase()}/${tag.toLowerCase()}.module.ts`,
        content: `import { Module } from '@nestjs/common';\nimport { ${ctrlName} } from './${tag.toLowerCase()}.controller';\n\n@Module({\n  controllers: [${ctrlName}],\n})\nexport class ${modName} {}\n`,
      });
    }
    files.push({
      path: 'src/app.module.ts',
      content: `${moduleImports.join('\n')}\nimport { Module } from '@nestjs/common';\n\n@Module({\n  imports: [${moduleNames.join(', ')}],\n})\nexport class AppModule {}\n`,
    });
    files.push({
      path: 'src/main.ts',
      content: `import { NestFactory } from '@nestjs/core';\nimport { AppModule } from './app.module';\n\nasync function bootstrap() {\n  const app = await NestFactory.create(AppModule);\n  app.setGlobalPrefix('api');\n  await app.listen(process.env.PORT ?? 3000);\n}\nbootstrap();\n`,
    });
    return files;
  }

  private scaffoldReact(mdd: MddEvidenceDocument, warnings: string[]): ScaffoldFile[] {
    const paths = (mdd.evidence_paths ?? []).filter((p) =>
      /routes?|pages?|views?/i.test(p),
    );
    const routePaths =
      paths.length > 0
        ? [...new Set(paths.map((p) => {
            const base = p.split('/').pop()?.replace(/\.tsx?$/, '') ?? 'home';
            return `/${base}`;
          }))]
        : ['/'];
    if (paths.length === 0) warnings.push('No route paths in evidence_paths; using / only.');
    const imports = routePaths
      .map((r) => {
        const name = r.replace(/^\//, '').replace(/[^a-zA-Z0-9]/g, '') || 'Home';
        const comp = name.charAt(0).toUpperCase() + name.slice(1) + 'Page';
        return { r, comp };
      });
    const files: ScaffoldFile[] = imports.map(({ r, comp }) => ({
      path: `src/pages/${comp}.tsx`,
      content: `export function ${comp}() {\n  return (\n    <main className="p-6">\n      <h1 className="text-xl font-semibold">${comp}</h1>\n      <p className="text-muted-foreground">Scaffold from MDD — implement business logic.</p>\n    </main>\n  );\n}\n`,
    }));
    const routeEls = imports
      .map(
        ({ r, comp }) =>
          `      <Route path="${r === '/' ? '/' : r}" element={<${comp} />} />`,
      )
      .join('\n');
    files.push({
      path: 'src/App.tsx',
      content: `import { BrowserRouter, Routes, Route } from 'react-router-dom';\n${imports.map(({ comp }) => `import { ${comp} } from './pages/${comp}';`).join('\n')}\n\nexport default function App() {\n  return (\n    <BrowserRouter>\n      <Routes>\n${routeEls}\n      </Routes>\n    </BrowserRouter>\n  );\n}\n`,
    });
    files.push({
      path: 'src/api/client.ts',
      content: `const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';\n\nexport async function apiGet(path: string) {\n  const res = await fetch(\`\${BASE}\${path.startsWith('/') ? path : \`/\${path}\`}\`);\n  if (!res.ok) throw new Error(\`HTTP \${res.status}\`);\n  return res.json();\n}\n`,
    });
    return files;
  }
}
