import { Injectable } from '@nestjs/common';
import type { BrandDto, CategoryDto } from '@zapadictos/shared';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  brands(): Promise<BrandDto[]> {
    return this.prisma.brand.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { slug: true, name: true },
    });
  }

  categories(): Promise<CategoryDto[]> {
    return this.prisma.category.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { slug: true, name: true },
    });
  }

  async banner() {
    const banner = await this.prisma.banner.findFirst({
      select: {
        tag: true,
        title: true,
        subtitle: true,
        imageUrl: true,
        ctaLabel: true,
        ctaHref: true,
      },
    });
    return banner;
  }
}
