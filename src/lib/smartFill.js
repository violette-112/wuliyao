/**
 * 智能模板填色引擎 v6
 * 核心改进：
 * 1. 正确提取所有颜色（包括白色、黄色条纹色）
 * 2. 检测横条纹
 * 3. 修复袖长检测
 */

import { TOMODACHI_PALETTE } from "../data/palette.js";
import { TOTAL_SIZE, TEMPLATES, DEFAULT_TEMPLATE, VIEW_COLS, BODY_ROWS, SLEEVE_ROWS } from "../data/templates.js";
import { findClosestColor } from "./colorDistance.js";

export function adjustColorBrightnessSaturation(rgb, brightness = 0, saturation = 0) {
  let [r, g, b] = rgb;
  
  // RGB转HSL
  let rn = r / 255, gn = g / 255, bn = b / 255;
  let max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0;
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h /= 6;
  }
  
  // 应用调整
  const brightFactor = brightness / 50;
  const satFactor = saturation / 50;
  
  // 调整亮度：-1到1映射到0到1的亮度范围
  l = Math.max(0, Math.min(1, l + brightFactor * 0.5));
  
  // 调整饱和度：-1到1映射到饱和度变化
  if (satFactor > 0) {
    s = s + (1 - s) * satFactor;
  } else {
    s = s * (1 + satFactor);
  }
  s = Math.max(0, Math.min(1, s));
  
  // HSL转RGB
  if (s === 0) {
    r = g = b = l * 255;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3) * 255;
    g = hue2rgb(p, q, h) * 255;
    b = hue2rgb(p, q, h - 1/3) * 255;
  }
  
  return [Math.round(r), Math.round(g), Math.round(b)];
}

export function adjustAnalysisBrightnessSaturation(analysis, brightness = 0, saturation = 0) {
  if (brightness === 0 && saturation === 0) return analysis;

  const adjusted = JSON.parse(JSON.stringify(analysis));

  if (adjusted.colors && Array.isArray(adjusted.colors)) {
    adjusted.colors = adjusted.colors.map(c => adjustColorBrightnessSaturation(c, brightness, saturation));
  }

  if (adjusted.horizontalStripes?.stripes) {
    adjusted.horizontalStripes.stripes = adjusted.horizontalStripes.stripes.map(s => ({
      ...s,
      color: adjustColorBrightnessSaturation(s.color, brightness, saturation),
    }));
  }

  if (adjusted.verticalStripes?.stripes) {
    adjusted.verticalStripes.stripes = adjusted.verticalStripes.stripes.map(s => ({
      ...s,
      color: adjustColorBrightnessSaturation(s.color, brightness, saturation),
    }));
  }

  if (adjusted.twoTone?.topColor) {
    adjusted.twoTone.topColor = adjustColorBrightnessSaturation(adjusted.twoTone.topColor, brightness, saturation);
  }
  if (adjusted.twoTone?.bottomColor) {
    adjusted.twoTone.bottomColor = adjustColorBrightnessSaturation(adjusted.twoTone.bottomColor, brightness, saturation);
  }

  if (adjusted.logo?.color) {
    adjusted.logo.color = adjustColorBrightnessSaturation(adjusted.logo.color, brightness, saturation);
  }

  if (adjusted.printPatterns && Array.isArray(adjusted.printPatterns)) {
    adjusted.printPatterns = adjusted.printPatterns.map(p => ({
      ...p,
      color: adjustColorBrightnessSaturation(p.color, brightness, saturation),
    }));
  }

  return adjusted;
}

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
  let totalPixels = 0;
  for (const p of pixels) {
    const key = `${Math.round(p.r / 15)}-${Math.round(p.g / 15)}-${Math.round(p.b / 15)}`;
    if (!buckets.has(key)) {
      buckets.set(key, { r: 0, g: 0, b: 0, count: 0 });
    }
    const b = buckets.get(key);
    b.r += p.r; b.g += p.g; b.b += p.b; b.count++;
    totalPixels++;
  }

  // 排序：优先按像素数量（大面积颜色排前面），同时考虑颜色亮度避免极端色
  const sorted = [...buckets.values()]
    .map(b => ({
      r: Math.round(b.r / b.count),
      g: Math.round(b.g / b.count),
      b: Math.round(b.b / b.count),
      count: b.count,
      ratio: b.count / Math.max(totalPixels, 1),
    }))
    .sort((a, b) => {
      // 大面积颜色优先：占比差异超过5%时，占比大的排前
      const ratioDiff = Math.abs(a.ratio - b.ratio);
      if (ratioDiff > 0.05) {
        return b.ratio - a.ratio;
      }
      // 占比接近时，避免把极端深色/极端浅色排第一
      const brightA = (a.r + a.g + a.b) / 3;
      const brightB = (b.r + b.g + b.b) / 3;
      const aExtreme = brightA < 40 || brightA > 240;
      const bExtreme = brightB < 40 || brightB > 240;
      if (aExtreme !== bExtreme) {
        return aExtreme ? 1 : -1;
      }
      return b.count - a.count;
    });

  const unique = [];
  for (const color of sorted) {
    const { r, g, b, count } = color;
    let dup = false;
    for (const u of unique) {
      const [h1, s1, l1] = rgbToHsl(r, g, b);
      const [h2, s2, l2] = rgbToHsl(u[0], u[1], u[2]);
      const hDiff = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
      if (hDiff < 18 && Math.abs(s1 - s2) < 25 && Math.abs(l1 - l2) < 18) {
        // 相似色合并：累加count，保留占比大的颜色
        u[3] += count;
        dup = true;
        break;
      }
    }
    if (!dup) {
      unique.push([r, g, b, count, color.ratio]);
    }
    if (unique.length >= maxColors) break;
  }

  // 最终再排序一次（合并后可能顺序变化）：确保大面积米色/中性色排第一
  unique.sort((a, b) => {
    const countA = a[3] || 0;
    const countB = b[3] || 0;
    const ratioA = a[4] || 0;
    const ratioB = b[4] || 0;
    // 占比差异超过8%时绝对优先
    if (Math.abs(ratioA - ratioB) > 0.08) {
      return ratioB - ratioA;
    }
    return countB - countA;
  });

  return unique.map(c => c.slice(0, 3));
}

