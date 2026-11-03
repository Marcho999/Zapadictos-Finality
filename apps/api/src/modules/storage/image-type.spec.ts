import { describe, expect, it } from 'vitest';
import { detectImageType } from './image-type.js';

const pad = (bytes: number[]) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

describe('detectImageType', () => {
  it('reconoce JPEG, PNG y WebP por su contenido', () => {
    expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe('image/jpeg');
    expect(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe('image/png');
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);
    expect(detectImageType(webp)?.mime).toBe('image/webp');
  });

  it('rechaza archivos que no son imágenes aunque se llamen .jpg', () => {
    expect(detectImageType(Buffer.from('<svg onload="alert(1)"></svg>'))).toBeNull();
    expect(detectImageType(Buffer.from('%PDF-1.7 ......'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a......'))).toBeNull();
  });
});
