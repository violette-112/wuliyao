/**
 * 模板填色引擎 v3
 * 从图片中提取衣服颜色，然后填充到衣服模板上
 * 与智能识别使用相同的颜色提取逻辑，确保结果一致
 * 支持横条纹、竖条纹、两色等检测
 */

import { TOMODACHI_PALETTE } from "../data/palette.js";
import { findClosestColor } from "./colorDistance.js";
import { VIEW_COLS, BODY_ROWS, SLEEVE_ROWS } from "../data/templates.js";

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
      default: h = 0;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function isWhiteBgPixel(r, g, b) {
  return r > 245 && g > 245 && b > 245;
}

function isSkinPixel(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (s < 10) return false;
  if (l < 20 || l > 95) return false;
  const inHue = (h > 10 && h < 50) || (h > 340 && h < 360);
  return inHue && s > 15 && s < 70;
}

function isHairPixel(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (l > 45) return false;
  if (s > 40) return false;
  return l < 45;
}

function findClothingRegion(imageData) {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  const clothingPixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 128) continue;
      if (isWhiteBgPixel(r, g, b)) continue;
      if (isSkinPixel(r, g, b)) continue;
      if (isHairPixel(r, g, b)) continue;
      clothingPixels.push({ x, y, r, g, b });
    }
  }

  if (clothingPixels.length < 100) return null;

  const minX = Math.min(...clothingPixels.map(p => p.x));
  const maxX = Math.max(...clothingPixels.map(p => p.x));
  const minY = Math.min(...clothingPixels.map(p => p.y));
  const maxY = Math.max(...clothingPixels.map(p => p.y));

  return { minX, maxX, minY, maxY, pixels: clothingPixels };
}

function extractColorsFromRegion(pixels, maxColors) {
  const buckets = new Map();
  for (const p of pixels) {
    const key = `${Math.round(p.r / 15)}-${Math.round(p.g / 15)}-${Math.round(p.b / 15)}`;
    if (!buckets.has(key)) {
      buckets.set(key, { r: 0, g: 0, b: 0, count: 0 });
    }
    const b = buckets.get(key);
    b.r += p.r; b.g += p.g; b.b += p.b; b.count++;
  }

  const sorted = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .map(b => [
      Math.round(b.r / b.count),
      Math.round(b.g / b.count),
      Math.round(b.b / b.count),
    ]);

  const unique = [];
  for (const [r, g, b] of sorted) {
    if (isWhiteBgPixel(r, g, b)) continue;

    let dup = false;
    for (const u of unique) {
      const [h1, s1, l1] = rgbToHsl(r, g, b);
      const [h2, s2, l2] = rgbToHsl(u[0], u[1], u[2]);
      const hDiff = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
      if (hDiff < 18 && Math.abs(s1 - s2) < 25 && Math.abs(l1 - l2) < 18) {
        dup = true;
        break;
      }
    }
    if (!dup) {
      unique.push([r, g, b]);
    }
    if (unique.length >= maxColors) break;
  }

  return unique;
}

export function extractClothingColors(imageData, maxColors = 6) {
  const region = findClothingRegion(imageData);
  if (!region) {
    return [[100, 100, 100]];
  }

  const { pixels, minX, maxX, minY, maxY } = region;

  const centerPixels = pixels.filter(
    p => p.x >= minX + (maxX - minX) * 0.2 &&
         p.x <= minX + (maxX - minX) * 0.8 &&
         p.y >= minY + (maxY - minY) * 0.15 &&
         p.y <= minY + (maxY - minY) * 0.85
  );

  const samplePixels = centerPixels.length > 50 ? centerPixels : pixels;
  return extractColorsFromRegion(samplePixels, maxColors);
}

export function mapColorsToPalette(colors) {
  return colors.map((c) => findClosestColor(c, TOMODACHI_PALETTE, true));
}

