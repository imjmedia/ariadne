/**
 * @fileoverview CRUD de credenciales (Bitbucket/GitHub) con valores cifrados en BD. Resolución para sync y webhooks.
 */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CredentialEntity } from './entities/credential.entity';
import { encrypt, decrypt } from './crypto.util';
import type { CredentialActor } from './credential-actor';
import { isAdmin } from './credential-actor';

const CACHE_TTL_MS = 60_000; // 1 min — evita N+1 en sync

const SYNC_KINDS: CredentialEntity['kind'][] = ['token', 'app_password'];

/** Credenciales desencriptadas para Bitbucket (Bearer o Basic). */
export interface BitbucketAuth {
  type: 'bearer' | 'basic';
  token: string;
  username?: string;
}

/** DTO para crear una credencial (provider, kind, value cifrado, name, extra). */
export interface CredentialsCreateDto {
  provider: 'bitbucket' | 'github';
  kind: 'token' | 'app_password' | 'webhook_secret';
  value: string;
  name?: string | null;
  /** For app_password: { username } */
  extra?: Record<string, unknown> | null;
}

/**
 * Servicio de credenciales: create, findAll, findOne, update, delete; resolveForBitbucket/resolveForGitHub para uso en sync y APIs.
 */
@Injectable()
export class CredentialsService {
  private readonly bbCache = new Map<string, { data: BitbucketAuth; expiry: number }>();
  private readonly ghCache = new Map<string, { data: string; expiry: number }>();

  constructor(
    @InjectRepository(CredentialEntity)
    private readonly repo: Repository<CredentialEntity>,
  ) {}

  private assertActorForWrite(actor: CredentialActor): string {
    if (!actor.userId) {
      throw new BadRequestException(
        'Usuario no identificado. Inicia sesión de nuevo; el API debe enviar X-User-Id.',
      );
    }
    return actor.userId;
  }

  private async assertCanAccess(id: string, actor: CredentialActor): Promise<CredentialEntity> {
    const c = await this.repo.findOne({ where: { id }, relations: { user: true } });
    if (!c) throw new NotFoundException(`Credential ${id} not found`);
    if (isAdmin(actor)) return c;
    if (c.userId && actor.userId && c.userId === actor.userId) return c;
    throw new ForbiddenException('No tienes acceso a esta credencial');
  }

  private toPublicView(
    c: CredentialEntity & { user?: { email: string; name: string | null } | null },
  ): Omit<CredentialEntity, 'encryptedValue'> & {
    ownerEmail: string | null;
    ownerName: string | null;
  } {
    const { encryptedValue: _enc, user, ...rest } = c;
    return {
      ...rest,
      ownerEmail: user?.email ?? null,
      ownerName: user?.name ?? null,
    };
  }

  private resolveUserIdReassignment(
    existing: CredentialEntity,
    nextUserId: string | null | undefined,
    actor: CredentialActor,
  ): string | null | undefined {
    if (nextUserId === undefined) return undefined;
    const target = nextUserId === '' ? null : nextUserId;
    if (isAdmin(actor)) return target;
    if (!actor.userId) {
      throw new BadRequestException('Usuario no identificado');
    }
    if (target !== actor.userId) {
      throw new ForbiddenException('Solo un admin puede reasignar a otro usuario');
    }
    if (existing.userId != null && existing.userId !== actor.userId) {
      throw new ForbiddenException('Esta credencial ya pertenece a otro usuario');
    }
    return actor.userId;
  }

