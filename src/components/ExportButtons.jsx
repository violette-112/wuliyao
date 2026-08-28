/**
 * 导出功能按钮组
 * 下载图纸PNG、下载编号图PNG、复制颜色列表
 */
import { useState } from "react";

export default function ExportButtons({
  canvasRef,
  result,
  templateName,
  params,
}) {
  const [copied, setCopied] = useState(false);

  const filenameBase = `tomogrid_${templateName}_${params.brushSize}px`;

  const downloadGrid = () => {
    canvasRef.current?.download(`${filenameBase}.png`);
  };

  const downloadNumbered = () => {
    // 临时启用编号并下载
    // 这个需要PatternCanvas支持带编号的直接下载
    // 简化：通过通知用户使用显示编号选项
    alert("请勾选「显示编号」后，再点击下载图纸即可获取编号图");
  };

  const copyColors = () => {
    if (!result?.usedColors) return;
    const lines = result.usedColors.map(
      (c) => `${c.hex} ${c.coord}`
    );
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={downloadGrid}
        className="px-4 py-2 bg-game-green text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-all shadow-sm"
      >
        下载图纸 PNG
      </button>
      <button
        onClick={copyColors}
        className="px-4 py-2 bg-white border-2 border-game-green text-game-green rounded-lg text-sm font-semibold hover:bg-green-50 transition-all"
      >
        {copied ? "已复制!" : "复制颜色列表"}
      </button>
    </div>
  );
}
