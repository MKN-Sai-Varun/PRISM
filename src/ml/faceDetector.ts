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
  console.log('BlazeFace loaded');
  console.log('Inputs:', JSON.stringify(blazefaceModel.inputs));
  console.log('Outputs:', JSON.stringify(blazefaceModel.outputs));
}

export async function detectFace(
  photoUri: string,
  frameWidth: number,
  frameHeight: number
): Promise<FaceBox | null> {
  if (!blazefaceModel) await loadFaceDetector();

  // Resize to 128x128
  const resized = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width: 128, height: 128 } }],
    { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 1.0 }
  );

  if (!resized.base64) return null;

  // Decode base64 to bytes
  const binary = atob(resized.base64);
  const jpegBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    jpegBytes[i] = binary.charCodeAt(i);
  }

  // Decode JPEG to raw RGBA pixels
  const rawImageData = jpeg.decode(jpegBytes, { useTArray: true });
  console.log('Decoded pixels:', rawImageData.width, 'x', rawImageData.height);

  // Convert RGBA to RGB float32 normalized to [-1, 1]
  const inputData = new Float32Array(128 * 128 * 3);
  for (let i = 0; i < 128 * 128; i++) {
    const rgbaIdx = i * 4;
    const rgbIdx = i * 3;
    inputData[rgbIdx]     = (rawImageData.data[rgbaIdx]     / 127.5) - 1.0; // R
    inputData[rgbIdx + 1] = (rawImageData.data[rgbaIdx + 1] / 127.5) - 1.0; // G
    inputData[rgbIdx + 2] = (rawImageData.data[rgbaIdx + 2] / 127.5) - 1.0; // B
  }

  console.log('Running inference...');

  let outputs;
  try {
    // @ts-ignore
    outputs = blazefaceModel!.runSync([inputData.buffer]);
    console.log('Inference complete');
  } catch (e: any) {
    console.log('Inference error:', e.message);
    return null;
  }

  // @ts-ignore
  const regressors = new Float32Array(outputs[0]);
  // @ts-ignore
  const classifiers = new Float32Array(outputs[1]);

  console.log('Regressors length:', regressors.length);
  console.log('Classifiers length:', classifiers.length);

  let bestScore = -1;
  let bestIdx = -1;

  for (let i = 0; i < 896; i++) {
    const score = 1 / (1 + Math.exp(-classifiers[i]));
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  console.log('Best score:', bestScore);

  if (bestScore < 0.5) return null;

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