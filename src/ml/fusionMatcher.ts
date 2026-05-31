import { cosineSimilarity } from './faceEmbedding';

export interface MatchResult {
  matched: boolean;
  confidence: number;
  userId: string | null;
  userName: string | null;
  channel: 'rgb' | 'geo' | 'fusion';
  rgbScore: number;
  finalScore: number;
  brightnessScore: number;
}

export interface StoredUser {
  id: string;
  name: string;
  rgb_embedding: number[];
  geo_vector: number[];
}

export function computeBrightness(embedding: number[]): number {
  // Use embedding magnitude as proxy for brightness
  const sum = embedding.reduce((a, b) => a + Math.abs(b), 0);
  return (sum / embedding.length) * 255;
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
      finalScore: 0,
      brightnessScore: 0,
    };
  }

  let bestScore = -1;
  let bestUser: StoredUser | null = null;

  for (const user of storedUsers) {
    const rgbScore = cosineSimilarity(queryRgb, user.rgb_embedding);
    if (rgbScore > bestScore) {
      bestScore = rgbScore;
      bestUser = user;
    }
  }

  const matched = bestScore >= threshold;

  return {
    matched,
    confidence: bestScore,
    userId: matched && bestUser ? bestUser.id : null,
    userName: matched && bestUser ? bestUser.name : null,
    channel: 'rgb',
    rgbScore: bestScore,
    finalScore: bestScore,
    brightnessScore: 0,
  };
}