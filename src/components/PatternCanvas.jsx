import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from "react";

const CELL_SIZE = 24;
const GRID_SIZE = 16;
const VIEW_COLS = 8;
const GAP = Math.round(CELL_SIZE / 5);
const BODY_ROWS = 9;
const SLEEVE_ROWS = 7;

const VIEW_WIDTH = VIEW_COLS * CELL_SIZE;
const BODY_HEIGHT = BODY_ROWS * CELL_SIZE;
const SLEEVE_HEIGHT = SLEEVE_ROWS * CELL_SIZE;
const FOUR_VIEW_WIDTH = VIEW_WIDTH * 2 + GAP;
const FOUR_VIEW_HEIGHT = BODY_HEIGHT + SLEEVE_HEIGHT + GAP;
const CANVAS_SIZE = Math.max(GRID_SIZE * CELL_SIZE, FOUR_VIEW_WIDTH, FOUR_VIEW_HEIGHT);

const GRAY = "rgb(85, 85, 85)";
const LIGHT_GRAY = "rgb(220, 220, 220)";
const WHITE = "rgb(255, 255, 255)";
const SUB_DIV = 3;
const SUB_SIZE = CELL_SIZE / SUB_DIV;
const MICRO_DIV = 4;
const MICRO_SIZE = SUB_SIZE / MICRO_DIV;

const ADIDAS_CLOVER = {
  rowOffset: 26,
  colOffset: -8,
  ranges: [
    [14, 13, 16], [15, 13, 17], [16, 14, 18], [17, 15, 18],
    [18, 16, 18], [19, 14, 18], [20, 13, 18], [21, 12, 18],
    [22, 12, 18], [23, 13, 18], [24, 14, 18], [25, 16, 18],
    [26, 15, 18], [27, 14, 18], [28, 13, 17], [29, 13, 16],
  ],
  hlines: [
    [17, 26, 20],
    [18, 25, 22],
  ],
};

const ZOOM_THRESHOLD = 2;

const PatternCanvas = forwardRef(function PatternCanvas(
  { result, showGrid, showNumbers, template, analysis },
  ref
) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const bodyRows = template?.views?.front?.length || BODY_ROWS;
  const sleeveRows = template?.views?.leftSleeve?.length || 0;
  const hasSleeves = sleeveRows > 0;
  const isTopHat = template?.id === "top-hat";
  const isBeanie = template?.id === "beanie";
  const isFullWidthHat = isTopHat || isBeanie;
  const bodyHeight = bodyRows * CELL_SIZE;
  const sleeveHeight = sleeveRows * CELL_SIZE;
  const fourViewHeight = hasSleeves ? bodyHeight + sleeveHeight + GAP : bodyHeight;

  const frontLen = template?.views?.front?.length || 0;
  const backLen = template?.views?.back?.length || 0;
  const leftLen = template?.views?.leftSleeve?.length || 0;
  const rightLen = template?.views?.rightSleeve?.length || 0;
  const GAP_ROWS = 1;
  const hasBrim = leftLen > 0;
  const totalHatRows = frontLen + GAP_ROWS + backLen + (hasBrim ? GAP_ROWS + leftLen : 0);
  const hatHeight = totalHatRows * CELL_SIZE;

  const canvasSize = isFullWidthHat
    ? Math.max(GRID_SIZE * CELL_SIZE, 16 * CELL_SIZE, hatHeight)
    : Math.max(GRID_SIZE * CELL_SIZE, FOUR_VIEW_WIDTH, fourViewHeight);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    download: (filename) => {
      const link = document.createElement("a");
      link.download = filename;
      link.href = canvasRef.current.toDataURL("image/png");
      link.click();
    },
  }));

  const showSubGrid = showGrid && zoom >= ZOOM_THRESHOLD;

  const analysisData = analysis || result?.analysis;

  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      tx: translate.x,
      ty: translate.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setTranslate({
      x: dragStart.current.tx + dx,
      y: dragStart.current.ty + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    setTranslate({ x: 0, y: 0 });
  }, [zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (template?.id === "simple-tee") {
      if (result) {
        drawSimpleTee(ctx, result, showGrid, showNumbers, showSubGrid);
      } else {
        drawEmptySimpleTee(ctx, showGrid, showSubGrid);
      }
    } else if (isFullWidthHat) {
      if (result?.fourView) {
        drawTopHatView(ctx, result.fourView, showGrid, template, showSubGrid, analysisData);
      } else if (template) {
        drawEmptyTopHatView(ctx, showGrid, template, showSubGrid);
      }
    } else if (result?.fourView) {
      drawFourView(ctx, result.fourView, showGrid, template, showSubGrid, analysisData);
      if (showGrid) {
        drawFourViewGrid(ctx, template);
      }
    } else if (template) {
      drawEmptyFourView(ctx, showGrid, template, showSubGrid);
    }
  }, [result, showGrid, showNumbers, template, showSubGrid, analysisData, zoom, isFullWidthHat]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="rounded-lg border border-gray-200 shadow-sm overflow-hidden"
        style={{
          maxHeight: "70vh",
          maxWidth: "100%",
          cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
          userSelect: "none",
          touchAction: zoom > 1 ? "none" : "auto",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          style={{
            imageRendering: "pixelated",
            width: `${canvasSize * zoom}px`,
            height: `${canvasSize * zoom}px`,
            userSelect: "none",
            transform: zoom > 1 ? `translate(${translate.x}px, ${translate.y}px)` : "none",
            transformOrigin: "top left",
            willChange: "transform",
          }}
          draggable={false}
        />
      </div>

      {/* 缩放控制 */}
      <div className="flex items-center justify-center gap-3 mt-3">
        <button
          onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))}
          disabled={zoom <= 1}
          className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold text-lg"
        >
          −
        </button>
        <span className="text-sm text-gray-500 min-w-[3rem] text-center">
          {zoom}x{showSubGrid && <span className="text-xs text-game-green ml-1">细节</span>}
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(4, +(z + 0.5).toFixed(1)))}
      disabled={zoom >= 4}
          className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold text-lg"
        >
          +
        </button>
        {zoom > 1 && (
          <button
            onClick={() => setZoom(1)}
            className="ml-2 px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 text-xs"
          >
            重置
          </button>
        )}
      </div>
    </div>
  );
});

// 绘制空白区域的小格子和小小格子（放大时显示）
function drawSubGrid(ctx, x, y) {
  x = Math.round(x);
  y = Math.round(y);

  // 3×3 小格子
  for (let sr = 0; sr < SUB_DIV; sr++) {
    for (let sc = 0; sc < SUB_DIV; sc++) {
      const subX = x + sc * SUB_SIZE;
      const subY = y + sr * SUB_SIZE;
      const isSubLight = (sr + sc) % 2 === 0;

      // 4×4 小小格子
      for (let mr = 0; mr < MICRO_DIV; mr++) {
        for (let mc = 0; mc < MICRO_DIV; mc++) {
          const microX = subX + mc * MICRO_SIZE;
          const microY = subY + mr * MICRO_SIZE;
          const isMicroLight = (mr + mc) % 2 === 0;

          // 颜色组合：深浅交替
          if (isSubLight && isMicroLight) {
            ctx.fillStyle = WHITE;
          } else if (isSubLight) {
            ctx.fillStyle = "rgb(240, 240, 240)";
          } else if (isMicroLight) {
            ctx.fillStyle = LIGHT_GRAY;
          } else {
            ctx.fillStyle = "rgb(200, 200, 200)";
          }

          ctx.fillRect(microX, microY, MICRO_SIZE + 0.5, MICRO_SIZE + 0.5);
        }
      }
    }
  }
}

// 绘制颜色区域的小格子和小小格子（放大时显示）
function drawSubGridOnColor(ctx, x, y, r, g, b) {
  x = Math.round(x);
  y = Math.round(y);

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  const isLight = brightness > 200;

  // 3×3 小格子
  for (let sr = 0; sr < SUB_DIV; sr++) {
    for (let sc = 0; sc < SUB_DIV; sc++) {
      const subX = x + sc * SUB_SIZE;
      const subY = y + sr * SUB_SIZE;
      const isSubLight = (sr + sc) % 2 === 0;

      // 4×4 小小格子
      for (let mr = 0; mr < MICRO_DIV; mr++) {
        for (let mc = 0; mc < MICRO_DIV; mc++) {
          const microX = subX + mc * MICRO_SIZE;
          const microY = subY + mr * MICRO_SIZE;
          const isMicroLight = (mr + mc) % 2 === 0;

          let br, bg, bb;

          if (isSubLight && isMicroLight) {
            // 主色（最亮）
            br = r; bg = g; bb = b;
          } else if (isSubLight) {
            // 稍暗
            if (isLight) {
              br = Math.max(0, r - 15);
              bg = Math.max(0, g - 15);
              bb = Math.max(0, b - 15);
            } else {
              br = Math.min(255, r + 20);
              bg = Math.min(255, g + 20);
              bb = Math.min(255, b + 20);
            }
          } else if (isMicroLight) {
            // 更暗
            if (isLight) {
              br = Math.max(0, r - 30);
              bg = Math.max(0, g - 30);
              bb = Math.max(0, b - 30);
            } else {
              br = Math.min(255, r + 40);
              bg = Math.min(255, g + 40);
              bb = Math.min(255, b + 40);
            }
          } else {
            // 最暗
            if (isLight) {
              br = Math.max(0, r - 45);
              bg = Math.max(0, g - 45);
              bb = Math.max(0, b - 45);
            } else {
              br = Math.min(255, r + 60);
              bg = Math.min(255, g + 60);
              bb = Math.min(255, b + 60);
            }
          }

          ctx.fillStyle = `rgb(${br},${bg},${bb})`;
          ctx.fillRect(microX, microY, MICRO_SIZE + 0.5, MICRO_SIZE + 0.5);
        }
      }
    }
  }
}

function drawSolidCell(ctx, x, y, r, g, b) {
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
}

// 绘制空白简单 T 视图
function drawEmptySimpleTee(ctx, showGrid, showSubGrid) {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const x = col * CELL_SIZE;
      const y = row * CELL_SIZE;

      if (showSubGrid) {
        drawSubGrid(ctx, x, y);
      } else {
        drawSolidCell(ctx, x, y, 240, 240, 240);
      }
    }
  }

  // 网格线绘制在最顶层
  if (showGrid) {
    drawSimpleGridLines(ctx, GRID_SIZE, GRID_SIZE, 0, 0);
  }
}

// 绘制填充的简单 T 视图
function drawSimpleTee(ctx, result, showGrid, showNumbers, showSubGrid) {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = GRAY;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const { pixels } = result;
  if (!pixels) return;

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const idx = row * GRID_SIZE + col;
      const pixel = pixels[idx];

      if (pixel && Array.isArray(pixel) && pixel.length >= 3) {
        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;

        if (showSubGrid) {
          drawSubGridOnColor(ctx, x, y, pixel[0], pixel[1], pixel[2]);
        } else {
          drawSolidCell(ctx, x, y, pixel[0], pixel[1], pixel[2]);
        }
      }
    }
  }

  // 网格线绘制在最顶层
  if (showGrid) {
    drawSimpleGridLines(ctx, GRID_SIZE, GRID_SIZE, 0, 0);
  }

  if (showNumbers && result.paletteIndices) {
    drawNumbers(ctx, result.paletteIndices, GRID_SIZE, GRID_SIZE, 0, 0);
  }
}

// 绘制空白四视图（放大时显示小格子和小小格子）
function drawEmptyFourView(ctx, showGrid, template, showSubGrid) {
  const frontRows = template?.views?.front?.length || BODY_ROWS;
  const backRows = template?.views?.back?.length || BODY_ROWS;
  const leftSleeveRows = template?.views?.leftSleeve?.length || 0;
  const rightSleeveRows = template?.views?.rightSleeve?.length || 0;
  const hasSleeves = leftSleeveRows > 0 || rightSleeveRows > 0;

  const upperRows = Math.max(frontRows, backRows);
  const lowerRows = Math.max(leftSleeveRows, rightSleeveRows);
  const upperHeight = upperRows * CELL_SIZE;
  const lowerHeight = lowerRows * CELL_SIZE;

  const fourViewWidth = VIEW_WIDTH * 2 + GAP;
  const fourViewHeight = hasSleeves ? upperHeight + lowerHeight + GAP : upperHeight;
  const canvasSize = Math.max(GRID_SIZE * CELL_SIZE, fourViewWidth, fourViewHeight);

  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = GRAY;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  const offsetX = Math.round((canvasSize - fourViewWidth) / 2);
  const offsetY = Math.round((canvasSize - fourViewHeight) / 2);

  // 帽舌帽的帽檐底部与帽身底部对齐
  const isCap = template?.id === "cap";
  const backOffsetY = isCap ? offsetY + (frontRows - backRows) * CELL_SIZE : offsetY;

  // 绘制四个视图（小格子在各视图绘制函数中处理）
  drawView(ctx, offsetX, offsetY, VIEW_COLS, frontRows, template?.views?.front, showSubGrid);
  drawView(ctx, offsetX + VIEW_WIDTH + GAP, backOffsetY, VIEW_COLS, backRows, template?.views?.back, showSubGrid);
  if (hasSleeves) {
    drawView(ctx, offsetX, offsetY + upperHeight + GAP, VIEW_COLS, leftSleeveRows, template?.views?.leftSleeve, showSubGrid, template?.sleeveSubOffset);
    drawView(ctx, offsetX + VIEW_WIDTH + GAP, offsetY + upperHeight + GAP, VIEW_COLS, rightSleeveRows, template?.views?.rightSleeve, showSubGrid, template?.sleeveSubOffset);
  }

  // 绘制裤腿间隙（短裤和长裤）- 始终显示，深灰色铺满
  const pantsTemplates = ["shorts", "long-pants"];
  if (pantsTemplates.includes(template?.id)) {
    const gapWidth = SUB_SIZE;
    const centerX = offsetX + VIEW_COLS * CELL_SIZE / 2;

    ctx.fillStyle = "#666666";
    ctx.globalAlpha = 1;

    const frontMask = template?.views?.front;
    if (frontMask) {
      const startRow = 3;
      const endRow = frontMask.length;
      const startY = offsetY + startRow * CELL_SIZE;
      const totalHeight = (endRow - startRow) * CELL_SIZE;
      ctx.fillRect(centerX - gapWidth / 2, startY, gapWidth, totalHeight);
    }

    const backMask = template?.views?.back;
    if (backMask) {
      const startRow = 3;
      const endRow = backMask.length;
      const startY = offsetY + startRow * CELL_SIZE;
      const totalHeight = (endRow - startRow) * CELL_SIZE;
      ctx.fillRect(centerX - gapWidth / 2 + VIEW_WIDTH + GAP, startY, gapWidth, totalHeight);
    }
  }

  // 网格线绘制在最顶层，四视图同步响应 showGrid
  if (showGrid) {
    drawViewGridLines(ctx, offsetX, offsetY, VIEW_COLS, frontRows, template?.views?.front);
    drawViewGridLines(ctx, offsetX + VIEW_WIDTH + GAP, backOffsetY, VIEW_COLS, backRows, template?.views?.back);
    if (hasSleeves) {
      drawViewGridLines(ctx, offsetX, offsetY + upperHeight + GAP, VIEW_COLS, leftSleeveRows, template?.views?.leftSleeve);
      drawViewGridLines(ctx, offsetX + VIEW_WIDTH + GAP, offsetY + upperHeight + GAP, VIEW_COLS, rightSleeveRows, template?.views?.rightSleeve);
    }
  }
}

