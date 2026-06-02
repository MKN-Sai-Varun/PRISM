/**
 * Geometric Ratios — lighting-invariant identity vector
 *
 * Computes 12 normalised facial ratios from 468 MediaPipe Face Mesh
 * landmarks. Because these are ratios of distances, they are scale,
 * rotation, and lighting invariant — the core of the ABM approach.
 */

export interface Point3D { x: number; y: number; z: number; }

export interface GeoVector {
  eyeSpacingRatio:         number;
  jawWidthFaceHeightRatio: number;
  noseLengthFaceHeightRatio: number;
  lipWidthJawRatio:        number;
  cheekboneWidthRatio:     number;
  eyebrowHeightRatio:      number;
  chinLengthRatio:         number;
  noseWidthRatio:          number;
  leftEyeAspectRatio:      number;
  rightEyeAspectRatio:     number;
  mouthAspectRatio:        number;
  faceSymmetryRatio:       number;
}

function dist(a: Point3D, b: Point3D): number {
  return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2);
}

// Eye Aspect Ratio — EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
function ear(lm: Point3D[], idx: number[]): number {
  return (dist(lm[idx[1]], lm[idx[5]]) + dist(lm[idx[2]], lm[idx[4]]))
       / (2 * dist(lm[idx[0]], lm[idx[3]]));
}

export function computeGeoVector(landmarks: Point3D[]): GeoVector {
  if (landmarks.length < 468) throw new Error('Need 468 landmarks from Face Mesh');

  const forehead   = landmarks[10];  const chin      = landmarks[152];
  const jawLeft    = landmarks[234]; const jawRight   = landmarks[454];
  const leftEyeR   = landmarks[133]; const rightEyeL  = landmarks[362];
  const noseTip    = landmarks[4];   const noseBase   = landmarks[168];
  const lipLeft    = landmarks[61];  const lipRight   = landmarks[291];
  const cheekLeft  = landmarks[116]; const cheekRight = landmarks[345];
  const leftBrow   = landmarks[70];
  const mouthTop   = landmarks[13];  const mouthBot   = landmarks[14];
  const mouthLeft  = landmarks[78];  const mouthRight = landmarks[308];
  const noseLeft   = landmarks[129]; const noseRight  = landmarks[358];

  const faceH  = dist(forehead, chin);
  const jawW   = dist(jawLeft,  jawRight);

  return {
    eyeSpacingRatio:           dist(leftEyeR, rightEyeL) / jawW,
    jawWidthFaceHeightRatio:   jawW / faceH,
    noseLengthFaceHeightRatio: dist(noseBase, noseTip) / faceH,
    lipWidthJawRatio:          dist(lipLeft,  lipRight) / jawW,
    cheekboneWidthRatio:       dist(cheekLeft, cheekRight) / jawW,
    eyebrowHeightRatio:        dist(leftBrow,  landmarks[159]) / faceH,
    chinLengthRatio:           dist(landmarks[175], chin) / faceH,
    noseWidthRatio:            dist(noseLeft,  noseRight) / jawW,
    leftEyeAspectRatio:        ear(landmarks, [33,  160, 158, 133, 153, 144]),
    rightEyeAspectRatio:       ear(landmarks, [362, 385, 387, 263, 373, 380]),
    mouthAspectRatio:          dist(mouthTop, mouthBot) / dist(mouthLeft, mouthRight),
    faceSymmetryRatio:         Math.min(dist(noseTip, jawLeft), dist(noseTip, jawRight))
                             / Math.max(dist(noseTip, jawLeft), dist(noseTip, jawRight)),
  };
}

export function geoVectorToArray(geo: GeoVector): number[] {
  return [
    geo.eyeSpacingRatio, geo.jawWidthFaceHeightRatio, geo.noseLengthFaceHeightRatio,
    geo.lipWidthJawRatio, geo.cheekboneWidthRatio, geo.eyebrowHeightRatio,
    geo.chinLengthRatio, geo.noseWidthRatio, geo.leftEyeAspectRatio,
    geo.rightEyeAspectRatio, geo.mouthAspectRatio, geo.faceSymmetryRatio,
  ];
}
