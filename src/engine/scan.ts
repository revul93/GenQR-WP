import jsQR from 'jsqr';
import { svgToCanvas } from './raster';

/**
 * Decodes the rendered SVG to check it can be read back. jsQR is stricter than phone
 * cameras, so a pass is a good sign; a fail is a warning, not a guarantee it won't scan.
 */
export async function scanCheck(svg: string, expected: string): Promise<boolean> {
  const size = 600;
  const canvas = await svgToCanvas(svg, size, '#ffffff');
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, size, size);
  return jsQR(pixels.data, size, size)?.data === expected;
}