function detectHorizontalStripes(clothingPixels, region) {
  const { minX, maxX, minY, maxY } = region;
  const h = maxY - minY;
  const w = maxX - minX;

  const centerPixels = clothingPixels.filter(
    p => p.x >= minX + w * 0.3 && p.x <= minX + w * 0.7
  );

  if (centerPixels.length < 50) return { hasStripes: false, stripes: [] };

  const rowBrightness = [];
  const rows = 20;
  for (let i = 0; i < rows; i++) {
    const yStart = minY + h * (i / rows);
    const yEnd = minY + h * ((i + 1) / rows);
    const rowPixels = centerPixels.filter(p => p.y >= yStart && p.y < yEnd);
    if (rowPixels.length > 5) {
      const avgB = rowPixels.reduce((s, p) => s + (p.r + p.g + p.b) / 3, 0) / rowPixels.length;
      rowBrightness.push({ y: i, brightness: avgB, pixels: rowPixels });
    }
  }

  if (rowBrightness.length < 4) return { hasStripes: false, stripes: [] };

  const allAvg = rowBrightness.reduce((s, r) => s + r.brightness, 0) / rowBrightness.length;

  const stripeRows = [];
  for (const row of rowBrightness) {
    if (Math.abs(row.brightness - allAvg) > 20) {
      stripeRows.push(row);
    }
  }

  if (stripeRows.length < 2) return { hasStripes: false, stripes: [] };

  const stripeColors = new Set();
  const stripeInfo = [];

  for (const row of stripeRows) {
    const sortedByB = row.pixels.sort((a, b) =>
      (b.r + b.g + b.b) / 3 - (a.r + a.g + a.b) / 3
    );
    const topN = sortedByB.slice(0, Math.max(10, Math.floor(sortedByB.length * 0.3)));
    const avgR = topN.reduce((s, p) => s + p.r, 0) / topN.length;
    const avgG = topN.reduce((s, p) => s + p.g, 0) / topN.length;
    const avgB = topN.reduce((s, p) => s + p.b, 0) / topN.length;

    const colorKey = `${Math.round(avgR / 20)}-${Math.round(avgG / 20)}-${Math.round(avgB / 20)}`;
    if (!stripeColors.has(colorKey)) {
      stripeColors.add(colorKey);
      stripeInfo.push({
        color: [Math.round(avgR), Math.round(avgG), Math.round(avgB)],
        yRatio: row.y / rows,
        isBright: row.brightness > allAvg
      });
    }
  }

  if (stripeInfo.length === 0) return { hasStripes: false, stripes: [] };
  return { hasStripes: true, stripes: stripeInfo, count: stripeRows.length };
}

function detectVerticalStripes(clothingPixels, region) {
  const { minX, maxX, minY, maxY } = region;
  const w = maxX - minX;

  const left = clothingPixels.filter(p => p.x >= minX && p.x < minX + w * 0.25);
  const right = clothingPixels.filter(p => p.x > maxX - w * 0.25 && p.x <= maxX);

  const results = [];

  for (const zone of [left, right]) {
    if (zone.length < 30) continue;
    const avgB = zone.reduce((s, p) => s + (p.r + p.g + p.b) / 3, 0) / zone.length;
    const bright = zone.filter(p => (p.r + p.g + p.b) / 3 > avgB + 25);
    if (bright.length > zone.length * 0.08) {
      const sr = bright.reduce((s, p) => s + p.r, 0) / bright.length;
      const sg = bright.reduce((s, p) => s + p.g, 0) / bright.length;
      const sb = bright.reduce((s, p) => s + p.b, 0) / bright.length;
      results.push([Math.round(sr), Math.round(sg), Math.round(sb)]);
    }
  }

  if (results.length === 0) return { hasStripes: false, color: null };
  const avg = results.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0])
    .map(v => Math.round(v / results.length));
  return { hasStripes: true, color: avg, sides: results.length };
}

