/**
 * @fileoverview Respuestas de chat para diagramas C4 (sin LLM).
 */
import { Injectable, Logger } from '@nestjs/common';
import { C4Service } from './c4.service';

@Injectable()
export class C4ChatBridgeService {
  private readonly logger = new Logger(C4ChatBridgeService.name);

  constructor(private readonly c4: C4Service) {}

  async buildChatAnswer(projectId: string): Promise<{ answer: string }> {
    try {
      let container = await this.c4.getModel(projectId, 'container');
      if (!container) {
        await this.c4.generateContainer(projectId);
        container = await this.c4.getModel(projectId, 'container');
      }
      const context = await this.c4.getModel(projectId, 'context');

      const base = process.env.INGEST_PUBLIC_URL?.replace(/\/$/, '') ?? '';
      const htmlContainer = base
        ? `${base}/projects/${projectId}/c4/html?level=container`
        : `GET /projects/${projectId}/c4/html?level=container`;
      const htmlContext = base
        ? `${base}/projects/${projectId}/c4/html?level=context`
        : `GET /projects/${projectId}/c4/html?level=context`;

      const containers =
        container?.elements.filter((e) => e.kind === 'container').map((e) => e.name) ?? [];
      const externals =
        context?.elements.filter((e) => e.kind === 'external').map((e) => e.name) ?? [];

      const lines = [
        '## Diagrama C4',
        '',
        context
          ? `**Contexto:** ${externals.length ? externals.join(', ') : 'sin sistemas externos declarados'}`
          : '_Sin snapshot Context — genera desde Arquitectura → Diagramas C4._',
        '',
        `**Contenedores:** ${containers.length ? containers.join(', ') : '—'}`,
        '',
        '### Enlaces',
        '',
        `- [HTML Container](${htmlContainer})`,
        context ? `- [HTML Context](${htmlContext})` : null,
        `- UI: Proyecto → pestaña **Arquitectura** → **Diagramas C4**`,
        '',
        '> Generado desde snapshots C4 (docker-compose + dominios). Regenera con POST `/c4/generate`.',
      ].filter(Boolean);

      return { answer: lines.join('\n') };
    } catch (err) {
      this.logger.warn(
        `C4 chat answer: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        answer:
          'No pude generar el diagrama C4. Verifica sync, dominios y Ajustes → Sistema → C4 habilitado.',
      };
    }
  }
}