  /**
   * Crea una credencial: cifra value y guarda en BD (asociada al usuario).
   */
  async create(dto: CredentialsCreateDto, actor: CredentialActor): Promise<CredentialEntity> {
    if (dto.kind === 'webhook_secret' && !isAdmin(actor)) {
      throw new ForbiddenException('Los webhook secrets globales solo los gestiona un admin');
    }
    const userId = dto.kind === 'webhook_secret' ? null : this.assertActorForWrite(actor);

    let enc: string;
    try {
      enc = encrypt(dto.value);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('CREDENTIALS_ENCRYPTION_KEY')) {
        throw new Error(
          'CREDENTIALS_ENCRYPTION_KEY no configurada. Ejecuta: openssl rand -base64 32',
        );
      }
      throw e;
    }
    const entity = this.repo.create({
      provider: dto.provider,
      kind: dto.kind,
      name: dto.name ?? null,
      encryptedValue: enc,
      extra: dto.extra ?? null,
      userId,
    });
    return this.repo.save(entity);
  }

  /**
   * Lista credenciales del usuario (admin ve todas). Sin valor cifrado.
   */
  async findAll(
    provider: string | undefined,
    actor: CredentialActor,
  ): Promise<Omit<CredentialEntity, 'encryptedValue'>[]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .select([
        'c.id',
        'c.provider',
        'c.kind',
        'c.name',
        'c.userId',
        'c.createdAt',
        'c.updatedAt',
      ]);
    if (provider) qb.andWhere('c.provider = :provider', { provider });
    if (!isAdmin(actor)) {
      if (!actor.userId) return [];
      qb.andWhere('c.user_id = :userId', { userId: actor.userId });
    }
    qb.leftJoinAndSelect('c.user', 'u').orderBy('c.createdAt', 'DESC');
    const rows = await qb.getMany();
    return rows.map((c) => this.toPublicView(c));
  }

  async findOne(
    id: string,
    actor: CredentialActor,
  ): Promise<Omit<CredentialEntity, 'encryptedValue'> & { ownerEmail: string | null; ownerName: string | null }> {
    const c = await this.assertCanAccess(id, actor);
    return this.toPublicView(c);
  }

  async update(
    id: string,
    dto: {
      value?: string;
      name?: string | null;
      extra?: Record<string, unknown> | null;
      userId?: string | null;
    },
    actor: CredentialActor,
  ): Promise<Omit<CredentialEntity, 'encryptedValue'> & { ownerEmail: string | null; ownerName: string | null }> {
    let existing = await this.repo.findOne({ where: { id }, relations: { user: true } });
    if (!existing) throw new NotFoundException(`Credential ${id} not found`);

    const claimOnly =
      dto.userId !== undefined &&
      actor.userId &&
      dto.userId === actor.userId &&
      existing.userId == null;
    if (!claimOnly) {
      existing = await this.assertCanAccess(id, actor);
    } else if (!isAdmin(actor) && existing.kind === 'webhook_secret') {
      throw new ForbiddenException('No puedes reclamar un webhook secret global');
    }

    const updates: {
      name?: string | null;
      encryptedValue?: string;
      extra?: Record<string, unknown> | null;
      userId?: string | null;
    } = {};
    const nextOwner = this.resolveUserIdReassignment(existing, dto.userId, actor);
    if (nextOwner !== undefined) updates.userId = nextOwner;
    if (dto.name !== undefined) updates.name = dto.name ?? null;
    if (dto.extra !== undefined) updates.extra = dto.extra ?? null;
    if (dto.value != null && dto.value.trim() !== '') {
      try {
        updates.encryptedValue = encrypt(dto.value.trim());
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('CREDENTIALS_ENCRYPTION_KEY')) {
          throw new Error('CREDENTIALS_ENCRYPTION_KEY no configurada.');
        }
        throw e;
      }
    }

    if (Object.keys(updates).length === 0) return this.findOne(id, actor);
    await this.repo.update(existing.id, updates as Record<string, unknown>);
    this.bbCache.delete(id);
    this.ghCache.delete(id);
    return this.findOne(id, actor);
  }

  /** Reclama credencial legado (user_id null) para el usuario actual. */
  async claimForActor(
    id: string,
    actor: CredentialActor,
  ): Promise<Omit<CredentialEntity, 'encryptedValue'> & { ownerEmail: string | null; ownerName: string | null }> {
    return this.update(id, { userId: actor.userId ?? null }, actor);
  }

  async delete(id: string, actor: CredentialActor): Promise<void> {
    await this.assertCanAccess(id, actor);
    const r = await this.repo.delete(id);
    if (r.affected === 0) throw new NotFoundException(`Credential ${id} not found`);
    this.bbCache.delete(id);
    this.ghCache.delete(id);
  }

  /**
   * UUID de la credencial del usuario para sync/discovery (token o app_password más reciente).
   */
  async findRefForUser(
    userId: string,
    provider: 'bitbucket' | 'github',
  ): Promise<string | null> {
    const row = await this.repo.findOne({
      where: {
        userId,
        provider,
        kind: In(SYNC_KINDS),
      },
      order: { updatedAt: 'DESC' },
      select: ['id'],
    });
    return row?.id ?? null;
  }

  /**
   * Ref efectiva para sync: token del usuario que disparó el job, luego credentialsRef del repo, luego null (env).
   */
  async resolveRefForSync(options: {
    repoCredentialsRef: string | null;
    provider: string;
    triggeredByUserId?: string | null;
  }): Promise<string | null> {
    const { repoCredentialsRef, provider, triggeredByUserId } = options;
    if (
      triggeredByUserId &&
      (provider === 'bitbucket' || provider === 'github')
    ) {
      const userRef = await this.findRefForUser(
        triggeredByUserId,
        provider as 'bitbucket' | 'github',
      );
      if (userRef) return userRef;
    }
    return repoCredentialsRef;
  }

  async resolveForBitbucket(credentialsRef: string | null): Promise<BitbucketAuth | null> {
    if (!credentialsRef) return null;
    const cached = this.bbCache.get(credentialsRef);
    if (cached && cached.expiry > Date.now()) return cached.data;
    try {
      const c = await this.repo.findOne({ where: { id: credentialsRef } });
      if (!c || c.provider !== 'bitbucket') return null;
      const value = decrypt(c.encryptedValue);
      let data: BitbucketAuth;
      if (c.kind === 'app_password') {
        const username = (c.extra?.username as string) ?? '';
        data = { type: 'basic', token: value, username };
      } else if (c.kind === 'token') {
        const email = (c.extra?.email as string) ?? '';
        data = { type: 'basic', token: value, username: email };
      } else {
        return null;
      }
      this.bbCache.set(credentialsRef, { data, expiry: Date.now() + CACHE_TTL_MS });
      return data;
    } catch {
      return null;
    }
  }

  async resolveForGitHub(credentialsRef: string | null): Promise<string | null> {
    if (!credentialsRef) return null;
    const cached = this.ghCache.get(credentialsRef);
    if (cached && cached.expiry > Date.now()) return cached.data;
    try {
      const c = await this.repo.findOne({ where: { id: credentialsRef } });
      if (!c || c.provider !== 'github' || c.kind !== 'token') return null;
      const data = decrypt(c.encryptedValue);
      this.ghCache.set(credentialsRef, { data, expiry: Date.now() + CACHE_TTL_MS });
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Get webhook secret for provider. Checks DB first (kind=webhook_secret), then env.
   */
  async getWebhookSecret(provider: 'bitbucket'): Promise<string | null> {
    const fromDb = await this.repo.findOne({
      where: { provider, kind: 'webhook_secret' },
    });
    if (fromDb) {
      try {
        return decrypt(fromDb.encryptedValue);
      } catch {
        return null;
      }
    }
    if (provider === 'bitbucket') {
      return process.env.BITBUCKET_WEBHOOK_SECRET ?? null;
    }
    return null;
  }
}
