import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminAccountDto, AdminCreateInput, AdminUpdateInput } from '@zapadictos/shared';
import argon2 from 'argon2';
import { ARGON2_OPTIONS } from '../../common/security/argon2-options.js';
import { ActorType, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Actor } from '../admin-catalog/admin-products.service.js';

@Injectable()
export class AdminAdminsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private log(actor: Actor, action: string, entityId: string, details?: Record<string, unknown>) {
    return this.audit.log({ action, actorType: ActorType.ADMIN, adminId: actor.adminId, entity: 'Admin', entityId, details, ip: actor.ip });
  }

  private toDto(admin: {
    id: string;
    name: string;
    email: string;
    active: boolean;
    mustChangePassword: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    createdBy: { name: string } | null;
  }): AdminAccountDto {
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      active: admin.active,
      mustChangePassword: admin.mustChangePassword,
      lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
      createdAt: admin.createdAt.toISOString(),
      createdByName: admin.createdBy?.name ?? null,
    };
  }

  async list(): Promise<AdminAccountDto[]> {
    const admins = await this.prisma.admin.findMany({
      orderBy: { createdAt: 'asc' },
      include: { createdBy: { select: { name: true } } },
    });
    return admins.map((a) => this.toDto(a));
  }

  async create(input: AdminCreateInput, actor: Actor): Promise<AdminAccountDto[]> {
    try {
      const admin = await this.prisma.admin.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: await argon2.hash(input.temporaryPassword, ARGON2_OPTIONS),
          mustChangePassword: true,
          createdById: actor.adminId,
        },
      });
      await this.log(actor, 'ADMIN_CREATED', admin.id, { name: admin.name, email: admin.email });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ message: 'Ya existe un administrador con ese correo' });
      }
      throw error;
    }
    return this.list();
  }

  /** Revoca todas las sesiones abiertas (desactivar o restablecer contraseña, docs/05-reglas-negocio.md). */
  private revokeSessions(adminId: string) {
    return this.prisma.adminSession.updateMany({
      where: { adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async update(id: string, input: AdminUpdateInput, actor: Actor): Promise<AdminAccountDto[]> {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException();

    if (input.active === false) {
      if (id === actor.adminId) {
        throw new ConflictException({ message: 'No puedes desactivarte a ti mismo' });
      }
      const otherActive = await this.prisma.admin.count({ where: { active: true, NOT: { id } } });
      if (otherActive === 0) {
        throw new ConflictException({ message: 'Debe quedar al menos un administrador activo' });
      }
      await this.prisma.admin.update({ where: { id }, data: { active: false } });
      await this.revokeSessions(id);
      await this.log(actor, 'ADMIN_DEACTIVATED', id);
    } else if (input.active === true) {
      await this.prisma.admin.update({ where: { id }, data: { active: true } });
      await this.log(actor, 'ADMIN_REACTIVATED', id);
    }

    if (input.temporaryPassword) {
      await this.prisma.admin.update({
        where: { id },
        data: { passwordHash: await argon2.hash(input.temporaryPassword, ARGON2_OPTIONS), mustChangePassword: true },
      });
      await this.revokeSessions(id);
      await this.log(actor, 'ADMIN_PASSWORD_RESET', id);
    }

    return this.list();
  }
}
