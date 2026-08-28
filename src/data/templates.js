const TOTAL_SIZE = 16;
const VIEW_COLS = 8;
const BODY_ROWS = 9;
const SLEEVE_ROWS = 7;

function createEmptyMask(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
}

function createFullMask(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => true));
}

/**
 * 创建正/背面mask（9行×8列）- 原始样式
 * 肩部曲线弧形：左右上角1-3行第0列锁定
 * 领口V领：第0行第2-5列，第1行第3-4列
 */
function createBodyMask() {
  const mask = createFullMask(BODY_ROWS, VIEW_COLS);
  for (let row = 0; row < 4; row++) {
    mask[row][0] = false;
    mask[row][7] = false;
  }
  for (let col = 2; col <= 5; col++) {
    mask[0][col] = false;
  }
  for (let col = 3; col <= 4; col++) {
    mask[1][col] = false;
  }
  return mask;
}

/**
 * 短袖mask（7行×8列）- 原始样式：底部4行可绘制
 */
function createShortSleeveMask() {
  const mask = createEmptyMask(SLEEVE_ROWS, VIEW_COLS);
  for (let row = 3; row < SLEEVE_ROWS; row++) {
    for (let col = 0; col < VIEW_COLS; col++) {
      mask[row][col] = true;
    }
  }
  return mask;
}

/**
 * 长袖mask（7行×8列）- 原始样式：全部可绘制
 */
function createLongSleeveMask() {
  return createFullMask(SLEEVE_ROWS, VIEW_COLS);
}

/**
 * 无袖/背心袖子mask：空数组（0行），不占用画布空间
 */
function createNoSleeveMask() {
  return [];
}

/**
 * 将四视图mask合并为16×16的完整画布mask
 */
function createCombinedMask(front, back, leftSleeve, rightSleeve) {
  const mask = [];
  const bodyRows = front?.length ?? BODY_ROWS;
  const sleeveRows = leftSleeve?.length ?? SLEEVE_ROWS;

  for (let row = 0; row < TOTAL_SIZE; row++) {
    const maskRow = [];
    for (let col = 0; col < TOTAL_SIZE; col++) {
      if (row < bodyRows) {
        if (col < VIEW_COLS) {
          maskRow.push(front[row]?.[col] || false);
        } else {
          maskRow.push(back[row]?.[col - VIEW_COLS] || false);
        }
      } else {
        const sleeveRow = row - bodyRows;
        if (sleeveRow < sleeveRows) {
          if (col < VIEW_COLS) {
            maskRow.push(leftSleeve[sleeveRow]?.[col] || false);
          } else {
            maskRow.push(rightSleeve[sleeveRow]?.[col - VIEW_COLS] || false);
          }
        } else {
          maskRow.push(false);
        }
      }
    }
    mask.push(maskRow);
  }
  return mask;
}

function createShortSleeve() {
  const front = createBodyMask();
  const back = createBodyMask();
  const leftSleeve = createShortSleeveMask();
  const rightSleeve = createShortSleeveMask();
  return { front, back, leftSleeve, rightSleeve };
}

function createLongSleeve() {
  const front = createBodyMask();
  const back = createBodyMask();
  const leftSleeve = createLongSleeveMask();
  const rightSleeve = createLongSleeveMask();
  return { front, back, leftSleeve, rightSleeve };
}

function createTankTop() {
  const front = createBodyMask();
  const back = createBodyMask();
  const leftSleeve = createNoSleeveMask();
  const rightSleeve = createNoSleeveMask();
  return { front, back, leftSleeve, rightSleeve };
}

function createSimpleTee() {
  const full = createFullMask(TOTAL_SIZE, TOTAL_SIZE);
  return {
    front: full,
    back: createEmptyMask(TOTAL_SIZE, TOTAL_SIZE),
    leftSleeve: createEmptyMask(TOTAL_SIZE, TOTAL_SIZE),
    rightSleeve: createEmptyMask(TOTAL_SIZE, TOTAL_SIZE),
  };
}

function createDressBodyMask(rows, collarDepth = 1) {
  const mask = createFullMask(rows, VIEW_COLS);

  // 和T恤一样的领口和肩部样式
  for (let row = 0; row < 4; row++) {
    mask[row][0] = false;
    mask[row][7] = false;
  }
  for (let col = 2; col <= 5; col++) {
    mask[0][col] = false;
  }
  for (let col = 3; col <= 4; col++) {
    mask[1][col] = false;
  }

  return mask;
}

