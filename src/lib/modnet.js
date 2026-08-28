/**
 * MODNet 衣物分割模块
 * 使用 ONNX Runtime Web 运行 MODNet 模型
 * 模型来源：https://huggingface.co/ZHKKKe/MODNet
 */

import * as ort from "onnxruntime-web";

let modnetSession = null;
let modelLoaded = false;
let loadError = null;

const MODEL_URL = "https://huggingface.co/ZHKKKe/MODNet/resolve/main/modnet.onnx";

export async function loadModnetModel() {
  if (modelLoaded || modnetSession) {
    return { success: true };
  }

  if (loadError) {
    return { success: false, error: loadError };
  }

  try {
    modnetSession = await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["webgl", "wasm"],
      graphOptimizationLevel: "all",
    });
    modelLoaded = true;
    return { success: true };
  } catch (error) {
    loadError = error.message;
    console.error("MODNet model load failed:", error);
    return { success: false, error: loadError };
  }
}

export function isModnetLoaded() {
  return modelLoaded && modnetSession !== null;
}

export async function segmentClothing(canvas) {
  if (!modnetSession) {
    throw new Error("MODNet model not loaded");
  }

  const width = canvas.width;
  const height = canvas.height;

  const targetWidth = 512;
  const targetHeight = 512;

  const resizedCanvas = document.createElement("canvas");
  resizedCanvas.width = targetWidth;
  resizedCanvas.height = targetHeight;
  const ctx = resizedCanvas.getContext("2d");

  ctx.drawImage(canvas, 0, 0, width, height, 0, 0, targetWidth, targetHeight);
  const resizedData = ctx.getImageData(0, 0, targetWidth, targetHeight);

  const inputTensor = new ort.Tensor("float32", new Float32Array(3 * targetWidth * targetHeight), [1, 3, targetHeight, targetWidth]);

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const i = (y * targetWidth + x) * 4;
      const r = resizedData.data[i] / 255;
      const g = resizedData.data[i + 1] / 255;
      const b = resizedData.data[i + 2] / 255;

      inputTensor.data[0 * targetHeight * targetWidth + y * targetWidth + x] = (r - 0.5) * 2;
      inputTensor.data[1 * targetHeight * targetWidth + y * targetWidth + x] = (g - 0.5) * 2;
      inputTensor.data[2 * targetHeight * targetWidth + y * targetWidth + x] = (b - 0.5) * 2;
    }
  }

  const feeds = { input: inputTensor };
  const results = await modnetSession.run(feeds);

  const matte = results["output"].data;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext("2d");

  const maskImageData = maskCtx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcY = Math.floor((y / height) * targetHeight);
      const srcX = Math.floor((x / width) * targetWidth);
      const srcIdx = srcY * targetWidth + srcX;

      const alpha = matte[srcIdx];

      const i = (y * width + x) * 4;
      maskImageData.data[i] = 255;
      maskImageData.data[i + 1] = 255;
      maskImageData.data[i + 2] = 255;
      maskImageData.data[i + 3] = Math.round(alpha * 255);
    }
  }

  maskCtx.putImageData(maskImageData, 0, 0);

  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = width;
  resultCanvas.height = height;
  const resultCtx = resultCanvas.getContext("2d");

  resultCtx.drawImage(canvas, 0, 0);

  resultCtx.globalCompositeOperation = "destination-in";
  resultCtx.drawImage(maskCanvas, 0, 0);

  return resultCtx.getImageData(0, 0, width, height);
}
