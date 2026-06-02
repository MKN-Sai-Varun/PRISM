/**
 * CLAHE — Contrast Limited Adaptive Histogram Equalization
 *
 * Normalises lighting on face crops before ML inference.
 * Addresses harsh outdoor sunlight, shadows, and low-light conditions
 * common in Indian field deployments.
 */

export function applyCLAHE(
  imageData: Uint8Array,
  width:     number,
  height:    number,
  clipLimit: number = 2.0,
  tileSize:  number = 8,
): Uint8Array {
  const result  = new Uint8Array(imageData.length);
  const tilesX  = Math.ceil(width  / tileSize);
  const tilesY  = Math.ceil(height / tileSize);
  const lookups: number[][] = [];

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * tileSize;
      const y0 = ty * tileSize;
      const x1 = Math.min(x0 + tileSize, width);
      const y1 = Math.min(y0 + tileSize, height);
      const tileArea = (x1 - x0) * (y1 - y0);

      const hist = new Array(256).fill(0);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i   = (y * width + x) * 4;
          const lum = Math.round(0.299 * imageData[i] + 0.587 * imageData[i+1] + 0.114 * imageData[i+2]);
          hist[lum]++;
        }
      }

      // Clip and redistribute excess
      const clip   = Math.round(clipLimit * tileArea / 256);
      let excess   = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clip) { excess += hist[i] - clip; hist[i] = clip; }
      }
      const redist = Math.floor(excess / 256);
      for (let i = 0; i < 256; i++) hist[i] += redist;

      // Build normalised CDF lookup
      const cdf    = new Array(256).fill(0);
      cdf[0]       = hist[0];
      for (let i = 1; i < 256; i++) cdf[i] = cdf[i-1] + hist[i];
      const cdfMin = cdf.find(v => v > 0) ?? 1;
      lookups.push(cdf.map(v => Math.round(((v - cdfMin) / (tileArea - cdfMin)) * 255)));
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx    = (y * width + x) * 4;
      const tx     = Math.min(Math.floor(x / tileSize), tilesX - 1);
      const ty     = Math.min(Math.floor(y / tileSize), tilesY - 1);
      const lookup = lookups[ty * tilesX + tx];
      const lum    = Math.round(0.299 * imageData[idx] + 0.587 * imageData[idx+1] + 0.114 * imageData[idx+2]);
      const scale  = lum > 0 ? lookup[lum] / lum : 1;
      result[idx]   = Math.min(255, Math.round(imageData[idx]   * scale));
      result[idx+1] = Math.min(255, Math.round(imageData[idx+1] * scale));
      result[idx+2] = Math.min(255, Math.round(imageData[idx+2] * scale));
      result[idx+3] = imageData[idx+3];
    }
  }

  return result;
}

export function computeBrightnessScore(imageData: Uint8Array, width: number, height: number): number {
  let total = 0;
  const pixels = width * height;
  for (let i = 0; i < pixels; i++) {
    const idx = i * 4;
    total += 0.299 * imageData[idx] + 0.587 * imageData[idx+1] + 0.114 * imageData[idx+2];
  }
  return total / pixels;
}
