/**
 * Redmean 感知色差公式
 * 一种针对人眼感知的快速色差计算方式
 * 公式：ΔC = sqrt((2+r_mean/256)*ΔR² + 4*ΔG² + (2+(255-r_mean)/256)*ΔB²)
 *
 * @param {number[]} a - RGB颜色 [R, G, B]
 * @param {number[]} b - RGB颜色 [R, G, B]
 * @returns {number} 色差值（越小越相似）
 */
export function redmeanDistance(a, b) {
  const rMean = (a[0] + b[0]) / 2;
  const rDiff = a[0] - b[0];
  const gDiff = a[1] - b[1];
  const bDiff = a[2] - b[2];

  const rWeight = 2 + rMean / 256;
  const bWeight = 2 + (255 - rMean) / 256;

  return Math.sqrt(
    rWeight * rDiff * rDiff +
    4 * gDiff * gDiff +
    bWeight * bDiff * bDiff
  );
}

/**
 * 简单的欧几里得距离（平方，用于比较无需开方）
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function euclideanDistanceSquared(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

/**
 * 检测颜色是否为灰绿色/鼠尾草绿色
 * 特征：低饱和度，绿色通道略高于红蓝通道
 */
function isGrayGreen(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  // 饱和度低 (< 30%)，且绿色是最大或接近最大通道
  if (saturation > 0.3) return false;
  if (g < r - 10) return false;
  if (g < b - 5) return false;
  // 亮度在中等范围
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 80 && brightness < 230;
}

function isGrayBlue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  // 饱和度低 (< 35%)，且蓝色是最大通道
  if (saturation > 0.35) return false;
  if (b < r + 5) return false;
  if (b < g + 5) return false;
  // 亮度在中等范围
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 80 && brightness < 230;
}

/**
 * 对灰绿色进行颜色校正，增强绿色倾向以更好匹配调色板
 */
function correctGrayGreen(rgb) {
  const [r, g, b] = rgb;
  if (!isGrayGreen(r, g, b)) return rgb;
  // 增强绿色，使其更接近调色板中的灰绿色
  const greenBoost = 15;
  return [
    Math.max(0, r - 5),
    Math.min(255, g + greenBoost),
    Math.max(0, b - 10),
  ];
}

/**
 * 对灰蓝色进行颜色校正，增强蓝色倾向以更好匹配调色板
 */
function correctGrayBlue(rgb) {
  const [r, g, b] = rgb;
  if (!isGrayBlue(r, g, b)) return rgb;
  // 增强蓝色，使其更接近调色板中的灰蓝色
  const blueBoost = 15;
  return [
    Math.max(0, r - 10),
    Math.max(0, g - 5),
    Math.min(255, b + blueBoost),
  ];
}

/**
 * 在调色板中找到最接近的颜色索引
 * @param {number[]} rgb - [R, G, B]
 * @param {Array<{rgb: number[]}>} palette
 * @param {boolean} useRedmean - 是否使用Redmean（否则用欧几里得）
 * @returns {number} 调色板索引
 */
export function findClosestColor(rgb, palette, useRedmean = true) {
  let bestIdx = 0;
  let bestDist = Infinity;

  const distFn = useRedmean ? redmeanDistance : euclideanDistanceSquared;
  let correctedRgb = correctGrayGreen(rgb);
  correctedRgb = correctGrayBlue(correctedRgb);

  for (let i = 0; i < palette.length; i++) {
    let dist = distFn(correctedRgb, palette[i].rgb);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  return bestIdx;
}
