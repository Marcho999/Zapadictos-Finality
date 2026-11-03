import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'node:path';
import { ImageStorage, LOCAL_FILE, LocalImageStorage } from './image-storage.js';

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

/** Sirve las imágenes guardadas en disco (solo en desarrollo y pruebas). */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: ImageStorage) {}

  @Get(':name')
  serve(@Param('name') name: string, @Res() res: Response) {
    if (!(this.storage instanceof LocalImageStorage) || !LOCAL_FILE.test(name)) {
      throw new NotFoundException();
    }
    const ext = name.split('.').pop() as keyof typeof MIME;
    res.setHeader('Content-Type', MIME[ext]);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // Además de la CSP de helmet: el navegador no debe interpretarla como otra cosa.
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
    res.sendFile(join(this.storage.dir, name), (error) => {
      if (error && !res.headersSent) res.status(404).json({ statusCode: 404, error: 'NOT_FOUND', message: 'No encontramos lo que buscas' });
    });
  }
}