function detectTwoTone(clothingPixels, region) {
  const { minX, maxX, minY, maxY } = region;
  const h = maxY - minY;

  const top = clothingPixels.filter(p => p.y >= minY && p.y < minY + h * 0.35);
  const bottom = clothingPixels.filter(p => p.y > maxY - h * 0.35 && p.y <= maxY);

  if (top.length < 20 || bottom.length < 20) {
    return { hasTwoTone: false, topColor: null, bottomColor: null };
  }

  const topR = top.reduce((s, p) => s + p.r, 0) / top.length;
  const topG = top.reduce((s, p) => s + p.g, 0) / top.length;
  const topB = top.reduce((s, p) => s + p.b, 0) / top.length;
  const botR = bottom.reduce((s, p) => s + p.r, 0) / bottom.length;
  const botG = bottom.reduce((s, p) => s + p.g, 0) / bottom.length;
  const botB = bottom.reduce((s, p) => s + p.b, 0) / bottom.length;

  const [h1, s1, l1] = rgbToHsl(topR, topG, topB);
  const [h2, s2, l2] = rgbToHsl(botR, botG, botB);
  const hDiff = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
  const lDiff = Math.abs(l1 - l2);

  const hasTwoTone = lDiff > 15 || (hDiff > 15 && Math.min(s1, s2) > 15);

  return {
    hasTwoTone,
    topColor: [Math.round(topR), Math.round(topG), Math.round(topB)],
    bottomColor: [Math.round(botR), Math.round(botG), Math.round(botB)],
  };
}

export function fillTemplateWithColors(templateMask, paletteIndices, gridSize, imageData = null, category = null) {
  const pixels = [];
  const indices = [];

  const rows = templateMask?.length || gridSize;
  const cols = templateMask?.[0]?.length || gridSize;

  const mainColorIdx = paletteIndices[0];
  const accentColorIdx = paletteIndices[1] || paletteIndices[0];

  let twoTone = { hasTwoTone: false, topColor: null, bottomColor: null };
  let horizontalStripes = { hasStripes: false, stripes: [] };
  let twoToneTopIdx = mainColorIdx;
  let twoToneBottomIdx = accentColorIdx;
  let stripeColorIndices = [];

  const isPants = category === "pants";

  if (imageData) {
    const region = findClothingRegion(imageData);
    if (region) {
      if (!isPants) {
        twoTone = detectTwoTone(region.pixels, region);
      }
      horizontalStripes = detectHorizontalStripes(region.pixels, region);

      if (twoTone.hasTwoTone) {
        twoToneTopIdx = findClosestColor(twoTone.topColor, TOMODACHI_PALETTE, true);
        twoToneBottomIdx = findClosestColor(twoTone.bottomColor, TOMODACHI_PALETTE, true);
      }

      if (horizontalStripes.hasStripes && horizontalStripes.stripes.length > 0) {
        stripeColorIndices = horizontalStripes.stripes.map(s => ({
          idx: findClosestColor(s.color, TOMODACHI_PALETTE, true),
          yRatio: s.yRatio,
        }));
      }
    }
  }

  const bodyTop = 0;
  const bodyBottom = rows;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (templateMask[y] && templateMask[y][x]) {
        let colorIdx = mainColorIdx;

        if (!isPants && twoTone.hasTwoTone && y > rows * 0.45) {
          colorIdx = twoToneBottomIdx;
        } else if (!isPants && twoTone.hasTwoTone) {
          colorIdx = twoToneTopIdx;
        }

        if (horizontalStripes.hasStripes && stripeColorIndices.length > 0) {
          for (const stripe of stripeColorIndices) {
            const stripeY = Math.floor(bodyTop + stripe.yRatio * (bodyBottom - bodyTop));
            if (Math.abs(y - stripeY) <= 1) {
              colorIdx = stripe.idx;
              break;
            }
          }
        }

        pixels.push([...TOMODACHI_PALETTE[colorIdx].rgb]);
        indices.push(colorIdx);
      } else {
        pixels.push([85, 85, 85]);
        indices.push(-1);
      }
    }
  }

  return { pixels, paletteIndices: indices };
}

