import { createHash, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { loadEnv } from '../../config/env.js';
import { API_PREFIX } from '../../setup-app.js';
import type { ImageType } from './image-type.js';

export interface StoredImage {
  url: string;
  publicId: string;
}

export abstract class ImageStorage {
  abstract upload(buffer: Buffer, type: ImageType, folder: string): Promise<StoredImage>;
  abstract delete(publicId: string): Promise<void>;
}

/** Imágenes en disco, solo para desarrollo y pruebas. */
@Injectable()
export class LocalImageStorage extends ImageStorage {
  readonly dir = resolve(loadEnv().UPLOADS_DIR);

  async upload(buffer: Buffer, type: ImageType): Promise<StoredImage> {
    await mkdir(this.dir, { recursive: true });
    // El nombre lo genera la API: nunca se usa el nombre que manda el usuario.
    const name = `${randomUUID()}.${type.ext}`;
    await writeFile(join(this.dir, name), buffer, { flag: 'wx' });
    return { url: `/${API_PREFIX}/uploads/${name}`, publicId: `local:${name}` };
  }

  async delete(publicId: string): Promise<void> {
    const name = publicId.replace(/^local:/, '');
    if (!LOCAL_FILE.test(name)) return;
    await unlink(join(this.dir, name)).catch(() => undefined);
  }
}

export const LOCAL_FILE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

/**
 * Cloudinary con subida firmada desde el servidor: la clave secreta nunca
 * sale de la API. https://cloudinary.com/documentation/upload_images
 */
@Injectable()
export class CloudinaryImageStorage extends ImageStorage {
  private readonly logger = new Logger('Cloudinary');
  private readonly config: { key: string; secret: string; cloud: string };

  constructor() {
    super();
    const url = new URL(loadEnv().CLOUDINARY_URL!);
    this.config = {
      key: decodeURIComponent(url.username),
      secret: decodeURIComponent(url.password),
      cloud: url.hostname,
    };
  }

  private sign(params: Record<string, string>): string {
    const toSign = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    return createHash('sha1').update(toSign + this.config.secret).digest('hex');
  }

  private async call(action: 'upload' | 'destroy', params: Record<string, string>, file?: Blob) {
    const form = new FormData();
    const signed = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
    for (const [k, v] of Object.entries(signed)) form.append(k, v);
    form.append('api_key', this.config.key);
    form.append('signature', this.sign(signed));
    if (file) form.append('file', file);

    // Dominio fijo: la API nunca hace peticiones a URLs que mande el usuario (A10).
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.config.cloud}/image/${action}`,
      { method: 'POST', body: form, signal: AbortSignal.timeout(20_000) },
    );
    if (!response.ok) {
      this.logger.error(`Cloudinary ${action} respondió ${response.status}`);
      throw new ServiceUnavailableException({ message: 'No se pudo guardar la imagen. Inténtalo de nuevo.' });
    }
    return (await response.json()) as { secure_url?: string; public_id?: string };
  }

  async upload(buffer: Buffer, type: ImageType, folder: string): Promise<StoredImage> {
    const result = await this.call(
      'upload',
      { folder: `zapadictos/${folder}`, public_id: randomUUID() },
      new Blob([new Uint8Array(buffer)], { type: type.mime }),
    );
    if (!result.secure_url || !result.public_id) {
      throw new ServiceUnavailableException({ message: 'No se pudo guardar la imagen. Inténtalo de nuevo.' });
    }
    // f_auto/q_auto: Cloudinary entrega el formato y la calidad óptimos.
    const url = result.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto,c_limit,w_1600/');
    return { url, publicId: result.public_id };
  }

  async delete(publicId: string): Promise<void> {
    if (publicId.startsWith('local:')) return;
    await this.call('destroy', { public_id: publicId }).catch((error: unknown) => {
      // Si falla el borrado remoto, la foto ya no está en la tienda;
      // queda en el log para limpiarla a mano.
      this.logger.warn(`No se pudo borrar ${publicId}: ${String(error)}`);
    });
  }
}
