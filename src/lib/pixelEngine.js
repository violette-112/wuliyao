/**
 * 核心图像处理引擎
 * 完整流程：预处理(智能裁剪) → 颜色映射 → 强制对称 → 模板遮罩 → 渲染
 */

import { TOMODACHI_PALETTE } from "../data/palette.js";
import { TOTAL_SIZE, VIEW_COLS, BODY_ROWS, SLEEVE_ROWS } from "../data/templates.js";
import { findClosestColor } from "./colorDistance.js";

const LOCKED_COLOR = [85, 85, 85];

/**
 * 步骤1：图片预处理
 * 居中裁剪为正方形，缩放到目标网格尺寸
 */
export function preprocessImage(img, gridSize = TOTAL_SIZE) {
  const canvas = document.createElement("canvas");
  canvas.width = gridSize;
  canvas.height = gridSize;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const size = Math.min(img.width, img.height);
  const sx = (img.width - size) / 2;
  const sy = (img.height - size) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, size, size, 0, 0, gridSize, gridSize);

  return ctx.getImageData(0, 0, gridSize, gridSize);
}

/**
 * 应用亮度和饱和度调整
 */
export function adjustImage(imageData, brightness = 0, saturation = 0) {
  const data = imageData.data;
  const brightFactor = brightness / 50;
  const satFactor = saturation / 50;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    r = Math.min(255, Math.max(0, r + brightFactor * 128));
    g = Math.min(255, Math.max(0, g + brightFactor * 128));
    b = Math.min(255, Math.max(0, b + brightFactor * 128));

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = Math.min(255, Math.max(0, gray + (r - gray) * (1 + satFactor)));
    g = Math.min(255, Math.max(0, gray + (g - gray) * (1 + satFactor)));
    b = Math.min(255, Math.max(0, gray + (b - gray) * (1 + satFactor)));

    data[i] = Math.round(r);
    data[i + 1] = Math.round(g);
    data[i + 2] = Math.round(b);
  }

  return imageData;
}

function extractPixels(imageData) {
  const data = imageData.data;
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  return pixels;
}

/**
 * 强制水平对称
 */
function enforceHorizontalSymmetry(pixels, paletteIndices, gridSize) {
  const resultPixels = [...pixels];
  const resultIndices = [...paletteIndices];
  const center = Math.floor(gridSize / 2);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < center; x++) {
      const mirrorX = gridSize - 1 - x;
      const idx = y * gridSize + x;
      const mirrorIdx = y * gridSize + mirrorX;

      const leftIdx = paletteIndices[idx];
      const rightIdx = paletteIndices[mirrorIdx];

      if (leftIdx === -1 && rightIdx === -1) continue;

      if (leftIdx === -1) {
        resultPixels[idx] = [...pixels[mirrorIdx]];
        resultIndices[idx] = rightIdx;
        continue;
      }
      if (rightIdx === -1) {
        resultPixels[mirrorIdx] = [...pixels[idx]];
        resultIndices[mirrorIdx] = leftIdx;
        continue;
      }

      if (leftIdx !== rightIdx) {
        const leftColor = TOMODACHI_PALETTE[leftIdx];
        const rightColor = TOMODACHI_PALETTE[rightIdx];
        const avgR = Math.round((leftColor.rgb[0] + rightColor.rgb[0]) / 2);
        const avgG = Math.round((leftColor.rgb[1] + rightColor.rgb[1]) / 2);
        const avgB = Math.round((leftColor.rgb[2] + rightColor.rgb[2]) / 2);
        const avgIdx = findClosestColor([avgR, avgG, avgB], TOMODACHI_PALETTE, true);
        
        resultPixels[idx] = [...TOMODACHI_PALETTE[avgIdx].rgb];
        resultPixels[mirrorIdx] = [...TOMODACHI_PALETTE[avgIdx].rgb];
        resultIndices[idx] = avgIdx;
        resultIndices[mirrorIdx] = avgIdx;
      }
    }
  }

  return { pixels: resultPixels, paletteIndices: resultIndices };
}

/**
 * 合并非常接近的调色板颜色
 */
function mergeSimilarColors(paletteIndices) {
  const countMap = new Map();
  for (const idx of paletteIndices) {
    if (idx >= 0) {
      countMap.set(idx, (countMap.get(idx) || 0) + 1);
    }
  }

  if (countMap.size <= 1) {
    return [...paletteIndices];
  }

  const sorted = [...countMap.entries()].sort((a, b) => b[1] - a[1]);
  const mainColorIdx = sorted[0][0];
  const mainColor = TOMODACHI_PALETTE[mainColorIdx];

  const closeColors = new Set([mainColorIdx]);
  for (const [idx] of sorted) {
    if (idx === mainColorIdx) continue;
    const color = TOMODACHI_PALETTE[idx];
    const dist =
      (color.rgb[0] - mainColor.rgb[0]) ** 2 +
      (color.rgb[1] - mainColor.rgb[1]) ** 2 +
      (color.rgb[2] - mainColor.rgb[2]) ** 2;
    if (dist < 800) {
      closeColors.add(idx);
    }
  }

  return paletteIndices.map((idx) => {
    if (idx >= 0 && closeColors.has(idx)) {
      return mainColorIdx;
    }
    return idx;
  });
}

/**
 * 检测图片是否近似左右对称
 * 返回对称度（0-1，越接近1越对称）
 */