export function generateTemplateFill(imageData, template, gridSize, maxColors = 6) {
  const clothingColors = extractClothingColors(imageData, maxColors);
  const mappedIndices = mapColorsToPalette(clothingColors);

  const templateMask = template.mask;
  const { pixels, paletteIndices } = fillTemplateWithColors(
    templateMask,
    mappedIndices,
    gridSize,
    imageData,
    template.category
  );

  const usedColors = getUsedColors(paletteIndices);
  const fourView = fillFourViewsTemplate(template, clothingColors, imageData);

  return {
    pixels,
    paletteIndices,
    gridSize,
    usedColors,
    extractedColors: clothingColors,
    mappedPaletteIndices: mappedIndices,
    fourView,
  };
}

function fillFourViewsTemplate(template, colors, imageData) {
  const views = template.views;

  const mainIdx = findClosestColor(colors[0], TOMODACHI_PALETTE, true);
  const secondaryIdx = colors[1]
    ? findClosestColor(colors[1], TOMODACHI_PALETTE, true)
    : mainIdx;

  let stripeColorIndices = [];
  let twoTone = { hasTwoTone: false, topIdx: mainIdx, bottomIdx: secondaryIdx };

  const isPants = template.category === "pants";

  if (imageData) {
    const region = findClothingRegion(imageData);
    if (region) {
      const hStripes = detectHorizontalStripes(region.pixels, region);
      if (hStripes.hasStripes && hStripes.stripes.length > 0) {
        stripeColorIndices = hStripes.stripes.map(s => ({
          idx: findClosestColor(s.color, TOMODACHI_PALETTE, true),
          yRatio: s.yRatio,
        }));
      }

      if (!isPants) {
        const tt = detectTwoTone(region.pixels, region);
        if (tt.hasTwoTone) {
          twoTone = {
            hasTwoTone: true,
            topIdx: findClosestColor(tt.topColor, TOMODACHI_PALETTE, true),
            bottomIdx: findClosestColor(tt.bottomColor, TOMODACHI_PALETTE, true),
          };
        }
      }
    }
  }

  function fillView(mask) {
    const pixels = [];
    const indices = [];
    const rows = mask.length;
    const cols = mask[0] ? mask[0].length : VIEW_COLS;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (mask[y][x]) {
          let colorIdx = mainIdx;

          if (twoTone.hasTwoTone) {
            colorIdx = y > rows * 0.45 ? twoTone.bottomIdx : twoTone.topIdx;
          }

          if (stripeColorIndices.length > 0) {
            for (const stripe of stripeColorIndices) {
              const stripeY = Math.floor(stripe.yRatio * rows);
              if (Math.abs(y - stripeY) <= 0) {
                colorIdx = stripe.idx;
                break;
              }
            }
          }

          pixels.push([...TOMODACHI_PALETTE[colorIdx].rgb]);
          indices.push(colorIdx);
        } else {
          pixels.push([85, 85, 85]);
          indices.push(-1);
        }
      }
    }

    return { pixels, paletteIndices: indices };
  }

  return {
    front: fillView(views.front),
    back: fillView(views.back),
    leftSleeve: fillView(views.leftSleeve),
    rightSleeve: fillView(views.rightSleeve),
    viewCols: VIEW_COLS,
    bodyRows: BODY_ROWS,
    sleeveRows: SLEEVE_ROWS,
  };
}

function getUsedColors(paletteIndices) {
  const used = new Map();
  for (const idx of paletteIndices) {
    if (idx < 0) continue;
    if (!used.has(idx)) {
      const color = TOMODACHI_PALETTE[idx];
      used.set(idx, {
        index: idx,
        hex: color.hex,
        rgb: color.rgb,
        row: color.row,
        col: color.col,
        count: 0,
      });
    }
    used.get(idx).count++;
  }
  return [...used.values()].sort((a, b) => b.count - a.count);
}
