import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const background = [24, 43, 42, 255];

type Png = { width: number; height: number; pixels: Buffer };

function png(path: string): Png {
  const data = readFileSync(resolve(path));
  expect(data.subarray(0, 8)).toEqual(pngSignature);
  let offset = 8;
  let width = 0;
  let height = 0;
  const chunks: Buffer[] = [];
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString('ascii', offset + 4, offset + 8);
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      expect(chunk[8]).toBe(8);
      expect(chunk[9]).toBe(6);
    }
    if (type === 'IDAT') chunks.push(chunk);
    offset += 12 + length;
  }
  const stride = width * 4;
  const packed = inflateSync(Buffer.concat(chunks));
  const pixels = Buffer.alloc(stride * height);
  let source = 0;
  for (let y = 0; y < height; y++) {
    const filter = packed[source++];
    for (let x = 0; x < stride; x++) {
      const raw = packed[source++];
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const above = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      const paeth = () => {
        const estimate = left + above - upperLeft;
        const leftDistance = Math.abs(estimate - left);
        const aboveDistance = Math.abs(estimate - above);
        const upperLeftDistance = Math.abs(estimate - upperLeft);
        return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance ? left : aboveDistance <= upperLeftDistance ? above : upperLeft;
      };
      pixels[y * stride + x] = (raw + (filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : filter === 4 ? paeth() : 0)) & 0xff;
    }
  }
  return { width, height, pixels };
}

function nonBackgroundBounds(image: Png) {
  let minX = image.width;
  let maxX = -1;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const offset = (y * image.width + x) * 4;
    if (background.some((value, channel) => image.pixels[offset + channel] !== value)) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }
  return { minX, maxX };
}

describe('Farm Empire brand assets', () => {
  it('ships valid exact-size normal and distinct safe-padded maskable PNGs', () => {
    for (const [file, size] of [['public/icon-192.png', 192], ['public/icon-512.png', 512], ['public/icon-maskable-192.png', 192], ['public/icon-maskable-512.png', 512]] as const) {
      const image = png(file);
      expect([image.width, image.height]).toEqual([size, size]);
    }
    const normal = png('public/icon-192.png');
    const maskable = png('public/icon-maskable-192.png');
    expect(readFileSync(resolve('public/icon-192.png')).equals(readFileSync(resolve('public/icon-maskable-192.png')))).toBe(false);
    const normalBounds = nonBackgroundBounds(normal);
    const maskableBounds = nonBackgroundBounds(maskable);
    expect(maskableBounds.minX).toBeGreaterThan(normalBounds.minX + 8);
    expect(maskableBounds.maxX).toBeLessThan(normalBounds.maxX - 8);
  });

  it('ships a 32-bit multi-resolution Windows ICO', () => {
    const icon = readFileSync(resolve('desktop/icon.ico'));
    expect(icon.readUInt16LE(0)).toBe(0);
    expect(icon.readUInt16LE(2)).toBe(1);
    const count = icon.readUInt16LE(4);
    expect(count).toBeGreaterThanOrEqual(7);
    const sizes = new Set<number>();
    for (let index = 0; index < count; index++) {
      const entry = 6 + index * 16;
      sizes.add(icon[entry] || 256);
      expect(icon[entry + 1] || 256).toBe(icon[entry] || 256);
      expect(icon.readUInt16LE(entry + 6)).toBe(32);
      const bytes = icon.readUInt32LE(entry + 8);
      const offset = icon.readUInt32LE(entry + 12);
      expect(bytes).toBeGreaterThan(0);
      expect(offset + bytes).toBeLessThanOrEqual(icon.length);
      expect(icon.subarray(offset, offset + 8)).toEqual(pngSignature);
    }
    expect([...sizes].sort((a, b) => a - b)).toEqual([16, 24, 32, 48, 64, 128, 256]);
  });

  it('keeps generator, runtime references, and package wiring on the canonical asset set', () => {
    const generator = readFileSync(resolve('desktop/generate-icon.ps1'), 'utf8');
    const svg = readFileSync(resolve('desktop/icon.svg'), 'utf8');
    const manifest = JSON.parse(readFileSync(resolve('public/manifest.webmanifest'), 'utf8')) as { icons: unknown[] };
    const index = readFileSync(resolve('index.html'), 'utf8');
    const packageJson = readFileSync(resolve('package.json'), 'utf8');
    expect(generator).toContain('Canonical Farm Empire icon geometry');
    expect(generator).toContain('function Get-IconSvg');
    expect(generator).toContain('function New-IconBitmap');
    expect(generator).toContain('function Save-Ico');
    expect(generator).toContain("Join-Path $root 'public/icon-maskable-512.png'");
    expect(svg).toContain("viewBox='0 0 256 256'");
    expect(manifest.icons).toEqual([
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]);
    expect(index).toContain('%BASE_URL%icon-192.png');
    expect(index).toContain('%BASE_URL%icon-512.png');
    expect(packageJson).toContain('desktop/icon.ico');
  });
});
