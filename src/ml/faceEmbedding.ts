import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import * as ImageManipulator from 'expo-image-manipulator';
import * as jpeg from 'jpeg-js';

let faceNetModel: TensorflowModel | null = null;

export async function loadFaceEmbedding(): Promise<void> {
  if (faceNetModel) return;
  faceNetModel = await loadTensorflowModel(
    require('../../assets/models/mobilefacenet.tflite'),
    []
  );
  // Model loaded — inputs: [1,112,112,3], outputs: embedding [1,192]
}

export async function getEmbedding(photoUri: string): Promise<number[] | null> {
  if (!faceNetModel) await loadFaceEmbedding();

  // MobileFaceNet expects 112x112 input
  const resized = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width: 112, height: 112 } }],
    { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 1.0 }
  );

  if (!resized.base64) return null;

  const binary = atob(resized.base64);
  const jpegBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    jpegBytes[i] = binary.charCodeAt(i);
  }

  const rawImageData = jpeg.decode(jpegBytes, { useTArray: true });

  // Normalize to [-1, 1]
  const inputData = new Float32Array(112 * 112 * 3);
  for (let i = 0; i < 112 * 112; i++) {
    const rgbaIdx = i * 4;
    const rgbIdx = i * 3;
    inputData[rgbIdx]     = (rawImageData.data[rgbaIdx]     / 127.5) - 1.0;
    inputData[rgbIdx + 1] = (rawImageData.data[rgbaIdx + 1] / 127.5) - 1.0;
    inputData[rgbIdx + 2] = (rawImageData.data[rgbaIdx + 2] / 127.5) - 1.0;
  }

  let outputs;
  try {
    // @ts-ignore
    outputs = faceNetModel!.runSync([inputData.buffer]);
  } catch (e: any) {
    console.log('Embedding error:', e.message);
    return null;
  }

  // @ts-ignore
  const embedding = new Float32Array(outputs[0]);

  // Normalize embedding to unit vector
  let norm = 0;
  for (let i = 0; i < embedding.length; i++) {
    norm += embedding[i] * embedding[i];
  }
  norm = Math.sqrt(norm);

  const normalized = Array.from(embedding).map(v => v / norm);
  return normalized;
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