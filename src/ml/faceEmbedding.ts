import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import * as ImageManipulator from 'expo-image-manipulator';
import * as jpeg from 'jpeg-js';
import { getMobileFaceNetUri } from './modelLoader';

let faceNetModel: TensorflowModel | null = null;

// Inputs: [1,112,112,3]  Outputs: embedding [1,192]
export async function loadFaceEmbedding(): Promise<void> {
  if (faceNetModel) return;
  const uri = await getMobileFaceNetUri();
  // @ts-ignore
  faceNetModel = await loadTensorflowModel({ url: uri }, []);
}

export async function getEmbedding(photoUri: string): Promise<number[] | null> {
  if (!faceNetModel) await loadFaceEmbedding();

  // MobileFaceNet requires 112×112 input
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

  // RGBA → RGB, normalise to [-1, 1]
  const inputData = new Float32Array(112 * 112 * 3);
  for (let i = 0; i < 112 * 112; i++) {
    const src = i * 4;
    const dst = i * 3;
    inputData[dst]     = (rawImageData.data[src]     / 127.5) - 1.0;
    inputData[dst + 1] = (rawImageData.data[src + 1] / 127.5) - 1.0;
    inputData[dst + 2] = (rawImageData.data[src + 2] / 127.5) - 1.0;
  }

  let outputs;
  try {
    // @ts-ignore
    outputs = faceNetModel!.runSync([inputData.buffer]);
  } catch (e: any) {
    return null;
  }

  // @ts-ignore
  const embedding = new Float32Array(outputs[0]);

  // L2-normalise to unit vector for cosine similarity
  let norm = 0;
  for (let i = 0; i < embedding.length; i++) norm += embedding[i] * embedding[i];
  norm = Math.sqrt(norm);

  return Array.from(embedding).map(v => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
