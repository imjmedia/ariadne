/**
 * Shared FalkorDB client for ingest.
 * Avoids connect/close per Cypher call (floods MAX_QUEUED_QUERIES and can crash on socket errors).
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { FalkorDB } from 'falkordb';
import { getFalkorConfig } from './falkor';

export type FalkorDbClient = Awaited<ReturnType<typeof FalkorDB.connect>>;

@Injectable()
export class FalkorClientService implements OnModuleDestroy {
  private readonly logger = new Logger(FalkorClientService.name);
  private client: FalkorDbClient | null = null;
  private connecting: Promise<FalkorDbClient> | null = null;

  async getClient(): Promise<FalkorDbClient> {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;
    this.connecting = this.connect();
    try {
      this.client = await this.connecting;
      return this.client;
    } finally {
      this.connecting = null;
    }
  }

  private async connect(): Promise<FalkorDbClient> {
    const config = getFalkorConfig();
    const c = await FalkorDB.connect({
      pingInterval: 30_000,
      socket: {
        host: config.host,
        port: config.port,
        ...({
          reconnectStrategy: (retries: number) => {
            if (retries > 100) {
              return new Error('[ingest] FalkorDB reconnection limit exceeded');
            }
            return Math.min(retries * 50, 2_000);
          },
        } as object),
      },
    });
    c.on('error', (err: Error) => {
      // Without a listener, Node terminates on SocketClosedUnexpectedlyError.
      this.logger.error(`FalkorDB client error: ${err?.message ?? err}`);
    });
    return c;
  }

  /** Drop cached client so the next getClient() reconnects (after fatal socket loss). */
  async reset(): Promise<void> {
    const prev = this.client;
    this.client = null;
    if (prev) {
      try {
        await prev.close();
      } catch {
        /* ignore */
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.reset();
  }
}
