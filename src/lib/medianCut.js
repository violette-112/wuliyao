/**
 * Median Cut 颜色量化算法
 * 将一组颜色缩减到指定数量的代表性颜色
 */

/**
 * 计算颜色列表的包围盒（每个通道的最小/最大值）
 * @param {number[][]} colors - RGB颜色数组
 * @returns {{min: number[], max: number[], range: number[]}}
 */
function getColorBox(colors) {
  const min = [255, 255, 255];
  const max = [0, 0, 0];

  for (const [r, g, b] of colors) {
    min[0] = Math.min(min[0], r);
    min[1] = Math.min(min[1], g);
    min[2] = Math.min(min[2], b);
    max[0] = Math.max(max[0], r);
    max[1] = Math.max(max[1], g);
    max[2] = Math.max(max[2], b);
  }

  return {
    min,
    max,
    range: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  };
}

/**
 * 找到范围最大的通道索引
 * @param {number[]} range
 * @returns {number} 0=R, 1=G, 2=B
 */
function getLongestChannel(range) {
  let maxIdx = 0;
  for (let i = 1; i < 3; i++) {
    if (range[i] > range[maxIdx]) {
      maxIdx = i;
    }
  }
  return maxIdx;
}

/**
 * 沿指定通道对颜色排序并分割为中位数
 * @param {number[][]} colors
 * @param {number} channel
 * @returns {[number[][], number[][]]}
 */
function splitColors(colors, channel) {
  const sorted = [...colors].sort((a, b) => a[channel] - b[channel]);
  const mid = Math.floor(sorted.length / 2);
  return [sorted.slice(0, mid), sorted.slice(mid)];
}

/**
 * Median Cut 主算法
 * @param {number[][]} colors - 输入的RGB颜色数组 [[r,g,b], ...]
 * @param {number} targetCount - 目标颜色数量
 * @returns {number[][]} 量化后的代表性颜色数组
 */
export function medianCut(colors, targetCount) {
  if (!colors || colors.length === 0) {
    return [];
  }

  if (colors.length <= targetCount) {
    return colors.map((c) => [...c]);
  }

  // 初始盒子包含所有颜色
  let boxes = [colors];

  // 迭代分割直到盒子数量达到目标
  while (boxes.length < targetCount) {
    // 找到包含最多颜色的盒子
    let largestBoxIdx = 0;
    for (let i = 1; i < boxes.length; i++) {
      if (boxes[i].length > boxes[largestBoxIdx].length) {
        largestBoxIdx = i;
      }
    }

    const box = boxes[largestBoxIdx];
    if (box.length <= 1) break;

    const { range } = getColorBox(box);
    const channel = getLongestChannel(range);
    const [left, right] = splitColors(box, channel);

    if (left.length === 0 || right.length === 0) break;

    // 替换原盒子为两个新盒子
    boxes.splice(largestBoxIdx, 1, left, right);
  }

  // 计算每个盒子的平均颜色
  const result = boxes.map((box) => {
    const sum = [0, 0, 0];
    for (const [r, g, b] of box) {
      sum[0] += r;
      sum[1] += g;
      sum[2] += b;
    }
    const count = box.length;
    return [
      Math.round(sum[0] / count),
      Math.round(sum[1] / count),
      Math.round(sum[2] / count),
    ];
  });

  return result;
}

/**
 * 对32×32像素数组执行Median Cut量化
 * @param {ImageData} imageData - 32×32的ImageData
 * @param {number} targetCount - 目标颜色数（null表示不量化）
 * @returns {{quantized: number[][], mapping: number[]}} 量化颜色和每个像素的索引映射
 */
export function quantizeImage(imageData, targetCount) {
  const pixels = [];
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  if (!targetCount || targetCount >= pixels.length) {
    return { quantized: pixels, mapping: pixels.map((_, i) => i) };
  }

  const quantized = medianCut(pixels, targetCount);

  // 为每个原始像素找到最近的量化颜色
  const mapping = pixels.map((pixel) => {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < quantized.length; i++) {
      const dist = colorDistanceSquared(pixel, quantized[i]);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestIdx;
  });

  return { quantized, mapping };
}

function colorDistanceSquared(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}
