/**
 * 手动裁剪组件
 * 用户拖拽框选衣服区域
 * 兼容：桌面鼠标 + 手机触屏（touchstart/touchmove/touchend，passive:false 防止页面滚动干扰拖拽）
 */
import { useState, useRef, useEffect, useCallback } from "react";

// 统一从 MouseEvent 或原生 TouchEvent 取 viewport 坐标
function getClientPoint(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  if (e.changedTouches && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

export default function CropTool({ image, onCrop }) {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const [cropArea, setCropArea] = useState(null);
  const [showCrop, setShowCrop] = useState(true);
  const containerRef = useRef(null);

  // 根据容器尺寸 + 原图尺寸计算像素缩放比
  const getScale = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { scaleX: 1, scaleY: 1, rect: null };
    return {
      scaleX: image.width / rect.width,
      scaleY: image.height / rect.height,
      rect,
    };
  }, [image]);

  // 开始框选（鼠标按下 或 手指落下）
  const handleStart = useCallback(
    (e) => {
      const { scaleX, scaleY, rect } = getScale();
      if (!rect) return;
      // touch：阻止默认（防止移动端长按选中文本/弹出菜单/页面滚动）
      if (e.cancelable) {
        try { e.preventDefault(); } catch (_) {}
      }
      const { x, y } = getClientPoint(e);
      startPosRef.current = {
        x: (x - rect.left) * scaleX,
        y: (y - rect.top) * scaleY,
      };
      setCropArea({
        x: startPosRef.current.x,
        y: startPosRef.current.y,
        width: 0,
        height: 0,
      });
      setIsDragging(true);
    },
    [getScale]
  );

  // 拖拽中（鼠标移动 / 手指滑动）
  const handleMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const { scaleX, scaleY, rect } = getScale();
      if (!rect) return;
      if (e.cancelable) {
        try { e.preventDefault(); } catch (_) {}
      }
      const { x, y } = getClientPoint(e);
      const endX = (x - rect.left) * scaleX;
      const endY = (y - rect.top) * scaleY;
      const sx = startPosRef.current.x;
      const sy = startPosRef.current.y;
      setCropArea({
        x: Math.min(sx, endX),
        y: Math.min(sy, endY),
        width: Math.abs(endX - sx),
        height: Math.abs(endY - sy),
      });
    },
    [isDragging, getScale]
  );

  // 结束框选
  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!cropArea || cropArea.width < 2 || cropArea.height < 2) {
      // 选区太小就跳过（防止误触）
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = cropArea.width;
    canvas.height = cropArea.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, cropArea.width, cropArea.height);

    const croppedImage = new Image();
    croppedImage.src = canvas.toDataURL();
    croppedImage.onload = () => {
      onCrop(croppedImage);
      setShowCrop(false);
    };
  }, [cropArea, image, onCrop]);

  const handleReset = useCallback(() => {
    setCropArea(null);
    onCrop(image);
    setShowCrop(false);
  }, [image, onCrop]);

  // 绑定原生事件：React 合成事件 touchmove 默认 passive=true，
  // 会导致 preventDefault 被忽略 → 页面跟着手指滚动，框选体验崩。
  // 所以用 useEffect 绑原生 listener 并显式 passive:false。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const onDown = (e) => handleStart(e);
    const onWinMove = (e) => handleMove(e);
    const onWinEnd = (e) => handleEnd(e);

    // 容器：鼠标按下 + 手指按下
    el.addEventListener("mousedown", onDown);
    el.addEventListener("touchstart", onDown, { passive: false });

    // 窗口级别（拖出容器也能继续跟随，框选区不因此截断）
    window.addEventListener("mousemove", onWinMove);
    window.addEventListener("mouseup", onWinEnd);
    window.addEventListener("touchmove", onWinMove, { passive: false });
    window.addEventListener("touchend", onWinEnd);
    window.addEventListener("touchcancel", onWinEnd);

    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("touchstart", onDown);
      window.removeEventListener("mousemove", onWinMove);
      window.removeEventListener("mouseup", onWinEnd);
      window.removeEventListener("touchmove", onWinMove);
      window.removeEventListener("touchend", onWinEnd);
      window.removeEventListener("touchcancel", onWinEnd);
    };
  }, [handleStart, handleMove, handleEnd]);

  if (!showCrop) return null;

  return (
    <div className="bg-white rounded-2xl shadow-md p-3 sm:p-4">
      <h3 className="text-sm font-bold text-gray-700 mb-2">裁剪衣服区域</h3>
      <p className="text-xs text-gray-500 mb-3">
        💻 电脑：鼠标拖拽 &nbsp;·&nbsp; 📱 手机：手指拖拽 → 框选衣服区域后点确认
      </p>

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg cursor-crosshair touch-none select-none"
        style={{ WebkitUserSelect: "none", userSelect: "none" }}
      >
        <img
          src={image.src}
          alt="裁剪预览"
          className="w-full h-auto"
          draggable={false}
        />
        
        {cropArea && (
          <div
            className="absolute border-2 border-green-500 bg-green-500/20"
            style={{
              left: `${(cropArea.x / image.width) * 100}%`,
              top: `${(cropArea.y / image.height) * 100}%`,
              width: `${(cropArea.width / image.width) * 100}%`,
              height: `${(cropArea.height / image.height) * 100}%`,
            }}
          />
        )}
        
        <div className="absolute inset-0 pointer-events-none">
          {cropArea ? (
            <div
              className="absolute inset-0 bg-black/40"
              style={{
                clipPath: `polygon(
                  0 0, 100% 0, 100% 100%, 0 100%,
                  0 0,
                  ${(cropArea.x / image.width) * 100}% ${(cropArea.y / image.height) * 100}%,
                  ${((cropArea.x + cropArea.width) / image.width) * 100}% ${(cropArea.y / image.height) * 100}%,
                  ${((cropArea.x + cropArea.width) / image.width) * 100}% ${((cropArea.y + cropArea.height) / image.height) * 100}%,
                  ${(cropArea.x / image.width) * 100}% ${((cropArea.y + cropArea.height) / image.height) * 100}%,
                  ${(cropArea.x / image.width) * 100}% ${(cropArea.y / image.height) * 100}%
                )`,
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-black/20" />
          )}
        </div>
      </div>
      
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleConfirm}
          disabled={!cropArea}
          className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-600 transition-colors"
        >
          确认裁剪
        </button>
        <button
          onClick={handleReset}
          className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
        >
          跳过裁剪
        </button>
      </div>
    </div>
  );
}