function detectSymmetry(pixels, paletteIndices, gridSize) {
  const center = Math.floor(gridSize / 2);
  let matched = 0;
  let total = 0;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < center; x++) {
      const mirrorX = gridSize - 1 - x;
      const idx = y * gridSize + x;
      const mirrorIdx = y * gridSize + mirrorX;

      const leftIdx = paletteIndices[idx];
      const rightIdx = paletteIndices[mirrorIdx];

      if (leftIdx === rightIdx) {
        matched++;
      }
      total++;
    }
  }

  return total > 0 ? matched / total : 0;
}

/**
 * 步骤2：颜色映射
 * 直接把每个像素映射到游戏调色板最近的颜色
 * 如果图片近似对称，则应用强制对称
 */
export function quantizeAndMap(imageData, colorCount = null) {
  const pixels = extractPixels(imageData);
  
  const isBackground = pixels.map((px) => {
    const [r, g, b] = px;
    const dist = (255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2;
    return dist < 1000;
  });

  const paletteIndices = pixels.map((px, i) => {
    if (isBackground[i]) return -1;
    return findClosestColor(px, TOMODACHI_PALETTE, true);
  });

  const mergedIndices = mergeSimilarColors(paletteIndices);

  const mappedPixels = mergedIndices.map((idx) => {
    if (idx === -1) return [255, 255, 255];
    return [...TOMODACHI_PALETTE[idx].rgb];
  });

  // 自动检测是否需要对称：对称度 > 0.85 才应用强制对称
  const symmetry = detectSymmetry(mappedPixels, mergedIndices, imageData.width);
  
  if (symmetry > 0.85) {
    const { pixels: finalPixels, paletteIndices: finalIndices } = enforceHorizontalSymmetry(
      mappedPixels,
      mergedIndices,
      imageData.width
    );
    return { mappedPixels: finalPixels, paletteIndices: finalIndices };
  }

  return { mappedPixels, paletteIndices: mergedIndices };
}

/**
 * 步骤3：应用服装模板遮罩
 */
export function applyMask(pixels, paletteIndices, mask) {
  const result = [];
  const resultIndices = [];
  const size = mask.length;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (mask[y][x]) {
        result.push(pixels[idx]);
        resultIndices.push(paletteIndices[idx]);
      } else {
        result.push([...LOCKED_COLOR]);
        resultIndices.push(-1);
      }
    }
  }

  return { pixels: result, paletteIndices: resultIndices };
}

/**
 * 从 16×16 像素结果中提取四视图数据
 * 根据模板的视图偏移量拆分 front / back / leftSleeve / rightSleeve
 */
function extractFourView(pixels, paletteIndices) {
  const backStartX = VIEW_COLS;                    // 8
  const sleeveStartY = TOTAL_SIZE - SLEEVE_ROWS;   // 12（从底部往上4行）

  function extractView(ox, oy, cols, rows) {
    const viewPixels = [];
    const viewIndices = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const srcIdx = (oy + y) * TOTAL_SIZE + (ox + x);
        viewPixels.push(pixels[srcIdx] || LOCKED_COLOR);
        viewIndices.push(paletteIndices[srcIdx] ?? -1);
      }
    }
    return { pixels: viewPixels, paletteIndices: viewIndices };
  }

  return {
    front:       extractView(0, 0, VIEW_COLS, BODY_ROWS),
    back:        extractView(backStartX, 0, VIEW_COLS, BODY_ROWS),
    leftSleeve:  extractView(0, sleeveStartY, VIEW_COLS, SLEEVE_ROWS),
    rightSleeve: extractView(backStartX, sleeveStartY, VIEW_COLS, SLEEVE_ROWS),
    viewCols: VIEW_COLS,
    bodyRows: BODY_ROWS,
    sleeveRows: SLEEVE_ROWS,
  };
}

/**
 * 完整处理流程
 */
export function processImage(img, options = {}) {
  const {
    gridSize = TOTAL_SIZE,
    colorCount = 6,
    mask = null,
    template = null,
    brightness = 0,
    saturation = 0,
  } = options;

  let imageData = preprocessImage(img, gridSize);

  if (brightness !== 0 || saturation !== 0) {
    imageData = adjustImage(imageData, brightness, saturation);
  }

  const { mappedPixels, paletteIndices } = quantizeAndMap(imageData, colorCount);

  let finalPixels = mappedPixels;
  let finalIndices = paletteIndices;

  if (mask) {
    const masked = applyMask(mappedPixels, paletteIndices, mask);
    finalPixels = masked.pixels;
    finalIndices = masked.paletteIndices;
  }

  const result = {
    pixels: finalPixels,
    paletteIndices: finalIndices,
    gridSize,
    usedColors: getUsedColors(finalIndices),
  };

  // 如果传入了四视图模板，生成 fourView 数据
  if (template && template.views && template.id !== "simple-tee") {
    result.fourView = extractFourView(finalPixels, finalIndices);
  }

  return result;
}

function getUsedColors(paletteIndices) {
  const used = new Map();

  for (const idx of paletteIndices) {
    if (idx >= 0 && !used.has(idx)) {
      used.set(idx, TOMODACHI_PALETTE[idx]);
    }
  }

  return Array.from(used.values()).sort((a, b) => {
    if (a.isAccent !== b.isAccent) return a.isAccent ? 1 : -1;
    if (a.row !== b.row) return (a.row || 0) - (b.row || 0);
    return (a.col || 0) - (b.col || 0);
  });
}
