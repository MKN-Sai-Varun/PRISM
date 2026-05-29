/**
 * BlazeFace Face Detector
 * Wraps TFLite BlazeFace model
 * Input: camera frame
 * Output: bounding box + confidence score
 */

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export function parseBlazeOutput(
  output: Float32Array,
  frameWidth: number,
  frameHeight: number,
  confidenceThreshold: number = 0.75
): FaceBox | null {
  // BlazeFace outputs [ymin, xmin, ymax, xmax, confidence]
  const confidence = output[4];

  if (confidence < confidenceThreshold) {
    return null;
  }

  const ymin = output[0];
  const xmin = output[1];
  const ymax = output[2];
  const xmax = output[3];

  return {
    x: xmin * frameWidth,
    y: ymin * frameHeight,
    width: (xmax - xmin) * frameWidth,
    height: (ymax - ymin) * frameHeight,
    confidence,
  };
}

export function cropFace(
  imageData: Uint8Array,
  frameWidth: number,
  frameHeight: number,
  box: FaceBox,
  padding: number = 0.2
): { data: Uint8Array; width: number; height: number } {
  // Add padding around face
  const padX = box.width * padding;
  const padY = box.height * padding;

  const x0 = Math.max(0, Math.floor(box.x - padX));
  const y0 = Math.max(0, Math.floor(box.y - padY));
  const x1 = Math.min(frameWidth, Math.ceil(box.x + box.width + padX));
  const y1 = Math.min(frameHeight, Math.ceil(box.y + box.height + padY));

  const cropWidth = x1 - x0;
  const cropHeight = y1 - y0;
  const cropData = new Uint8Array(cropWidth * cropHeight * 4);

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const srcIdx = (y * frameWidth + x) * 4;
      const dstIdx = ((y - y0) * cropWidth + (x - x0)) * 4;
      cropData[dstIdx] = imageData[srcIdx];
      cropData[dstIdx + 1] = imageData[srcIdx + 1];
      cropData[dstIdx + 2] = imageData[srcIdx + 2];
      cropData[dstIdx + 3] = imageData[srcIdx + 3];
    }
  }

  return { data: cropData, width: cropWidth, height: cropHeight };
}