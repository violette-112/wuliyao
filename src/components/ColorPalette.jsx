/**
 * 颜色色板列表
 * 展示图纸中使用的所有颜色
 * 点击复制HEX，hover高亮（复制兼容手机 HTTP 非安全上下文）
 */
import { useState, useCallback } from "react";
import { copyToClipboard } from "../lib/clipboard";

export default function ColorPalette({ usedColors, onColorHover }) {
  const [copied, setCopied] = useState(null);

  const handleCopy = useCallback(async (color) => {
    try {
      await copyToClipboard(color.hex);
      setCopied(color.coord);
      setTimeout(() => setCopied(null), 1500);
    } catch (err) {
      alert(`复制失败：${err?.message || "浏览器不支持"}`);
    }
  }, []);

  if (!usedColors || usedColors.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-bold text-gray-700 mb-3">
        使用颜色 ({usedColors.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {usedColors.map((color) => (
          <button
            key={color.coord}
            type="button"
            onClick={() => handleCopy(color)}
            onMouseEnter={() => onColorHover?.(color)}
            onMouseLeave={() => onColorHover?.(null)}
            className="group flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5 hover:border-game-green hover:shadow-sm transition-all active:scale-95"
            title={`${color.hex} - 点击复制`}
          >
            <div
              className="w-6 h-6 rounded border border-gray-200 shrink-0"
              style={{ backgroundColor: color.hex }}
            />
            <div className="text-left">
              <div className="text-[10px] font-mono text-gray-500 leading-tight">
                {color.hex}
              </div>
              <div className="text-[10px] font-bold text-gray-700 leading-tight">
                {color.coord}
              </div>
            </div>
            {copied === color.coord && (
              <span className="text-[10px] text-game-green font-bold">
                已复制!
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
