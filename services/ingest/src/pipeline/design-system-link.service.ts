/**
 * Post-sync: link Components to shadcn/Kreo design-system imports via File IMPORTS edges.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ChatCypherService } from '../chat/chat-cypher.service';

const SHADCN_PATTERNS = [
  '/components/ui/',
  '@/components/ui/',
  'components/ui/',
];

const KREO_PATTERNS = ['@kreo/', '/kreo/', 'kreo-ui', '@kreodevs/kreo'];

function classifyImportPath(importPath: string): 'shadcn' | 'kreo' | null {
  const p = importPath.toLowerCase();
  if (SHADCN_PATTERNS.some((x) => p.includes(x.replace('@/', '')) || p.includes('components/ui'))) {
    return 'shadcn';
  }
  if (KREO_PATTERNS.some((x) => p.includes(x.toLowerCase()))) return 'kreo';
  return null;
}

@Injectable()
export class DesignSystemLinkService {
  private readonly logger = new Logger(DesignSystemLinkService.name);

  constructor(private readonly cypher: ChatCypherService) {}

  async linkAfterSync(projectId: string, repoId: string): Promise<{ linked: number }> {
    const rows = (await this.cypher.executeCypher(
      projectId,
      `MATCH (a:File {projectId: $projectId, repoId: $repoId})-[:IMPORTS]->(b:File)
       RETURN a.path AS fromPath, b.path AS toPath`,
      { repoId },
    )) as Array<{ fromPath?: string; toPath?: string }>;

    let linked = 0;
    for (const row of rows) {
      const fromPath = String(row.fromPath ?? '');
      const toPath = String(row.toPath ?? '');
      const lib = classifyImportPath(toPath);
      if (!lib) continue;
      const compRows = (await this.cypher.executeCypher(
        projectId,
        `MATCH (f:File {path: $fromPath, projectId: $projectId, repoId: $repoId})-[:CONTAINS]->(c:Component)
         RETURN c.name AS name LIMIT 5`,
        { fromPath, repoId },
      )) as Array<{ name?: string }>;
      for (const cr of compRows) {
        const compName = String(cr.name ?? '');
        if (!compName) continue;
        const dsName = `${lib}:${toPath.split('/').pop()?.replace(/\.tsx?$/, '') ?? 'unknown'}`;
        await this.cypher.executeCypher(
          projectId,
          `MERGE (ds:DesignSystemComponent {name: $dsName, library: $lib, projectId: $projectId, repoId: $repoId})
           ON CREATE SET ds.importPath = $toPath
           WITH ds
           MATCH (c:Component {name: $compName, projectId: $projectId, repoId: $repoId})
           MERGE (c)-[:USES_DS_COMPONENT]->(ds)`,
          { dsName, lib, toPath, compName, repoId },
        );
        linked++;
      }
    }
    if (linked > 0) this.logger.log(`Design-system links: ${linked} for repo ${repoId}`);
    return { linked };
  }
}