// 绘制填充的四视图（放大时显示小格子和小小格子，网格线同步响应按钮）
function drawFourView(ctx, fourView, showGrid, template, showSubGrid, analysis) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  const frontRows = template?.views?.front?.length || BODY_ROWS;
  const backRows = template?.views?.back?.length || BODY_ROWS;
  const leftSleeveRows = template?.views?.leftSleeve?.length || 0;
  const rightSleeveRows = template?.views?.rightSleeve?.length || 0;
  const hasSleeves = leftSleeveRows > 0 || rightSleeveRows > 0;

  const upperRows = Math.max(frontRows, backRows);
  const lowerRows = Math.max(leftSleeveRows, rightSleeveRows);
  const upperHeight = upperRows * CELL_SIZE;
  const lowerHeight = lowerRows * CELL_SIZE;

  const fourViewWidth = VIEW_WIDTH * 2 + GAP;
  const fourViewHeight = hasSleeves ? upperHeight + lowerHeight + GAP : upperHeight;
  const canvasSize = Math.max(GRID_SIZE * CELL_SIZE, fourViewWidth, fourViewHeight);

  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = GRAY;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  const offsetX = Math.round((canvasSize - fourViewWidth) / 2);
  const offsetY = Math.round((canvasSize - fourViewHeight) / 2);

  const frontOffsetY = offsetY;
  // 帽舌帽的帽檐底部与帽身底部对齐
  const isCap = template?.id === "cap";
  const backOffsetY = isCap ? offsetY + (frontRows - backRows) * CELL_SIZE : offsetY;
  const leftSleeveOffsetY = offsetY + upperHeight + GAP;
  const rightSleeveOffsetY = offsetY + upperHeight + GAP;

  const mainColor = fourView.front?.pixels ? getMainColor(fourView.front.pixels) : [220, 220, 220];

  // 绘制四个视图的填充内容（小格子在各视图绘制函数中处理）
  drawFilledView(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
    template?.views?.front, fourView.front, mainColor, showSubGrid);
  drawFilledView(ctx, offsetX + VIEW_WIDTH + GAP, backOffsetY, VIEW_COLS, backRows,
    template?.views?.back, fourView.back, mainColor, showSubGrid);
  if (hasSleeves) {
    drawFilledView(ctx, offsetX, leftSleeveOffsetY, VIEW_COLS, leftSleeveRows,
      template?.views?.leftSleeve, fourView.leftSleeve, mainColor, showSubGrid, template?.sleeveSubOffset);
    drawFilledView(ctx, offsetX + VIEW_WIDTH + GAP, rightSleeveOffsetY, VIEW_COLS, rightSleeveRows,
      template?.views?.rightSleeve, fourView.rightSleeve, mainColor, showSubGrid, template?.sleeveSubOffset);
  }

  // 帽子模板的帽檐不绘制条纹
  const hatTemplates = ["cap", "beanie", "top-hat"];
  const isHat = hatTemplates.includes(template?.id);
  const isBrim = isHat && template?.views?.back && (template.id === "cap" || template.id === "top-hat");

  // 绘制服装细节（位于小格子之上）
  if (analysis?.verticalStripes?.hasStripes && analysis.verticalStripes.color) {
    const stripeRgb = analysis.verticalStripes.color;
    const stripeCount = analysis.verticalStripes.count || 3;

    drawBodyVerticalStripes(ctx, offsetX, frontOffsetY,
      VIEW_COLS, frontRows, template?.views?.front, stripeRgb, stripeCount);
    // 帽檐不绘制条纹
    if (!isBrim) {
      drawBodyVerticalStripes(ctx, offsetX + VIEW_WIDTH + GAP, backOffsetY,
        VIEW_COLS, backRows, template?.views?.back, stripeRgb, stripeCount);
    }

    if (hasSleeves) {
      drawSleeveVerticalStripes(ctx, offsetX, leftSleeveOffsetY,
        VIEW_COLS, leftSleeveRows, template?.views?.leftSleeve, "left", stripeRgb, stripeCount);
      drawSleeveVerticalStripes(ctx, offsetX + VIEW_WIDTH + GAP, rightSleeveOffsetY,
        VIEW_COLS, rightSleeveRows, template?.views?.rightSleeve, "right", stripeRgb, stripeCount);
    }
  }

  // 只有当AI识别到logo且颜色与主色有显著差异时才绘制
  if (analysis?.logo?.hasLogo && analysis.logo.color) {
    // 验证logo颜色是否合理 - 与主色差异需大于10
    const logoColor = analysis.logo.color;
    const mainColor = analysis.colors?.[0];
    let colorDiff = 0;
    if (mainColor) {
      colorDiff = Math.abs(logoColor[0] - mainColor[0]) + Math.abs(logoColor[1] - mainColor[1]) + Math.abs(logoColor[2] - mainColor[2]);
    }
    
    // 只有当颜色差异足够大时才绘制logo，避免AI误识别
    if (!mainColor || colorDiff > 10) {
      const logoLayout = isHat ? null : analysis.layout?.logo;
      drawSubPixelLogo(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
        template?.views?.front, analysis.logo.color, analysis.logo.type, analysis.logo.shape, logoLayout, template?.id);
    }
  }

  if (analysis?.printPatterns && analysis.printPatterns.length > 0) {
    for (const pattern of analysis.printPatterns) {
      const pos = pattern.position || "";
      const isLeftSide = pos.includes("左侧") || pos.includes("左边");
      const isRightSide = pos.includes("右侧") || pos.includes("右边");
      const isChest = pos.includes("胸") || pos.includes("胸口") || pos.includes("胸前");
      const isCuff = pos.includes("袖口") || pos.includes("袖");
      const isFullBody = pos.includes("全身") || pos.includes("满") || pos.includes("遍布");

      // 左侧印花：主要画在左袖子上
      if (isLeftSide) {
        if (hasSleeves && template?.views?.leftSleeve) {
          drawPrintPattern(ctx, offsetX, leftSleeveOffsetY, VIEW_COLS, leftSleeveRows,
            template?.views?.leftSleeve, pattern, template?.id);
        }
        // 如果没有袖子模板，则画在正面左侧
        if (!hasSleeves || !template?.views?.leftSleeve || template.views.leftSleeve.length === 0) {
          drawPrintPattern(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
            template?.views?.front, pattern, template?.id);
        }
      }
      // 右侧印花：主要画在右袖子上
      else if (isRightSide) {
        if (hasSleeves && template?.views?.rightSleeve) {
          drawPrintPattern(ctx, offsetX + VIEW_WIDTH + GAP, rightSleeveOffsetY, VIEW_COLS, rightSleeveRows,
            template?.views?.rightSleeve, pattern, template?.id);
        }
        if (!hasSleeves || !template?.views?.rightSleeve || template.views.rightSleeve.length === 0) {
          drawPrintPattern(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
            template?.views?.front, pattern, template?.id);
        }
      }
      // 胸前印花：画在衣服主体上
      else if (isChest) {
        drawPrintPattern(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
          template?.views?.front, pattern, template?.id);
      }
      // 袖口印花：画在两个袖子上
      else if (isCuff) {
        if (hasSleeves && template?.views?.leftSleeve) {
          drawPrintPattern(ctx, offsetX, leftSleeveOffsetY, VIEW_COLS, leftSleeveRows,
            template?.views?.leftSleeve, pattern, template?.id);
        }
        if (hasSleeves && template?.views?.rightSleeve) {
          drawPrintPattern(ctx, offsetX + VIEW_WIDTH + GAP, rightSleeveOffsetY, VIEW_COLS, rightSleeveRows,
            template?.views?.rightSleeve, pattern, template?.id);
        }
        // 袖口印花也在正面画一个
        drawPrintPattern(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
          template?.views?.front, pattern, template?.id);
      }
      // 全身印花：所有视图都画
      else if (isFullBody) {
        drawPrintPattern(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
          template?.views?.front, pattern, template?.id);
        if (template?.views?.back && !isBrim) {
          drawPrintPattern(ctx, offsetX + VIEW_WIDTH + GAP, backOffsetY, VIEW_COLS, backRows,
            template?.views?.back, pattern, template?.id);
        }
        if (hasSleeves) {
          if (template?.views?.leftSleeve) {
            drawPrintPattern(ctx, offsetX, leftSleeveOffsetY, VIEW_COLS, leftSleeveRows,
              template?.views?.leftSleeve, pattern, template?.id);
          }
          if (template?.views?.rightSleeve) {
            drawPrintPattern(ctx, offsetX + VIEW_WIDTH + GAP, rightSleeveOffsetY, VIEW_COLS, rightSleeveRows,
              template?.views?.rightSleeve, pattern, template?.id);
          }
        }
      }
      // 默认：画在正背面
      else {
        drawPrintPattern(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
          template?.views?.front, pattern, template?.id);
        if (template?.views?.back && !isBrim) {
          drawPrintPattern(ctx, offsetX + VIEW_WIDTH + GAP, backOffsetY, VIEW_COLS, backRows,
            template?.views?.back, pattern, template?.id);
        }
      }
    }
  }

  const pantsTemplates = ["shorts", "long-pants"];
  const isPants = pantsTemplates.includes(template?.id);
  const dressTemplates = ["sleeveless-dress", "short-sleeve-dress", "long-sleeve-dress", "robe", "gown", "short-skirt", "long-skirt"];
  const isDress = dressTemplates.includes(template?.id);

  if (analysis?.innerLayerColor && !isWhiteColor(analysis.innerLayerColor) && !isPants) {
    if (analysis.isOpenFront) {
      drawOpenFront(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
        template?.views?.front, analysis.innerLayerColor, analysis.innerLayerExtendsBelow);
      if (analysis.innerLayerExtendsBelow) {
        drawInnerLayerHem(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
          template?.views?.front, analysis.innerLayerColor, analysis.innerLayerStripeDirection, analysis.innerLayerStripeColor);
        // 帽檐不绘制内搭下摆
        if (!isBrim) {
          drawInnerLayerHem(ctx, offsetX + VIEW_WIDTH + GAP, backOffsetY, VIEW_COLS, backRows,
            template?.views?.back, analysis.innerLayerColor, analysis.innerLayerStripeDirection, analysis.innerLayerStripeColor);
        }
      }
    } else {
      if (analysis.innerLayerExtendsBelow) {
        drawInnerLayerHem(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
          template?.views?.front, analysis.innerLayerColor, analysis.innerLayerStripeDirection, analysis.innerLayerStripeColor);
        // 帽檐不绘制内搭下摆
        if (!isBrim) {
          drawInnerLayerHem(ctx, offsetX + VIEW_WIDTH + GAP, backOffsetY, VIEW_COLS, backRows,
            template?.views?.back, analysis.innerLayerColor, analysis.innerLayerStripeDirection, analysis.innerLayerStripeColor);
        }
      }
    }
    if (hasSleeves && analysis.sleeveLength === "long" && analysis.hasInnerLayerAtCuffs) {
      const cuffStripeDir = analysis.innerLayerStripeDirection;
      drawInnerLayerCuff(ctx, offsetX, leftSleeveOffsetY, VIEW_COLS, leftSleeveRows,
        template?.views?.leftSleeve, analysis.innerLayerColor, cuffStripeDir, analysis.innerLayerStripeColor);
      drawInnerLayerCuff(ctx, offsetX + VIEW_WIDTH + GAP, rightSleeveOffsetY, VIEW_COLS, rightSleeveRows,
        template?.views?.rightSleeve, analysis.innerLayerColor, cuffStripeDir, analysis.innerLayerStripeColor);
    }
  }

  if (analysis?.collar && analysis.collar.color) {
    drawCollar(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
      template?.views?.front, analysis.collar, analysis.innerLayerColor, analysis.isOpenFront, analysis.layout?.collar, mainColor);
  }

  if (analysis?.printPatterns && analysis.printPatterns.length > 0) {
    for (const pattern of analysis.printPatterns) {
      if (pattern.type?.includes("领结") || pattern.type?.includes("蝴蝶结")) {
        drawPrintPattern(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
          template?.views?.front, pattern, template?.id);
      }
    }
  }

  if (analysis?.hasDrawstrings && !isDress) {
    drawDrawstrings(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
      template?.views?.front, analysis.hasDrawstrings, analysis.drawstringColor, analysis.drawstringPosition, analysis.drawstringLength, template?.id);
  }

  if (analysis?.zipper) {
    drawZipper(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
      template?.views?.front, analysis.zipper, analysis.isOpenFront, analysis.layout?.zipper);
  } else if (analysis?.buttons) {
    drawButtons(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
      template?.views?.front, analysis.buttons, analysis.isOpenFront, analysis.layout?.buttons);
  }

  if (analysis?.pockets) {
    drawPockets(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
      template?.views?.front, analysis.pockets, analysis.layout?.pockets, analysis.isOpenFront, analysis.stitchingColor, isPants);
  }

  if (hasSleeves &&
      ((analysis?.cuffStyle && analysis.cuffStyle !== "无特殊设计" && analysis.sleeveLength === "long") ||
       (analysis?.cuffButton && analysis.sleeveLength === "long") ||
       (analysis?.hasCuffs && analysis.sleeveLength === "long"))) {
    drawCuffDetails(ctx, offsetX, leftSleeveOffsetY, VIEW_COLS, leftSleeveRows,
      template?.views?.leftSleeve, analysis.cuffStyle, analysis.cuffColor, analysis.cuffButton, mainColor, analysis.cuffPattern, analysis.cuffPatternColor);
    drawCuffDetails(ctx, offsetX + VIEW_WIDTH + GAP, rightSleeveOffsetY, VIEW_COLS, rightSleeveRows,
      template?.views?.rightSleeve, analysis.cuffStyle, analysis.cuffColor, analysis.cuffButton, mainColor, analysis.cuffPattern, analysis.cuffPatternColor);
  }

  // 绘制裤腿卷边（短裤和长裤）
  if (isPants &&
      ((analysis?.cuffStyle && analysis.cuffStyle !== "无特殊设计") ||
       analysis?.hasCuffs)) {
    drawPantsHem(ctx, offsetX, frontOffsetY, VIEW_COLS, frontRows,
      template?.views?.front, analysis.cuffStyle, analysis.cuffColor, analysis.cuffPattern, analysis.cuffPatternColor, mainColor);
    drawPantsHem(ctx, offsetX + VIEW_WIDTH + GAP, backOffsetY, VIEW_COLS, backRows,
      template?.views?.back, analysis.cuffStyle, analysis.cuffColor, analysis.cuffPattern, analysis.cuffPatternColor, mainColor);
  }

  // 最后绘制网格线（最顶层），四视图同步响应 showGrid 按钮
  if (showGrid) {
    ctx.save();
    ctx.resetTransform();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.5;

    const views = [
      { x: offsetX, y: frontOffsetY, cols: VIEW_COLS, rows: frontRows, mask: template?.views?.front },
      { x: offsetX + VIEW_WIDTH + GAP, y: backOffsetY, cols: VIEW_COLS, rows: backRows, mask: template?.views?.back },
      ...(hasSleeves ? [
        { x: offsetX, y: leftSleeveOffsetY, cols: VIEW_COLS, rows: leftSleeveRows, mask: template?.views?.leftSleeve },
        { x: offsetX + VIEW_WIDTH + GAP, y: rightSleeveOffsetY, cols: VIEW_COLS, rows: rightSleeveRows, mask: template?.views?.rightSleeve },
      ] : []),
    ];

    for (const v of views) {
      if (!v.mask || !v.mask[0]) continue;
      const vx = Math.round(v.x);
      const vy = Math.round(v.y);
      for (let row = 0; row < v.rows; row++) {
        for (let col = 0; col < v.cols; col++) {
          if (v.mask[row] && v.mask[row][col]) {
            const cellX = vx + col * CELL_SIZE + 0.5;
            const cellY = vy + row * CELL_SIZE + 0.5;
            ctx.strokeRect(cellX, cellY, CELL_SIZE - 1, CELL_SIZE - 1);
          }
        }
      }
    }
    ctx.restore();
  }

  // 绘制裤腿间隙（短裤和长裤）- 在网格线之后绘制，确保间隙区域无网格线
  if (isPants) {
    ctx.save();
    ctx.resetTransform();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    const gapWidth = SUB_SIZE;
    const centerX = offsetX + VIEW_COLS * CELL_SIZE / 2;

    ctx.fillStyle = "#666666";

    const frontMask = template?.views?.front;
    if (frontMask) {
      const startRow = 3;
      const endRow = frontMask.length;
      const startY = frontOffsetY + startRow * CELL_SIZE;
      const totalHeight = (endRow - startRow) * CELL_SIZE;
      ctx.fillRect(centerX - gapWidth / 2, startY, gapWidth, totalHeight);
    }

    const backMask = template?.views?.back;
    if (backMask) {
      const startRow = 3;
      const endRow = backMask.length;
      const startY = backOffsetY + startRow * CELL_SIZE;
      const totalHeight = (endRow - startRow) * CELL_SIZE;
      ctx.fillRect(centerX - gapWidth / 2 + VIEW_WIDTH + GAP, startY, gapWidth, totalHeight);
    }
    ctx.restore();
  }

  // 终极防线：逐格校验修复异常颜色（白色方块、背景灰泄漏）
  // 5点采样（四角+中心），4点以上异常才修复，避免误伤logo/text/stitch等细节
  const allViews = [
    { x: offsetX, y: frontOffsetY, cols: VIEW_COLS, rows: frontRows, mask: template?.views?.front },
    { x: offsetX + VIEW_WIDTH + GAP, y: backOffsetY, cols: VIEW_COLS, rows: backRows, mask: template?.views?.back },
    ...(hasSleeves ? [
      { x: offsetX, y: leftSleeveOffsetY, cols: VIEW_COLS, rows: leftSleeveRows, mask: template?.views?.leftSleeve },
      { x: offsetX + VIEW_WIDTH + GAP, y: rightSleeveOffsetY, cols: VIEW_COLS, rows: rightSleeveRows, mask: template?.views?.rightSleeve },
    ] : []),
  ];

  const [mr, mg, mb] = mainColor;
  const mainIsWhite = mr > 245 && mg > 245 && mb > 245;

  try {
    for (const v of allViews) {
      if (!v.mask) continue;
      const vx = Math.round(v.x);
      const vy = Math.round(v.y);
      for (let row = 0; row < v.rows; row++) {
        for (let col = 0; col < v.cols; col++) {
          if (!(v.mask[row] && v.mask[row][col])) continue;
          const cx = vx + col * CELL_SIZE;
          const cy = vy + row * CELL_SIZE;

          // 5点采样：四角+中心
          const samples = [
            [cx + 1, cy + 1],
            [cx + CELL_SIZE - 2, cy + 1],
            [cx + 1, cy + CELL_SIZE - 2],
            [cx + CELL_SIZE - 2, cy + CELL_SIZE - 2],
            [cx + CELL_SIZE / 2, cy + CELL_SIZE / 2],
          ];

          let abnormalCount = 0;
          for (const [sx, sy] of samples) {
            const pix = ctx.getImageData(sx, sy, 1, 1).data;
            const [pr, pg, pb] = [pix[0], pix[1], pix[2]];
            // 异常条件1：mask=true却出现纯背景灰[85,85,85]
            const isGray = pr === 85 && pg === 85 && pb === 85;
            // 异常条件2：主色不是白，但像素接近纯白（且不是透明造成的）
            const isBadWhite = !mainIsWhite && pr > 248 && pg > 248 && pb > 248 && pix[3] > 200;
            if (isGray || isBadWhite) abnormalCount++;
          }

          if (abnormalCount >= 4) {
            // 强制用主色覆盖这个格子
            ctx.fillStyle = `rgb(${mr},${mg},${mb})`;
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.fillRect(cx, cy, CELL_SIZE, CELL_SIZE);
          }
        }
      }
    }
  } catch (e) {
    // getImageData可能因跨域失败，静默跳过
  }

  ctx.restore();
}

