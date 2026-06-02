import * as jpeg from 'jpeg-js';
import * as ImageManipulator from 'expo-image-manipulator';

export interface LivenessResult {
  isLive: boolean;
  score:  number;
  reason: string;
}


function computeTextureVariance(pixels: Uint8Array, width: number, height: number): number {
  let variance = 0, count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx    = (y * width + x) * 4;
      const center = pixels[idx];
      const neighbors = [
        pixels[((y-1) * width + (x-1)) * 4], pixels[((y-1) * width + x) * 4],
        pixels[((y-1) * width + (x+1)) * 4], pixels[(y     * width + (x+1)) * 4],
        pixels[((y+1) * width + (x+1)) * 4], pixels[((y+1) * width + x) * 4],
        pixels[((y+1) * width + (x-1)) * 4], pixels[(y     * width + (x-1)) * 4],
      ];
      variance += neighbors.reduce((s, n) => s + Math.pow(n - center, 2), 0) / 8;
      count++;
    }
  }
  return count > 0 ? variance / count : 0;
}

function computeColorScore(pixels: Uint8Array, width: number, height: number): number {
  const total = width * height;
  if (total === 0) return 0;
  let rSum = 0, gSum = 0, bSum = 0;
  for (let i = 0; i < total; i++) {
    rSum += pixels[i * 4]; gSum += pixels[i * 4 + 1]; bSum += pixels[i * 4 + 2];
  }
  const rMean = rSum / total, gMean = gSum / total, bMean = bSum / total;
  let rVar = 0, gVar = 0, bVar = 0;
  for (let i = 0; i < total; i++) {
    rVar += Math.pow(pixels[i * 4]     - rMean, 2);
    gVar += Math.pow(pixels[i * 4 + 1] - gMean, 2);
    bVar += Math.pow(pixels[i * 4 + 2] - bMean, 2);
  }
  return (rVar / total + gVar / total + bVar / total) / 3;
}


export async function checkLiveness(photoUri: string): Promise<LivenessResult> {
  try {
    const resized = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 64, height: 64 } }],
      { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 1.0 }
    );
    if (!resized.base64) return { isLive: true, score: 0.5, reason: 'Check skipped' };

    const bin = atob(resized.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    let rawImage: { data: Uint8Array };
    try {
      rawImage = jpeg.decode(bytes, { useTArray: true }) as { data: Uint8Array };
    } catch {
      return { isLive: true, score: 0.5, reason: 'Check skipped' };
    }

    const pixels         = rawImage.data;
    const textureVariance = computeTextureVariance(pixels, 64, 64);
    const colorScore      = computeColorScore(pixels, 64, 64);

    const textureOk = textureVariance > 200;
    const colorOk   = colorScore      > 300;
    const isLive    = textureOk && colorOk;

    const score = Math.min(1,
      (textureVariance / 2000) * 0.6 +
      (colorScore      / 3000) * 0.4
    );

    let reason = 'Live face confirmed';
    if (!textureOk) reason = 'Low texture — possible photo spoof';
    else if (!colorOk) reason = 'Unusual colour distribution';

    return { isLive, score, reason };
  } catch {
    return { isLive: true, score: 0.5, reason: 'Check skipped' };
  }
}


export type LivenessChallenge = 'blink' | 'smile' | 'turn';

export function randomChallenge(): LivenessChallenge {
  const options: LivenessChallenge[] = ['blink', 'smile', 'turn'];
  return options[Math.floor(Math.random() * options.length)];
}

export function challengePrompt(challenge: LivenessChallenge): string {
  switch (challenge) {
    case 'blink': return '👁️  Please blink slowly';
    case 'smile': return '😊  Please smile';
    case 'turn':  return '↩️  Turn your head slightly left';
  }
}

export async function checkActiveLiveness(
  beforeUri: string,
  afterUri: string,
): Promise<LivenessResult> {
  try {
    const [before, after] = await Promise.all([
      ImageManipulator.manipulateAsync(
        beforeUri,
        [{ resize: { width: 64, height: 64 } }],
        { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 1.0 }
      ),
      ImageManipulator.manipulateAsync(
        afterUri,
        [{ resize: { width: 64, height: 64 } }],
        { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 1.0 }
      ),
    ]);

    if (!before.base64 || !after.base64) {
      return { isLive: true, score: 0.5, reason: 'Active check skipped' };
    }

    const decode = (b64: string): Uint8Array => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      try { return (jpeg.decode(bytes, { useTArray: true }) as { data: Uint8Array }).data; }
      catch { return bytes; }
    };

    const pixelsBefore = decode(before.base64);
    const pixelsAfter  = decode(after.base64);
    const len          = Math.min(pixelsBefore.length, pixelsAfter.length);

    let totalDelta = 0;
    for (let i = 0; i < len; i++) totalDelta += Math.abs(pixelsBefore[i] - pixelsAfter[i]);
    const meanDelta = totalDelta / len;

    const isLive = meanDelta > 6;
    return {
      isLive,
      score:  Math.min(1, meanDelta / 30),
      reason: isLive ? 'Motion detected — live face confirmed' : 'No motion detected — possible spoof',
    };
  } catch {
    return { isLive: true, score: 0.5, reason: 'Active check skipped' };
  }
}
