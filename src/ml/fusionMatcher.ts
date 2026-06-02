/**
 * ABM Fusion Matcher — Adaptive Biometric Mesh
 * Dynamically weights RGB photometric channel vs Geometric channel
 * based on ambient lighting conditions.
 *
 * Key insight: In bad lighting, face texture (RGB) is unreliable.
 * Geometric ratios (jaw width, eye spacing etc.) are lighting-invariant.
 * We shift weight toward geometry when lighting is poor.
 */

import { cosineSimilarity } from './faceEmbedding';

export interface MatchResult {
  matched: boolean;
  confidence: number;
  userId: string | null;
  userName: string | null;
  channel: 'rgb' | 'geo' | 'fusion';
  rgbScore: number;
  geoScore: number;
  finalScore: number;
  brightnessScore: number;
  weightRgb: number;
  weightGeo: number;
}

export interface StoredUser {
  id: string;
  name: string;
  rgb_embedding: number[];
  geo_vector: number[];
}

/**
 * Estimate ambient brightness from the RGB embedding magnitude.
 * Embeddings of brightly-lit faces cluster closer to the unit sphere surface;
 * low-light embeddings have lower mean absolute values.
 */
export function computeBrightness(embedding: number[]): number {
  const sum = embedding.reduce((a, b) => a + Math.abs(b), 0);
  return (sum / embedding.length) * 255; // scale to 0-255 range
}

/**
 * Dynamic channel weighting based on brightness score.
 *
 * Lighting condition  | RGB weight | Geo weight
 * ------------------- | ---------- | ----------
 * Good  (40–180)      |    0.75    |    0.25
 * Bad   (<40 or >180) |    0.30    |    0.70
 */
function getChannelWeights(brightness: number): { weightRgb: number; weightGeo: number } {
  if (brightness > 180 || brightness < 40) {
    // Harsh sunlight or low light — trust geometry over texture
    return { weightRgb: 0.30, weightGeo: 0.70 };
  }
  // Good lighting — RGB embedding is reliable
  return { weightRgb: 0.75, weightGeo: 0.25 };
}

export function runFusionMatch(
  queryRgb: number[],
  storedUsers: StoredUser[],
  threshold: number = 0.75
): MatchResult {
  if (storedUsers.length === 0) {
    return {
      matched: false,
      confidence: 0,
      userId: null,
      userName: null,
      channel: 'rgb',
      rgbScore: 0,
      geoScore: 0,
      finalScore: 0,
      brightnessScore: 0,
      weightRgb: 0.75,
      weightGeo: 0.25,
    };
  }

  const brightness = computeBrightness(queryRgb);
  const { weightRgb, weightGeo } = getChannelWeights(brightness);

  let bestScore = -1;
  let bestUser: StoredUser | null = null;
  let bestRgbScore = 0;
  let bestGeoScore = 0;

  for (const user of storedUsers) {
    const rgbScore = cosineSimilarity(queryRgb, user.rgb_embedding);

    let finalScore: number;
    let geoScore = 0;

    if (user.geo_vector && user.geo_vector.length > 0) {
      // Full ABM fusion — both channels available
      geoScore = cosineSimilarity(queryRgb, user.geo_vector); // placeholder until geo pipeline is wired
      finalScore = rgbScore * weightRgb + geoScore * weightGeo;
    } else {
      // Geo not available yet — fall back to RGB only
      finalScore = rgbScore;
    }

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestUser = user;
      bestRgbScore = rgbScore;
      bestGeoScore = geoScore;
    }
  }

  const matched = bestScore >= threshold;

  // Determine which channel dominated
  let channel: 'rgb' | 'geo' | 'fusion' = 'rgb';
  if (bestUser?.geo_vector && bestUser.geo_vector.length > 0) {
    channel = weightGeo >= 0.7 ? 'geo' : 'fusion';
  }

  return {
    matched,
    confidence: bestScore,
    userId: matched && bestUser ? bestUser.id : null,
    userName: matched && bestUser ? bestUser.name : null,
    channel,
    rgbScore: bestRgbScore,
    geoScore: bestGeoScore,
    finalScore: bestScore,
    brightnessScore: brightness,
    weightRgb,
    weightGeo,
  };
}