function drawEmptyTopHatView(ctx, showGrid, template, showSubGrid) {
  const frontRows = template?.views?.front?.length || 6;
  const backRows = template?.views?.back?.length || 4;
  const brimRows = template?.views?.leftSleeve?.length || 0;
  const GAP_ROWS = 1;
  const hasBrim = brimRows > 0;
  const totalRows = frontRows + GAP_ROWS + backRows + (hasBrim ? GAP_ROWS + brimRows : 0);
  
  // 使用实际的mask列数
  const frontMask = template?.views?.front;
  const backMask = template?.views?.back;
  const brimMask = template?.views?.leftSleeve;
  
  const frontCols = frontMask?.[0]?.length || VIEW_COLS;
  const backCols = backMask?.[0]?.length || VIEW_COLS;
  const brimCols = brimMask?.[0]?.length || VIEW_COLS;
  const maxCols = Math.max(frontCols, backCols, brimCols);

  const canvasSize = Math.max(GRID_SIZE * CELL_SIZE, maxCols * CELL_SIZE, totalRows * CELL_SIZE);

  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = GRAY;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  const offsetX = Math.round((canvasSize - maxCols * CELL_SIZE) / 2);
  const offsetY = Math.round((canvasSize - totalRows * CELL_SIZE) / 2);

  // 绘制front面板
  for (let row = 0; row < frontRows; row++) {
    for (let col = 0; col < frontCols; col++) {
      if (frontMask && frontMask[row] && frontMask[row][col]) {
        const cellX = offsetX + col * CELL_SIZE;
        const cellY = offsetY + row * CELL_SIZE;
        if (showSubGrid) {
          drawSubGrid(ctx, cellX, cellY);
        } else {
          drawSolidCell(ctx, cellX, cellY, 240, 240, 240);
        }
      }
    }
  }

  // 绘制back面板
  for (let row = 0; row < backRows; row++) {
    for (let col = 0; col < backCols; col++) {
      if (backMask && backMask[row] && backMask[row][col]) {
        const cellX = offsetX + col * CELL_SIZE;
        const cellY = offsetY + (frontRows + GAP_ROWS + row) * CELL_SIZE;
        if (showSubGrid) {
          drawSubGrid(ctx, cellX, cellY);
        } else {
          drawSolidCell(ctx, cellX, cellY, 240, 240, 240);
        }
      }
    }
  }

  // 绘制brim面板
  if (hasBrim) {
    for (let row = 0; row < brimRows; row++) {
      for (let col = 0; col < brimCols; col++) {
        if (brimMask && brimMask[row] && brimMask[row][col]) {
          const cellX = offsetX + col * CELL_SIZE;
          const cellY = offsetY + (frontRows + GAP_ROWS + backRows + GAP_ROWS + row) * CELL_SIZE;
          if (showSubGrid) {
            drawSubGrid(ctx, cellX, cellY);
          } else {
            drawSolidCell(ctx, cellX, cellY, 240, 240, 240);
          }
        }
      }
    }
  }

  if (showGrid) {
    ctx.save();
    ctx.resetTransform();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.5;

    for (let row = 0; row < frontRows; row++) {
      for (let col = 0; col < frontCols; col++) {
        if (frontMask && frontMask[row] && frontMask[row][col]) {
          const cellX = offsetX + col * CELL_SIZE + 0.5;
          const cellY = offsetY + row * CELL_SIZE + 0.5;
          ctx.strokeRect(cellX, cellY, CELL_SIZE - 1, CELL_SIZE - 1);
        }
      }
    }

    for (let row = 0; row < backRows; row++) {
      for (let col = 0; col < backCols; col++) {
        if (backMask && backMask[row] && backMask[row][col]) {
          const cellX = offsetX + col * CELL_SIZE + 0.5;
          const cellY = offsetY + (frontRows + GAP_ROWS + row) * CELL_SIZE + 0.5;
          ctx.strokeRect(cellX, cellY, CELL_SIZE - 1, CELL_SIZE - 1);
        }
      }
    }

    if (hasBrim) {
      for (let row = 0; row < brimRows; row++) {
        for (let col = 0; col < brimCols; col++) {
          if (brimMask && brimMask[row] && brimMask[row][col]) {
            const cellX = offsetX + col * CELL_SIZE + 0.5;
            const cellY = offsetY + (frontRows + GAP_ROWS + backRows + GAP_ROWS + row) * CELL_SIZE + 0.5;
            ctx.strokeRect(cellX, cellY, CELL_SIZE - 1, CELL_SIZE - 1);
          }
        }
      }
    }

    ctx.restore();
  }
}

function drawTopHatView(ctx, fourView, showGrid, template, showSubGrid, analysis) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  const frontRows = template?.views?.front?.length || 6;
  const backRows = template?.views?.back?.length || 4;
  const brimRows = template?.views?.leftSleeve?.length || 0;
  const GAP_ROWS = 1;
  const hasBrim = brimRows > 0;
  const totalRows = frontRows + GAP_ROWS + backRows + (hasBrim ? GAP_ROWS + brimRows : 0);
  
  // 使用实际的mask列数，而不是GRID_SIZE
  const frontMask = template?.views?.front;
  const backMask = template?.views?.back;
  const brimMask = template?.views?.leftSleeve;
  
  const frontCols = frontMask?.[0]?.length || VIEW_COLS;
  const backCols = backMask?.[0]?.length || VIEW_COLS;
  const brimCols = brimMask?.[0]?.length || VIEW_COLS;
  
  const maxCols = Math.max(frontCols, backCols, brimCols);

  const canvasSize = Math.max(GRID_SIZE * CELL_SIZE, maxCols * CELL_SIZE, totalRows * CELL_SIZE);

  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = GRAY;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  const offsetX = Math.round((canvasSize - maxCols * CELL_SIZE) / 2);
  const offsetY = Math.round((canvasSize - totalRows * CELL_SIZE) / 2);

  const mainColor = fourView.front?.pixels ? getMainColor(fourView.front.pixels) : [220, 220, 220];
  const [mr, mg, mb] = mainColor;

  // 绘制front面板
  for (let row = 0; row < frontRows; row++) {
    for (let col = 0; col < frontCols; col++) {
      if (!frontMask || !frontMask[row] || !frontMask[row][col]) continue;

      const idx = row * frontCols + col;
      let pixel = null;
      if (fourView.front?.pixels) {
        const p = fourView.front.pixels[idx];
        if (p) {
          pixel = p;
        }
      }

      const [r, g, b] = pixel || [mr, mg, mb];
      const cellX = offsetX + col * CELL_SIZE;
      const cellY = offsetY + row * CELL_SIZE;

      if (showSubGrid) {
        drawSubGridOnColor(ctx, cellX, cellY, r, g, b);
      } else {
        drawSolidCell(ctx, cellX, cellY, r, g, b);
      }
    }
  }

  // 绘制back面板
  for (let row = 0; row < backRows; row++) {
    for (let col = 0; col < backCols; col++) {
      if (!backMask || !backMask[row] || !backMask[row][col]) continue;

      const idx = row * backCols + col;
      let pixel = null;
      if (fourView.back?.pixels) {
        const p = fourView.back.pixels[idx];
        if (p) {
          pixel = p;
        }
      }

      const [r, g, b] = pixel || [mr, mg, mb];
      const cellX = offsetX + col * CELL_SIZE;
      const cellY = offsetY + (frontRows + GAP_ROWS + row) * CELL_SIZE;

      if (showSubGrid) {
        drawSubGridOnColor(ctx, cellX, cellY, r, g, b);
      } else {
        drawSolidCell(ctx, cellX, cellY, r, g, b);
      }
    }
  }

  // 绘制brim面板
  if (hasBrim) {
    for (let row = 0; row < brimRows; row++) {
      for (let col = 0; col < brimCols; col++) {
        if (!brimMask || !brimMask[row] || !brimMask[row][col]) continue;

        const idx = row * brimCols + col;
        let pixel = null;
        if (fourView.leftSleeve?.pixels) {
          const p = fourView.leftSleeve.pixels[idx];
          if (p) {
            pixel = p;
          }
        }

        const [r, g, b] = pixel || [mr, mg, mb];
        const cellX = offsetX + col * CELL_SIZE;
        const cellY = offsetY + (frontRows + GAP_ROWS + backRows + GAP_ROWS + row) * CELL_SIZE;

        if (showSubGrid) {
          drawSubGridOnColor(ctx, cellX, cellY, r, g, b);
        } else {
          drawSolidCell(ctx, cellX, cellY, r, g, b);
        }
      }
    }
  }

  // 绘制帽子logo
  if (analysis?.logo?.hasLogo && analysis.logo.color) {
    drawSubPixelLogo(ctx, offsetX, offsetY, frontCols, frontRows,
      frontMask, analysis.logo.color, analysis.logo.type, analysis.logo.shape, null, template?.id);
  }

  // 绘制网格线
  if (showGrid) {
    ctx.save();
    ctx.resetTransform();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.5;

    for (let row = 0; row < frontRows; row++) {
      for (let col = 0; col < frontCols; col++) {
        if (frontMask && frontMask[row] && frontMask[row][col]) {
          const cellX = offsetX + col * CELL_SIZE + 0.5;
          const cellY = offsetY + row * CELL_SIZE + 0.5;
          ctx.strokeRect(cellX, cellY, CELL_SIZE - 1, CELL_SIZE - 1);
        }
      }
    }

    for (let row = 0; row < backRows; row++) {
      for (let col = 0; col < backCols; col++) {
        if (backMask && backMask[row] && backMask[row][col]) {
          const cellX = offsetX + col * CELL_SIZE + 0.5;
          const cellY = offsetY + (frontRows + GAP_ROWS + row) * CELL_SIZE + 0.5;
          ctx.strokeRect(cellX, cellY, CELL_SIZE - 1, CELL_SIZE - 1);
        }
      }
    }

    if (hasBrim) {
      for (let row = 0; row < brimRows; row++) {
        for (let col = 0; col < brimCols; col++) {
          if (brimMask && brimMask[row] && brimMask[row][col]) {
            const cellX = offsetX + col * CELL_SIZE + 0.5;
            const cellY = offsetY + (frontRows + GAP_ROWS + backRows + GAP_ROWS + row) * CELL_SIZE + 0.5;
            ctx.strokeRect(cellX, cellY, CELL_SIZE - 1, CELL_SIZE - 1);
          }
        }
      }
    }

    ctx.restore();
  }

  ctx.restore();
}