function createDress(sleeveType = "short", bodyRows = 14, sleeveRows = SLEEVE_ROWS, sleeveCols = VIEW_COLS) {
  const front = createDressBodyMask(bodyRows, 1);
  const back = createDressBodyMask(bodyRows, 1);
  let leftSleeve, rightSleeve;

  const createCustomSleeveMask = (rows, cols) => {
    const actualRows = Math.max(1, Math.floor(rows));
    const mask = createEmptyMask(actualRows, VIEW_COLS);
    const startCol = Math.floor((VIEW_COLS - cols) / 2);
    for (let row = 0; row < actualRows; row++) {
      for (let col = startCol; col < startCol + cols; col++) {
        mask[row][col] = true;
      }
    }
    const subOffset = ((VIEW_COLS - cols) * 3) / 2 - Math.floor((VIEW_COLS - cols) / 2) * 3;
    return { mask, subOffset };
  };

  if (sleeveType === "long") {
    leftSleeve = createLongSleeveMask();
    rightSleeve = createLongSleeveMask();
  } else if (sleeveType === "short") {
    leftSleeve = createShortSleeveMask();
    rightSleeve = createShortSleeveMask();
  } else if (sleeveType === "custom") {
    const sleeveResult = createCustomSleeveMask(sleeveRows, sleeveCols);
    leftSleeve = sleeveResult.mask;
    rightSleeve = sleeveResult.mask;
    return { front, back, leftSleeve, rightSleeve, sleeveSubOffset: sleeveResult.subOffset };
  } else {
    leftSleeve = createNoSleeveMask();
    rightSleeve = createNoSleeveMask();
  }
  return { front, back, leftSleeve, rightSleeve };
}

function createSkirtMask(rows = 4) {
  const mask = [];
  for (let r = 0; r < rows; r++) {
    mask[r] = [];
    for (let c = 0; c < VIEW_COLS; c++) {
      mask[r][c] = false;
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < VIEW_COLS; c++) {
      let leftEdge, rightEdge;

      if (r === 0) {
        leftEdge = 1.5;
        rightEdge = 6.5;
      } else if (r === 1) {
        leftEdge = 0.8;
        rightEdge = 7.2;
      } else if (r === 2) {
        leftEdge = 0.2;
        rightEdge = 7.8;
      } else {
        leftEdge = 0;
        rightEdge = 8;
      }

      if (c >= leftEdge && c <= rightEdge) {
        mask[r][c] = true;
      }
    }
  }

  return mask;
}

function createSkirt(type = "short") {
  const rows = type === "short" ? 4 : 7;

  const front = createSkirtMask(rows);
  const back = createSkirtMask(rows);
  const leftSleeve = createEmptyMask(SLEEVE_ROWS, VIEW_COLS);
  const rightSleeve = createEmptyMask(SLEEVE_ROWS, VIEW_COLS);
  return { front, back, leftSleeve, rightSleeve };
}

function createPantsMask(rows = 12, hasGap = false, gapRow = 3) {
  const mask = createFullMask(rows, VIEW_COLS);
  return mask;
}

function createPants(type = "long") {
  let rows = 9;
  let hasGap = true;
  let gapRow = 3;

  if (type === "short") {
    rows = 5;
    hasGap = true;
    gapRow = 3;
  } else if (type === "skirt-short") {
    rows = 4;
    hasGap = false;
  } else if (type === "skirt-long") {
    rows = 7;
    hasGap = false;
  }

  const front = createPantsMask(rows, hasGap, gapRow);
  const back = createPantsMask(rows, hasGap, gapRow);
  const leftSleeve = (type === "skirt-short" || type === "skirt-long") ? createNoSleeveMask() : createEmptyMask(SLEEVE_ROWS, VIEW_COLS);
  const rightSleeve = (type === "skirt-short" || type === "skirt-long") ? createNoSleeveMask() : createEmptyMask(SLEEVE_ROWS, VIEW_COLS);
  return { front, back, leftSleeve, rightSleeve };
}

