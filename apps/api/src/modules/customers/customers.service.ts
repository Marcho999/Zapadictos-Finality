import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MAX_ADDRESSES,
  type AddressDto,
  type CustomerMeDto,
  type addressCreateSchema,
  type addressUpdateSchema,
  type profileUpdateSchema,
  type z,
} from '@zapadictos/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toCustomerMe } from '../customer-auth/customer-auth.service.js';

const addressSelect = {
  id: true,
  label: true,
  recipientName: true,
  phone: true,
  department: true,
  city: true,
  line1: true,
  notes: true,
  isDefault: true,
} as const;

/**
 * Perfil y direcciones (HU-08). Toda consulta filtra por el cliente de la
 * sesión; si la dirección es de otro, responde 404 (docs/06-seguridad.md A01).
 */
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(customerId: string): Promise<CustomerMeDto> {
    return toCustomerMe(await this.prisma.customer.findUniqueOrThrow({ where: { id: customerId } }));
  }

  async updateMe(customerId: string, input: z.output<typeof profileUpdateSchema>): Promise<CustomerMeDto> {
    return toCustomerMe(await this.prisma.customer.update({ where: { id: customerId }, data: input }));
  }

  addresses(customerId: string): Promise<AddressDto[]> {
    return this.prisma.address.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: addressSelect,
    });
  }

  async createAddress(customerId: string, input: z.output<typeof addressCreateSchema>): Promise<AddressDto[]> {
    await this.prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { customerId } });
      if (count >= MAX_ADDRESSES) {
        throw new ConflictException({ message: `Puedes guardar hasta ${MAX_ADDRESSES} direcciones. Borra una para agregar otra.` });
      }
      // La primera dirección siempre queda como predeterminada.
      const isDefault = input.isDefault || count === 0;
      if (isDefault) await tx.address.updateMany({ where: { customerId }, data: { isDefault: false } });
      await tx.address.create({ data: { ...input, isDefault, customerId } });
    });
    return this.addresses(customerId);
  }

  async updateAddress(customerId: string, id: string, input: z.output<typeof addressUpdateSchema>): Promise<AddressDto[]> {
    await this.prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({ where: { id, customerId } });
      if (!address) throw new NotFoundException();
      // No se puede "quitar" la predeterminada sin elegir otra.
      const data = { ...input, isDefault: input.isDefault === false && address.isDefault ? undefined : input.isDefault };
      if (data.isDefault) await tx.address.updateMany({ where: { customerId }, data: { isDefault: false } });
      await tx.address.update({ where: { id }, data });
    });
    return this.addresses(customerId);
  }

  async deleteAddress(customerId: string, id: string): Promise<AddressDto[]> {
    await this.prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({ where: { id, customerId } });
      if (!address) throw new NotFoundException();
      await tx.address.delete({ where: { id } });
      if (address.isDefault) {
        const next = await tx.address.findFirst({ where: { customerId }, orderBy: { createdAt: 'asc' } });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
    return this.addresses(customerId);
  }
}