function drawFourViewGrid(ctx, template) {
  if (!template?.views) return;

  const frontRows = template?.views?.front?.length || BODY_ROWS;
  const backRows = template?.views?.back?.length || BODY_ROWS;
  const leftSleeveRows = template?.views?.leftSleeve?.length || 0;
  const rightSleeveRows = template?.views?.rightSleeve?.length || 0;
  const hasSleeves = leftSleeveRows > 0 || rightSleeveRows > 0;

  const upperRows = Math.max(frontRows, backRows);
  const lowerRows = Math.max(leftSleeveRows, rightSleeveRows);
  const upperHeight = upperRows * CELL_SIZE;
  const lowerHeight = lowerRows * CELL_SIZE;

  const fourViewWidth = VIEW_WIDTH * 2 + GAP;
  const fourViewHeight = hasSleeves ? upperHeight + lowerHeight + GAP : upperHeight;
  const canvasSize = Math.max(GRID_SIZE * CELL_SIZE, fourViewWidth, fourViewHeight);

  const offsetX = Math.round((canvasSize - fourViewWidth) / 2);
  const offsetY = Math.round((canvasSize - fourViewHeight) / 2);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.5;

  const frontOffsetY = offsetY;
  // 帽舌帽的帽檐底部与帽身底部对齐
  const isCap = template?.id === "cap";
  const backOffsetY = isCap ? offsetY + (frontRows - backRows) * CELL_SIZE : offsetY;
  const leftSleeveOffsetY = offsetY + upperHeight + GAP;
  const rightSleeveOffsetY = offsetY + upperHeight + GAP;

  const views = [
    { x: offsetX, y: frontOffsetY, cols: VIEW_COLS, rows: frontRows, mask: template.views.front },
    { x: offsetX + VIEW_WIDTH + GAP, y: backOffsetY, cols: VIEW_COLS, rows: backRows, mask: template.views.back },
    ...(hasSleeves ? [
      { x: offsetX, y: leftSleeveOffsetY, cols: VIEW_COLS, rows: leftSleeveRows, mask: template.views.leftSleeve },
      { x: offsetX + VIEW_WIDTH + GAP, y: rightSleeveOffsetY, cols: VIEW_COLS, rows: rightSleeveRows, mask: template.views.rightSleeve },
    ] : []),
  ];

  for (const v of views) {
    if (!v.mask || !v.mask[0]) continue;
    for (let row = 0; row < v.rows; row++) {
      for (let col = 0; col < v.cols; col++) {
        if (v.mask[row] && v.mask[row][col]) {
          const cellX = v.x + col * CELL_SIZE + 0.5;
          const cellY = v.y + row * CELL_SIZE + 0.5;
          ctx.strokeRect(cellX, cellY, CELL_SIZE - 1, CELL_SIZE - 1);
        }
      }
    }
  }

  // 绘制裤腿间隙线（短裤和长裤）
  const pantsTemplates = ["shorts", "long-pants"];
  if (pantsTemplates.includes(template?.id)) {
    const gapWidth = SUB_SIZE / 5 * 2;
    const centerX = offsetX + VIEW_COLS * CELL_SIZE / 2;
    
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = gapWidth;
    ctx.lineCap = "butt";
    ctx.globalAlpha = 1;
    
    const frontMask = template?.views?.front;
    if (frontMask) {
      const startRow = 3;
      const endRow = frontMask.length;
      const startY = frontOffsetY + startRow * CELL_SIZE;
      const endY = frontOffsetY + endRow * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(centerX, startY);
      ctx.lineTo(centerX, endY);
      ctx.stroke();
    }
    
    const backMask = template?.views?.back;
    if (backMask) {
      const startRow = 3;
      const endRow = backMask.length;
      const startY = backOffsetY + startRow * CELL_SIZE;
      const endY = backOffsetY + endRow * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(centerX + VIEW_WIDTH + GAP, startY);
      ctx.lineTo(centerX + VIEW_WIDTH + GAP, endY);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function isWhiteColor(rgb) {
  return rgb[0] >= 230 && rgb[1] >= 230 && rgb[2] >= 230;
}

function drawOpenFront(ctx, x, y, cols, rows, mask, innerColor, extendsBelow = false) {
  if (!mask) return;
  const [ir, ig, ib] = innerColor;

  ctx.save();

  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (mask[row] && mask[row][col]) {
        ctx.rect(x + col * CELL_SIZE, y + row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }
  ctx.clip();

  const centerCol = Math.floor(cols / 2);
  const stripeWidth = CELL_SIZE * 1.4;
  const stripeX = x + centerCol * CELL_SIZE - stripeWidth / 2;

  let topRow = rows;
  let bottomRow = -1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (mask[row] && mask[row][col]) {
        topRow = Math.min(topRow, row);
        bottomRow = Math.max(bottomRow, row);
      }
    }
  }
  if (bottomRow < 0) {
    ctx.restore();
    return;
  }

  const startY = y + topRow * CELL_SIZE;
  const endY = y + (bottomRow + 1) * CELL_SIZE;
  const stripeH = endY - startY;

  if (extendsBelow) {
    ctx.fillStyle = `rgb(${ir},${ig},${ib})`;
    ctx.fillRect(stripeX, startY, stripeWidth, stripeH);
  }

  ctx.strokeStyle = `rgb(${Math.max(0, ir - 50)}, ${Math.max(0, ig - 50)}, ${Math.max(0, ib - 50)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(stripeX, startY);
  ctx.lineTo(stripeX, endY);
  ctx.moveTo(stripeX + stripeWidth, startY);
  ctx.lineTo(stripeX + stripeWidth, endY);
  ctx.stroke();

  ctx.restore();
}

function drawInnerLayerHem(ctx, x, y, cols, rows, mask, innerColor, stripeDirection, stripeColor) {
  if (!mask) return;
  const [ir, ig, ib] = innerColor;
  const hasStripe = stripeDirection && stripeDirection !== "null" && stripeColor;
  const [sr, sg, sb] = stripeColor || [255, 255, 255];

  ctx.save();

  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (mask[row] && mask[row][col]) {
        ctx.rect(x + col * CELL_SIZE, y + row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }
  ctx.clip();

  const bottomRow = rows - 1;
  let hemStartCol = cols, hemEndCol = -1;
  for (let col = 0; col < cols; col++) {
    if (mask[bottomRow] && mask[bottomRow][col]) {
      hemStartCol = Math.min(hemStartCol, col);
      hemEndCol = Math.max(hemEndCol, col);
    }
  }
  if (hemEndCol < 0) {
    ctx.restore();
    return;
  }

  const hemHeight = CELL_SIZE;
  const hemY = y + (rows - 1) * CELL_SIZE;
  const hemX = x + hemStartCol * CELL_SIZE;
  const hemW = (hemEndCol - hemStartCol + 1) * CELL_SIZE;

  ctx.fillStyle = `rgb(${ir},${ig},${ib})`;
  ctx.fillRect(hemX, hemY, hemW, hemHeight);

  if (hasStripe) {
    if (stripeDirection === "vertical") {
      const stripeCount = 5;
      const gap = hemW / stripeCount;
      ctx.fillStyle = `rgb(${sr},${sg},${sb})`;
      for (let i = 0; i < stripeCount; i++) {
        const stripeX = hemX + i * gap + gap * 0.4;
        ctx.fillRect(stripeX, hemY, SUB_SIZE * 0.2, hemHeight);
      }
    } else if (stripeDirection === "horizontal") {
      ctx.fillStyle = `rgb(${sr},${sg},${sb})`;
      for (let i = 0; i < 3; i++) {
        const stripeY = hemY + hemHeight * 0.2 + i * hemHeight * 0.25;
        ctx.fillRect(hemX, stripeY, hemW, SUB_SIZE * 0.15);
      }
    }
  }

  ctx.restore();
}

function drawInnerLayerCuff(ctx, x, y, cols, rows, mask, innerColor, stripeDirection, stripeColor) {
  if (!mask) return;
  const [ir, ig, ib] = innerColor;
  const hasStripe = stripeDirection && stripeDirection !== "null" && stripeColor;
  const [sr, sg, sb] = stripeColor || [255, 255, 255];

  ctx.save();

  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (mask[row] && mask[row][col]) {
        ctx.rect(x + col * CELL_SIZE, y + row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }
  ctx.clip();

  const bottomRow = rows - 1;
  let cuffStartCol = cols, cuffEndCol = -1;
  for (let col = 0; col < cols; col++) {
    if (mask[bottomRow] && mask[bottomRow][col]) {
      cuffStartCol = Math.min(cuffStartCol, col);
      cuffEndCol = Math.max(cuffEndCol, col);
    }
  }
  if (cuffEndCol < 0) {
    ctx.restore();
    return;
  }

  const cuffY = y + (rows - 1) * CELL_SIZE;
  const cuffHeight = CELL_SIZE;
  const cuffX = x + cuffStartCol * CELL_SIZE;
  const cuffW = (cuffEndCol - cuffStartCol + 1) * CELL_SIZE;

  ctx.fillStyle = `rgb(${ir},${ig},${ib})`;
  ctx.fillRect(cuffX, cuffY, cuffW, cuffHeight);

  if (hasStripe) {
    if (stripeDirection === "horizontal") {
      ctx.fillStyle = `rgb(${sr},${sg},${sb})`;
      for (let i = 0; i < 2; i++) {
        const stripeY = cuffY + cuffHeight * 0.25 + i * cuffHeight * 0.35;
        ctx.fillRect(cuffX, stripeY, cuffW, SUB_SIZE * 0.15);
      }
    } else if (stripeDirection === "vertical") {
      const stripeCount = 3;
      const gap = cuffW / stripeCount;
      ctx.fillStyle = `rgb(${sr},${sg},${sb})`;
      for (let i = 0; i < stripeCount; i++) {
        const stripeX = cuffX + i * gap + gap * 0.4;
        ctx.fillRect(stripeX, cuffY, SUB_SIZE * 0.2, cuffHeight);
      }
    }
  }

  ctx.restore();
}

function drawCuffDetails(ctx, x, y, cols, rows, mask, cuffStyle, cuffColor, cuffButton, mainColor, cuffPattern, cuffPatternColor) {
  if (!mask) return;
  if (!cuffStyle && !cuffButton) return;
  if (cuffStyle === "无特殊设计" && !cuffButton) return;

  const bottomRow = rows - 1;
  let cuffStartCol = cols, cuffEndCol = -1;
  for (let col = 0; col < cols; col++) {
    if (mask[bottomRow] && mask[bottomRow][col]) {
      cuffStartCol = Math.min(cuffStartCol, col);
      cuffEndCol = Math.max(cuffEndCol, col);
    }
  }
  if (cuffEndCol < 0) return;

  const cuffX = x + cuffStartCol * CELL_SIZE;
  const cuffW = (cuffEndCol - cuffStartCol + 1) * CELL_SIZE;
  const cuffY = y + bottomRow * CELL_SIZE;

  ctx.save();

  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (mask[row] && mask[row][col]) {
        ctx.rect(x + col * CELL_SIZE, y + row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }
  ctx.clip();

  const cuffHeight = CELL_SIZE;

  if (cuffStyle === "翻边") {
    const [r, g, b] = cuffColor || mainColor || [128, 128, 128];
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(cuffX, cuffY, cuffW, cuffHeight);

    ctx.strokeStyle = `rgb(${Math.max(0, r - 30)},${Math.max(0, g - 30)},${Math.max(0, b - 30)})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(cuffX, cuffY, cuffW, cuffHeight);
  } else if (cuffStyle === "松紧" || cuffStyle === "罗纹") {
    const [r, g, b] = cuffColor || mainColor || [128, 128, 128];
    const ribCount = 5;
    const ribWidth = cuffW / ribCount;

    for (let i = 0; i < ribCount; i++) {
      const ribX = cuffX + i * ribWidth;
      const isLight = i % 2 === 0;
      if (isLight) {
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        ctx.fillStyle = `rgb(${Math.max(0, r - 30)},${Math.max(0, g - 30)},${Math.max(0, b - 30)})`;
      }
      ctx.fillRect(ribX, cuffY, ribWidth, cuffHeight);
    }

    ctx.strokeStyle = `rgb(${Math.max(0, r - 40)},${Math.max(0, g - 40)},${Math.max(0, b - 40)})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(cuffX, cuffY, cuffW, cuffHeight);
  } else if (cuffStyle === "收口") {
    const [r, g, b] = cuffColor || mainColor || [128, 128, 128];
    ctx.fillStyle = `rgb(${Math.max(0, r - 20)},${Math.max(0, g - 20)},${Math.max(0, b - 20)})`;
    ctx.fillRect(cuffX, cuffY, cuffW, cuffHeight);

    ctx.strokeStyle = `rgb(${Math.max(0, r - 40)},${Math.max(0, g - 40)},${Math.max(0, b - 40)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cuffX, cuffY);
    ctx.lineTo(cuffX + cuffW, cuffY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cuffX, cuffY + cuffHeight);
    ctx.lineTo(cuffX + cuffW, cuffY + cuffHeight);
    ctx.stroke();
  } else if (cuffStyle === "条纹") {
    const [r, g, b] = cuffColor || mainColor || [128, 128, 128];
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(cuffX, cuffY, cuffW, cuffHeight);
    
    const [pr, pg, pb] = cuffPatternColor || [255, 255, 255];
    const stripeCount = 3;
    const stripeGap = cuffHeight / (stripeCount + 1);

    for (let i = 1; i <= stripeCount; i++) {
      const stripeY = cuffY + i * stripeGap;
      ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
      ctx.fillRect(cuffX, stripeY - SUB_SIZE * 0.15, cuffW, SUB_SIZE * 0.3);
    }
  } else if (cuffStyle === "印花") {
    const [pr, pg, pb] = cuffPatternColor || mainColor || [128, 128, 128];
    const dotCount = 4;
    const dotGap = cuffW / (dotCount + 1);

    ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
    for (let i = 1; i <= dotCount; i++) {
      const dotX = cuffX + i * dotGap;
      const dotY = cuffY + cuffHeight / 2;
      ctx.beginPath();
      ctx.arc(dotX, dotY, SUB_SIZE * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (cuffStyle === "纽扣") {
    const [r, g, b] = cuffColor || mainColor || [128, 128, 128];

    ctx.strokeStyle = `rgb(${Math.max(0, r - 40)},${Math.max(0, g - 40)},${Math.max(0, b - 40)})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(cuffX, cuffY, cuffW, cuffHeight);

    const buttonCount = 2;
    const buttonGap = cuffW / (buttonCount + 1);
    for (let i = 1; i <= buttonCount; i++) {
      const buttonX = cuffX + i * buttonGap;
      const buttonY = cuffY + cuffHeight / 2;
      const buttonR = SUB_SIZE * 0.4;

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.arc(buttonX, buttonY, buttonR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgb(${Math.max(0, r - 50)},${Math.max(0, g - 50)},${Math.max(0, b - 50)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(buttonX, buttonY, buttonR, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (cuffPattern) {
    const [pr, pg, pb] = cuffPatternColor || mainColor || [128, 128, 128];
    const cuffHeight = CELL_SIZE * 0.8;

    if (cuffPattern.includes("条纹")) {
      const stripeCount = 3;
      const stripeGap = cuffHeight / stripeCount;
      for (let i = 0; i < stripeCount; i++) {
        const stripeY = cuffY + i * stripeGap + stripeGap * 0.3;
        ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
        ctx.fillRect(cuffX, stripeY, cuffW, SUB_SIZE * 0.2);
      }
    } else if (cuffPattern.includes("格子")) {
      const gridCount = 3;
      const gridW = cuffW / gridCount;
      const gridH = cuffHeight / gridCount;
      ctx.strokeStyle = `rgb(${pr},${pg},${pb})`;
      ctx.lineWidth = 1;
      for (let i = 0; i <= gridCount; i++) {
        ctx.beginPath();
        ctx.moveTo(cuffX + i * gridW, cuffY);
        ctx.lineTo(cuffX + i * gridW, cuffY + cuffHeight);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cuffX, cuffY + i * gridH);
        ctx.lineTo(cuffX + cuffW, cuffY + i * gridH);
        ctx.stroke();
      }
    } else if (cuffPattern.includes("印花")) {
      const dotCount = 5;
      const dotGap = cuffW / (dotCount + 1);
      ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
      for (let i = 1; i <= dotCount; i++) {
        const dotX = cuffX + i * dotGap;
        const dotY = cuffY + cuffHeight / 2;
        ctx.beginPath();
        ctx.arc(dotX, dotY, SUB_SIZE * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (cuffButton) {
    const [r, g, b] = cuffColor || mainColor || [128, 128, 128];
    const cuffHeight = CELL_SIZE * 0.7;

    ctx.strokeStyle = `rgb(${Math.max(0, r - 40)},${Math.max(0, g - 40)},${Math.max(0, b - 40)})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(cuffX, cuffY, cuffW, cuffHeight);

    const buttonCount = 2;
    const buttonGap = cuffW / (buttonCount + 1);
    for (let i = 1; i <= buttonCount; i++) {
      const buttonX = cuffX + i * buttonGap;
      const buttonY = cuffY + cuffHeight / 2;
      const buttonR = SUB_SIZE * 0.45;

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.arc(buttonX, buttonY, buttonR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgb(${Math.max(0, r - 60)},${Math.max(0, g - 60)},${Math.max(0, b - 60)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(buttonX, buttonY, buttonR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgb(${Math.max(0, r - 30)},${Math.max(0, g - 30)},${Math.max(0, b - 30)})`;
      ctx.beginPath();
      ctx.arc(buttonX, buttonY, buttonR * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

// 绘制空白视图（放大时显示小格子和小小格子）
function drawView(ctx, x, y, cols, rows, mask, showSubGrid, subOffset = 0) {
  if (!mask) return;

  x = Math.round(x);
  y = Math.round(y);
  const offsetX = subOffset * SUB_SIZE;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (mask[row] && mask[row][col]) {
        const cellX = x + col * CELL_SIZE + offsetX;
        const cellY = y + row * CELL_SIZE;

        if (showSubGrid) {
          drawSubGrid(ctx, cellX, cellY);
        } else {
          drawSolidCell(ctx, cellX, cellY, 240, 240, 240);
        }
      }
    }
  }
}

// 绘制填充视图（放大时显示小格子和小小格子）
function drawFilledView(ctx, x, y, cols, rows, mask, viewData, mainColor, showSubGrid, subOffset = 0) {
  if (!mask) return;

  x = Math.round(x);
  y = Math.round(y);
  const offsetX = subOffset * SUB_SIZE;
  const [mr, mg, mb] = mainColor;

  // 检查主色是否为白色
  const isMainWhite = mr > 245 && mg > 245 && mb > 245;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!mask[row] || !mask[row][col]) continue;

      // 防御性检查：确保col和row在mask的实际范围内
      const actualCols = mask[row]?.length || 0;
      if (col >= actualCols) continue;

      const idx = row * cols + col;
      let pixel = null;

      if (viewData?.pixels) {
        const p = viewData.pixels[idx];
        if (p && Array.isArray(p) && p.length === 3 &&
            typeof p[0] === 'number' && typeof p[1] === 'number' && typeof p[2] === 'number') {
          // 严格防御：如果颜色是纯背景灰[85,85,85]但mask=true，一定是错误数据
          const isBackgroundGray = p[0] === 85 && p[1] === 85 && p[2] === 85;
          // 严格防御：如果颜色是白色但主色不是白色，可能是错误数据
          const isUnexpectedWhite = !isMainWhite && (p[0] > 248 && p[1] > 248 && p[2] > 248);
          
          if (!isBackgroundGray && !isUnexpectedWhite) {
            pixel = p;
          }
        }
      }

      const [r, g, b] = pixel || [mr, mg, mb];
      const cellX = x + col * CELL_SIZE + offsetX;
      const cellY = y + row * CELL_SIZE;

      if (showSubGrid) {
        drawSubGridOnColor(ctx, cellX, cellY, r, g, b);
      } else {
        drawSolidCell(ctx, cellX, cellY, r, g, b);
      }
    }
  }
}

function drawBodyVerticalStripes(ctx, x, y, cols, rows, mask, stripeRgb, stripeCount) {
  if (!mask) return;
  const [sr, sg, sb] = stripeRgb;
  const stripeW = SUB_SIZE;
  const count = stripeCount && stripeCount > 0 ? Math.min(stripeCount, 12) : 6;

  ctx.save();
  
  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (mask[row] && mask[row][col]) {
        ctx.rect(x + col * CELL_SIZE, y + row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }
  ctx.clip();

  const spacing = (cols * CELL_SIZE) / (count + 1);
  
  for (let i = 1; i <= count; i++) {
    const sx = x + i * spacing - stripeW / 2;
    ctx.fillStyle = `rgb(${sr},${sg},${sb})`;
    ctx.fillRect(Math.round(sx), y, Math.ceil(stripeW), rows * CELL_SIZE);
  }

  ctx.restore();
}

function drawSleeveVerticalStripes(ctx, x, y, cols, rows, mask, side, stripeRgb, stripeCount) {
  if (!mask) return;
  const [sr, sg, sb] = stripeRgb;
  const stripeW = SUB_SIZE;
  const count = stripeCount && stripeCount > 0 ? Math.min(stripeCount, 5) : 3;

  ctx.save();

  for (let row = 0; row < rows; row++) {
    let rowMin = cols, rowMax = -1;
    for (let col = 0; col < cols; col++) {
      if (mask[row] && mask[row][col]) {
        rowMin = Math.min(rowMin, col);
        rowMax = Math.max(rowMax, col);
      }
    }
    if (rowMax < 0) continue;

    const rowW = rowMax - rowMin + 1;
    if (rowW < 5) continue;

    let stripeCols = [];
    let center;
    if (side === "left") {
      center = rowMin + rowW * 0.35;
    } else {
      center = rowMax - rowW * 0.35;
    }
    
    if (count === 1) {
      stripeCols = [center];
    } else if (count === 2) {
      stripeCols = [center - 0.7, center + 0.7];
    } else if (count === 3) {
      stripeCols = [center - 1, center, center + 1];
    } else if (count === 4) {
      stripeCols = [center - 1.5, center - 0.5, center + 0.5, center + 1.5];
    } else {
      stripeCols = [center - 2, center - 1, center, center + 1, center + 2];
    }

    for (const sc of stripeCols) {
      const sx = x + sc * CELL_SIZE;
      const sy = y + row * CELL_SIZE;
      
      for (let mr = 0; mr < SUB_DIV; mr++) {
        const subY = sy + mr * SUB_SIZE;
        const cellRow = Math.floor((subY - y) / CELL_SIZE);
        const cellCol = Math.floor((sx - x) / CELL_SIZE);
        
        if (cellRow >= 0 && cellRow < rows && cellCol >= 0 && cellCol < cols) {
          if (mask[cellRow] && mask[cellRow][cellCol]) {
            ctx.fillStyle = `rgb(${sr},${sg},${sb})`;
            ctx.fillRect(Math.round(sx), Math.round(subY), Math.ceil(stripeW), Math.ceil(SUB_SIZE));
          }
        }
      }
    }
  }

  ctx.restore();
}

function getMaskCentroid(mask, cols, rows) {
  if (!mask || !mask[0]) return { col: Math.floor(cols / 2), row: Math.floor(rows / 2) };
  let minRow = rows, maxRow = 0, minCol = cols, maxCol = 0;
  let hasAny = false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r] && mask[r][c]) {
        hasAny = true;
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
      }
    }
  }
  if (!hasAny) return { col: Math.floor(cols / 2), row: Math.floor(rows / 2) };
  return { col: (minCol + maxCol) / 2, row: (minRow + maxRow) / 2 };
}

function drawSubPixelLogo(ctx, x, y, cols, rows, mask, logoRgb, logoType, logoShape, layoutLogo, templateType = null) {
  if (!mask) return;
  let [lr, lg, lb] = logoRgb;

  let centerCol, centerRow;
  let isBeanieBottomCenter = false;
  if (layoutLogo && layoutLogo.row !== undefined && layoutLogo.col !== undefined) {
    centerCol = Math.max(0, Math.min(cols - 1, layoutLogo.col));
    centerRow = Math.max(0, Math.min(rows - 1, layoutLogo.row));
  } else if (templateType === "beanie") {
    // 针织帽的logo位于正面底部2行中间，大小占2行2列
    let bottomRow = -1;
    let minCol = cols, maxCol = -1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (mask[r] && mask[r][c]) {
          bottomRow = r;
          minCol = Math.min(minCol, c);
          maxCol = Math.max(maxCol, c);
        }
      }
    }
    centerRow = bottomRow >= 1 ? bottomRow - 0.5 : Math.floor(rows / 2);
    centerCol = minCol <= maxCol ? (minCol + maxCol) / 2 : Math.floor(cols / 2);
    isBeanieBottomCenter = true;
  } else {
    const centroid = getMaskCentroid(mask, cols, rows);
    centerCol = Math.round(centroid.col);
    centerRow = Math.round(centroid.row);
  }
  let logoCenterCol = centerCol;
  let logoCenterRow = centerRow;
  if (!isBeanieBottomCenter && !(centerRow < rows && centerCol < cols && mask[centerRow] && mask[centerRow][centerCol])) {
    let bestDist = Infinity;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (mask[r] && mask[r][c]) {
          const dist = (r - centerRow) ** 2 + (c - centerCol) ** 2;
          if (dist < bestDist) {
            bestDist = dist;
            logoCenterCol = c;
            logoCenterRow = r;
          }
        }
      }
    }
  }
  if (!isBeanieBottomCenter && logoCenterRow < rows && logoCenterCol < cols && mask[logoCenterRow] && mask[logoCenterRow][logoCenterCol]) {
    centerCol = logoCenterCol;
    centerRow = logoCenterRow;
  }

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  // 使用更可靠的裁剪路径创建方式
  ctx.beginPath();
  let started = false;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (mask[row] && mask[row][col]) {
        const rx = x + col * CELL_SIZE;
        const ry = y + row * CELL_SIZE;
        if (!started) {
          ctx.moveTo(rx, ry);
          started = true;
        }
        ctx.rect(rx, ry, CELL_SIZE, CELL_SIZE);
      }
    }
  }
  ctx.closePath();
  ctx.clip();

  const logoX = x + centerCol * CELL_SIZE;
  const logoY = y + centerRow * CELL_SIZE;
  // 针织帽logo占2行2列，其他保持默认
  const size = templateType === "beanie" ? CELL_SIZE * 2 : CELL_SIZE * 1.2;

  if (logoType === "adidas") {
    const totalMicroCols = cols * SUB_DIV * MICRO_DIV;
    const cloverPixels = [];
    const template = ADIDAS_CLOVER;

    for (const [colR, rowStart, rowEnd] of template.ranges) {
      for (let r = rowStart; r <= rowEnd; r++) {
        cloverPixels.push([colR, r]);
      }
    }
    for (const [colStart, colEnd, row] of template.hlines) {
      for (let c = colStart; c <= colEnd; c++) {
        cloverPixels.push([c, row]);
      }
    }

    for (const [colR, rowM] of cloverPixels) {
      const colL = totalMicroCols - colR + 1 + template.colOffset;
      const microX = x + (colL - 1) * MICRO_SIZE;
      const microY = y + (rowM - 1 + template.rowOffset) * MICRO_SIZE;

      const cellRow = Math.floor((microY - y) / CELL_SIZE);
      const cellCol = Math.floor((microX - x) / CELL_SIZE);

      if (cellRow >= 0 && cellRow < rows && cellCol >= 0 && cellCol < cols) {
        if (mask[cellRow] && mask[cellRow][cellCol]) {
          ctx.fillStyle = `rgb(${lr},${lg},${lb})`;
          ctx.fillRect(
            Math.round(microX),
            Math.round(microY),
            Math.ceil(MICRO_SIZE),
            Math.ceil(MICRO_SIZE)
          );
        }
      }
    }
  } else if (logoType === "nike" || logoType === "swoosh") {
    ctx.fillStyle = `rgb(${lr},${lg},${lb})`;
    ctx.beginPath();
    ctx.moveTo(logoX, logoY + size * 0.5);
    ctx.quadraticCurveTo(logoX + size * 0.3, logoY + size * 0.2, logoX + size, logoY);
    ctx.quadraticCurveTo(logoX + size * 0.3, logoY + size * 0.5, logoX, logoY + size * 0.5);
    ctx.closePath();
    ctx.fill();
  } else if (logoType === "star") {
    ctx.fillStyle = `rgb(${lr},${lg},${lb})`;
    drawStar(ctx, logoX + CELL_SIZE * 0.5, logoY + CELL_SIZE * 0.5, size * 0.5, size * 0.25, 5);
  } else if (logoType === "text" || logoType === "letter") {
    ctx.fillStyle = `rgb(${lr},${lg},${lb})`;
    ctx.font = `bold ${Math.round(size * 0.6)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let displayText = "LOGO";
    if (logoShape) {
      const letterMatch = logoShape.match(/[A-Za-z]{1,6}/);
      if (letterMatch) {
        displayText = letterMatch[0].toUpperCase().substring(0, 4);
      } else if (logoShape.includes("字母") || logoShape.includes("文字")) {
        displayText = "ABC";
      }
    }
    ctx.fillText(displayText, logoX + CELL_SIZE * 0.5, logoY + CELL_SIZE * 0.55);
  } else if (logoType === "emblem" || logoShape?.includes("徽章") || logoShape?.includes("盾") || logoShape?.includes("标")) {
    ctx.strokeStyle = `rgb(${lr},${lg},${lb})`;
    ctx.lineWidth = SUB_SIZE * 0.25;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const cx = logoX + CELL_SIZE * 0.5;
    const cy = logoY + CELL_SIZE * 0.5;
    const r = size * 0.4;

    ctx.beginPath();
    ctx.moveTo(cx - r * 0.6, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.6, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.7, cy);
    ctx.lineTo(cx + r * 0.5, cy + r * 0.6);
    ctx.lineTo(cx, cy + r * 0.8);
    ctx.lineTo(cx - r * 0.5, cy + r * 0.6);
    ctx.lineTo(cx - r * 0.7, cy);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - r * 0.3, cy - r * 0.1);
    ctx.lineTo(cx, cy + r * 0.3);
    ctx.lineTo(cx + r * 0.3, cy - r * 0.1);
    ctx.stroke();
  } else {
    ctx.strokeStyle = `rgb(${lr},${lg},${lb})`;
    ctx.lineWidth = SUB_SIZE * 0.25;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const cx = logoX + CELL_SIZE * 0.5;
    const cy = logoY + CELL_SIZE * 0.5;
    const r = size * 0.4;

    if (logoShape && logoShape.includes("三角")) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx - r * 0.866, cy + r * 0.5);
      ctx.lineTo(cx + r * 0.866, cy + r * 0.5);
      ctx.closePath();
      ctx.stroke();
    } else if (logoShape && logoShape.includes("菱形")) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.stroke();
    } else if (logoShape && logoShape.includes("皇冠")) {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy);
      ctx.lineTo(cx - r * 0.3, cy - r * 0.8);
      ctx.lineTo(cx, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.3, cy - r * 0.8);
      ctx.lineTo(cx + r * 0.5, cy);
      ctx.lineTo(cx + r * 0.4, cy + r * 0.3);
      ctx.lineTo(cx - r * 0.4, cy + r * 0.3);
      ctx.closePath();
      ctx.stroke();
    } else if (logoShape && logoShape.includes("马")) {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.3, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.3, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.5, cy);
      ctx.lineTo(cx + r * 0.2, cy + r * 0.3);
      ctx.lineTo(cx - r * 0.4, cy + r * 0.2);
      ctx.closePath();
      ctx.stroke();
    } else if (logoShape && logoShape.includes("叶子")) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.quadraticCurveTo(cx + r * 0.7, cy - r * 0.3, cx + r * 0.5, cy + r * 0.3);
      ctx.quadraticCurveTo(cx, cy + r * 0.5, cx - r * 0.5, cy + r * 0.3);
      ctx.quadraticCurveTo(cx - r * 0.7, cy - r * 0.3, cx, cy - r);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.3);
      ctx.lineTo(cx, cy + r * 0.2);
      ctx.stroke();
    } else if (logoShape && logoShape.includes("箭头")) {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.6, cy);
      ctx.lineTo(cx + r * 0.4, cy);
      ctx.lineTo(cx + r * 0.1, cy - r * 0.3);
      ctx.moveTo(cx + r * 0.4, cy);
      ctx.lineTo(cx + r * 0.1, cy + r * 0.3);
      ctx.stroke();
    } else if (logoShape && logoShape.includes("K")) {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.2, cy - r * 0.5);
      ctx.lineTo(cx - r * 0.2, cy + r * 0.4);
      ctx.moveTo(cx - r * 0.2, cy - r * 0.1);
      ctx.lineTo(cx + r * 0.4, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.2, cy + r * 0.1);
      ctx.lineTo(cx + r * 0.4, cy + r * 0.4);
      ctx.stroke();
    } else if (logoShape && logoShape.includes("心")) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.2);
      ctx.bezierCurveTo(cx + r * 0.6, cy - r * 0.8, cx + r * 0.8, cy + r * 0.1, cx, cy + r * 0.5);
      ctx.bezierCurveTo(cx - r * 0.8, cy + r * 0.1, cx - r * 0.6, cy - r * 0.8, cx, cy - r * 0.2);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawStar(ctx, cx, cy, outerR, innerR, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawPrintPattern(ctx, x, y, cols, rows, mask, pattern, templateType = null) {
  if (!mask) return;
  const [r, g, b] = pattern.color;
  const type = pattern.type;
  const position = pattern.position;

  // 条纹有单独的处理逻辑，不在此处绘制
  if (type.includes("条纹")) return;

  // 花边/荷叶边/蕾丝通常是AI误识别的，跳过不画
  if (type.includes("花边") || type.includes("荷叶边") || type.includes("蕾丝") || type.includes("波浪边") || type.includes("装饰边")) return;

  ctx.save();

  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (mask[row] && mask[row][col]) {
        ctx.rect(x + col * CELL_SIZE, y + row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }
  ctx.clip();

  // 计算mask中实际可见的行范围，避免袖子mask顶部有空行导致定位错误
  let minVisibleRow = rows, maxVisibleRow = -1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (mask[row] && mask[row][col]) {
        minVisibleRow = Math.min(minVisibleRow, row);
        maxVisibleRow = Math.max(maxVisibleRow, row);
        break;
      }
    }
  }
  const visibleRows = maxVisibleRow >= minVisibleRow ? maxVisibleRow - minVisibleRow + 1 : rows;
  const rowOffset = minVisibleRow;

  // 可见列范围
  let minVisibleCol = cols, maxVisibleCol = -1;
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      if (mask[row] && mask[row][col]) {
        minVisibleCol = Math.min(minVisibleCol, col);
        maxVisibleCol = Math.max(maxVisibleCol, col);
        break;
      }
    }
  }
  const visibleCols = maxVisibleCol >= minVisibleCol ? maxVisibleCol - minVisibleCol + 1 : cols;
  const colOffset = minVisibleCol;

  // 把相对可见区域的坐标转换为绝对坐标
  const toAbsoluteRow = (relRow) => rowOffset + relRow;
  const toAbsoluteCol = (relCol) => colOffset + relCol;

  // 统一的位置计算函数：基于可见区域计算centerCol和centerRow
  // pos: "左"/"右"/"中"/"上"/"下"/组合
  // 返回 {col, row} 基于绝对网格坐标
  const calcCenter = (pos) => {
    let relCol, relRow;
    const centerLineRelCol = Math.floor(visibleCols / 2);

    if (pos.includes("左")) {
      relCol = Math.floor(visibleCols * 0.25);
    } else if (pos.includes("右")) {
      relCol = Math.floor(visibleCols * 0.75);
    } else if (pos.includes("中间") || pos.includes("中")) {
      relCol = Math.floor(visibleCols * 0.3);
    } else {
      relCol = Math.floor(visibleCols * 0.45);
    }

    // 避免落在中心线上
    if (Math.abs(relCol - centerLineRelCol) < 1.5) {
      if (relCol <= centerLineRelCol) {
        relCol = Math.max(1, relCol - 1);
      } else {
        relCol = Math.min(visibleCols - 2, relCol + 1);
      }
    }

    if (pos.includes("上")) {
      relRow = visibleRows <= 2 ? 0 : Math.min(2, visibleRows - 1);
    } else if (pos.includes("下")) {
      relRow = Math.floor(visibleRows * 0.7);
    } else {
      relRow = Math.floor(visibleRows * 0.4);
    }

    return {
      col: toAbsoluteCol(relCol),
      row: toAbsoluteRow(relRow),
      cx: x + toAbsoluteCol(relCol) * CELL_SIZE + CELL_SIZE / 2,
      cy: y + toAbsoluteRow(relRow) * CELL_SIZE + CELL_SIZE / 2,
    };
  };

  ctx.fillStyle = `rgb(${r},${g},${b})`;

  const isFullBody = position.includes("全身") || position.includes("满") || position.includes("遍布");

  if (type.includes("圆点") && isFullBody) {
    const dotRadius = CELL_SIZE * 0.35;
    const spacing = CELL_SIZE * 2;
    
    for (let sy = spacing / 2; sy < rows * CELL_SIZE; sy += spacing) {
      for (let sx = spacing / 2; sx < cols * CELL_SIZE; sx += spacing) {
        const offsetX = (Math.floor(sy / spacing) % 2) * (spacing / 2);
        const px = x + sx + offsetX;
        const py = y + sy;
        
        const col = Math.floor((px - x) / CELL_SIZE);
        const row = Math.floor((py - y) / CELL_SIZE);
        
        if (row >= 0 && row < rows && col >= 0 && col < cols && mask[row] && mask[row][col]) {
          ctx.beginPath();
          ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else if ((type.includes("大花") || type.includes("大朵花")) && isFullBody) {
    const bigSpacing = CELL_SIZE * 1.8;
    const allItems = [];
    
    for (let sy = bigSpacing / 2; sy < rows * CELL_SIZE; sy += bigSpacing) {
      for (let sx = bigSpacing / 2; sx < cols * CELL_SIZE; sx += bigSpacing) {
        const offsetX = (Math.floor(sy / bigSpacing) % 2) * (bigSpacing / 2);
        const px = x + sx + offsetX;
        const py = y + sy;
        
        const col = Math.floor((px - x) / CELL_SIZE);
        const row = Math.floor((py - y) / CELL_SIZE);
        
        if (row >= 0 && row < rows && col >= 0 && col < cols && mask[row] && mask[row][col]) {
          allItems.push({ px, py, row, col });
        }
      }
    }
    
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      if (i % 3 === 0) {
        drawLeaf(ctx, item.px - CELL_SIZE * 0.6, item.py - CELL_SIZE * 0.6, CELL_SIZE * 1.2);
      } else {
        drawBigFlower(ctx, item.px - CELL_SIZE * 0.6, item.py - CELL_SIZE * 0.6, CELL_SIZE * 1.2);
      }
    }
  } else if (type.includes("叶子") && isFullBody) {
    const leafSpacing = CELL_SIZE * 2.5;
    
    for (let sy = leafSpacing / 2; sy < rows * CELL_SIZE; sy += leafSpacing) {
      for (let sx = leafSpacing / 2; sx < cols * CELL_SIZE; sx += leafSpacing) {
        const offsetX = (Math.floor(sy / leafSpacing) % 2) * (leafSpacing / 2);
        const px = x + sx + offsetX;
        const py = y + sy;
        
        const col = Math.floor((px - x) / CELL_SIZE);
        const row = Math.floor((py - y) / CELL_SIZE);
        
        if (row >= 0 && row < rows && col >= 0 && col < cols && mask[row] && mask[row][col]) {
          drawLeaf(ctx, px - CELL_SIZE * 0.75, py - CELL_SIZE * 0.75, CELL_SIZE * 1.5);
        }
      }
    }
  } else if ((type.includes("花") || type.includes("朵")) && isFullBody) {
    const spacing = CELL_SIZE * 2;
    
    for (let sy = spacing / 2; sy < rows * CELL_SIZE; sy += spacing) {
      for (let sx = spacing / 2; sx < cols * CELL_SIZE; sx += spacing) {
        const offsetX = (Math.floor(sy / spacing) % 2) * (spacing / 2);
        const px = x + sx + offsetX;
        const py = y + sy;
        
        const col = Math.floor((px - x) / CELL_SIZE);
        const row = Math.floor((py - y) / CELL_SIZE);
        
        if (row >= 0 && row < rows && col >= 0 && col < cols && mask[row] && mask[row][col]) {
          drawFlower(ctx, px - CELL_SIZE / 2, py - CELL_SIZE / 2);
        }
      }
    }
  } else if (type.includes("领结") || type.includes("蝴蝶结")) {
    const centerX = x + cols * CELL_SIZE / 2;
    const tieY = y + CELL_SIZE * 2;
    drawBowtie(ctx, centerX, tieY);
  } else if (type.includes("蝴蝶")) {
    const { cx, cy } = calcCenter(position);
    drawButterfly(ctx, cx, cy);
  } else if (type.includes("星星") || type.includes("星")) {
    if (templateType === "beanie") {
      // 针织帽：星星在正面底部2行中间，大小占2行2列
      let bottomRow = -1;
      let minCol = cols, maxCol = -1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (mask[r] && mask[r][c]) {
            bottomRow = r;
            minCol = Math.min(minCol, c);
            maxCol = Math.max(maxCol, c);
          }
        }
      }
      centerRow = bottomRow >= 1 ? bottomRow - 0.5 : Math.floor(rows / 2);
      centerCol = minCol <= maxCol ? (minCol + maxCol) / 2 : Math.floor(cols / 2);

      const cx = x + centerCol * CELL_SIZE + CELL_SIZE / 2;
      const cy = y + centerRow * CELL_SIZE + CELL_SIZE / 2;
      const outerR = CELL_SIZE * 0.85; // 占2行2列大小
      drawStar(ctx, cx, cy, outerR, outerR * 0.4, 5);
    } else {
      const { cx, cy } = calcCenter(position);
      drawStar(ctx, cx, cy, CELL_SIZE * 0.4, CELL_SIZE * 0.16, 5);
    }
  } else if (type.includes("花") || type.includes("朵")) {
    const { cx, cy } = calcCenter(position);
    drawFlower(ctx, cx - CELL_SIZE / 2, cy - CELL_SIZE / 2);
  } else if (type.includes("圆点")) {
    const { cx, cy } = calcCenter(position);
    ctx.beginPath();
    ctx.arc(cx, cy, CELL_SIZE * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (type.includes("腊肠犬") || type.includes("达克斯") || (type.includes("狗") && (type.includes("长") || type.includes("香肠")))) {
    const { cx, cy } = calcCenter(position);
    drawDachshund(ctx, cx, cy, CELL_SIZE * 2);
  } else if (type.includes("狗") || type.includes("犬") || type.includes("小狗")) {
    const { cx, cy } = calcCenter(position);
    drawDoggy(ctx, cx, cy, CELL_SIZE * 1.8);
  } else if (type.includes("猫") || type.includes("小猫")) {
    const { cx, cy } = calcCenter(position);
    drawKitty(ctx, cx, cy, CELL_SIZE * 1.5);
  } else if (type.includes("熊") || type.includes("小熊")) {
    const { cx, cy } = calcCenter(position);
    drawBear(ctx, cx, cy, CELL_SIZE * 1.5);
  } else if (type.includes("爱心") || type.includes("心") || type.includes("桃心")) {
    const { cx, cy } = calcCenter(position);
    drawHeart(ctx, cx, cy, CELL_SIZE * 0.5);
  } else {
    const { cx, cy } = calcCenter(position);
    ctx.beginPath();
    ctx.ellipse(cx, cy, CELL_SIZE * 0.4, CELL_SIZE * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawButterfly(ctx, x, y) {
  const w = CELL_SIZE;
  const h = CELL_SIZE * 0.8;

  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.bezierCurveTo(x + w, y + h / 3, x + w, y + h, x + w / 2, y + h * 0.9);
  ctx.bezierCurveTo(x, y + h, x, y + h / 3, x + w / 2, y);
  ctx.fill();

  ctx.fillStyle = "rgb(255,255,255)";
  ctx.beginPath();
  ctx.arc(x + w / 2 - w * 0.15, y + h * 0.4, w * 0.1, 0, Math.PI * 2);
  ctx.arc(x + w / 2 + w * 0.15, y + h * 0.4, w * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawBowtie(ctx, x, y) {
  const size = CELL_SIZE * 0.8;
  const currentFillStyle = ctx.fillStyle;
  
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.3);
  ctx.bezierCurveTo(x - size * 0.6, y - size * 0.3, x - size * 0.8, y + size * 0.1, x - size * 0.4, y + size * 0.4);
  ctx.lineTo(x, y + size * 0.2);
  ctx.lineTo(x + size * 0.4, y + size * 0.4);
  ctx.bezierCurveTo(x + size * 0.8, y + size * 0.1, x + size * 0.6, y - size * 0.3, x, y - size * 0.3);
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.2);
  ctx.lineTo(x, y + size * 0.6);
  ctx.stroke();
  
  ctx.fillStyle = "rgb(255,255,255)";
  ctx.beginPath();
  ctx.arc(x, y + size * 0.25, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = currentFillStyle;
}

function drawRuffleEdge(ctx, x, y, w, h) {
  const ruffleHeight = h * 0.4;
  
  // 安全：如果当前填充颜色是深色（接近黑色），改用白色
  const currentFill = ctx.fillStyle;
  let isDark = false;
  if (typeof currentFill === "string" && currentFill.startsWith("rgb(")) {
    const parts = currentFill.match(/\d+/g);
    if (parts && parts.length >= 3) {
      const brightness = (parseInt(parts[0]) * 299 + parseInt(parts[1]) * 587 + parseInt(parts[2]) * 114) / 1000;
      if (brightness < 60) isDark = true;
    }
  }
  if (isDark) {
    ctx.fillStyle = "rgb(255,255,255)";
  }
  
  ctx.beginPath();
  
  const waveCount = 3;
  const waveWidth = w / waveCount;
  
  for (let i = 0; i < waveCount; i++) {
    const startX = x + i * waveWidth;
    const midX = startX + waveWidth / 2;
    const endX = startX + waveWidth;
    
    ctx.moveTo(startX, y);
    ctx.quadraticCurveTo(midX, y - ruffleHeight, endX, y);
  }
  
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
}

function drawFlower(ctx, x, y) {
  const w = CELL_SIZE;
  const h = CELL_SIZE;
  const currentFillStyle = ctx.fillStyle;

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const px = x + w / 2 + Math.cos(angle) * w * 0.35;
    const py = y + h / 2 + Math.sin(angle) * h * 0.35;
    ctx.beginPath();
    ctx.ellipse(px, py, w * 0.15, w * 0.25, angle + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgb(255,200,0)";
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, w * 0.15, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = currentFillStyle;
}

function drawBigFlower(ctx, x, y, size) {
  const currentFillStyle = ctx.fillStyle;
  const w = size;
  const h = size;
  const cx = x + w / 2;
  const cy = y + h / 2;

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const px = cx + Math.cos(angle) * w * 0.32;
    const py = cy + Math.sin(angle) * h * 0.32;
    ctx.beginPath();
    ctx.ellipse(px, py, w * 0.22, w * 0.32, angle + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgb(255,220,0)";
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.18, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = currentFillStyle;
}

function drawLeaf(ctx, x, y, size) {
  const w = size;
  const h = size;
  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.4);
  ctx.bezierCurveTo(cx + w * 0.4, cy - h * 0.3, cx + w * 0.4, cy + h * 0.2, cx, cy + h * 0.4);
  ctx.bezierCurveTo(cx - w * 0.4, cy + h * 0.2, cx - w * 0.4, cy - h * 0.3, cx, cy - h * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(0,80,0,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.3);
  ctx.lineTo(cx, cy + h * 0.3);
  ctx.stroke();
}

/**
 * 绘制腊肠犬形象（长身短腿的经典腊肠犬）
 * 朝向：脸朝左
 */
function drawDachshund(ctx, cx, cy, size) {
  const currentFillStyle = ctx.fillStyle;
  const mainColor = ctx.fillStyle;

  const w = size * 1.0;
  const h = size * 0.55;
  const left = cx - w / 2;
  const top = cy - h / 2;

  // 颜色派生：深色用于耳朵/鼻子/细节
  let darkR = 80, darkG = 50, darkB = 30;
  if (typeof mainColor === "string" && mainColor.startsWith("rgb(")) {
    const parts = mainColor.match(/\d+/g);
    if (parts && parts.length >= 3) {
      const pr = parseInt(parts[0]), pg = parseInt(parts[1]), pb = parseInt(parts[2]);
      darkR = Math.max(20, pr - 80);
      darkG = Math.max(10, pg - 80);
      darkB = Math.max(10, pb - 80);
    }
  }
  const darkColor = `rgb(${darkR},${darkG},${darkB})`;

  // 1. 身体（长椭圆形）
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.08, cy + h * 0.08, w * 0.38, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. 胸部连接
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.22, cy + h * 0.05, w * 0.15, h * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3. 头部（朝左的椭圆+口鼻）
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.4, cy - h * 0.02, w * 0.16, h * 0.22, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // 口鼻部分（略突出）
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.53, cy + h * 0.02, w * 0.08, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // 4. 长耳朵（垂耳，深色）
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.34, cy + h * 0.12, w * 0.09, h * 0.22, 0.35, 0, Math.PI * 2);
  ctx.fill();

  // 5. 四条短腿
  ctx.fillStyle = mainColor;
  // 前腿
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.3, cy + h * 0.3, w * 0.06, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.18, cy + h * 0.32, w * 0.06, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  // 后腿
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.22, cy + h * 0.3, w * 0.06, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.38, cy + h * 0.32, w * 0.06, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // 6. 尾巴（翘起的细尾）
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.42, cy - h * 0.05);
  ctx.quadraticCurveTo(cx + w * 0.55, cy - h * 0.3, cx + w * 0.5, cy - h * 0.38);
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.strokeStyle = mainColor;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.lineWidth = 1;

  // 7. 脸部细节
  // 眼睛（黑色小圆）
  ctx.fillStyle = "rgb(30,30,30)";
  ctx.beginPath();
  ctx.arc(cx - w * 0.42, cy - h * 0.06, size * 0.035, 0, Math.PI * 2);
  ctx.fill();
  // 眼高光
  ctx.fillStyle = "rgb(255,255,255)";
  ctx.beginPath();
  ctx.arc(cx - w * 0.43, cy - h * 0.075, size * 0.012, 0, Math.PI * 2);
  ctx.fill();
  // 鼻子
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.56, cy, size * 0.035, size * 0.025, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = currentFillStyle;
}

/**
 * 绘制通用可爱小狗形象
 */
function drawDoggy(ctx, cx, cy, size) {
  const currentFillStyle = ctx.fillStyle;
  const mainColor = ctx.fillStyle;

  let darkR = 80, darkG = 50, darkB = 30;
  if (typeof mainColor === "string" && mainColor.startsWith("rgb(")) {
    const parts = mainColor.match(/\d+/g);
    if (parts && parts.length >= 3) {
      const pr = parseInt(parts[0]), pg = parseInt(parts[1]), pb = parseInt(parts[2]);
      darkR = Math.max(20, pr - 70);
      darkG = Math.max(10, pg - 70);
      darkB = Math.max(10, pb - 70);
    }
  }
  const darkColor = `rgb(${darkR},${darkG},${darkB})`;

  const s = size;

  // 身体
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.15, s * 0.35, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // 头
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.2, s * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // 耳朵（垂耳）
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.26, cy - s * 0.18, s * 0.1, s * 0.2, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + s * 0.26, cy - s * 0.18, s * 0.1, s * 0.2, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // 脸部
  ctx.fillStyle = mainColor;
  // 口鼻
  ctx.beginPath();
  ctx.ellipse(cx, cy - s * 0.05, s * 0.15, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛
  ctx.fillStyle = "rgb(30,30,30)";
  ctx.beginPath();
  ctx.arc(cx - s * 0.12, cy - s * 0.25, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.12, cy - s * 0.25, s * 0.045, 0, Math.PI * 2);
  ctx.fill();

  // 眼高光
  ctx.fillStyle = "rgb(255,255,255)";
  ctx.beginPath();
  ctx.arc(cx - s * 0.135, cy - s * 0.265, s * 0.015, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.105, cy - s * 0.265, s * 0.015, 0, Math.PI * 2);
  ctx.fill();

  // 鼻子
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.ellipse(cx, cy - s * 0.1, s * 0.04, s * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();

  // 嘴巴
  ctx.strokeStyle = darkColor;
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.06);
  ctx.lineTo(cx, cy - s * 0.02);
  ctx.moveTo(cx, cy - s * 0.02);
  ctx.quadraticCurveTo(cx - s * 0.05, cy + s * 0.02, cx - s * 0.08, cy);
  ctx.moveTo(cx, cy - s * 0.02);
  ctx.quadraticCurveTo(cx + s * 0.05, cy + s * 0.02, cx + s * 0.08, cy);
  ctx.stroke();
  ctx.lineWidth = 1;

  // 腿
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.22, cy + s * 0.38, s * 0.06, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + s * 0.22, cy + s * 0.38, s * 0.06, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // 尾巴
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.32, cy + s * 0.05);
  ctx.quadraticCurveTo(cx + s * 0.5, cy - s * 0.1, cx + s * 0.48, cy - s * 0.25);
  ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.strokeStyle = mainColor;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.lineWidth = 1;

  ctx.fillStyle = currentFillStyle;
}

/**
 * 绘制猫咪形象
 */
function drawKitty(ctx, cx, cy, size) {
  const currentFillStyle = ctx.fillStyle;
  const mainColor = ctx.fillStyle;

  let darkR = 80, darkG = 60, darkB = 50;
  if (typeof mainColor === "string" && mainColor.startsWith("rgb(")) {
    const parts = mainColor.match(/\d+/g);
    if (parts && parts.length >= 3) {
      const pr = parseInt(parts[0]), pg = parseInt(parts[1]), pb = parseInt(parts[2]);
      darkR = Math.max(20, pr - 70);
      darkG = Math.max(10, pg - 70);
      darkB = Math.max(10, pb - 70);
    }
  }
  const darkColor = `rgb(${darkR},${darkG},${darkB})`;
  const s = size;

  // 头（圆形）
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.1, s * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // 尖耳朵（左）
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.32, cy - s * 0.35);
  ctx.lineTo(cx - s * 0.15, cy - s * 0.65);
  ctx.lineTo(cx - s * 0.02, cy - s * 0.35);
  ctx.closePath();
  ctx.fill();
  // 左耳内粉
  ctx.fillStyle = "rgb(255,200,200)";
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.26, cy - s * 0.38);
  ctx.lineTo(cx - s * 0.15, cy - s * 0.55);
  ctx.lineTo(cx - s * 0.08, cy - s * 0.38);
  ctx.closePath();
  ctx.fill();

  // 尖耳朵（右）
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.32, cy - s * 0.35);
  ctx.lineTo(cx + s * 0.15, cy - s * 0.65);
  ctx.lineTo(cx + s * 0.02, cy - s * 0.35);
  ctx.closePath();
  ctx.fill();
  // 右耳内粉
  ctx.fillStyle = "rgb(255,200,200)";
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.26, cy - s * 0.38);
  ctx.lineTo(cx + s * 0.15, cy - s * 0.55);
  ctx.lineTo(cx + s * 0.08, cy - s * 0.38);
  ctx.closePath();
  ctx.fill();

  // 眼睛
  ctx.fillStyle = "rgb(30,30,30)";
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.15, cy - s * 0.12, s * 0.055, s * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + s * 0.15, cy - s * 0.12, s * 0.055, s * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  // 眼高光
  ctx.fillStyle = "rgb(255,255,255)";
  ctx.beginPath();
  ctx.arc(cx - s * 0.17, cy - s * 0.145, s * 0.02, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.13, cy - s * 0.145, s * 0.02, 0, Math.PI * 2);
  ctx.fill();

  // 鼻子（小三角粉色）
  ctx.fillStyle = "rgb(255,150,150)";
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.04, cy + s * 0.02);
  ctx.lineTo(cx + s * 0.04, cy + s * 0.02);
  ctx.lineTo(cx, cy + s * 0.08);
  ctx.closePath();
  ctx.fill();

  // 嘴巴
  ctx.strokeStyle = darkColor;
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.08);
  ctx.lineTo(cx, cy + s * 0.14);
  ctx.moveTo(cx, cy + s * 0.14);
  ctx.quadraticCurveTo(cx - s * 0.08, cy + s * 0.2, cx - s * 0.12, cy + s * 0.14);
  ctx.moveTo(cx, cy + s * 0.14);
  ctx.quadraticCurveTo(cx + s * 0.08, cy + s * 0.2, cx + s * 0.12, cy + s * 0.14);
  ctx.stroke();
  ctx.lineWidth = 1;

  // 胡须
  ctx.strokeStyle = "rgb(120,120,120)";
  ctx.lineWidth = Math.max(1, s * 0.012);
  // 左
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.1, cy + s * 0.08);
  ctx.lineTo(cx - s * 0.35, cy + s * 0.04);
  ctx.moveTo(cx - s * 0.1, cy + s * 0.12);
  ctx.lineTo(cx - s * 0.35, cy + s * 0.14);
  // 右
  ctx.moveTo(cx + s * 0.1, cy + s * 0.08);
  ctx.lineTo(cx + s * 0.35, cy + s * 0.04);
  ctx.moveTo(cx + s * 0.1, cy + s * 0.12);
  ctx.lineTo(cx + s * 0.35, cy + s * 0.14);
  ctx.stroke();
  ctx.lineWidth = 1;

  // 身体
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.35, s * 0.3, s * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // 尾巴（弯曲）
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.28, cy + s * 0.35);
  ctx.quadraticCurveTo(cx + s * 0.55, cy + s * 0.15, cx + s * 0.4, cy - s * 0.05);
  ctx.lineWidth = Math.max(3, s * 0.1);
  ctx.strokeStyle = mainColor;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.lineWidth = 1;

  ctx.fillStyle = currentFillStyle;
}

