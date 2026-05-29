/**
 * ABM Fusion Matcher
 * Dynamically weights RGB vs Geometric channel based on lighting
 * Core innovation of the PRISM system
 */

import { computeBrightnessScore } from './clahe';
import { cosineSimilarity } from './geometricRatios';

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
  rgbEmbedding: number[];
  geoVector: number[];
}

function getChannelWeights(brightness: number): {
  weightRgb: number;
  weightGeo: number;
} {
  // Bad lighting: too bright (>180) or too dark (<40)
  if (brightness > 180 || brightness < 40) {
    return { weightRgb: 0.3, weightGeo: 0.7 };
  }
  // Good lighting
  return { weightRgb: 0.7, weightGeo: 0.3 };
}

export function runFusionMatch(
  queryRgb: number[],
  queryGeo: number[],
  imageData: Uint8Array,
  frameWidth: number,
  frameHeight: number,
  storedUsers: StoredUser[],
  threshold: number = 0.75
): MatchResult {
  if (storedUsers.length === 0) {
    return {
      matched: false,
      confidence: 0,
      userId: null,
      userName: null,
      channel: 'fusion',
      rgbScore: 0,
      geoScore: 0,
      finalScore: 0,
      brightnessScore: 0,
      weightRgb: 0.7,
      weightGeo: 0.3,
    };
  }

  const brightness = computeBrightnessScore(imageData, frameWidth, frameHeight);
  const { weightRgb, weightGeo } = getChannelWeights(brightness);

  let bestScore = -1;
  let bestUser: StoredUser | null = null;
  let bestRgbScore = 0;
  let bestGeoScore = 0;

  for (const user of storedUsers) {
    const rgbScore = cosineSimilarity(queryRgb, user.rgbEmbedding);
    const geoScore = cosineSimilarity(queryGeo, user.geoVector);
    const finalScore = rgbScore * weightRgb + geoScore * weightGeo;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestUser = user;
      bestRgbScore = rgbScore;
      bestGeoScore = geoScore;
    }
  }

  const matched = bestScore >= threshold;

  // Determine dominant channel
  let channel: 'rgb' | 'geo' | 'fusion' = 'fusion';
  if (weightRgb >= 0.7) channel = 'rgb';
  if (weightGeo >= 0.7) channel = 'geo';

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