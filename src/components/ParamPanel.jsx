/**
 * 参数面板
 * 包含：模板选择、生成模式、显示选项、图像调整、生成按钮
 */
import { useState } from "react";
import TemplateSelector from "./TemplateSelector.jsx";
import ApiKeyPanel from "./ApiKeyPanel.jsx";
import { hasApiKey } from "../lib/qwenAI.js";

export default function ParamPanel({
  template,
  onTemplateChange,
  params,
  onChange,
  onGenerate,
  hasImage,
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(hasApiKey());

  const handleApiKeyClose = () => {
    setShowApiKey(false);
    setApiKeyConfigured(hasApiKey());
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 space-y-6">
      {/* 模板选择器 */}
      <TemplateSelector selected={template} onSelect={onTemplateChange} />

      {/* 生成模式 */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>🔄</span> 生成模式
          </span>
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            className="text-xs text-game-green hover:text-game-green/80 font-normal"
          >
            ⚙️ AI设置
          </button>
        </h3>
        <div className="space-y-2">
          <button
            onClick={() => onChange({ ...params, mode: "ai" })}
            className={`
              w-full px-3 py-2 rounded-lg text-sm font-semibold transition-all text-left
              ${
                params.mode === "ai"
                  ? "bg-game-green text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }
            `}
          >
            🧠 AI大模型识别（最准）
            <div className="text-xs mt-1 font-normal opacity-80">
              千问大模型识别衣服，准确率最高
              {apiKeyConfigured ? <span className="ml-1">✓</span> : <span className="ml-1 text-yellow-500">⚠需配置</span>}
            </div>
          </button>
          <button
            onClick={() => onChange({ ...params, mode: "template" })}
            className={`
              w-full px-3 py-2 rounded-lg text-sm font-semibold transition-all text-left
              ${
                params.mode === "template"
                  ? "bg-game-green text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }
            `}
          >
            🎨 手动选模板填色
            <div className="text-xs mt-1 font-normal opacity-80">
              手动选择模板，提取颜色填充
            </div>
          </button>
        </div>
      </div>

      {/* API Key 配置面板 */}
      {showApiKey && (
        <ApiKeyPanel onClose={handleApiKeyClose} />
      )}

      {/* 生成按钮 */}
      <button
        onClick={onGenerate}
        disabled={!hasImage}
        className={`
          w-full py-3 rounded-xl font-bold text-sm transition-all
          ${
            hasImage
              ? "bg-game-green text-white hover:bg-green-600 shadow-md active:scale-95"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }
        `}
      >
        生成图纸
      </button>
    </div>
  );
}