/**
 * 绘制小熊形象
 */
function drawBear(ctx, cx, cy, size) {
  const currentFillStyle = ctx.fillStyle;
  const mainColor = ctx.fillStyle;

  let darkR = 80, darkG = 50, darkB = 30;
  if (typeof mainColor === "string" && mainColor.startsWith("rgb(")) {
    const parts = mainColor.match(/\d+/g);
    if (parts && parts.length >= 3) {
      const pr = parseInt(parts[0]), pg = parseInt(parts[1]), pb = parseInt(parts[2]);
      darkR = Math.max(20, pr - 60);
      darkG = Math.max(10, pg - 60);
      darkB = Math.max(10, pb - 60);
    }
  }
  const darkColor = `rgb(${darkR},${darkG},${darkB})`;
  let lightR = 230, lightG = 200, lightB = 170;
  if (typeof mainColor === "string" && mainColor.startsWith("rgb(")) {
    const parts = mainColor.match(/\d+/g);
    if (parts && parts.length >= 3) {
      const pr = parseInt(parts[0]), pg = parseInt(parts[1]), pb = parseInt(parts[2]);
      lightR = Math.min(255, pr + 40);
      lightG = Math.min(255, pg + 30);
      lightB = Math.min(255, pb + 20);
    }
  }
  const lightColor = `rgb(${lightR},${lightG},${lightB})`;
  const s = size;

  // 耳朵（圆耳朵，左右）
  ctx.beginPath();
  ctx.arc(cx - s * 0.3, cy - s * 0.38, s * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.3, cy - s * 0.38, s * 0.15, 0, Math.PI * 2);
  ctx.fill();
  // 耳内浅色
  ctx.fillStyle = lightColor;
  ctx.beginPath();
  ctx.arc(cx - s * 0.3, cy - s * 0.38, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.3, cy - s * 0.38, s * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // 头
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.15, s * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // 脸部浅色区域（吻部）
  ctx.fillStyle = lightColor;
  ctx.beginPath();
  ctx.ellipse(cx, cy - s * 0.02, s * 0.22, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛
  ctx.fillStyle = "rgb(30,30,30)";
  ctx.beginPath();
  ctx.arc(cx - s * 0.15, cy - s * 0.22, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.15, cy - s * 0.22, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  // 眼高光
  ctx.fillStyle = "rgb(255,255,255)";
  ctx.beginPath();
  ctx.arc(cx - s * 0.165, cy - s * 0.235, s * 0.018, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.135, cy - s * 0.235, s * 0.018, 0, Math.PI * 2);
  ctx.fill();

  // 鼻子
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.ellipse(cx, cy - s * 0.08, s * 0.055, s * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();

  // 嘴巴（微笑弧线）
  ctx.strokeStyle = darkColor;
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.03);
  ctx.lineTo(cx, cy + s * 0.02);
  ctx.moveTo(cx, cy + s * 0.02);
  ctx.quadraticCurveTo(cx - s * 0.08, cy + s * 0.08, cx - s * 0.1, cy + s * 0.04);
  ctx.moveTo(cx, cy + s * 0.02);
  ctx.quadraticCurveTo(cx + s * 0.08, cy + s * 0.08, cx + s * 0.1, cy + s * 0.04);
  ctx.stroke();
  ctx.lineWidth = 1;

  // 身体
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.35, s * 0.32, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  // 肚子浅色
  ctx.fillStyle = lightColor;
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.4, s * 0.18, s * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = currentFillStyle;
}

/**
 * 绘制爱心形象
 */
function drawHeart(ctx, cx, cy, size) {
  const currentFillStyle = ctx.fillStyle;
  const s = size;

  ctx.beginPath();
  // 经典爱心路径
  ctx.moveTo(cx, cy + s * 0.3);
  ctx.bezierCurveTo(
    cx - s * 1.2, cy - s * 0.2,
    cx - s * 0.5, cy - s * 1.0,
    cx, cy - s * 0.35
  );
  ctx.bezierCurveTo(
    cx + s * 0.5, cy - s * 1.0,
    cx + s * 1.2, cy - s * 0.2,
    cx, cy + s * 0.3
  );
  ctx.closePath();
  ctx.fill();

  // 高光
  let hr = 255, hg = 255, hb = 255;
  const mainColor = ctx.fillStyle;
  if (typeof mainColor === "string" && mainColor.startsWith("rgb(")) {
    const parts = mainColor.match(/\d+/g);
    if (parts && parts.length >= 3) {
      hr = Math.min(255, parseInt(parts[0]) + 60);
      hg = Math.min(255, parseInt(parts[1]) + 60);
      hb = Math.min(255, parseInt(parts[2]) + 60);
    }
  }
  ctx.fillStyle = `rgba(${hr},${hg},${hb},0.5)`;
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.35, cy - s * 0.35, s * 0.2, s * 0.13, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = currentFillStyle;
}

function drawButtons(ctx, x, y, cols, rows, mask, buttons, isOpenFront, layoutButtons) {
  const [r, g, b] = buttons.color;
  // 闭合衣服默认最多2颗纽扣，开衫最多4颗
  const maxCount = isOpenFront ? 4 : 2;
  const count = Math.min(buttons.count, maxCount);
  if (count <= 0) return;

  const buttonType = buttons.type || "纽扣";

  ctx.save();

  if (mask) {
    ctx.beginPath();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (mask[row] && mask[row][col]) {
          ctx.rect(x + col * CELL_SIZE, y + row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }
    ctx.clip();
  }

  const centerX = x + cols * CELL_SIZE / 2;
  const innerWidth = CELL_SIZE * 1.4;
  const innerLeft = centerX - innerWidth / 2;
  const innerRight = centerX + innerWidth / 2;
  const placketWidth = CELL_SIZE * 0.8;
  const leftPanelRight = innerLeft - placketWidth / 2;
  const rightPanelLeft = innerRight + placketWidth / 2;
  const position = buttons.position || "前中";

  const drawMaleButton = (bx, by) => {
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.arc(bx, by, CELL_SIZE * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgb(255,255,255)";
    ctx.beginPath();
    ctx.arc(bx, by, CELL_SIZE * 0.08, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawFemaleButton = (bx, by) => {
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.arc(bx, by, CELL_SIZE * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgb(255,255,255)";
    ctx.beginPath();
    ctx.arc(bx, by, CELL_SIZE * 0.06, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawButtonhole = (bx, by) => {
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - CELL_SIZE * 0.12, by);
    ctx.lineTo(bx + CELL_SIZE * 0.12, by);
    ctx.stroke();

    ctx.strokeStyle = `rgb(${Math.max(0, r - 30)},${Math.max(0, g - 30)},${Math.max(0, b - 30)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bx, by, CELL_SIZE * 0.18, 0, Math.PI * 2);
    ctx.stroke();
  };

  // 纽扣从第3行开始垂直排列（避开领口区域）
  const buttonRows = [];
  for (let i = 0; i < count; i++) {
    const row = 3 + i;
    if (row >= rows) break;
    buttonRows.push(row);
  }

  if (isOpenFront) {
    // 开衫：纽扣在左/右前襟上，或根据AI位置
    if (position.includes("右侧")) {
      for (const row of buttonRows) {
        const buttonY = y + row * CELL_SIZE + CELL_SIZE / 2;
        drawMaleButton(rightPanelLeft, buttonY);
      }
    } else if (position.includes("左侧")) {
      for (const row of buttonRows) {
        const buttonY = y + row * CELL_SIZE + CELL_SIZE / 2;
        drawMaleButton(leftPanelRight, buttonY);
      }
    } else {
      for (const row of buttonRows) {
        const buttonY = y + row * CELL_SIZE + CELL_SIZE / 2;

        if (buttonType === "按扣") {
          drawMaleButton(leftPanelRight, buttonY);
          drawFemaleButton(rightPanelLeft, buttonY);
        } else {
          drawMaleButton(leftPanelRight, buttonY);
          drawButtonhole(rightPanelLeft, buttonY);
        }
      }
    }
  } else {
    // 闭合衣服（扣子扣上的T恤/衬衫等）：纽扣垂直排列在领口正中间一列
    for (const row of buttonRows) {
      const buttonY = y + row * CELL_SIZE + CELL_SIZE / 2;
      // 纽扣画在正中间centerX位置，不是左右两边
      if (buttonType === "按扣") {
        drawFemaleButton(centerX, buttonY);
      } else {
        // 传统纽扣：圆形+白点，居中显示
        drawMaleButton(centerX, buttonY);
      }
    }
  }

  ctx.restore();
}

function drawDrawstrings(ctx, x, y, cols, rows, mask, hasDrawstrings, drawstringColor, drawstringPosition, drawstringLength, templateId) {
  if (!hasDrawstrings) return;

  const [r, g, b] = drawstringColor || [0, 0, 0];

  ctx.save();

  if (mask) {
    ctx.beginPath();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (mask[row] && mask[row][col]) {
          ctx.rect(x + col * CELL_SIZE, y + row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }
    ctx.clip();
  }

  ctx.strokeStyle = `rgb(${r},${g},${b})`;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  const centerX = x + cols * CELL_SIZE / 2;
  const innerWidth = CELL_SIZE * 1.4;
  const innerLeft = centerX - innerWidth / 2;
  const innerRight = centerX + innerWidth / 2;
  const placketWidth = CELL_SIZE * 0.8;
  const leftPanelRight = innerLeft - placketWidth / 2;
  const rightPanelLeft = innerRight + placketWidth / 2;

  const isPants = ["shorts", "long-pants"].includes(templateId);
  const startRow = isPants ? 0 : 4;
  let endRow;
  if (isPants) {
    endRow = Math.min(startRow + 3, rows - 1);
  } else if (drawstringLength === "short") {
    endRow = startRow + 1;
  } else if (drawstringLength === "medium") {
    endRow = Math.min(startRow + 3, rows - 1);
  } else {
    endRow = Math.min(8, rows - 1);
  }

  const leftDrawstringX = x + 2 * CELL_SIZE + CELL_SIZE / 2;
  const rightDrawstringX = x + 5 * CELL_SIZE + CELL_SIZE / 2;

  // 先画深色描边增强可见性
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(leftDrawstringX, y + startRow * CELL_SIZE + CELL_SIZE * 0.5);
  ctx.lineTo(leftDrawstringX, y + endRow * CELL_SIZE + CELL_SIZE * 0.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(rightDrawstringX, y + startRow * CELL_SIZE + CELL_SIZE * 0.5);
  ctx.lineTo(rightDrawstringX, y + endRow * CELL_SIZE + CELL_SIZE * 0.5);
  ctx.stroke();

  // 再画挂绳本体颜色
  ctx.strokeStyle = `rgb(${r},${g},${b})`;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(leftDrawstringX, y + startRow * CELL_SIZE + CELL_SIZE * 0.5);
  ctx.lineTo(leftDrawstringX, y + endRow * CELL_SIZE + CELL_SIZE * 0.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(rightDrawstringX, y + startRow * CELL_SIZE + CELL_SIZE * 0.5);
  ctx.lineTo(rightDrawstringX, y + endRow * CELL_SIZE + CELL_SIZE * 0.5);
  ctx.stroke();

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  for (let row = startRow; row <= endRow; row++) {
    const drawstringY = y + row * CELL_SIZE + CELL_SIZE * 0.5;
    
    ctx.beginPath();
    ctx.arc(leftDrawstringX, drawstringY, CELL_SIZE * 0.08, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(rightDrawstringX, drawstringY, CELL_SIZE * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPantsHem(ctx, x, y, cols, rows, mask, cuffStyle, cuffColor, cuffPattern, cuffPatternColor, mainColor) {
  if (!mask || !mask[0]) return;
  if (!cuffStyle && !cuffPattern) return;
  if (cuffStyle === "无特殊设计" && !cuffPattern) return;

  const bottomRow = mask.length - 1;

  const hemCols = [];
  for (let col = 0; col < cols; col++) {
    if (mask[bottomRow] && mask[bottomRow][col]) {
      hemCols.push(col);
    }
  }

  if (hemCols.length === 0) return;

  const [cr, cg, cb] = cuffColor || mainColor || [128, 128, 128];

  ctx.save();
  ctx.globalAlpha = 1;

  const leftCols = [];
  const rightCols = [];
  const centerCol = Math.floor(cols / 2);

  for (const col of hemCols) {
    if (col < centerCol) {
      leftCols.push(col);
    } else {
      rightCols.push(col);
    }
  }

  const drawHemPart = (cols) => {
    if (cols.length === 0) return;
    const startCol = Math.min(...cols);
    const endCol = Math.max(...cols);
    const hemX = x + startCol * CELL_SIZE;
    const hemW = (endCol - startCol + 1) * CELL_SIZE;
    const hemY = y + (bottomRow + 1) * CELL_SIZE - SUB_SIZE * 2;
    const hemHeight = SUB_SIZE * 2;

    if (cuffStyle === "翻边") {
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(hemX, hemY, hemW, hemHeight);
      ctx.strokeStyle = `rgba(0,0,0,0.3)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(hemX, hemY, hemW, hemHeight);
    } else if (cuffStyle === "松紧" || cuffStyle === "罗纹") {
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      const ribCount = 5;
      const ribWidth = hemW / ribCount;
      ctx.fillRect(hemX, hemY, hemW, hemHeight);
      ctx.fillStyle = `rgba(0,0,0,0.15)`;
      for (let i = 0; i < ribCount; i++) {
        const ribX = hemX + i * ribWidth;
        ctx.fillRect(ribX, hemY, ribWidth * 0.6, hemHeight);
      }
      ctx.strokeStyle = `rgba(0,0,0,0.3)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(hemX, hemY, hemW, hemHeight);
    } else if (cuffStyle === "收口") {
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(hemX, hemY, hemW, hemHeight);
      ctx.strokeStyle = `rgba(0,0,0,0.4)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hemX, hemY);
      ctx.lineTo(hemX + hemW, hemY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hemX, hemY + hemHeight);
      ctx.lineTo(hemX + hemW, hemY + hemHeight);
      ctx.stroke();
    } else if (cuffStyle === "条纹") {
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(hemX, hemY, hemW, hemHeight);
      if (cuffPatternColor) {
        const [pr, pg, pb] = cuffPatternColor;
        ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
        const stripeCount = 3;
        const stripeGap = hemHeight / (stripeCount + 1);
        for (let i = 1; i <= stripeCount; i++) {
          const stripeY = hemY + i * stripeGap;
          ctx.fillRect(hemX, stripeY - SUB_SIZE * 0.15, hemW, SUB_SIZE * 0.3);
        }
      }
    } else if (cuffPattern) {
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(hemX, hemY, hemW, hemHeight);
      if (cuffPattern.includes("条纹") && cuffPatternColor) {
        const [pr, pg, pb] = cuffPatternColor;
        ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
        const stripeCount = 3;
        const stripeGap = hemHeight / (stripeCount + 1);
        for (let i = 1; i <= stripeCount; i++) {
          const stripeY = hemY + i * stripeGap;
          ctx.fillRect(hemX, stripeY - SUB_SIZE * 0.15, hemW, SUB_SIZE * 0.3);
        }
      }
    } else {
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(hemX, hemY, hemW, hemHeight);
    }
  };

  drawHemPart(leftCols);
  drawHemPart(rightCols);

  ctx.restore();
}

function drawZipper(ctx, x, y, cols, rows, mask, zipper, isOpenFront, layoutZipper) {
  const [r, g, b] = zipper.color;

  ctx.save();

  if (mask) {
    ctx.beginPath();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (mask[row] && mask[row][col]) {
          ctx.rect(x + col * CELL_SIZE, y + row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }
    ctx.clip();
  }

  ctx.strokeStyle = `rgb(${r},${g},${b})`;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  let startRow = -1;
  let endRow = -1;
  const col = Math.floor(cols / 2);

  for (let row = 0; row < rows; row++) {
    if (mask && !mask[row][3] && !mask[row][4]) continue;
    if (startRow === -1) startRow = row;
    endRow = row;
  }

  if (startRow >= 0 && endRow >= 0) {
    const maxClosedRow = isOpenFront ? rows - 1 : Math.min(startRow + 3, endRow);
    const actualEndRow = isOpenFront ? endRow : maxClosedRow;

    const centerX = x + (cols * CELL_SIZE) / 2;
    const innerWidth = CELL_SIZE * 1.4;
    const innerLeft = centerX - innerWidth / 2;
    const innerRight = centerX + innerWidth / 2;
    const placketWidth = CELL_SIZE * 0.8;
    const leftPanelRight = innerLeft - placketWidth / 2;
    const rightPanelLeft = innerRight + placketWidth / 2;

    let zipperX = centerX;
    const alignment = zipper.alignment || layoutZipper?.alignment;
    if (alignment === "center") {
      zipperX = centerX;
    } else if (alignment === "left") {
      zipperX = x + 3 * CELL_SIZE + CELL_SIZE / 2 - SUB_SIZE;
    } else if (alignment === "right") {
      zipperX = x + 4 * CELL_SIZE + CELL_SIZE / 2 + SUB_SIZE;
    } else if (layoutZipper?.col != null) {
      zipperX = x + layoutZipper.col * CELL_SIZE + CELL_SIZE / 2;
    } else if (isOpenFront) {
      zipperX = x + 3 * CELL_SIZE + CELL_SIZE / 2 - SUB_SIZE;
    }

    const fixedStartRow = 3;
    const startY = y + fixedStartRow * CELL_SIZE + CELL_SIZE * 0.5 + SUB_SIZE * 2;
    const endY = y + actualEndRow * CELL_SIZE + CELL_SIZE * 0.5;

    ctx.beginPath();
    ctx.moveTo(zipperX, startY);
    ctx.lineTo(zipperX, endY);
    ctx.stroke();

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    for (let row = startRow; row <= actualEndRow; row++) {
      const zipperY = y + row * CELL_SIZE + CELL_SIZE * 0.35;

      ctx.fillRect(zipperX - SUB_SIZE * 0.5, zipperY - SUB_SIZE * 0.15, SUB_SIZE * 0.6, SUB_SIZE * 0.3);

      ctx.beginPath();
      ctx.arc(zipperX - SUB_SIZE * 0.6, zipperY, SUB_SIZE * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    if (zipper.hasPuller) {
      const pullerY = y + actualEndRow * CELL_SIZE + CELL_SIZE * 0.5;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(zipperX - SUB_SIZE * 0.8, pullerY - SUB_SIZE * 1.2, SUB_SIZE * 1.6, SUB_SIZE * 0.8);
      ctx.fillRect(zipperX - SUB_SIZE * 0.4, pullerY - SUB_SIZE * 0.4, SUB_SIZE * 0.8, SUB_SIZE * 1.2);
    }
  }

  ctx.restore();
}

function drawCollar(ctx, x, y, cols, rows, mask, collar, innerLayerColor, isOpenFront, layoutCollar, mainColor) {
  if (!mask) return;
  if (!collar.color) return; // 没有明确领子颜色时不画（例如格子领无法单色还原）
  const [r, g, b] = collar.color;
  const type = collar.type;
  // 不再默认使用蓝色领子色作为内搭！优先innerLayerColor，否则用衣服主色（用户：内搭不是蓝）
  const hasInner = !!innerLayerColor || !!mainColor;
  const [ir, ig, ib] = innerLayerColor || mainColor || [r, g, b];

  ctx.save();

  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (mask[row] && mask[row][col]) {
        ctx.rect(x + col * CELL_SIZE, y + row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }
  ctx.clip();

  const centerX = x + (cols * CELL_SIZE) / 2;
  const startY = y + CELL_SIZE + CELL_SIZE / 2;
  const endY = y + 3 * CELL_SIZE + CELL_SIZE / 2;
  
  const rightStartX = x + (cols - 3) * CELL_SIZE;
  const leftStartX = centerX - (rightStartX - centerX);
  
  const leftMidX = leftStartX - CELL_SIZE;
  const leftMidY = startY + CELL_SIZE;
  const rightMidX = rightStartX + CELL_SIZE;
  const rightMidY = startY + CELL_SIZE;
  
  if (type.includes("翻领") || type.includes("立领")) {
    if (isOpenFront && hasInner) {
      const placketEndY = y + rows * CELL_SIZE;
      const collarBottomY = startY + CELL_SIZE * 2;

      const innerWidth = CELL_SIZE * 1.4;
      const innerLeft = centerX - innerWidth / 2;
      const innerRight = centerX + innerWidth / 2;

      ctx.fillStyle = `rgb(${ir},${ig},${ib})`;

      ctx.beginPath();
      ctx.moveTo(leftStartX, startY);
      ctx.lineTo(leftMidX, leftMidY);
      ctx.lineTo(innerLeft, collarBottomY);
      ctx.lineTo(innerLeft, placketEndY);
      ctx.lineTo(innerRight, placketEndY);
      ctx.lineTo(innerRight, collarBottomY);
      ctx.lineTo(rightMidX, rightMidY);
      ctx.lineTo(rightStartX, startY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgb(${Math.max(0, r - 40)},${Math.max(0, g - 40)},${Math.max(0, b - 40)})`;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(leftStartX, startY);
      ctx.lineTo(leftMidX, leftMidY);
      ctx.lineTo(innerLeft, collarBottomY);
      ctx.lineTo(innerLeft, placketEndY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rightStartX, startY);
      ctx.lineTo(rightMidX, rightMidY);
      ctx.lineTo(innerRight, collarBottomY);
      ctx.lineTo(innerRight, placketEndY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(leftStartX, startY);
      ctx.lineTo(rightStartX, startY);
      ctx.stroke();
    } else {
      const closedEndY = y + 4 * CELL_SIZE;

      ctx.fillStyle = `rgb(${ir},${ig},${ib})`;
      ctx.beginPath();
      ctx.moveTo(leftStartX, startY);
      ctx.lineTo(leftMidX, leftMidY);
      ctx.lineTo(centerX, closedEndY);
      ctx.lineTo(rightMidX, rightMidY);
      ctx.lineTo(rightStartX, startY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = `rgb(${r},${g},${b})`;

      ctx.beginPath();
      ctx.moveTo(leftStartX, startY);
      ctx.lineTo(leftMidX, leftMidY);
      ctx.lineTo(centerX, closedEndY);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(rightStartX, startY);
      ctx.lineTo(rightMidX, rightMidY);
      ctx.lineTo(centerX, closedEndY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(leftStartX, startY);
      ctx.lineTo(leftMidX, leftMidY);
      ctx.lineTo(centerX, closedEndY);
      ctx.lineTo(rightMidX, rightMidY);
      ctx.lineTo(rightStartX, startY);
      ctx.closePath();
      ctx.stroke();
    }
  } else if (type.includes("圆领")) {
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.arc(centerX, y + CELL_SIZE, CELL_SIZE * 1.5, 0, Math.PI, true);
    ctx.fill();
  }

  ctx.restore();
}

function drawPockets(ctx, x, y, cols, rows, mask, pockets, layoutPockets, isOpenFront, stitchingColor, isPants = false) {
  if (!mask) return;
  const [pr, pg, pb] = pockets.color;
  const count = pockets.count || 2;
  const position = pockets.position || "胸前";
  const style = pockets.style || "贴袋";

  const hasStitching = stitchingColor && stitchingColor.length === 3;
  const [sr, sg, sb] = hasStitching ? stitchingColor : [pr, pg, pb];

  ctx.save();

  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (mask[row] && mask[row][col]) {
        ctx.rect(x + col * CELL_SIZE, y + row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }
  ctx.clip();

  const centerX = x + cols * CELL_SIZE / 2;
  const innerWidth = CELL_SIZE * 1.4;
  const innerLeft = centerX - innerWidth / 2;
  const innerRight = centerX + innerWidth / 2;

  ctx.strokeStyle = `rgb(${sr},${sg},${sb})`;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";

  const pocketWidth = CELL_SIZE * 1.6;
  const pocketHeight = CELL_SIZE * 1.6;
  const flapHeight = CELL_SIZE * 0.5;

  const drawSinglePocket = (pocketX, pocketY, pw, ph) => {
    const px = pocketX + SUB_SIZE * 0.2;
    const py = pocketY + SUB_SIZE * 0.2;
    const w = pw - SUB_SIZE * 0.4;
    const h = ph - SUB_SIZE * 0.4;

    if (style === "贴袋" || style === "牛仔袋") {
      ctx.fillStyle = `rgba(${sr},${sg},${sb},0.35)`;
      ctx.fillRect(px, py + flapHeight, w, h - flapHeight);

      ctx.strokeStyle = `rgb(${sr},${sg},${sb})`;
      ctx.beginPath();
      ctx.moveTo(px, py + flapHeight);
      ctx.lineTo(px, py + h);
      ctx.lineTo(px + w, py + h);
      ctx.lineTo(px + w, py + flapHeight);
      ctx.stroke();

      ctx.fillStyle = `rgba(${sr},${sg},${sb},0.4)`;
      ctx.beginPath();
      ctx.moveTo(px, py + flapHeight);
      ctx.lineTo(px + w * 0.15, py);
      ctx.lineTo(px + w * 0.85, py);
      ctx.lineTo(px + w, py + flapHeight);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgb(${sr},${sg},${sb})`;
      ctx.beginPath();
      ctx.moveTo(px, py + flapHeight);
      ctx.lineTo(px + w * 0.15, py);
      ctx.lineTo(px + w * 0.85, py);
      ctx.lineTo(px + w, py + flapHeight);
      ctx.stroke();

      ctx.fillStyle = `rgb(${sr},${sg},${sb})`;
      ctx.beginPath();
      ctx.arc(px + w / 2, py + flapHeight * 0.6, SUB_SIZE * 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === "插袋") {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + w, py);
      ctx.moveTo(px, py);
      ctx.lineTo(px + SUB_SIZE * 0.5, py + h * 0.3);
      ctx.moveTo(px + w, py);
      ctx.lineTo(px + w - SUB_SIZE * 0.5, py + h * 0.3);
      ctx.stroke();
    } else {
      ctx.strokeRect(px, py, w, h);
    }
  };

  const isDenim = style === "牛仔袋";

  const center = Math.floor(cols / 2);
  // 裤子口袋沿中心对称，避开挂绳位置(第2、5列)
  const pocketCols = isPants ? [center - 3, center + 3] : [center - 3, center + 1];

  if (isDenim) {
    drawDenimChestPockets(ctx, x, y, cols, rows, mask, pocketCols, sr, sg, sb);
    drawDenimWaistPockets(ctx, x, y, cols, rows, mask, pocketCols, sr, sg, sb);
  } else if (isPants) {
    // 裤子斜插袋
    const pocketStartRow = 1;
    const pocketDepth = 2;

    // 找到当前视图mask中第pocketStartRow行的有效列范围
    let leftBound = 0, rightBound = cols - 1;
    if (mask && mask[pocketStartRow]) {
      const rowMask = mask[pocketStartRow];
      for (let c = 0; c < cols; c++) {
        if (rowMask[c]) { leftBound = c; break; }
      }
      for (let c = cols - 1; c >= 0; c--) {
        if (rowMask[c]) { rightBound = c; break; }
      }
    }

    const drawSlantPocket = (col, isLeft) => {
      if (col < 0 || col >= cols) return;

      const startX = x + col * CELL_SIZE + CELL_SIZE / 2;
      const startY = y + pocketStartRow * CELL_SIZE + CELL_SIZE * 0.3;
      let endX = isLeft
        ? startX - CELL_SIZE * 1.2
        : startX + CELL_SIZE * 1.2;
      const endY = startY + CELL_SIZE * pocketDepth;

      // 限制口袋末端在mask范围内
      const cellPixelLeft = x + leftBound * CELL_SIZE;
      const cellPixelRight = x + (rightBound + 1) * CELL_SIZE;
      if (endX < cellPixelLeft) endX = cellPixelLeft + CELL_SIZE * 0.2;
      if (endX > cellPixelRight) endX = cellPixelRight - CELL_SIZE * 0.2;

      ctx.strokeStyle = `rgb(${sr},${sg},${sb})`;
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";

      // 袋口斜线
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // 袋口小弧线
      ctx.beginPath();
      ctx.arc(startX, startY, CELL_SIZE * 0.15, 0, Math.PI * 2);
      ctx.stroke();
    };

    if (count === 1) {
      drawSlantPocket(pocketCols[0], pocketCols[0] < cols / 2);
    } else if (count >= 2) {
      drawSlantPocket(pocketCols[0], true);
      drawSlantPocket(pocketCols[1], false);
    }
  } else {
    let pocketRow;
    if (position.includes("胸前")) {
      pocketRow = 5;
    } else if (position.includes("腰部")) {
      pocketRow = 8;
    } else if (position.includes("下摆")) {
      pocketRow = Math.max(5, rows - 3);
    } else {
      pocketRow = 5;
    }

    const drawPocketAtCol = (col) => {
      if (col < 0 || col >= cols) return;
      if (!mask[pocketRow] || !mask[pocketRow][col]) return;

      const pocketX = x + col * CELL_SIZE;
      const pocketY = y + pocketRow * CELL_SIZE;
      drawSinglePocket(pocketX, pocketY, pocketWidth, pocketHeight);
    };

    if (count === 1) {
      drawPocketAtCol(pocketCols[0]);
    } else if (count >= 2) {
      drawPocketAtCol(pocketCols[0]);
      drawPocketAtCol(pocketCols[1]);
    }
  }

  ctx.restore();
}

function drawDenimChestPockets(ctx, x, y, cols, rows, mask, pocketCols, pr, pg, pb) {
  const pocketY = y + 4 * CELL_SIZE;
  const pocketWidth = CELL_SIZE * 1.5;
  const pocketHeight = CELL_SIZE * 1.5;
  const flapHeight = CELL_SIZE * 0.5;

  for (let i = 0; i < pocketCols.length; i++) {
    const col = pocketCols[i];
    if (col < 0 || col >= cols) continue;
    
    const checkRow = Math.floor((pocketY - y) / CELL_SIZE);
    if (checkRow < 0 || checkRow >= rows) continue;
    if (!mask[checkRow] || !mask[checkRow][col]) continue;

    const pocketX = x + col * CELL_SIZE;
    const px = pocketX + SUB_SIZE * 0.3;
    const py = pocketY + SUB_SIZE * 0.3;
    const pw = pocketWidth - SUB_SIZE * 0.6;
    const ph = pocketHeight - SUB_SIZE * 0.6;

    ctx.beginPath();
    ctx.moveTo(px, py + flapHeight);
    ctx.lineTo(px, py + ph);
    ctx.lineTo(px + pw, py + ph);
    ctx.lineTo(px + pw, py + flapHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px, py + flapHeight);
    ctx.lineTo(px + pw * 0.15, py);
    ctx.lineTo(px + pw * 0.85, py);
    ctx.lineTo(px + pw, py + flapHeight);
    ctx.stroke();

    ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
    ctx.beginPath();
    ctx.arc(px + pw / 2, py + flapHeight * 0.6, SUB_SIZE * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDenimWaistPockets(ctx, x, y, cols, rows, mask, pocketCols, pr, pg, pb) {
  const pocketY = y + 6 * CELL_SIZE;
  const pocketWidth = CELL_SIZE * 1.8;
  const pocketHeight = CELL_SIZE * 2;

  for (let i = 0; i < pocketCols.length; i++) {
    const col = pocketCols[i];
    if (col < 0 || col >= cols) continue;
    
    const checkRow = Math.floor((pocketY - y) / CELL_SIZE);
    if (checkRow < 0 || checkRow >= rows) continue;
    if (!mask[checkRow] || !mask[checkRow][col]) continue;

    const pocketX = x + col * CELL_SIZE;
    const px = pocketX - SUB_SIZE * 0.5;
    const py = pocketY + SUB_SIZE * 0.3;
    const pw = pocketWidth + SUB_SIZE;
    const ph = pocketHeight - SUB_SIZE * 0.6;

    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + pw, py);
    ctx.lineTo(px + pw, py + ph * 0.4);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - SUB_SIZE * 0.3, py + ph * 0.3);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px + pw, py);
    ctx.lineTo(px + pw + SUB_SIZE * 0.3, py + ph * 0.3);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px + SUB_SIZE * 0.3, py + ph * 0.5);
    ctx.lineTo(px + pw - SUB_SIZE * 0.3, py + ph * 0.5);
    ctx.lineTo(px + pw - SUB_SIZE * 0.3, py + ph);
    ctx.lineTo(px + SUB_SIZE * 0.3, py + ph);
    ctx.closePath();
    ctx.stroke();
  }
}

function drawCuffs(ctx, x, y, cols, rows, mask, color) {
  if (!mask) return;
  const [cr, cg, cb] = color;

  ctx.save();

  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (mask[row] && mask[row][col]) {
        ctx.rect(x + col * CELL_SIZE, y + row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }
  ctx.clip();

  const bottomRow = rows - 1;
  let cuffStartCol = cols, cuffEndCol = -1;
  for (let col = 0; col < cols; col++) {
    if (mask[bottomRow] && mask[bottomRow][col]) {
      cuffStartCol = Math.min(cuffStartCol, col);
      cuffEndCol = Math.max(cuffEndCol, col);
    }
  }

  if (cuffEndCol < 0) {
    ctx.restore();
    return;
  }

  const cuffY = y + (rows - 1) * CELL_SIZE;
  const cuffHeight = CELL_SIZE * 0.8;
  const cuffX = x + cuffStartCol * CELL_SIZE + SUB_SIZE * 0.5;
  const cuffW = (cuffEndCol - cuffStartCol + 1) * CELL_SIZE - SUB_SIZE;

  const sr = Math.max(60, Math.min(255, Math.round(cr * 0.8)));
  const sg = Math.max(60, Math.min(255, Math.round(cg * 0.8)));
  const sb = Math.max(60, Math.min(255, Math.round(cb * 0.8)));
  ctx.strokeStyle = `rgb(${sr},${sg},${sb})`;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(cuffX, cuffY + SUB_SIZE * 0.5);
  ctx.lineTo(cuffX + cuffW, cuffY + SUB_SIZE * 0.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cuffX, cuffY + cuffHeight - SUB_SIZE * 0.3);
  ctx.lineTo(cuffX + cuffW, cuffY + cuffHeight - SUB_SIZE * 0.3);
  ctx.stroke();

  ctx.strokeStyle = `rgba(${sr},${sg},${sb}, 0.5)`;
  const stitchCount = 5;
  for (let i = 1; i < stitchCount; i++) {
    const sx = cuffX + (cuffW / stitchCount) * i;
    ctx.beginPath();
    ctx.moveTo(sx, cuffY + SUB_SIZE * 0.5);
    ctx.lineTo(sx, cuffY + cuffHeight - SUB_SIZE * 0.3);
    ctx.stroke();
  }

  ctx.restore();
}


// 绘制四视图网格线（白色半透明，响应 showGrid 按钮）
function drawViewGridLines(ctx, x, y, cols, rows, mask) {
  if (!mask) return;
  if (!mask[0]) return;

  x = Math.round(x);
  y = Math.round(y);

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.5;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (mask[row] && mask[row][col]) {
        const cellX = x + col * CELL_SIZE + 0.5;
        const cellY = y + row * CELL_SIZE + 0.5;
        ctx.strokeRect(cellX, cellY, CELL_SIZE - 1, CELL_SIZE - 1);
      }
    }
  }

  ctx.restore();
}

// 绘制简单 T 视图的网格线（灰色）
function drawSimpleGridLines(ctx, cols, rows, offsetX, offsetY) {
  ctx.strokeStyle = "rgb(150, 150, 150)";
  ctx.lineWidth = 1;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.strokeRect(
        Math.round(offsetX + col * CELL_SIZE),
        Math.round(offsetY + row * CELL_SIZE),
        CELL_SIZE,
        CELL_SIZE
      );
    }
  }
}

function drawNumbers(ctx, paletteIndices, cols, rows, offsetX, offsetY) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.max(10, Math.floor(CELL_SIZE * 0.45))}px sans-serif`;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const paletteIdx = paletteIndices[idx];
      if (paletteIdx >= 0) {
        const cx = offsetX + col * CELL_SIZE + CELL_SIZE / 2;
        const cy = offsetY + row * CELL_SIZE + CELL_SIZE / 2;
        const text = String(paletteIdx + 1);
        const metrics = ctx.measureText(text);
        const fh = parseInt(ctx.font);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(cx - metrics.width / 2 - 1, cy - fh / 2, metrics.width + 2, fh);
        ctx.fillStyle = "#333333";
        ctx.fillText(text, cx, cy);
      }
    }
  }
}

function getMainColor(pixels) {
  const counts = new Map();
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i];
    if (p && !(p[0] === 85 && p[1] === 85 && p[2] === 85)) {
      const key = p.join(",");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  let maxCount = 0;
  let maxColor = [220, 220, 220];
  for (const [key, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxColor = key.split(",").map(Number);
    }
  }
  return maxColor;
}

export default PatternCanvas;
