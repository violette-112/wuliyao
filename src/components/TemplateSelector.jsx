/**
 * 服装模板选择器
 * 分类展示：T恤、裙子、裤子、帽子
 * 点击分类展开子模板
 */
import { useState, useEffect } from "react";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "../data/templates.js";

const CATEGORY_ICONS = {
  tee: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M14 16 L4 26 L14 30 L14 56 L50 56 L50 30 L60 26 L50 16 L44 22 Q32 28 20 22 Z"
        fill="#e8f4f8" stroke="#4a90d9" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M20 22 Q32 32 44 22" fill="none" stroke="#4a90d9" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  dress: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M24 8 L40 8 L44 20 L56 56 L8 56 L20 20 Z"
        fill="#fce4ec" stroke="#e91e63" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M24 8 Q32 16 40 8" fill="none" stroke="#e91e63" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  pants: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M14 8 L50 8 L52 24 L42 56 L32 56 L32 24 L22 56 L12 56 L12 24 Z"
        fill="#e3f2fd" stroke="#1976d2" strokeWidth="2.5" strokeLinejoin="round"/>
    </svg>
  ),
  hat: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="32" cy="48" rx="28" ry="8" fill="#fff3e0" stroke="#ff9800" strokeWidth="2.5"/>
      <path d="M20 48 Q20 20 32 16 Q44 20 44 48" fill="#fff3e0" stroke="#ff9800" strokeWidth="2.5" strokeLinejoin="round"/>
    </svg>
  ),
};

const TEMPLATE_ICONS = {
  "simple-tee": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M10 14 L4 28 L14 30 L14 56 L50 56 L50 30 L60 28 L54 14 L44 20 Q32 24 20 20 Z"
        fill="#e8f4f8" stroke="#4a90d9" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M20 20 Q32 28 44 20" fill="none" stroke="#4a90d9" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  "tank-top": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M20 10 Q32 18 44 10 L50 18 Q46 16 46 58 L18 58 Q18 16 14 18 Z"
        fill="#e8f4f8" stroke="#4a90d9" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M20 10 Q32 20 44 10" fill="none" stroke="#4a90d9" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  "short-sleeve": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M14 16 L4 26 L14 30 L14 56 L50 56 L50 30 L60 26 L50 16 L44 22 Q32 28 20 22 Z"
        fill="#e8f4f8" stroke="#4a90d9" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M20 22 Q32 32 44 22" fill="none" stroke="#4a90d9" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  "long-sleeve": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M14 16 L2 40 L12 44 L14 56 L50 56 L52 44 L62 40 L50 16 L44 22 Q32 28 20 22 Z"
        fill="#e8f4f8" stroke="#4a90d9" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M20 22 Q32 32 44 22" fill="none" stroke="#4a90d9" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  "sleeveless-dress": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M22 8 L42 8 L46 20 L58 56 L6 56 L18 20 Z"
        fill="#fce4ec" stroke="#e91e63" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M22 8 Q32 16 42 8" fill="none" stroke="#e91e63" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  "short-sleeve-dress": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M12 16 L4 24 L14 28 L10 56 L54 56 L50 28 L60 24 L52 16 L44 20 Q32 26 20 20 Z"
        fill="#fce4ec" stroke="#e91e63" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M20 20 Q32 30 44 20" fill="none" stroke="#e91e63" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  "long-sleeve-dress": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M12 16 L2 36 L10 40 L8 56 L56 56 L54 40 L62 36 L52 16 L44 20 Q32 26 20 20 Z"
        fill="#fce4ec" stroke="#e91e63" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M20 20 Q32 30 44 20" fill="none" stroke="#e91e63" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  "robe": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M8 12 L2 56 L12 56 L14 44 L50 44 L52 56 L62 56 L56 12 L48 18 Q32 24 16 18 Z"
        fill="#e8f5e9" stroke="#388e3c" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M16 18 Q32 28 48 18" fill="none" stroke="#388e3c" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="32" y1="24" x2="32" y2="44" stroke="#388e3c" strokeWidth="2"/>
    </svg>
  ),
  "gown": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M20 6 L44 6 L48 18 L62 58 L2 58 L16 18 Z"
        fill="#f3e5f5" stroke="#7b1fa2" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M20 6 Q32 14 44 6" fill="none" stroke="#7b1fa2" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  "short-skirt": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="16" y="14" width="32" height="40" fill="#e3f2fd" stroke="#1976d2" strokeWidth="2.5" strokeLinejoin="round" rx="2"/>
    </svg>
  ),
  "long-skirt": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="16" y="10" width="32" height="50" fill="#e3f2fd" stroke="#1976d2" strokeWidth="2.5" strokeLinejoin="round" rx="2"/>
    </svg>
  ),
  "shorts": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="14" y="14" width="36" height="40" fill="#e3f2fd" stroke="#1976d2" strokeWidth="2.5" strokeLinejoin="round" rx="2"/>
    </svg>
  ),
  "long-pants": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="14" y="10" width="36" height="50" fill="#e3f2fd" stroke="#1976d2" strokeWidth="2.5" strokeLinejoin="round" rx="2"/>
    </svg>
  ),
  "cap": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* 帽身主体 - 放大填满卡片 */}
      <path d="M22 28 Q16 14 32 10 Q48 14 48 28 L48 44 Q32 50 22 44Z"
        fill="#1e88e5" stroke="#0d47a1" strokeWidth="2.5" strokeLinejoin="round"/>
      {/* 帽身拼接线 */}
      <path d="M32 14 Q32 28 30 44" fill="none" stroke="#0d47a1" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
      <path d="M24 14 Q22 28 22 44" fill="none" stroke="#0d47a1" strokeWidth="1.8" strokeLinecap="round" opacity="0.7"/>
      <path d="M42 14 Q44 28 48 44" fill="none" stroke="#0d47a1" strokeWidth="1.8" strokeLinecap="round" opacity="0.7"/>
      {/* 顶部纽扣 */}
      <circle cx="32" cy="10" r="3" fill="#1565c0" stroke="#0d47a1" strokeWidth="1.5"/>
      {/* 帽檐 */}
      <path d="M22 44 Q10 48 4 54 Q6 58 14 56 Q22 52 28 48Z"
        fill="#42a5f5" stroke="#0d47a1" strokeWidth="2.5" strokeLinejoin="round"/>
      {/* 帽檐底部阴影线 */}
      <path d="M6 57 Q16 54 26 50" fill="none" stroke="#0d47a1" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      {/* 后扣带 */}
      <path d="M48 38 Q54 42 54 46" fill="none" stroke="#0d47a1" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  "beanie": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="32" cy="52" rx="22" ry="5" fill="#ffccbc" stroke="#e64a19" strokeWidth="2.5"/>
      <path d="M12 52 Q10 20 32 10 Q54 20 52 52" fill="#ffccbc" stroke="#e64a19" strokeWidth="2.5" strokeLinejoin="round"/>
      <circle cx="32" cy="10" r="5" fill="#ff5722" stroke="#e64a19" strokeWidth="2"/>
    </svg>
  ),
  "top-hat": (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="32" cy="54" rx="28" ry="5" fill="#212121" stroke="#000" strokeWidth="2.5"/>
      <rect x="18" y="14" width="28" height="42" fill="#424242" stroke="#000" strokeWidth="2.5" rx="2"/>
      <rect x="16" y="48" width="32" height="6" fill="#212121" stroke="#000" strokeWidth="2" rx="1"/>
    </svg>
  ),
};

