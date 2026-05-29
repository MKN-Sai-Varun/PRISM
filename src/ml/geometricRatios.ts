/**
 * Geometric Ratios from Face Mesh Landmarks
 * These ratios are lighting-invariant — core of the ABM concept
 * Input: 468 landmark points from MediaPipe Face Mesh
 * Output: 12-dimensional geometric identity vector
 */

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface GeoVector {
  eyeSpacingRatio: number;
  jawWidthFaceHeightRatio: number;
  noseLengthFaceHeightRatio: number;
  lipWidthJawRatio: number;
  cheekboneWidthRatio: number;
  eyebrowHeightRatio: number;
  chinLengthRatio: number;
  noseWidthRatio: number;
  leftEyeAspectRatio: number;
  rightEyeAspectRatio: number;
  mouthAspectRatio: number;
  faceSymmetryRatio: number;
}

function distance(a: Point3D, b: Point3D): number {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.y - b.y, 2) +
    Math.pow(a.z - b.z, 2)
  );
}

function eyeAspectRatio(landmarks: Point3D[], indices: number[]): number {
  // EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
  const p1 = landmarks[indices[0]];
  const p2 = landmarks[indices[1]];
  const p3 = landmarks[indices[2]];
  const p4 = landmarks[indices[3]];
  const p5 = landmarks[indices[4]];
  const p6 = landmarks[indices[5]];

  const vertical1 = distance(p2, p6);
  const vertical2 = distance(p3, p5);
  const horizontal = distance(p1, p4);

  return (vertical1 + vertical2) / (2.0 * horizontal);
}

export function computeGeoVector(landmarks: Point3D[]): GeoVector {
  if (landmarks.length < 468) {
    throw new Error('Need 468 landmarks from Face Mesh');
  }

  // Key landmark indices (MediaPipe Face Mesh)
  const leftEyeLeft = landmarks[33];
  const leftEyeRight = landmarks[133];
  const rightEyeLeft = landmarks[362];
  const rightEyeRight = landmarks[263];
  const noseTip = landmarks[4];
  const noseBase = landmarks[168];
  const jawLeft = landmarks[234];
  const jawRight = landmarks[454];
  const chin = landmarks[152];
  const forehead = landmarks[10];
  const lipLeft = landmarks[61];
  const lipRight = landmarks[291];
  const cheekLeft = landmarks[116];
  const cheekRight = landmarks[345];
  const leftBrow = landmarks[70];
  const rightBrow = landmarks[300];

  const faceHeight = distance(forehead, chin);
  const jawWidth = distance(jawLeft, jawRight);
  const eyeSpacing = distance(leftEyeRight, rightEyeLeft);
  const noseLength = distance(noseBase, noseTip);
  const lipWidth = distance(lipLeft, lipRight);
  const cheekWidth = distance(cheekLeft, cheekRight);

  // Left eye EAR landmarks
  const leftEAR = eyeAspectRatio(landmarks, [33, 160, 158, 133, 153, 144]);

  // Right eye EAR landmarks
  const rightEAR = eyeAspectRatio(landmarks, [362, 385, 387, 263, 373, 380]);

  // Mouth aspect ratio
  const mouthTop = landmarks[13];
  const mouthBottom = landmarks[14];
  const mouthLeft = landmarks[78];
  const mouthRight = landmarks[308];
  const mouthVertical = distance(mouthTop, mouthBottom);
  const mouthHorizontal = distance(mouthLeft, mouthRight);
  const mar = mouthVertical / mouthHorizontal;

  // Face symmetry — compare left vs right distances from nose
  const leftSymmetry = distance(noseTip, jawLeft);
  const rightSymmetry = distance(noseTip, jawRight);
  const symmetryRatio = Math.min(leftSymmetry, rightSymmetry) /
    Math.max(leftSymmetry, rightSymmetry);

  // Eyebrow height ratio
  const leftEyeTop = landmarks[159];
  const browHeight = distance(leftBrow, leftEyeTop) / faceHeight;

  // Chin length
  const chinLength = distance(landmarks[175], chin) / faceHeight;

  // Nose width
  const noseLeft = landmarks[129];
  const noseRight = landmarks[358];
  const noseWidth = distance(noseLeft, noseRight) / jawWidth;

  return {
    eyeSpacingRatio: eyeSpacing / jawWidth,
    jawWidthFaceHeightRatio: jawWidth / faceHeight,
    noseLengthFaceHeightRatio: noseLength / faceHeight,
    lipWidthJawRatio: lipWidth / jawWidth,
    cheekboneWidthRatio: cheekWidth / jawWidth,
    eyebrowHeightRatio: browHeight,
    chinLengthRatio: chinLength,
    noseWidthRatio: noseWidth,
    leftEyeAspectRatio: leftEAR,
    rightEyeAspectRatio: rightEAR,
    mouthAspectRatio: mar,
    faceSymmetryRatio: symmetryRatio,
  };
}

export function geoVectorToArray(geo: GeoVector): number[] {
  return [
    geo.eyeSpacingRatio,
    geo.jawWidthFaceHeightRatio,
    geo.noseLengthFaceHeightRatio,
    geo.lipWidthJawRatio,
    geo.cheekboneWidthRatio,
    geo.eyebrowHeightRatio,
    geo.chinLengthRatio,
    geo.noseWidthRatio,
    geo.leftEyeAspectRatio,
    geo.rightEyeAspectRatio,
    geo.mouthAspectRatio,
    geo.faceSymmetryRatio,
  ];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}