function createBeaniePanel(rows) {
  const cols = TOTAL_SIZE;
  const mask = createEmptyMask(rows, cols);
  const centerCol = cols / 2;

  for (let row = 0; row < rows; row++) {
    const distFromBottom = (rows - 1) - row;
    let maxCols;
    if (distFromBottom <= 0) maxCols = 6;
    else if (distFromBottom === 1) maxCols = 5.5;
    else if (distFromBottom === 2) maxCols = 5;
    else if (distFromBottom === 3) maxCols = 4.5;
    else if (distFromBottom === 4) maxCols = 4;
    else if (distFromBottom === 5) maxCols = 3;
    else if (distFromBottom === 6) maxCols = 2;
    else maxCols = 1;

    for (let col = 0; col < cols; col++) {
      const distFromCenter = Math.abs(col - centerCol + 0.5);
      if (distFromCenter <= maxCols) {
        mask[row][col] = true;
      }
    }
  }

  return mask;
}

function createBeanieTopPanel() {
  return createBeaniePanel(8);
}

function createBeanieBottomPanel() {
  return createBeaniePanel(8);
}

function createTopHatCircleMask() {
  const rows = 4;
  const cols = TOTAL_SIZE;
  const mask = createEmptyMask(rows, cols);
  const centerCol = cols / 2;
  const centerRow = 1.5;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dist = Math.sqrt(Math.pow(col - centerCol + 0.5, 2) + Math.pow(row - centerRow, 2));
      if (dist <= 2) {
        mask[row][col] = true;
      }
    }
  }

  return mask;
}

function createTopHatBandOnlyMask() {
  const rows = 3;
  const cols = TOTAL_SIZE;
  const mask = createEmptyMask(rows, cols);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      mask[row][col] = true;
    }
  }

  return mask;
}

function createTopHatBrimMask() {
  const rows = 2;
  const cols = TOTAL_SIZE;
  const mask = createEmptyMask(rows, cols);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      mask[row][col] = true;
    }
  }

  return mask;
}

function createCapDomePanel(rows, baseWidth, topMaxCols) {
  const mask = createEmptyMask(rows, VIEW_COLS);
  const centerCol = VIEW_COLS / 2;
  const top = topMaxCols ?? null;

  for (let row = 0; row < rows; row++) {
    const distFromBottom = (rows - 1) - row;
    let maxCols;
    if (row === 0 && top !== null) {
      maxCols = top;
    } else {
      maxCols = Math.max(0.5, baseWidth - distFromBottom * 0.5);
    }

    for (let col = 0; col < VIEW_COLS; col++) {
      const distFromCenter = Math.abs(col - centerCol + 0.5);
      if (distFromCenter <= maxCols) {
        mask[row][col] = true;
      }
    }
  }

  return mask;
}

function createCapFrontPanel() {
  return createCapDomePanel(6, 4, 1);
}

function createCapVisorPanel() {
  const rows = 3;
  const mask = createEmptyMask(rows, VIEW_COLS);
  const centerCol = VIEW_COLS / 2;

  for (let row = 0; row < rows; row++) {
    if (row === 0) {
      // 第一行只保留第一个和最后一个格子
      mask[row][0] = true;
      mask[row][VIEW_COLS - 1] = true;
    } else {
      const maxCols = 7.5;
      for (let col = 0; col < VIEW_COLS; col++) {
        const distFromCenter = Math.abs(col - centerCol + 0.5);
        if (distFromCenter <= maxCols) {
          mask[row][col] = true;
        }
      }
    }
  }

  return mask;
}

function createCapLeftPanel() {
  return createCapDomePanel(7, 4);
}

function createCapRightPanel() {
  return createCapDomePanel(7, 4);
}

function createHat(type = "cap") {
  let front, back, leftSleeve, rightSleeve;

  if (type === "cap" || type === "baseball") {
    front = createCapFrontPanel();
    back = createCapVisorPanel();
    leftSleeve = createCapLeftPanel();
    rightSleeve = createCapRightPanel();
  } else if (type === "beanie") {
    front = createBeanieTopPanel();
    back = createBeanieBottomPanel();
    leftSleeve = createEmptyMask(0, VIEW_COLS);
    rightSleeve = createEmptyMask(0, VIEW_COLS);
  } else if (type === "tophat" || type === "top-hat") {
    front = createTopHatCircleMask();
    back = createTopHatBandOnlyMask();
    leftSleeve = createTopHatBrimMask();
    rightSleeve = createEmptyMask(0, VIEW_COLS);
  } else {
    front = createFullMask(4, VIEW_COLS);
    back = createFullMask(4, VIEW_COLS);
    leftSleeve = createEmptyMask(0, VIEW_COLS);
    rightSleeve = createEmptyMask(0, VIEW_COLS);
  }

  return { front, back, leftSleeve, rightSleeve };
}

