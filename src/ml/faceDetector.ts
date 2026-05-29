import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';

let blazefaceModel: TensorflowModel | null = null;

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export async function loadFaceDetector(): Promise<void> {
  if (blazefaceModel) return;
  blazefaceModel = await loadTensorflowModel(
    require('../../assets/models/blaze_face_short_range.tflite'),
    []
  );
  console.log('BlazeFace loaded');
}

export function preprocessFrame(
  frameData: Uint8Array,
  frameWidth: number,
  frameHeight: number
): Float32Array {
  const targetSize = 128;
  const input = new Float32Array(targetSize * targetSize * 3);

  const scaleX = frameWidth / targetSize;
  const scaleY = frameHeight / targetSize;

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const srcX = Math.floor(x * scaleX);
      const srcY = Math.floor(y * scaleY);
      const srcIdx = (srcY * frameWidth + srcX) * 4;
      const dstIdx = (y * targetSize + x) * 3;

      // Normalize to [-1, 1]
      input[dstIdx] = (frameData[srcIdx] / 127.5) - 1;
      input[dstIdx + 1] = (frameData[srcIdx + 1] / 127.5) - 1;
      input[dstIdx + 2] = (frameData[srcIdx + 2] / 127.5) - 1;
    }
  }

  return input;
}

export async function detectFace(
  frameData: Uint8Array,
  frameWidth: number,
  frameHeight: number
): Promise<FaceBox | null> {
  if (!blazefaceModel) await loadFaceDetector();

  const input = preprocessFrame(frameData, frameWidth, frameHeight);

  const outputs = blazefaceModel!.runSync([input.buffer as ArrayBuffer]);

  const regressors = new Float32Array(outputs[0] as ArrayBuffer); // [896, 16]
  const classifiers = new Float32Array(outputs[1] as ArrayBuffer); // [896, 1]

  // Find best detection
  let bestScore = -1;
  let bestIdx = -1;

  for (let i = 0; i < 896; i++) {
    const score = 1 / (1 + Math.exp(-classifiers[i])); // sigmoid
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  if (bestScore < 0.75) return null;

  // Decode bounding box
  const boxOffset = bestIdx * 16;
  const cx = (regressors[boxOffset] / 128) * frameWidth;
  const cy = (regressors[boxOffset + 1] / 128) * frameHeight;
  const w = (regressors[boxOffset + 2] / 128) * frameWidth;
  const h = (regressors[boxOffset + 3] / 128) * frameHeight;

  return {
    x: cx - w / 2,
    y: cy - h / 2,
    width: w,
    height: h,
    confidence: bestScore,
  };
}