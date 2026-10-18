/** SVG → canvas in the browser (used by the PNG/JPG/PDF/Word downloads and the scan check). */

export function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not draw the QR code.'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/** Draws the SVG on a square canvas. `fill` paints a solid background first (JPEG has no transparency). */
export async function svgToCanvas(svg: string, sizePx: number, fill?: string): Promise<HTMLCanvasElement> {
  const img = await svgToImage(svg);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw images.');
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, sizePx, sizePx);
  }
  ctx.drawImage(img, 0, 0, sizePx, sizePx);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image.'))), type, quality),
  );
}

export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Loads an image URL (an admin logo) as a data URI, so it can be embedded in the SVG and downloads. */
export async function urlToDataUri(url: string): Promise<string> {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Could not load the logo.');
  return blobToDataUri(await res.blob());
}
