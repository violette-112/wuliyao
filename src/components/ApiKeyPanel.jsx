/**
 * 千问 API Key 配置组件
 */
import { useState, useEffect } from "react";
import { getApiKey, setApiKey, hasApiKey } from "../lib/qwenAI.js";

export default function ApiKeyPanel({ onClose }) {
  const [apiKey, setApiKeyState] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setApiKeyState(getApiKey());
  }, []);

  const handleSave = () => {
    setApiKey(apiKey.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    if (onClose) onClose();
  };

  const handleClear = () => {
    setApiKeyState("");
    setApiKey("");
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-700 flex items-center gap-2">
          <span>🤖</span>
          千问大模型配置
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg"
          >
            ✕
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">
            API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
              placeholder="请输入阿里云 DashScope API Key"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
                       focus:outline-none focus:border-game-green focus:ring-2 focus:ring-game-green/20
                       pr-20 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
            >
              {showKey ? "隐藏" : "显示"}
            </button>
          </div>
        </div>

        <div className="bg-game-bg rounded-xl p-3 text-xs text-gray-500 space-y-1">
          <p>💡 <strong>获取方式：</strong></p>
          <p>1. 访问阿里云 DashScope 控制台</p>
          <p>2. 注册账号并开通百炼服务</p>
          <p>3. 在「API-KEY 管理」中创建 API Key</p>
          <p>4. 确保开通了 qwen-vl-max 模型</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-game-green text-white text-sm font-bold rounded-xl
                     hover:bg-game-green/90 transition-colors"
          >
            {isSaved ? "✓ 已保存" : "保存配置"}
          </button>
          {hasApiKey() && (
            <button
              onClick={handleClear}
              className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl
                       hover:bg-gray-200 transition-colors"
            >
              清除
            </button>
          )}
        </div>

        {hasApiKey() && (
          <div className="text-center text-xs text-game-green font-medium">
            ✓ API Key 已配置
          </div>
        )}
      </div>
    </div>
  );
}
