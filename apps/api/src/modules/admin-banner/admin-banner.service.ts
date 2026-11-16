import { Injectable, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import type { AdminBannerDto, AdminBannerUpdateInput } from '@zapadictos/shared';
import { ActorType } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService, diff } from '../audit/audit.service.js';
import type { Actor } from '../admin-catalog/admin-products.service.js';
import { ImageStorage } from '../storage/image-storage.js';
import { detectImageType } from '../storage/image-type.js';

@Injectable()
export class AdminBannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: ImageStorage,
  ) {}

  private async toDto(bannerId: string): Promise<AdminBannerDto> {
    const banner = await this.prisma.banner.findUniqueOrThrow({
      where: { id: bannerId },
      include: { updatedBy: { select: { name: true } } },
    });
    return {
      tag: banner.tag,
      title: banner.title,
      subtitle: banner.subtitle,
      imageUrl: banner.imageUrl,
      ctaLabel: banner.ctaLabel,
      ctaHref: banner.ctaHref,
      updatedAt: banner.updatedAt.toISOString(),
      updatedByName: banner.updatedBy?.name ?? null,
    };
  }

  async get(): Promise<AdminBannerDto> {
    const banner = await this.prisma.banner.findFirst();
    if (!banner) throw new NotFoundException();
    return this.toDto(banner.id);
  }

  async update(
    input: AdminBannerUpdateInput,
    file: { buffer: Buffer; size: number } | undefined,
    actor: Actor,
  ): Promise<AdminBannerDto> {
    const before = await this.prisma.banner.findFirst();
    if (!before) throw new NotFoundException();

    let image: { url: string; publicId: string } | undefined;
    if (file) {
      const type = detectImageType(file.buffer);
      if (!type) throw new UnsupportedMediaTypeException({ message: 'Solo se permiten imágenes JPEG, PNG o WebP' });
      image = await this.storage.upload(file.buffer, type, 'banner');
    }

    try {
      const after = await this.prisma.banner.update({
        where: { id: before.id },
        data: {
          ...input,
          ...(image && { imageUrl: image.url, imagePublicId: image.publicId }),
          updatedById: actor.adminId,
        },
      });
      await this.audit.log({
        action: 'BANNER_UPDATED',
        actorType: ActorType.ADMIN,
        adminId: actor.adminId,
        entity: 'Banner',
        entityId: before.id,
        details: diff(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>),
        ip: actor.ip,
      });
    } catch (error) {
      if (image) await this.storage.delete(image.publicId);
      throw error;
    }
    // Solo se borra la foto anterior cuando la nueva ya quedó guardada en la base.
    if (image && before.imagePublicId) await this.storage.delete(before.imagePublicId);

    return this.toDto(before.id);
  }
}
