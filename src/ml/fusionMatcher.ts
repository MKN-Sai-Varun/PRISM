/**
 * ABM Fusion Matcher — Adaptive Biometric Mesh
 *
 * Dynamically weights the RGB photometric channel against the geometric
 * channel based on ambient lighting. In poor lighting conditions face
 * texture is unreliable, so weight shifts toward lighting-invariant
 * geometric ratios (jaw width, eye spacing, etc.).
 *
 * Brightness  | RGB weight | Geo weight
 * ----------- | ---------- | ----------
 * Good (40–180)|   0.75    |   0.25
 * Bad (<40/>180)|  0.30    |   0.70
 */

import { cosineSimilarity } from './faceEmbedding';

export interface MatchResult {
  matched:        boolean;
  confidence:     number;
  userId:         string | null;
  userName:       string | null;
  channel:        'rgb' | 'geo' | 'fusion';
  rgbScore:       number;
  geoScore:       number;
  finalScore:     number;
  brightnessScore: number;
  weightRgb:      number;
  weightGeo:      number;
}

export interface StoredUser {
  id:            string;
  name:          string;
  rgb_embedding: number[];
  geo_vector:    number[];
}

function computeBrightness(embedding: number[]): number {
  const sum = embedding.reduce((a, b) => a + Math.abs(b), 0);
  return (sum / embedding.length) * 255;
}

function getChannelWeights(brightness: number): { weightRgb: number; weightGeo: number } {
  return brightness > 180 || brightness < 40
    ? { weightRgb: 0.30, weightGeo: 0.70 }
    : { weightRgb: 0.75, weightGeo: 0.25 };
}

export function runFusionMatch(
  queryRgb:    number[],
  storedUsers: StoredUser[],
  threshold:   number = 0.75,
): MatchResult {
  if (storedUsers.length === 0) {
    return {
      matched: false, confidence: 0, userId: null, userName: null,
      channel: 'rgb', rgbScore: 0, geoScore: 0, finalScore: 0,
      brightnessScore: 0, weightRgb: 0.75, weightGeo: 0.25,
    };
  }

  const brightness            = computeBrightness(queryRgb);
  const { weightRgb, weightGeo } = getChannelWeights(brightness);

  let bestScore = -1;
  let bestUser: StoredUser | null = null;
  let bestRgbScore = 0;
  let bestGeoScore = 0;

  for (const user of storedUsers) {
    const rgbScore = cosineSimilarity(queryRgb, user.rgb_embedding);
    let geoScore   = 0;
    let finalScore: number;

    if (user.geo_vector?.length > 0) {
      geoScore   = cosineSimilarity(queryRgb, user.geo_vector);
      finalScore = rgbScore * weightRgb + geoScore * weightGeo;
    } else {
      finalScore = rgbScore;
    }

    if (finalScore > bestScore) {
      bestScore    = finalScore;
      bestUser     = user;
      bestRgbScore = rgbScore;
      bestGeoScore = geoScore;
    }
  }

  const matched = bestScore >= threshold;
  const hasGeo  = (bestUser?.geo_vector?.length ?? 0) > 0;
  const channel: 'rgb' | 'geo' | 'fusion' = hasGeo
    ? (weightGeo >= 0.7 ? 'geo' : 'fusion')
    : 'rgb';

  return {
    matched,
    confidence:      bestScore,
    userId:          matched && bestUser ? bestUser.id   : null,
    userName:        matched && bestUser ? bestUser.name : null,
    channel,
    rgbScore:        bestRgbScore,
    geoScore:        bestGeoScore,
    finalScore:      bestScore,
    brightnessScore: brightness,
    weightRgb,
    weightGeo,
  };
}
