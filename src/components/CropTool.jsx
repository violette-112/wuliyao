/**
 * 手动裁剪组件
 * 用户拖拽框选衣服区域
 */
import { useState, useRef, useEffect, useCallback } from "react";

export default function CropTool({ image, onCrop }) {
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [cropArea, setCropArea] = useState(null);
  const [showCrop, setShowCrop] = useState(true);
  const containerRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = image.width / rect.width;
    const scaleY = image.height / rect.height;
    
    setStartPos({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    });
    setIsDragging(true);
  }, [image]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = image.width / rect.width;
    const scaleY = image.height / rect.height;
    
    const endX = (e.clientX - rect.left) * scaleX;
    const endY = (e.clientY - rect.top) * scaleY;
    
    const area = {
      x: Math.min(startPos.x, endX),
      y: Math.min(startPos.y, endY),
      width: Math.abs(endX - startPos.x),
      height: Math.abs(endY - startPos.y),
    };
    
    setCropArea(area);
  }, [isDragging, startPos, image]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleConfirm = useCallback(() => {
    if (cropArea) {
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
    }
  }, [cropArea, image, onCrop]);

  const handleReset = useCallback(() => {
    setCropArea(null);
    onCrop(image);
    setShowCrop(false);
  }, [image, onCrop]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!showCrop) return null;

  return (
    <div className="bg-white rounded-2xl shadow-md p-4">
      <h3 className="text-sm font-bold text-gray-700 mb-2">裁剪衣服区域</h3>
      <p className="text-xs text-gray-500 mb-3">拖拽框选衣服区域，然后点击确认</p>
      
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg cursor-crosshair"
        onMouseDown={handleMouseDown}
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
