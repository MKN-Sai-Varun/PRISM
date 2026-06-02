import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import * as ImageManipulator from 'expo-image-manipulator';
import * as jpeg from 'jpeg-js';

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
}

export async function detectFace(
  photoUri: string,
  frameWidth: number,
  frameHeight: number
): Promise<FaceBox | null> {
  if (!blazefaceModel) await loadFaceDetector();

  const resized = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width: 128, height: 128 } }],
    { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 1.0 }
  );

  if (!resized.base64) return null;

  const binary = atob(resized.base64);
  const jpegBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    jpegBytes[i] = binary.charCodeAt(i);
  }

  const rawImageData = jpeg.decode(jpegBytes, { useTArray: true });

  const inputData = new Float32Array(128 * 128 * 3);
  for (let i = 0; i < 128 * 128; i++) {
    const src = i * 4;
    const dst = i * 3;
    inputData[dst]     = (rawImageData.data[src]     / 127.5) - 1.0;
    inputData[dst + 1] = (rawImageData.data[src + 1] / 127.5) - 1.0;
    inputData[dst + 2] = (rawImageData.data[src + 2] / 127.5) - 1.0;
  }

  let outputs;
  try {
    outputs = blazefaceModel!.runSync([inputData.buffer]);
  } catch (e: any) {
    return null;
  }

  const regressors  = new Float32Array(outputs[0]);
  const classifiers = new Float32Array(outputs[1]);

  let bestScore = -1;
  let bestIdx   = -1;
  for (let i = 0; i < 896; i++) {
    const score = 1 / (1 + Math.exp(-classifiers[i]));
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }

  if (bestScore < 0.5) return null;

  const off = bestIdx * 16;
  const cx  = (regressors[off]     / 128) * frameWidth;
  const cy  = (regressors[off + 1] / 128) * frameHeight;
  const w   = (regressors[off + 2] / 128) * frameWidth;
  const h   = (regressors[off + 3] / 128) * frameHeight;

  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h, confidence: bestScore };
}
