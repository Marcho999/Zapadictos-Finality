/**
 * Detecta el tipo real de una imagen por sus primeros bytes ("magic bytes"),
 * sin confiar en la extensión ni en el Content-Type que manda el navegador
 * (docs/06-seguridad.md A08). Solo JPEG, PNG y WebP.
 */
export type ImageType = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' };

export function detectImageType(buffer: Buffer): ImageType | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, i) => buffer[i] === byte)) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}