export default function TemplateSelector({ selected, onSelect }) {
  const [activeCategory, setActiveCategory] = useState("tee");

  // 当selected变化时，自动切换到对应分类
  useEffect(() => {
    if (!selected) return;
    for (const cat of TEMPLATE_CATEGORIES) {
      if (cat.templates.includes(selected.id)) {
        setActiveCategory(cat.id);
        break;
      }
    }
  }, [selected]);

  const currentCategory = TEMPLATE_CATEGORIES.find((c) => c.id === activeCategory);
  const currentTemplates = currentCategory
    ? currentCategory.templates
        .map((id) => TEMPLATES.find((t) => t.id === id))
        .filter(Boolean)
    : [];

  return (
    <div className="w-full">
      <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
        <span>🎽</span> 服装模板
      </h3>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {TEMPLATE_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`
                flex flex-col items-center p-2 rounded-lg border-2 transition-all duration-200
                ${
                  isActive
                    ? "border-game-green bg-green-50 shadow-md"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }
              `}
            >
              <div className="w-10 h-10 mb-1">
                {CATEGORY_ICONS[cat.id]}
              </div>
              <span className="text-xs font-bold text-gray-700">{cat.name}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {currentTemplates.map((template) => {
          const isSelected = selected.id === template.id;
          return (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className={`
                flex flex-col items-center p-2 rounded-lg border-2 transition-all duration-200
                ${
                  isSelected
                    ? "border-game-green bg-green-50 shadow-md"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                }
              `}
            >
              <div className="w-full aspect-square rounded mb-1 overflow-hidden bg-gray-50 p-1">
                {TEMPLATE_ICONS[template.id]}
              </div>
              <span className="text-xs font-bold text-gray-700">
                {template.name}
              </span>
              <span className="text-[10px] text-gray-400 mt-0.5 leading-tight text-center">
                {template.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