const simpleTeeViews = createSimpleTee();
const longSleeveViews = createLongSleeve();
const tankTopViews = createTankTop();
const shortSleeveViews = createShortSleeve();

const sleevelessDressViews = createDress("none", 11, 0);
const shortSleeveDressViews = createDress("custom", 11, 4);
const longSleeveDressViews = createDress("custom", 11, 5, 5);
const robeViews = createDress("custom", 11, 4.8);
const gownViews = createDress("custom", 12.6, 3.2);

const shortSkirtViews = createPants("skirt-short");
const longSkirtViews = createPants("skirt-long");
const shortsViews = createPants("short");
const longPantsViews = createPants("long");

const capViews = createHat("cap");
const beanieViews = createHat("beanie");
const topHatViews = createHat("tophat");

export const TEMPLATE_CATEGORIES = [
  {
    id: "tee",
    name: "T恤",
    icon: "👕",
    templates: ["simple-tee", "long-sleeve", "tank-top", "short-sleeve"],
  },
  {
    id: "dress",
    name: "裙子",
    icon: "👗",
    templates: ["sleeveless-dress", "short-sleeve-dress", "long-sleeve-dress", "robe", "gown", "short-skirt", "long-skirt"],
  },
  {
    id: "pants",
    name: "裤子",
    icon: "👖",
    templates: ["shorts", "long-pants"],
  },
  {
    id: "hat",
    name: "帽子",
    icon: "🧢",
    templates: ["cap", "beanie", "top-hat"],
  },
];

