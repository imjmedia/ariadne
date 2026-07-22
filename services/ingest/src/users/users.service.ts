/**
 * @fileoverview Servicio de usuarios: CRUD, resolución SSO/OTP, tokens MCP, login password.
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserEntity, type UserRole } from './entities/user.entity';

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LEN = 8;

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  /** Seed admin desde env (BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD). */
  async onModuleInit(): Promise<void> {
    await this.ensureBootstrapAdmin();
  }

  /**
   * Crea o actualiza el admin bootstrap si hay env.
   * Si el email ya existe: asegura rol admin; solo setea password si falta o BOOTSTRAP_ADMIN_PASSWORD_FORCE=1.
   */
  async ensureBootstrapAdmin(): Promise<void> {
    const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? '').trim().toLowerCase();
    const password = (process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '').trim();
    if (!email) return;
    if (!password) {
      this.logger.warn(
        'BOOTSTRAP_ADMIN_EMAIL definido sin BOOTSTRAP_ADMIN_PASSWORD — seed omitido',
      );
      return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      this.logger.warn(
        `BOOTSTRAP_ADMIN_PASSWORD demasiado corta (mín. ${MIN_PASSWORD_LEN}) — seed omitido`,
      );
      return;
    }

    const force =
      (process.env.BOOTSTRAP_ADMIN_PASSWORD_FORCE ?? '').trim().toLowerCase() === '1' ||
      (process.env.BOOTSTRAP_ADMIN_PASSWORD_FORCE ?? '').trim().toLowerCase() === 'true';

    let user = await this.repo.findOne({ where: { email } });
    if (!user) {
      user = this.repo.create({
        email,
        name: email.split('@')[0] ?? 'admin',
        role: 'admin',
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      });
      await this.repo.save(user);
      this.logger.log(`Bootstrap admin creado: ${email}`);
      return;
    }

    let dirty = false;
    if (user.role !== 'admin') {
      user.role = 'admin';
      dirty = true;
    }
    if (!user.passwordHash || force) {
      user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      dirty = true;
    }
    if (dirty) {
      await this.repo.save(user);
      this.logger.log(`Bootstrap admin actualizado: ${email}`);
    }
  }

  /** Busca un usuario por email. Si no existe y createIfMissing=true, lo crea con rol 'developer'. */
  async resolveByEmail(
    email: string,
    createIfMissing = false,
  ): Promise<{ id: string; email: string; role: UserRole; name: string | null; isNew: boolean }> {
    const normalized = email.trim().toLowerCase();
    let user = await this.repo.findOne({ where: { email: normalized } });
    let isNew = false;

    if (!user) {
      if (!createIfMissing) {
        throw new NotFoundException(`Usuario ${normalized} no encontrado`);
      }
      user = this.repo.create({
        email: normalized,
        name: normalized.split('@')[0] ?? null,
        role: 'developer',
      });
      user = await this.repo.save(user);
      isNew = true;
    }

    return { id: user.id, email: user.email, role: user.role, name: user.name, isNew };
  }

  /** Listar todos los usuarios (sin datos sensibles). */
  async findAll(): Promise<
    Array<{
      id: string;
      email: string;
      name: string | null;
      role: UserRole;
      hasMcpToken: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    const users = await this.repo.find({ order: { createdAt: 'ASC' } });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      hasMcpToken: !!u.mcpTokenHash,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }

  /** Obtener un usuario por ID. */
  async findOne(id: string): Promise<{
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    mcpTokenPrefix: string | null;
    hasMcpToken: boolean;
    hasMcpSecret: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mcpTokenPrefix: user.mcpTokenPrefix,
      hasMcpToken: !!user.mcpTokenHash,
      hasMcpSecret: !!user.mcpSecret,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * GET /users/:id/mcp-secret
   * Retorna el mcpSecret en texto plano (para mostrar en UI con toggle).
   * Si no existe pero hay hash (migración), genera el mcpSecret automáticamente.
   */
  async getMcpSecret(userId: string): Promise<{ mcpSecret: string; email: string; prefix: string }> {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`Usuario ${userId} no encontrado`);

    // Si no tiene mcpSecret pero tiene hash (migración de datos), generar automático
    if (!user.mcpSecret && user.mcpTokenHash) {
      const secret = `ari_${crypto.randomBytes(32).toString('hex')}`;
      const prefix = secret.slice(0, 8);
      user.mcpSecret = secret;
      if (!user.mcpTokenPrefix) user.mcpTokenPrefix = prefix;
      await this.repo.save(user);
      return { mcpSecret: secret, email: user.email, prefix };
    }

    // Si no tiene nada, generar por primera vez
    if (!user.mcpSecret) {
      const secret = `ari_${crypto.randomBytes(32).toString('hex')}`;
      const prefix = secret.slice(0, 8);
      const hash = await bcrypt.hash(secret, 10);
      user.mcpSecret = secret;
      user.mcpTokenPrefix = prefix;
      user.mcpTokenHash = hash;
      await this.repo.save(user);
      return { mcpSecret: secret, email: user.email, prefix };
    }

    return { mcpSecret: user.mcpSecret, email: user.email, prefix: user.mcpTokenPrefix ?? user.mcpSecret.slice(0, 8) };
  }

  /** Cambiar rol de un usuario. Solo admin puede hacerlo. */
  async updateRole(id: string, role: UserRole): Promise<{ id: string; email: string; role: UserRole }> {
    if (role !== 'admin' && role !== 'developer') {
      throw new BadRequestException('Rol inválido. Use admin o developer.');
    }
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    user.role = role;
    await this.repo.save(user);
    return { id: user.id, email: user.email, role: user.role };
  }

  /** Genera un nuevo token MCP para el usuario. Retorna el token en texto plano. */
  async regenerateMcpToken(userId: string): Promise<{ token: string; prefix: string }> {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`Usuario ${userId} no encontrado`);

    const token = `ari_${crypto.randomBytes(32).toString('hex')}`;
    const prefix = token.slice(0, 8);
    const hash = await bcrypt.hash(token, 10);

    user.mcpSecret = token;
    user.mcpTokenHash = hash;
    user.mcpTokenPrefix = prefix;
    await this.repo.save(user);

    return { token, prefix };
  }

  /** Valida un token MCP contra el hash o mcpSecret almacenado. Devuelve el usuario o null. */
  async validateMcpToken(
    token: string,
  ): Promise<{ id: string; email: string; role: UserRole; name: string | null } | null> {
    if (!token.trim()) return null;

    const users = await this.repo.find({ select: ['id', 'email', 'role', 'name', 'mcpTokenHash', 'mcpSecret'] });
    for (const user of users) {
      // Primero compara con mcpSecret (rápido, texto plano)
      if (user.mcpSecret && user.mcpSecret === token) {
        return { id: user.id, email: user.email, role: user.role, name: user.name };
      }
      // Fallback: comparar con bcrypt (tokens viejos)
      if (user.mcpTokenHash) {
        const valid = await bcrypt.compare(token, user.mcpTokenHash);
        if (valid) {
          return { id: user.id, email: user.email, role: user.role, name: user.name };
        }
      }
    }

    return null;
  }

  /** Crear un usuario manualmente (admin). Devuelve error si ya existe. */
  async create(
    email: string,
    name?: string,
    role?: UserRole,
    password?: string,
  ): Promise<{ id: string; email: string; role: UserRole }> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.repo.findOne({ where: { email: normalized } });
    if (existing) throw new ConflictException(`El email ${normalized} ya está registrado`);

    let passwordHash: string | null = null;
    if (password?.trim()) {
      if (password.trim().length < MIN_PASSWORD_LEN) {
        throw new BadRequestException(`Contraseña mínimo ${MIN_PASSWORD_LEN} caracteres`);
      }
      passwordHash = await bcrypt.hash(password.trim(), BCRYPT_ROUNDS);
    }

    const user = this.repo.create({
      email: normalized,
      name: (name?.trim() || normalized.split('@')[0]) ?? null,
      role: role ?? 'developer',
      passwordHash,
    });
    const saved = await this.repo.save(user);
    return { id: saved.id, email: saved.email, role: saved.role };
  }

  /** Actualiza contraseña de un usuario (admin o bootstrap). */
  async setPassword(id: string, password: string): Promise<{ id: string; email: string }> {
    if (!password?.trim() || password.trim().length < MIN_PASSWORD_LEN) {
      throw new BadRequestException(`Contraseña mínimo ${MIN_PASSWORD_LEN} caracteres`);
    }
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    user.passwordHash = await bcrypt.hash(password.trim(), BCRYPT_ROUNDS);
    await this.repo.save(user);
    return { id: user.id, email: user.email };
  }

  /**
   * Login email+password. Devuelve usuario o lanza UnauthorizedException.
   */
  async validatePasswordLogin(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string; role: UserRole; name: string | null }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.repo.findOne({ where: { email: normalized } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return { id: user.id, email: user.email, role: user.role, name: user.name };
  }

  /** Eliminar un usuario. */
  async delete(id: string): Promise<void> {
    const r = await this.repo.delete(id);
    if (r.affected === 0) throw new NotFoundException(`Usuario ${id} no encontrado`);
  }

  /** Contar usuarios registrados. */
  async count(): Promise<number> {
    return this.repo.count();
  }

  /** Crear el primer administrador (solo si no hay usuarios). */
  async registerFirstAdmin(
    email: string,
    name?: string,
    password?: string,
  ): Promise<{
    id: string;
    email: string;
    role: UserRole;
    name: string | null;
  }> {
    const existing = await this.repo.count();
    if (existing > 0) {
      throw new BadRequestException('Ya existen usuarios registrados');
    }
    const normalized = email.trim().toLowerCase();
    let passwordHash: string | null = null;
    if (password?.trim()) {
      if (password.trim().length < MIN_PASSWORD_LEN) {
        throw new BadRequestException(`Contraseña mínimo ${MIN_PASSWORD_LEN} caracteres`);
      }
      passwordHash = await bcrypt.hash(password.trim(), BCRYPT_ROUNDS);
    }
    const user = this.repo.create({
      email: normalized,
      name: (name?.trim() || normalized.split('@')[0]) ?? null,
      role: 'admin',
      passwordHash,
    });
    const saved = await this.repo.save(user);
    return { id: saved.id, email: saved.email, role: saved.role, name: saved.name };
  }
}