function detectHorizontalStripes(clothingPixels, region) {
  const { minX, maxX, minY, maxY } = region;
  const h = maxY - minY;
  const w = maxX - minX;

  // 使用更宽的中心区域来检测条纹（忽略边缘的领子/袖口/下摆区域）
  const centerPixels = clothingPixels.filter(
    p => p.x >= minX + w * 0.2 && p.x <= minX + w * 0.8 &&
         p.y >= minY + h * 0.15 && p.y <= minY + h * 0.85
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
    // 需要更显著的亮度差异才能算条纹（排除领子/下摆等小区域）
    if (Math.abs(row.brightness - allAvg) > 25) {
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
  const h = maxY - minY;

  // 检测左右两侧的竖条纹区域（扩大检测范围）
  const left = clothingPixels.filter(p => p.x >= minX && p.x < minX + w * 0.3);
  const right = clothingPixels.filter(p => p.x > maxX - w * 0.3 && p.x <= maxX);

  const results = [];

  for (const [zone, side] of [[left, "left"], [right, "right"]]) {
    if (zone.length < 20) continue;

    // 计算该区域的平均亮度
    const avgB = zone.reduce((s, p) => s + (p.r + p.g + p.b) / 3, 0) / zone.length;

    // 找出比平均亮很多的像素（条纹通常是浅色的）
    const brightThreshold = Math.max(avgB + 15, 160); // 至少比平均亮15，且绝对亮度>160
    const bright = zone.filter(p => {
      const b = (p.r + p.g + p.b) / 3;
      return b > brightThreshold;
    });

    // 降低阈值：只要亮像素占比超过5%就算有竖条纹
    if (bright.length > zone.length * 0.04) {
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

  // 将衣服分为上中下三个区域，检测是否为真双色（上下不同色）还是只是点缀
  const top = clothingPixels.filter(p => p.y >= minY && p.y < minY + h * 0.35);
  const middle = clothingPixels.filter(p => p.y >= minY + h * 0.35 && p.y < minY + h * 0.65);
  const bottom = clothingPixels.filter(p => p.y > maxY - h * 0.35 && p.y <= maxY);

  if (top.length < 20 || middle.length < 20 || bottom.length < 20) {
    return { hasTwoTone: false, topColor: null, bottomColor: null };
  }

  const avgColor = (pixels) => {
    const r = pixels.reduce((s, p) => s + p.r, 0) / pixels.length;
    const g = pixels.reduce((s, p) => s + p.g, 0) / pixels.length;
    const b = pixels.reduce((s, p) => s + p.b, 0) / pixels.length;
    return [r, g, b];
  };

  const [topR, topG, topB] = avgColor(top);
  const [midR, midG, midB] = avgColor(middle);
  const [botR, botG, botB] = avgColor(bottom);

  const topBright = (topR + topG + topB) / 3;
  const midBright = (midR + midG + midB) / 3;
  const botBright = (botR + botG + botB) / 3;

  const [h1, s1, l1] = rgbToHsl(topR, topG, topB);
  const [h2, s2, l2] = rgbToHsl(botR, botG, botB);
  const [hM, sM, lM] = rgbToHsl(midR, midG, midB);
  const hDiffTB = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
  const hDiffTM = Math.min(Math.abs(h1 - hM), 360 - Math.abs(h1 - hM));
  const hDiffBM = Math.min(Math.abs(h2 - hM), 360 - Math.abs(h2 - hM));
  const lDiffTB = Math.abs(l1 - l2);
  const lDiffTM = Math.abs(l1 - lM);
  const lDiffBM = Math.abs(l2 - lM);

  // 计算色距离
  const colorDist = (a, b) => Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]);
  const topBotDist = colorDist([topR,topG,topB], [botR,botG,botB]);
  const topMidDist = colorDist([topR,topG,topB], [midR,midG,midB]);
  const botMidDist = colorDist([botR,botG,botB], [midR,midG,midB]);

  // 真双色判定：上下颜色差异大，且中间过渡区域是渐变/混合色（不是与上下都差异巨大）
  // 如果上和下颜色相近（如都是蓝色），但与中间差异大，则不是双色，是点缀
  const topBotSimilar = topBotDist < 50; // 上下颜色很接近（如都是蓝色）
  const bothDiffFromMid = topMidDist > 60 && botMidDist > 60; // 上下都与中间差异大

  // 如果上下颜色相似但都与中间差异大 -> 不是双色，是点缀（如蓝色领子+蓝色下摆，中间米色）
  if (topBotSimilar && bothDiffFromMid) {
    return { hasTwoTone: false, topColor: null, bottomColor: null };
  }

  // 只有当上下颜色差异大，且中间区域没有一个完全不同的第三色时，才认为是双色
  const isTrueTwoTone = (lDiffTB > 15 || (hDiffTB > 20 && Math.min(s1, s2) > 20))
    && !(lDiffTM > 20 && lDiffBM > 20 && Math.abs(l1 - l2) < 25);

  return {
    hasTwoTone: isTrueTwoTone,
    topColor: [Math.round(topR), Math.round(topG), Math.round(topB)],
    bottomColor: [Math.round(botR), Math.round(botG), Math.round(botB)],
    splitRatio: 0.5,
  };
}

function detectLogo(clothingPixels, region) {
  const { minX, maxX, minY, maxY } = region;
  const w = maxX - minX;
  const h = maxY - minY;

  // 胸部中心区域（扩大范围确保覆盖到logo）
  const chest = clothingPixels.filter(
    p => p.x >= minX + w * 0.3 && p.x <= minX + w * 0.7 &&
         p.y >= minY + h * 0.08 && p.y <= minY + h * 0.4
  );

  if (chest.length < 20) return { hasLogo: false, color: null };

  // 整件衣服的平均亮度
  const allAvgB = clothingPixels.reduce((s, p) => s + (p.r + p.g + p.b) / 3, 0) / clothingPixels.length;

  // 胸口区域平均亮度
  const chestAvgB = chest.reduce((s, p) => s + (p.r + p.g + p.b) / 3, 0) / chest.length;
  const brightnessDiff = Math.abs(chestAvgB - allAvgB);

  // 排除肤色
  const avgR = chest.reduce((s, p) => s + p.r, 0) / chest.length;
  const avgG = chest.reduce((s, p) => s + p.g, 0) / chest.length;
  const avgB = chest.reduce((s, p) => s + p.b, 0) / chest.length;
  if (isSkinPixel(Math.round(avgR), Math.round(avgG), Math.round(avgB))) {
    return { hasLogo: false, color: null };
  }

  // 核心检测：胸口与整体亮度差异足够大 → 有logo
  if (brightnessDiff > 12) {
    const sortedByB = [...chest].sort((a, b) => (b.r+b.g+b.b)/3 - (a.r+a.g+a.b)/3);

    if (chestAvgB > allAvgB) {
      // 深色衣服上的亮色logo（如深蓝Adidas夹克上的白logo）
      const candidates = sortedByB.slice(0, Math.max(5, Math.ceil(chest.length * 0.15)));
      if (candidates.length >= 4) {
        const lr = candidates.reduce((s, p) => s + p.r, 0) / candidates.length;
        const lg = candidates.reduce((s, p) => s + p.g, 0) / candidates.length;
        const lb = candidates.reduce((s, p) => s + p.b, 0) / candidates.length;
        // 深底衣服上允许白色作为logo色
        if (allAvgB < 140 || !isWhiteBgPixel(Math.round(lr), Math.round(lg), Math.round(lb))) {
          return { hasLogo: true, color: [Math.round(lr), Math.round(lg), Math.round(lb)] };
        }
      }
    } else {
      // 浅色衣服上的深色logo
      const candidates = sortedByB.slice(-Math.max(3, Math.ceil(chest.length * 0.1)));
      if (candidates.length >= 3) {
        const lr = candidates.reduce((s, p) => s + p.r, 0) / candidates.length;
        const lg = candidates.reduce((s, p) => s + p.g, 0) / candidates.length;
        const lb = candidates.reduce((s, p) => s + p.b, 0) / candidates.length;
        return { hasLogo: true, color: [Math.round(lr), Math.round(lg), Math.round(lb)] };
      }
    }
  }

  // 备用：高方差检测（胸口有图案/文字时方差大）
  const variance = chest.reduce((sum, p) => {
    const b = (p.r+p.g+p.b)/3;
    return sum + Math.pow(b - chestAvgB, 2);
  }, 0) / chest.length;

  if (variance > 400 && brightnessDiff > 5) {
    const bright = chest.filter(p => (p.r+p.g+p.b)/3 > chestAvgB + 10);
    if (bright.length >= 4) {
      const lr = bright.reduce((s,p) => s+p.r, 0)/bright.length;
      const lg = bright.reduce((s,p) => s+p.g, 0)/bright.length;
      const lb = bright.reduce((s,p) => s+p.b, 0)/bright.length;
      return { hasLogo: true, color: [Math.round(lr), Math.round(lg), Math.round(lb)] };
    }
  }

  return { hasLogo: false, color: null };
}

function detectHood(clothingPixels, region) {
  const { minX, maxX, minY, maxY } = region;
  const top = clothingPixels.filter(p => p.y < minY + (maxY - minY) * 0.12);
  if (top.length < 20) return false;
  const topL = Math.min(...top.map(p => p.x));
  const topR = Math.max(...top.map(p => p.x));
  const topW = topR - topL;
  const fullW = maxX - minX;
  return topW / fullW > 0.7;
}

function detectBottomWidth(clothingPixels, region) {
  const { minX, maxX, minY, maxY } = region;
  const h = maxY - minY;

  const bottomPixels = clothingPixels.filter(p => p.y > maxY - h * 0.15);
  
  if (bottomPixels.length < 5) return 0;

  const bottomLeft = Math.min(...bottomPixels.map(p => p.x));
  const bottomRight = Math.max(...bottomPixels.map(p => p.x));
  
  return bottomRight - bottomLeft;
}

function detectSleeveLength(clothingPixels, region) {
  const { minX, maxX, minY, maxY } = region;
  const w = maxX - minX;
  const h = maxY - minY;

  const bottomZone = clothingPixels.filter(p => p.y > maxY - h * 0.15);

  if (bottomZone.length < 10) return "short";

  const leftEdge = bottomZone.filter(p => p.x < minX + w * 0.15);
  const rightEdge = bottomZone.filter(p => p.x > maxX - w * 0.15);

  const hasBottomSleeves = leftEdge.length > 5 || rightEdge.length > 5;

  if (hasBottomSleeves) return "long";

  const midY = minY + h * 0.4;
  const midZone = clothingPixels.filter(p => Math.abs(p.y - midY) < h * 0.1);
  
  if (midZone.length < 20) return "short";

  const midLeft = midZone.filter(p => p.x < minX + w * 0.15);
  const midRight = midZone.filter(p => p.x > maxX - w * 0.15);

  if (midLeft.length > 5 && midRight.length > 5) return "short";

  return "sleeveless";
}

export function analyzeClothing(imageData) {
  const region = findClothingRegion(imageData);
  if (!region) return null;

  const { pixels, minX, maxX, minY, maxY } = region;

  const width = maxX - minX;
  const height = maxY - minY;
  const aspectRatio = width / Math.max(height, 1);

  let aspectRatioType = null;
  let pantsLength = null;
  let skirtLength = null;

  if (aspectRatio > 1.3 && height < width * 0.7) {
    aspectRatioType = "hat";
  } else if (aspectRatio < 0.7) {
    aspectRatioType = "pants";
    pantsLength = height > width * 2.5 ? "long" : "short";
  } else if (aspectRatio >= 0.7 && aspectRatio <= 1.2) {
    const bottomWidth = detectBottomWidth(pixels, region);
    if (bottomWidth > width * 0.8) {
      aspectRatioType = "skirt";
      skirtLength = height > width * 1.2 ? "long" : "short";
    }
  }

  const centerPixels = pixels.filter(
    p => p.x >= minX + (maxX - minX) * 0.2 &&
         p.x <= minX + (maxX - minX) * 0.8 &&
         p.y >= minY + (maxY - minY) * 0.15 &&
         p.y <= minY + (maxY - minY) * 0.85
  );

  const samplePixels = centerPixels.length > 50 ? centerPixels : pixels;

  const colors = extractColorsFromRegion(samplePixels, 8);
  const hStripes = detectHorizontalStripes(pixels, region);
  const vStripes = detectVerticalStripes(pixels, region);
  const twoTone = detectTwoTone(pixels, region);
  const logo = detectLogo(pixels, region);
  const hasHood = detectHood(pixels, region);
  const sleeveLength = detectSleeveLength(pixels, region);

  return {
    boundingBox: { minX, maxX, minY, maxY },
    colors,
    horizontalStripes: hStripes,
    verticalStripes: vStripes,
    twoTone,
    logo,
    hasHood,
    sleeveLength,
    aspectRatio,
    aspectRatioType,
    pantsLength,
    skirtLength,
  };
}

export function autoSelectTemplate(analysis) {
  if (!analysis) return DEFAULT_TEMPLATE;
  const find = (id) => TEMPLATES.find((t) => t.id === id) || DEFAULT_TEMPLATE;

  const bbox = analysis.boundingBox;
  let clothingType = null;

  if (bbox) {
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;
    const aspectRatio = width / Math.max(height, 1);

    if (analysis.aspectRatioType === "hat") {
      clothingType = "hat";
    } else if (analysis.aspectRatioType === "pants") {
      clothingType = "pants";
    } else if (analysis.aspectRatioType === "skirt") {
      clothingType = "skirt";
    }
  }

  if (clothingType === "hat") {
    return find("cap");
  }
  if (clothingType === "pants") {
    if (analysis.pantsLength === "short") {
      return find("shorts");
    }
    return find("long-pants");
  }
  if (clothingType === "skirt") {
    if (analysis.skirtLength === "short") {
      return find("short-skirt");
    }
    return find("long-skirt");
  }

  if (analysis.hasHood || analysis.sleeveLength === "long") return find("long-sleeve");
  if (analysis.sleeveLength === "short") return find("short-sleeve");
  if (analysis.sleeveLength === "sleeveless") return find("tank-top");
  return find("short-sleeve");
}

export function fillTemplateSmart(templateMask, analysis, gridSize, category = null) {
  const pixels = [];
  const indices = [];

  const SUB_DIV = 3;

  const rows = templateMask?.length || gridSize;
  const cols = templateMask?.[0]?.length || gridSize;

  const subRows = rows * SUB_DIV;
  const subCols = cols * SUB_DIV;

  const mainColor = analysis.colors[0] || [100, 100, 100];
  let mainIdx = findClosestColor(mainColor, TOMODACHI_PALETTE, true);
  let secondaryIdx = mainIdx;
  let stripeColorIndices = [];
  let logoIdx = -1;

  const isPants = category === "pants";

  // twoTone 双保险：只有在没有领子/袖口/开衫等独立细节时才允许色块拼接
  // 领子/袖口/下摆的异色是"装饰边缘"不是"上/下大色块"
  const hasEdgeDetails = analysis.collar || analysis.cuffStyle || analysis.hasCuffs;
  const safeTwoTone = !!(
    analysis.twoTone &&
    analysis.twoTone.hasTwoTone &&
    !isPants &&
    !hasEdgeDetails &&
    analysis.twoTone.topColor &&
    analysis.twoTone.bottomColor
  );

  if (analysis.colors[1]) {
    secondaryIdx = findClosestColor(analysis.colors[1], TOMODACHI_PALETTE, true);
  }

  if (analysis.horizontalStripes.hasStripes && analysis.horizontalStripes.stripes.length > 0) {
    stripeColorIndices = analysis.horizontalStripes.stripes.map(s => ({
      idx: findClosestColor(s.color, TOMODACHI_PALETTE, true),
      yRatio: s.yRatio,
      isBright: s.isBright
    }));
  }

  if (analysis.logo.hasLogo && analysis.logo.color) {
    logoIdx = findClosestColor(analysis.logo.color, TOMODACHI_PALETTE, true);
  }

  if (safeTwoTone) {
    mainIdx = findClosestColor(analysis.twoTone.topColor, TOMODACHI_PALETTE, true);
    secondaryIdx = findClosestColor(analysis.twoTone.bottomColor, TOMODACHI_PALETTE, true);
  }

  const bodyTop = 0;
  const bodyBottom = subRows;

  for (let sy = 0; sy < subRows; sy++) {
    for (let sx = 0; sx < subCols; sx++) {
      const y = Math.floor(sy / SUB_DIV);
      const x = Math.floor(sx / SUB_DIV);
      const subY = sy % SUB_DIV;
      const subX = sx % SUB_DIV;

      if (templateMask[y] && templateMask[y][x]) {
        let colorIdx = mainIdx;

        if (safeTwoTone && sy > subRows * (analysis.twoTone.splitRatio || 0.5)) {
          colorIdx = secondaryIdx;
        }

        if (analysis.horizontalStripes.hasStripes && stripeColorIndices.length > 0) {
          const yInBody = (sy - bodyTop) / (bodyBottom - bodyTop);
          for (const stripe of stripeColorIndices) {
            const stripeY = Math.floor(bodyTop + stripe.yRatio * (bodyBottom - bodyTop));
            if (Math.abs(sy - stripeY) <= 1) {
              colorIdx = stripe.idx;
              break;
            }
          }
        }

        if (analysis.logo.hasLogo && logoIdx >= 0) {
          const lt = Math.floor(subRows * 0.22);
          const lb = Math.floor(subRows * 0.38);
          const ll = Math.floor(subCols * 0.4);
          const lr = Math.floor(subCols * 0.6);
          if (sy >= lt && sy <= lb && sx >= ll && sx <= lr) {
            if (drawAdidasLogo(sx - ll, sy - lt, lr - ll + 1, lb - lt + 1)) {
              colorIdx = logoIdx;
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

  return { pixels, paletteIndices: indices, subDiv: SUB_DIV };
}

function drawAdidasLogo(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  const pr = Math.min(w, h) * 0.35;
  const sw = w * 0.12;
  const d = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
  if (d <= pr) return true;

  const angle = Math.atan2(y - cy, x - cx);
  const pa = Math.PI / 3;
  for (let i = 0; i < 3; i++) {
    const sa = -Math.PI / 2 + i * pa * 2 - pa;
    const ea = sa + pa * 2;
    let na = angle;
    while (na < sa - Math.PI) na += Math.PI * 2;
    while (na > ea + Math.PI) na -= Math.PI * 2;
    if (na >= sa && na <= ea && d <= pr * 1.8) return true;
  }
  if (Math.abs(x - cx) < sw && y > cy) return true;
  return false;
}

export function generateSmartTemplateFill(imageData, gridSize = TOTAL_SIZE) {
  const analysis = analyzeClothing(imageData);
  if (!analysis) return null;

  const template = autoSelectTemplate(analysis);
  const { pixels, paletteIndices } = fillTemplateSmart(template.mask, analysis, gridSize, template.category);
  const usedColors = getUsedColors(paletteIndices);

  const fourView = fillFourViews(template, analysis);

  return {
    pixels,
    paletteIndices,
    gridSize,
    usedColors,
    analysis,
    template,
    fourView,
  };
}

/**
 * 填充四视图
 * 返回 { front, back, leftSleeve, rightSleeve }
 * 每个视图: { pixels, paletteIndices }
 */
export function fillFourViews(template, analysis, imageData = null) {
  const views = template.views;

  // ===== 主色校正（强制像素级） =====
  // 用户反复强调：颜色必须和原图一致，严禁AI编造#FFD700之类的标准色
  // 只要有 imageData，就用真实像素统计出来的颜色作为基准——完全覆盖 AI 返回的 colors
  // 以前的"imgIsNeutral && aiIsDark"条件太窄，黄裙/粉T/任何色都不匹配导致校正被跳过
  let mainColor = analysis.colors[0] || [100, 100, 100];
  let pixelCorrected = false;
  if (imageData) {
    try {
      const region = findClothingRegion(imageData);
      if (region && region.pixels.length > 100) {
        // 中心 50% 区域取像素，绝对避免领口/模特皮肤/下摆阴影和背景
        const w = region.maxX - region.minX;
        const h = region.maxY - region.minY;
        let centerPixels = region.pixels.filter(
          p => p.x >= region.minX + w * 0.25 &&
               p.x <= region.minX + w * 0.75 &&
               p.y >= region.minY + h * 0.20 &&
               p.y <= region.minY + h * 0.80
        );
        if (centerPixels.length < 100) {
          centerPixels = region.pixels.filter(
            p => p.x >= region.minX + w * 0.15 &&
                 p.x <= region.minX + w * 0.85 &&
                 p.y >= region.minY + h * 0.15 &&
                 p.y <= region.minY + h * 0.85
          );
        }
        const samplePixels = centerPixels.length > 100 ? centerPixels : region.pixels;

        // ========== 亮度中值百分位过滤 ==========
        // 消除太阳高光（L过高的亮像素）和褶皱阴影（L过低的暗像素）
        // 只保留亮度在 [Q1, Q3]（25%分位~75%分位）之间的中间调像素做聚类取众数
        // 这是为什么之前"黄裙主色被识别成亮黄(#FFD700)"的根因
        const sortedByLum = samplePixels
          .map(p => ({ p, L: 0.299*p.rgb[0] + 0.587*p.rgb[1] + 0.114*p.rgb[2] }))
          .sort((a,b) => a.L - b.L);
        const n = sortedByLum.length;
        const Q1L = sortedByLum[Math.floor(n * 0.20)].L; // 20th percentile
        const Q3L = sortedByLum[Math.floor(n * 0.80)].L; // 80th percentile，比25/75更严格
        const midTonePixels = sortedByLum.filter(o => o.L >= Q1L && o.L <= Q3L).map(o => o.p);
        const finalPixels = midTonePixels.length > 80 ? midTonePixels : samplePixels;

        // 提取 4 种代表性颜色（主色/辅色/点缀色/边缘色）
        const imgColors = extractColorsFromRegion(finalPixels, 4);
        if (imgColors && imgColors.length > 0) {
          // imgColors[0] = 出现频率最高的颜色（服装主体）
          mainColor = imgColors[0];
          // 完全重写 analysis.colors（第一个=主，第二个=与主差异最大的辅助色，往后差异递减）
          const newColors = [mainColor];
          for (let i = 1; i < imgColors.length; i++) {
            const c = imgColors[i];
            // 过滤掉与主色太近的颜色（避免细微纹理色被当作辅助色）
            const d1 = Math.abs(c[0]-mainColor[0]) + Math.abs(c[1]-mainColor[1]) + Math.abs(c[2]-mainColor[2]);
            if (d1 < 50) continue;
            // 过滤掉和已添加颜色重复的
            let dup = false;
            for (const nc of newColors) {
              const d2 = Math.abs(c[0]-nc[0]) + Math.abs(c[1]-nc[1]) + Math.abs(c[2]-nc[2]);
              if (d2 < 40) { dup = true; break; }
            }
            if (!dup) newColors.push(c);
          }
          analysis.colors = newColors;
          pixelCorrected = true;

          // 同步校正 twoTone 颜色：如果原twoTone颜色与"新主色+新辅助色"一致才保留，否则关掉
          if (analysis.twoTone && analysis.twoTone.hasTwoTone) {
            const tc = analysis.twoTone.topColor;
            const bc = analysis.twoTone.bottomColor;
            const closeTo = (c, palette) => palette.some(p => Math.abs(c[0]-p[0])+Math.abs(c[1]-p[1])+Math.abs(c[2]-p[2]) < 50);
            if (!tc || !bc || !closeTo(tc, newColors) || !closeTo(bc, newColors)) {
              analysis.twoTone = { hasTwoTone: false, topColor: null, bottomColor: null, splitRatio: 0.5 };
            } else {
              analysis.twoTone.topColor = newColors[0];
              analysis.twoTone.bottomColor = newColors[1] || newColors[0];
            }
          }

          // 同步校正 verticalStripes.color：
          // - 如果与新主色差<25 = 完全同色 = 强制提亮18%派生出来（条纹=必须画）
          // - 如果 25<=差<60 = 近色但可辨 = 保持原样（或替换为像素辅助色）
          // - 差>=60 = 撞色 = 保持原样
          if (analysis.verticalStripes) {
            if (analysis.verticalStripes.color) {
              const d = Math.abs(analysis.verticalStripes.color[0]-mainColor[0])
                      + Math.abs(analysis.verticalStripes.color[1]-mainColor[1])
                      + Math.abs(analysis.verticalStripes.color[2]-mainColor[2]);
              if (d < 25) {
                // 完全同色 → 提亮18%派生（条纹必须可见）
                const c = analysis.verticalStripes.color;
                analysis.verticalStripes.color = [
                  Math.min(255, Math.round(c[0] + (255-c[0])*0.18)),
                  Math.min(255, Math.round(c[1] + (255-c[1])*0.18)),
                  Math.min(255, Math.round(c[2] + (255-c[2])*0.18)),
                ];
              } else if (newColors[1] && d < 70) {
                // 近色但差异仍在：如果像素辅助色与主色差更大，优先用辅助色
                const dSec = Math.abs(newColors[1][0]-mainColor[0])
                           + Math.abs(newColors[1][1]-mainColor[1])
                           + Math.abs(newColors[1][2]-mainColor[2]);
                if (dSec > d) analysis.verticalStripes.color = newColors[1].slice();
              }
            } else if (analysis.verticalStripes.hasStripes) {
              // color=null但AI明确说了有条纹 → 直接派生提亮
              analysis.verticalStripes.color = [
                Math.min(255, Math.round(mainColor[0] + (255-mainColor[0])*0.18)),
                Math.min(255, Math.round(mainColor[1] + (255-mainColor[1])*0.18)),
                Math.min(255, Math.round(mainColor[2] + (255-mainColor[2])*0.18)),
              ];
            }
          }

          // 同步校正 horizontalStripes：同近色逻辑
          if (analysis.horizontalStripes && analysis.horizontalStripes.stripes) {
            analysis.horizontalStripes.stripes = analysis.horizontalStripes.stripes.map(s => {
              if (!s.color) return s;
              const d = Math.abs(s.color[0]-mainColor[0])+Math.abs(s.color[1]-mainColor[1])+Math.abs(s.color[2]-mainColor[2]);
              if (d < 25) {
                return {
                  ...s,
                  color: [
                    Math.min(255, Math.round(s.color[0] + (255-s.color[0])*0.18)),
                    Math.min(255, Math.round(s.color[1] + (255-s.color[1])*0.18)),
                    Math.min(255, Math.round(s.color[2] + (255-s.color[2])*0.18)),
                  ],
                };
              }
              return s;
            });
            // 条纹必须保留（AI说了有条纹就画），hasStripes不再被清空
            if (analysis.horizontalStripes.stripes.length === 0 && aiResult.stripeCount > 0) {
              analysis.horizontalStripes.hasStripes = true;
            }
          }

          // 同步校正 collar.color（与新主色相近→置空，与辅助色相近→替换为辅助色，避免两个蓝）
          if (analysis.collar && analysis.collar.color) {
            const dFromMain = Math.abs(analysis.collar.color[0]-mainColor[0])
                            + Math.abs(analysis.collar.color[1]-mainColor[1])
                            + Math.abs(analysis.collar.color[2]-mainColor[2]);
            if (dFromMain < 40) analysis.collar.color = null;
            else if (newColors[1]) {
              const dFromSec = Math.abs(analysis.collar.color[0]-newColors[1][0])
                             + Math.abs(analysis.collar.color[1]-newColors[1][1])
                             + Math.abs(analysis.collar.color[2]-newColors[1][2]);
              if (dFromSec < 50) analysis.collar.color = newColors[1].slice();
            }
          }

          // 同步校正 printPatterns 的颜色：与新主色相近的（微光/近色）过滤
          if (analysis.printPatterns && Array.isArray(analysis.printPatterns)) {
            for (const p of analysis.printPatterns) {
              if (!p.color) continue;
              const pRgb = typeof p.color === "string"
                ? (() => { const h=p.color.replace('#',''); return h.length===6 ? [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)] : null; })()
                : p.color;
              if (!pRgb) continue;
              const dFromMain = Math.abs(pRgb[0]-mainColor[0])+Math.abs(pRgb[1]-mainColor[1])+Math.abs(pRgb[2]-mainColor[2]);
              if (dFromMain < 40) {
                // 图案色与主色太近→不算印花（微光/提花），给个null避免后续被当成独立颜色
                p.color = null;
              } else if (newColors[1]) {
                const dFromSec = Math.abs(pRgb[0]-newColors[1][0])+Math.abs(pRgb[1]-newColors[1][1])+Math.abs(pRgb[2]-newColors[1][2]);
                if (dFromSec < 50) p.color = newColors[1].slice(); // 统一到像素辅助色
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("像素主色校正失败，使用AI默认:", e);
    }
  }

  let mainIdx = findClosestColor(mainColor, TOMODACHI_PALETTE, true);

  // ========== 奶油/暖黄 → 肤色桃色 防误判 钩子 ==========
  // 用户黄裙案例：奶油暖黄（R≈245 G≈220 B≈155，低饱和）会被 redmean 距离（蓝通道权重小）误分到 C11(肤色)/C10(棕色) 列
  // 检测：如果是"典型黄/奶油色域"（R高 G高且接近R B中等且<G-15）但结果落在 C10/C11 → 强制改为只在 C4(黄列) 内按亮度找最近
  const [mR, mG, mB] = mainColor;
  const yellowZone = mR >= 220 && mG >= 200 && mB >= 110 && mB <= 195 && (mG >= mR - 45) && (mG > mB + 15) && (mR >= mB + 30);
  if (yellowZone && TOMODACHI_PALETTE[mainIdx]?.col >= 10) { // 落在棕/肤列（C10=col 10, C11=col 11）
    const yCol = 4; // 黄列 (C4: 1-indexed = index 4, 0-indexed = 3)
    const cIdx = yCol - 1; // 3
    let bestC4 = -1; let bestC4d = Infinity;
    for (let r = 0; r < 8; r++) {
      const i = r * 11 + cIdx;
      const p = TOMODACHI_PALETTE[i];
      if (!p) continue;
      const d = Math.abs(p.rgb[0]-mR) + Math.abs(p.rgb[1]-mG) + Math.abs(p.rgb[2]-mB);
      if (d < bestC4d) { bestC4d = d; bestC4 = i; }
    }
    // 也在 C3(橙列) 比一下，万一更接近
    const oIdx = 2;
    for (let r = 0; r < 8; r++) {
      const i = r * 11 + oIdx;
      const p = TOMODACHI_PALETTE[i];
      if (!p) continue;
      const d = Math.abs(p.rgb[0]-mR) + Math.abs(p.rgb[1]-mG) + Math.abs(p.rgb[2]-mB);
      if (d < bestC4d) { bestC4d = d; bestC4 = i; }
    }
    if (bestC4 >= 0) mainIdx = bestC4;
  }

  let secondaryIdx = mainIdx;
  const mainRgbGlobal = TOMODACHI_PALETTE[mainIdx]?.rgb || [128, 128, 128];
  const rgbDiff = (a, b) => Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]);
  let stripeColorIndices = [];
  let logoIdx = -1;

  if (analysis.colors[1]) {
    secondaryIdx = findClosestColor(analysis.colors[1], TOMODACHI_PALETTE, true);
    // 同黄区校正（辅色也应用，避免辅色变桃色灰）
    const [sR, sG, sB] = analysis.colors[1];
    const sYellow = sR >= 220 && sG >= 200 && sB >= 110 && sB <= 195 && (sG >= sR - 45) && (sG > sB + 15);
    if (sYellow && TOMODACHI_PALETTE[secondaryIdx]?.col >= 10) {
      const cIdx = 3; let bestI = -1; let bestD = Infinity;
      for (let r = 0; r < 8; r++) {
        for (const cc of [2, 3]) {
          const i = r * 11 + cc;
          const p = TOMODACHI_PALETTE[i]; if (!p) continue;
          const d = Math.abs(p.rgb[0]-sR) + Math.abs(p.rgb[1]-sG) + Math.abs(p.rgb[2]-sB);
          if (d < bestD) { bestD = d; bestI = i; }
        }
      }
      if (bestI >= 0) secondaryIdx = bestI;
    }
  }

  // 横条纹：AI明确有条纹就画（提亮色即使差10也应该可见，即使idx相同=findClosestColor找不到差异也fallback用邻近索引）
  if (analysis.horizontalStripes.hasStripes && analysis.horizontalStripes.stripes.length > 0) {
    const filtered = analysis.horizontalStripes.stripes.filter(s => !!s.color);
    stripeColorIndices = filtered.map(s => {
      const idx = findClosestColor(s.color, TOMODACHI_PALETTE, true);
      return { idx, yRatio: s.yRatio };
    }).filter(s => s.idx >= 0); // 允许 idx===mainIdx？下面会处理
  }
  // 如果 stripeIdx === mainIdx（提亮色仍然映射到主色索引）
  // = 先找"同色系更亮邻居"，找不到就用"同色系暗一格（row+1同列）"，再不行就纯白/纯黄点缀
  // 绝对不允许 stripeIdx === mainIdx（否则条纹不可见 = 用户说"删条纹"）
  const findStripeNeighbor = () => {
    const mc = TOMODACHI_PALETTE[mainIdx];
    if (!mc) return 0;
    const mainL = mc.rgb[0]*0.299 + mc.rgb[1]*0.587 + mc.rgb[2]*0.114;
    // 1) 更亮同色系邻居（L+>10，且整体色差<90）
    let bestI = -1;
    let bestDelta = 0;
    for (let j = 0; j < TOMODACHI_PALETTE.length; j++) {
      if (j === mainIdx) continue;
      const c = TOMODACHI_PALETTE[j];
      const L = c.rgb[0]*0.299 + c.rgb[1]*0.587 + c.rgb[2]*0.114;
      const rgbD = Math.abs(c.rgb[0]-mc.rgb[0]) + Math.abs(c.rgb[1]-mc.rgb[1]) + Math.abs(c.rgb[2]-mc.rgb[2]);
      if (L > mainL + 10 && rgbD < 90) {
        const delta = L - mainL;
        if (delta > bestDelta) { bestDelta = delta; bestI = j; }
      }
    }
    if (bestI >= 0) return bestI;
    // 2) 更暗同色系（优先级最高：row+1 同列=调色板本意的同色阴影色）
    if (mainIdx < 88) {
      const row = Math.floor(mainIdx / 11);
      const col = mainIdx % 11;
      if (row + 1 < 8) return (row + 1) * 11 + col;
      if (row - 1 >= 0) return (row - 1) * 11 + col; // row=7已经最深：用row=6稍亮
    } else {
      // accent 88-95：映射到基础调色板中对应的色相 row=3 同色
      const accentCols = [8, 2, 3, 4, 4, 6, 7, 3]; // A1..A8 近似基础色 col（0-indexed）
      const aIdx = mainIdx - 88;
      const cc = accentCols[aIdx] ?? 3;
      return 3 * 11 + cc; // R4 中间深浅
    }
    // 3) 终极兜底：主色亮就用黑色(7*11+9=R8C10深棕=近似黑)，主色暗就用白(R1C1)
    return mainL > 140 ? (7 * 11 + 9) : 0;
  };
  for (let i = 0; i < stripeColorIndices.length; i++) {
    if (stripeColorIndices[i].idx === mainIdx) {
      stripeColorIndices[i].idx = findStripeNeighbor();
    }
  }

  // 竖条纹：AI明确说了hasStripes=true 就一定要启用
  // 找不到不同索引就强制用 findStripeNeighbor（同色系row+1或亮邻居）
  // 绝对不允许 verticalStripeIdx === mainIdx（否则条纹=同色不可见）
  let verticalStripeIdx = -1;
  let verticalStripeCols = [];
  if (analysis.verticalStripes && analysis.verticalStripes.hasStripes) {
    const col = analysis.verticalStripes.color
      ? analysis.verticalStripes.color
      : [
          Math.min(255, Math.round(mainRgbGlobal[0] + (255-mainRgbGlobal[0])*0.2)),
          Math.min(255, Math.round(mainRgbGlobal[1] + (255-mainRgbGlobal[1])*0.2)),
          Math.min(255, Math.round(mainRgbGlobal[2] + (255-mainRgbGlobal[2])*0.2)),
        ];
    let vsIdx = findClosestColor(col, TOMODACHI_PALETTE, true);
    if (vsIdx === mainIdx || vsIdx < 0) {
      // 重用上面定义的同色系邻居查找函数（如果存在）
      if (typeof findStripeNeighbor === "function") {
        vsIdx = findStripeNeighbor();
      } else {
        // 兜底：row+1同列 或 R1C1 纯白
        if (mainIdx < 88) {
          const row = Math.floor(mainIdx / 11);
          const ccol = mainIdx % 11;
          vsIdx = (row + 1 < 8) ? ((row + 1) * 11 + ccol) : 0;
        } else {
          vsIdx = 0;
        }
      }
    }
    // 终极防御：强制保证 vsIdx !== mainIdx 且 vsIdx >= 0
    if (vsIdx === mainIdx) {
      vsIdx = (mainIdx + 1 < TOMODACHI_PALETTE.length) ? mainIdx + 1 : mainIdx - 1;
    }
    if (vsIdx >= 0) {
      verticalStripeIdx = vsIdx;
      verticalStripeCols = [];
      verticalStripeCols._count = analysis.verticalStripes.count || analysis.stripeCount || 8;
      // 同步 analysis.verticalStripes.color 为 调色板真实颜色
      // 保证 PatternCanvas.drawBodyVerticalStripes 画的 overlay 条纹 RGB = 调色板[verticalStripeIdx].rgb
      // 这样"像素级条纹（fillView）"和"Canvas层条纹"颜色 100% 统一
      const pc = TOMODACHI_PALETTE[verticalStripeIdx];
      if (pc) {
        analysis.verticalStripes.color = [pc.rgb[0], pc.rgb[1], pc.rgb[2]];
      }
    }
  }

  // 横条纹 overlay 颜色也同步：把 analysis.horizontalStripes.stripes[i].color 改成 palette[stripeColorIndices映射后].rgb
  // （注意stripeColorIndices是filter(!s.color)后得到的，顺序与"过滤后stripes"一致；但为了保险，重新遍历原数组）
  if (analysis.horizontalStripes && analysis.horizontalStripes.stripes && analysis.horizontalStripes.stripes.length > 0) {
    // 用同一个 findStripeNeighbor 处理如果匹配 = mainIdx 的情况
    const useNeighbor = typeof findStripeNeighbor === "function" ? findStripeNeighbor : null;
    for (let k = 0; k < analysis.horizontalStripes.stripes.length; k++) {
      const s = analysis.horizontalStripes.stripes[k];
      if (!s.color) continue;
      let hIdx = findClosestColor(s.color, TOMODACHI_PALETTE, true);
      if (hIdx === mainIdx && useNeighbor) hIdx = useNeighbor();
      if (hIdx >= 0 && hIdx !== mainIdx) {
        const pc = TOMODACHI_PALETTE[hIdx];
        if (pc) s.color = [pc.rgb[0], pc.rgb[1], pc.rgb[2]];
      } else if (hIdx === mainIdx && TOMODACHI_PALETTE[mainIdx+1]) {
        // 真没找到 → +1索引邻色 强制
        const pc = TOMODACHI_PALETTE[mainIdx+1];
        s.color = [pc.rgb[0], pc.rgb[1], pc.rgb[2]];
      }
    }
  }

  if (analysis.logo.hasLogo && analysis.logo.color) {
    logoIdx = findClosestColor(analysis.logo.color, TOMODACHI_PALETTE, true);
  }

  const isPants = template.category === "pants";

  // fillFourViews 也应用 twoTone 双保险
  const fvHasEdgeDetails = analysis.collar || analysis.cuffStyle || analysis.hasCuffs;
  const fvSafeTwoTone = !!(
    analysis.twoTone &&
    analysis.twoTone.hasTwoTone &&
    !isPants &&
    !fvHasEdgeDetails &&
    analysis.twoTone.topColor &&
    analysis.twoTone.bottomColor
  );

  if (fvSafeTwoTone) {
    mainIdx = findClosestColor(analysis.twoTone.topColor, TOMODACHI_PALETTE, true);
    secondaryIdx = findClosestColor(analysis.twoTone.bottomColor, TOMODACHI_PALETTE, true);
  }

  // ===== 边缘色块（袖口/下摆 装饰色条） =====
  // 用户要求：袖口/下摆是原图蓝色细边，颜色必须正确，不要逐cell采样出青紫色
  // 策略：
  //  - printPatterns 里位置含 "下摆" / "袖口" → 直接启用对应行（1行细边）
  //  - 颜色优先用 pattern 的 color；没有就 fallback 到 analysis.colors[1] 辅助色
  //  - 领口（neck/领子）不在像素 fill 层涂色（交给 drawCollar canvas 层单独处理）
  const rgbDistLocal = (a, b) => a && b ? Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]) : 999;
  const hex2rgb = (hex) => {
    if (!hex || typeof hex !== "string") return null;
    const h = hex.replace("#", "");
    if (h.length !== 6) return null;
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  };
  const defaultEdgeColor = (analysis.colors && analysis.colors[1]) || (analysis.twoTone?.bottomColor);

  // hem: body 底部的装饰色条（下摆=花边(下摆)，只画1行=细边）
  let hemRows = 0;
  let hemColor = null;
  // cuff: sleeve 底部装饰色条（袖口=花边(袖口)，只画1行）
  let cuffRows = 0;
  let cuffColor = null;

  if (analysis.printPatterns && Array.isArray(analysis.printPatterns)) {
    for (const p of analysis.printPatterns) {
      const pos = ((p.position || "") + " " + (p.type || "")).toLowerCase();
      const pRgb = p.color ? (typeof p.color === "string" ? hex2rgb(p.color) : p.color) : null;

      // === 下摆 ===
      if (pos.includes("下摆")) {
        hemRows = 1;
        if (pRgb) {
          // 优先选更合适的候选：与已有候选对比，取更蓝（更贴近辅助色）的那个
          if (!hemColor || (defaultEdgeColor && rgbDistLocal(pRgb, defaultEdgeColor) < rgbDistLocal(hemColor, defaultEdgeColor))) {
            hemColor = pRgb;
          }
        }
      }
      // === 袖口 ===
      if (pos.includes("袖口")) {
        cuffRows = 1;
        if (pRgb) {
          if (!cuffColor || (defaultEdgeColor && rgbDistLocal(pRgb, defaultEdgeColor) < rgbDistLocal(cuffColor, defaultEdgeColor))) {
            cuffColor = pRgb;
          }
        }
      }
    }
  }
  // cuffStyle/hasCuffs 暗示袖口也有细边（但没颜色，不画，避免错色）
  // hemStyle 同理，只有样式没颜色就不画。只有明确 pattern 或有默认辅助色时才填

  // 如果 hem 启用但没颜色 → 用 defaultEdgeColor
  if (hemRows > 0 && !hemColor && defaultEdgeColor) hemColor = defaultEdgeColor;
  if (cuffRows > 0 && !cuffColor && defaultEdgeColor) cuffColor = defaultEdgeColor;

  // 转换成 TOMODACHI 调色板索引
  const hemIdx = hemColor ? findClosestColor(hemColor, TOMODACHI_PALETTE, true) : -1;
  const cuffIdx = cuffColor ? findClosestColor(cuffColor, TOMODACHI_PALETTE, true) : -1;

  // 若转换后 hem/cuff 丢失（没找到匹配色），退回 defaultEdgeColor 的索引
  const defaultEdgeIdx = defaultEdgeColor ? findClosestColor(defaultEdgeColor, TOMODACHI_PALETTE, true) : -1;
  const finalHemIdx = hemIdx >= 0 ? hemIdx : (hemRows > 0 ? defaultEdgeIdx : -1);
  const finalCuffIdx = cuffIdx >= 0 ? cuffIdx : (cuffRows > 0 ? defaultEdgeIdx : -1);

  // 像素采样函数：从原图采样每个格子对应区域的平均颜色
  let sampleCellColor = null;
  if (imageData) {
    const { width, height, data } = imageData;
    sampleCellColor = (row, totalRows, col, totalCols, viewName = "front") => {
      // 采样区域：使用图片中心80%区域
      const margin = 0.1;
      const startX = Math.floor(width * margin);
      const endX = Math.floor(width * (1 - margin));
      const startY = Math.floor(height * margin * 0.5);
      const endY = Math.floor(height * (1 - margin * 0.5));
      const regionW = endX - startX;
      const regionH = endY - startY;

      const cellW = Math.max(1, Math.floor(regionW / totalCols));
      const cellH = Math.max(1, Math.floor(regionH / totalRows));
      const cellX = startX + Math.floor((col / totalCols) * regionW);
      const cellY = startY + Math.floor((row / totalRows) * regionH);

      let r = 0, g = 0, b = 0, count = 0;
      // 采样步长，避免过多像素
      const step = Math.max(1, Math.floor(Math.sqrt(cellW * cellH) / 8));
      for (let py = cellY; py < cellY + cellH && py < height; py += step) {
        for (let px = cellX; px < cellX + cellW && px < width; px += step) {
          const idx = (py * width + px) * 4;
          const pr = data[idx], pg = data[idx + 1], pb = data[idx + 2];
          r += pr; g += pg; b += pb; count++;
        }
      }
      if (count > 0) {
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        return [r, g, b];
      }
      return null;
    };
  }

  // 按实际mask高度填充，body=9行，sleeve=4行
  // 严格对照mask：true→颜色，false→深灰[85,85,85]
  // 核心原则：除印花/logo/条纹/下摆/袖口/纽扣等"明确提取的结构化特征"外，所有单元格一律使用主色
  //       ——用户：大部分是同色就只画主色，不要逐cell采样导致颜色乱飞
  function fillView(mask, showLogo = false) {
    const pixels = [];
    const indices = [];
    const rows = mask.length;
    const cols = mask[0]?.length || 0;

    // 获取主色的RGB，用于后续校验
    const mainRgb = TOMODACHI_PALETTE[mainIdx]?.rgb || [128, 128, 128];
    const isMainWhite = mainRgb[0] > 245 && mainRgb[1] > 245 && mainRgb[2] > 245;

    // 竖条纹列索引（本视图内均匀分布）
    let vsColsSet = null;
    if (verticalStripeIdx >= 0) {
      const n = verticalStripeCols._count || analysis.verticalStripes?.count || 6;
      const set = new Set();
      if (n > 0) {
        for (let i = 0; i < n; i++) {
          const xc = Math.round(((i + 0.5) / n) * cols);
          if (xc >= 0 && xc < cols) set.add(xc);
        }
      }
      vsColsSet = set;
    }

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (mask[y] && mask[y][x]) {
          let colorIdx = mainIdx;

          // 下摆：body最后N行（只1行细边），用下摆装饰色
          const isHem = y >= rows - hemRows;
          if (isHem && finalHemIdx >= 0 && finalHemIdx !== mainIdx) {
            colorIdx = finalHemIdx;
          }

          // 竖条纹：命中均匀分布的列才替换（仅当颜色与主色不同时才会启用）
          if (verticalStripeIdx >= 0 && vsColsSet && vsColsSet.has(x) && colorIdx === mainIdx) {
            colorIdx = verticalStripeIdx;
          }

          // 双色覆盖（twoTone）：仅 fvSafeTwoTone=true 时启用
          if (fvSafeTwoTone && y > rows * (analysis.twoTone.splitRatio || 0.5)) {
            if (secondaryIdx >= 0 && secondaryIdx < TOMODACHI_PALETTE.length) {
              const secRgb = TOMODACHI_PALETTE[secondaryIdx]?.rgb;
              const isSecWhite = secRgb && secRgb[0] > 245 && secRgb[1] > 245 && secRgb[2] > 245;
              if (!isSecWhite || isMainWhite) {
                colorIdx = secondaryIdx;
              }
            }
          }

          // 横条纹覆盖（stripeColorIndices 已过滤，只有与主色差>=60的真条纹才会在此）
          if (stripeColorIndices.length > 0) {
            for (const stripe of stripeColorIndices) {
              const stripeY = Math.floor(stripe.yRatio * rows);
              if (y === stripeY) {
                colorIdx = stripe.idx;
                break;
              }
            }
          }

          // 最终防御：确保colorIdx有效
          if (!(colorIdx >= 0 && colorIdx < TOMODACHI_PALETTE.length && TOMODACHI_PALETTE[colorIdx])) {
            colorIdx = mainIdx;
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

  function fillSleeve(mask, side = "left") {
    const pixels = [];
    const indices = [];
    const rows = mask.length;
    const cols = mask[0]?.length || 0;

    // 获取主色的RGB，用于后续校验
    const mainRgb = TOMODACHI_PALETTE[mainIdx]?.rgb || [128, 128, 128];
    const isMainWhite = mainRgb[0] > 245 && mainRgb[1] > 245 && mainRgb[2] > 245;

    // 竖条纹列索引（袖子视图内按条纹数均匀分布）
    let vsColsSet = null;
    if (verticalStripeIdx >= 0) {
      const n = verticalStripeCols._count || analysis.verticalStripes?.count || 6;
      const set = new Set();
      if (n > 0) {
        for (let i = 0; i < n; i++) {
          const xc = Math.round(((i + 0.5) / n) * cols);
          if (xc >= 0 && xc < cols) set.add(xc);
        }
      }
      vsColsSet = set;
    }

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (mask[y] && mask[y][x]) {
          let colorIdx = mainIdx;

          // 袖口底部画装饰色（只1行细边）
          const isCuff = y >= rows - cuffRows;
          if (isCuff && finalCuffIdx >= 0 && finalCuffIdx !== mainIdx) {
            colorIdx = finalCuffIdx;
          }

          // 竖条纹
          if (verticalStripeIdx >= 0 && vsColsSet && vsColsSet.has(x) && colorIdx === mainIdx) {
            colorIdx = verticalStripeIdx;
          }

          if (fvSafeTwoTone && y > rows * (analysis.twoTone.splitRatio || 0.5)) {
            if (secondaryIdx >= 0 && secondaryIdx < TOMODACHI_PALETTE.length) {
              const secRgb = TOMODACHI_PALETTE[secondaryIdx]?.rgb;
              const isSecWhite = secRgb && secRgb[0] > 245 && secRgb[1] > 245 && secRgb[2] > 245;
              if (!isSecWhite || isMainWhite) {
                colorIdx = secondaryIdx;
              }
            }
          }

          // 横条纹：sleeve 也应用（仅真条纹）
          if (stripeColorIndices.length > 0) {
            for (const stripe of stripeColorIndices) {
              const stripeY = Math.floor(stripe.yRatio * rows);
              if (y === stripeY) {
                colorIdx = stripe.idx;
                break;
              }
            }
          }

          // 最终防御：确保colorIdx有效
          if (!(colorIdx >= 0 && colorIdx < TOMODACHI_PALETTE.length && TOMODACHI_PALETTE[colorIdx])) {
            colorIdx = mainIdx;
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
    front: fillView(views.front, true),
    back: fillView(views.back, false),
    leftSleeve: fillSleeve(views.leftSleeve),
    rightSleeve: fillSleeve(views.rightSleeve),
    viewCols: VIEW_COLS,
    bodyRows: BODY_ROWS,
    sleeveRows: SLEEVE_ROWS,
  };
}

function drawSimpleLogo(x, y, w, h) {
  const pattern = [
    [0, 1, 0, 0, 1, 0],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 0, 0],
  ];

  const scaleX = w / 6;
  const scaleY = h / 6;
  const px = Math.floor(x / scaleX);
  const py = Math.floor(y / scaleY);

  if (py >= 0 && py < 6 && px >= 0 && px < 6) {
    return pattern[py][px] === 1;
  }
  return false;
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