export const TEMPLATES = [
  {
    id: "simple-tee",
    name: "简易T恤",
    category: "tee",
    description: "16×16 单画布",
    views: simpleTeeViews,
    mask: createFullMask(TOTAL_SIZE, TOTAL_SIZE),
    gridSize: TOTAL_SIZE,
    defaultColors: 6,
  },
  {
    id: "long-sleeve",
    name: "长袖T恤",
    category: "tee",
    description: "正背面 9×8 · 袖子 7×8",
    views: longSleeveViews,
    mask: createCombinedMask(longSleeveViews.front, longSleeveViews.back, longSleeveViews.leftSleeve, longSleeveViews.rightSleeve),
    gridSize: TOTAL_SIZE,
    defaultColors: 12,
  },
  {
    id: "tank-top",
    name: "坦克背心",
    category: "tee",
    description: "正背面 9×8 · 无袖",
    views: tankTopViews,
    mask: createCombinedMask(tankTopViews.front, tankTopViews.back, tankTopViews.leftSleeve, tankTopViews.rightSleeve),
    gridSize: TOTAL_SIZE,
    defaultColors: 8,
  },
  {
    id: "short-sleeve",
    name: "短袖T恤",
    category: "tee",
    description: "正背面 9×8 · 袖子 4×8",
    views: shortSleeveViews,
    mask: createCombinedMask(shortSleeveViews.front, shortSleeveViews.back, shortSleeveViews.leftSleeve, shortSleeveViews.rightSleeve),
    gridSize: TOTAL_SIZE,
    defaultColors: 12,
  },
  {
    id: "sleeveless-dress",
    name: "无袖连衣裙",
    category: "dress",
    description: "正背面 14×8 · 无袖",
    views: sleevelessDressViews,
    mask: createCombinedMask(sleevelessDressViews.front, sleevelessDressViews.back, sleevelessDressViews.leftSleeve, sleevelessDressViews.rightSleeve),
    gridSize: TOTAL_SIZE,
    defaultColors: 8,
  },
  {
    id: "short-sleeve-dress",
    name: "短袖连衣裙",
    category: "dress",
    description: "正背面 14×8 · 短袖",
    views: shortSleeveDressViews,
    mask: createCombinedMask(shortSleeveDressViews.front, shortSleeveDressViews.back, shortSleeveDressViews.leftSleeve, shortSleeveDressViews.rightSleeve),
    gridSize: TOTAL_SIZE,
    defaultColors: 12,
  },
  {
    id: "long-sleeve-dress",
    name: "长袖连衣裙",
    category: "dress",
    description: "正背面 14×8 · 长袖",
    views: longSleeveDressViews,
    mask: createCombinedMask(longSleeveDressViews.front, longSleeveDressViews.back, longSleeveDressViews.leftSleeve, longSleeveDressViews.rightSleeve),
    gridSize: TOTAL_SIZE,
    defaultColors: 12,
  },
  {
    id: "robe",
    name: "长袍",
    category: "dress",
    description: "正背面 14×8 · 长袖",
    views: robeViews,
    mask: createCombinedMask(robeViews.front, robeViews.back, robeViews.leftSleeve, robeViews.rightSleeve),
    gridSize: TOTAL_SIZE,
    defaultColors: 12,
  },
  {
    id: "gown",
    name: "礼服",
    category: "dress",
    description: "正背面 14×8 · 无袖",
    views: gownViews,
    mask: createCombinedMask(gownViews.front, gownViews.back, gownViews.leftSleeve, gownViews.rightSleeve),
    gridSize: TOTAL_SIZE,
    defaultColors: 8,
  },
  {
    id: "short-skirt",
    name: "半身短裙",
    category: "dress",
    description: "正背面 4×8",
    views: shortSkirtViews,
    mask: createCombinedMask(shortSkirtViews.front, shortSkirtViews.back, shortSkirtViews.leftSleeve, shortSkirtViews.rightSleeve),
    gridSize: TOTAL_SIZE,
    defaultColors: 6,
  },
  {
    id: "long-skirt",
    name: "半身长裙",
    category: "dress",
    description: "正背面 7×8",
    views: longSkirtViews,
    mask: createCombinedMask(longSkirtViews.front, longSkirtViews.back, longSkirtViews.leftSleeve, longSkirtViews.rightSleeve),
    gridSize: TOTAL_SIZE,
    defaultColors: 8,
  },
  {
    id: "shorts",
    name: "短裤",
    category: "pants",
    description: "正背面 5×8",
    views: shortsViews,
    mask: createCombinedMask(shortsViews.front, shortsViews.back, shortsViews.leftSleeve, shortsViews.rightSleeve),
    gridSize: TOTAL_SIZE,
    defaultColors: 8,
  },
  {
    id: "long-pants",
    name: "长裤",
    category: "pants",
    description: "正背面 9×8",
    views: longPantsViews,
    mask: createCombinedMask(longPantsViews.front, longPantsViews.back, longPantsViews.leftSleeve, longPantsViews.rightSleeve),
    gridSize: TOTAL_SIZE,
    defaultColors: 12,
  },
  {
    id: "cap",
    name: "鸭舌帽",
    category: "hat",
    description: "左上正面/左下左面/右上帽檐/右下右面 四片",
    views: capViews,
    mask: createCombinedMask(capViews.front, capViews.back, capViews.leftSleeve, capViews.rightSleeve),
    gridSize: TOTAL_SIZE,
    defaultColors: 6,
  },
  {
    id: "beanie",
    name: "针织帽",
    category: "hat",
    description: "上正面/下背面 两片",
    views: beanieViews,
    mask: createCombinedMask(beanieViews.front, beanieViews.back, beanieViews.leftSleeve, beanieViews.rightSleeve),
    gridSize: TOTAL_SIZE,
    defaultColors: 6,
  },
  {
    id: "top-hat",
    name: "礼帽",
    category: "hat",
    description: "帽顶/帽身/帽檐 三片 (圆形/中间/下面)",
    views: topHatViews,
    mask: createCombinedMask(topHatViews.front, topHatViews.back, topHatViews.leftSleeve, topHatViews.rightSleeve),
    gridSize: TOTAL_SIZE,
    defaultColors: 6,
  },
];

export const DEFAULT_TEMPLATE = TEMPLATES[3];

export { TOTAL_SIZE, VIEW_COLS, BODY_ROWS, SLEEVE_ROWS };
