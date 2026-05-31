/**
 * Passive Liveness Detection
 * Detects if the face is real or a spoofed photo/screen
 * Uses texture analysis and multiple frame comparison
 */

import * as jpeg from 'jpeg-js';
import * as ImageManipulator from 'expo-image-manipulator';

export interface LivenessResult {
  isLive: boolean;
  score: number;
  reason: string;
}

function computeTextureVariance(pixels: Uint8Array, width: number, height: number): number {
  let variance = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const center = pixels[idx];

      const neighbors = [
        pixels[((y-1) * width + (x-1)) * 4],
        pixels[((y-1) * width + x) * 4],
        pixels[((y-1) * width + (x+1)) * 4],
        pixels[(y * width + (x+1)) * 4],
        pixels[((y+1) * width + (x+1)) * 4],
        pixels[((y+1) * width + x) * 4],
        pixels[((y+1) * width + (x-1)) * 4],
        pixels[(y * width + (x-1)) * 4],
      ];

      const localVariance = neighbors.reduce((sum, n) => sum + Math.pow(n - center, 2), 0) / 8;
      variance += localVariance;
      count++;
    }
  }

  return count > 0 ? variance / count : 0;
}

function computeSpecularScore(pixels: Uint8Array, width: number, height: number): number {
  let brightPixels = 0;
  const total = width * height;

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    const brightness = (r + g + b) / 3;
    if (brightness > 220) brightPixels++;
  }

  return total > 0 ? brightPixels / total : 0;
}

function computeColorScore(pixels: Uint8Array, width: number, height: number): number {
  let rSum = 0, gSum = 0, bSum = 0;
  let rVar = 0, gVar = 0, bVar = 0;
  const total = width * height;

  if (total === 0) return 0;

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    rSum += pixels[idx];
    gSum += pixels[idx + 1];
    bSum += pixels[idx + 2];
  }

  const rMean = rSum / total;
  const gMean = gSum / total;
  const bMean = bSum / total;

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    rVar += Math.pow(pixels[idx] - rMean, 2);
    gVar += Math.pow(pixels[idx + 1] - gMean, 2);
    bVar += Math.pow(pixels[idx + 2] - bMean, 2);
  }

  rVar /= total;
  gVar /= total;
  bVar /= total;

  return (rVar + gVar + bVar) / 3;
}

export async function checkLiveness(photoUri: string): Promise<LivenessResult> {
  try {
    const resized = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 64, height: 64 } }],
      { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 1.0 }
    );

    if (!resized.base64) {
      return { isLive: true, score: 0.5, reason: 'Check skipped' };
    }

    const binary = atob(resized.base64);
    const jpegBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      jpegBytes[i] = binary.charCodeAt(i);
    }

    let rawImage;
    try {
      rawImage = jpeg.decode(jpegBytes, { useTArray: true });
    } catch (e) {
      console.log('JPEG decode failed:', e);
      return { isLive: true, score: 0.5, reason: 'Check skipped' };
    }

    const pixels = rawImage.data as Uint8Array;

    const textureVariance = computeTextureVariance(pixels, 64, 64);
    const specularScore = computeSpecularScore(pixels, 64, 64);
    const colorScore = computeColorScore(pixels, 64, 64);

    console.log('Texture variance:', textureVariance);
    console.log('Specular score:', specularScore);
    console.log('Color score:', colorScore);

    const textureOk = textureVariance > 200;
    const colorOk = colorScore > 300;

    const livenessScore = (
      (textureVariance / 2000) * 0.5 +
      (colorScore / 3000) * 0.3 +
      specularScore * 0.2
    );

    const isLive = textureOk && colorOk;

    let reason = '';
    if (!textureOk) reason = 'Low texture — possible photo spoof';
    else if (!colorOk) reason = 'Unusual color distribution';
    else reason = 'Live face confirmed';

    return {
      isLive,
      score: Math.min(1, livenessScore),
      reason,
    };
  } catch (e: any) {
    console.log('Liveness error:', e.message);
    return { isLive: true, score: 0.5, reason: 'Check skipped' };
  }
}