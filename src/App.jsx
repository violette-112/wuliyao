/**
 * Tomodachi Create 主应用
 * 朋友收集 梦想生活 · 图案设计工具
 */
import { useState, useRef, useCallback, useEffect } from "react";
import Header from "./components/Header.jsx";
import UploadZone from "./components/UploadZone.jsx";
import CropTool from "./components/CropTool.jsx";
import ParamPanel from "./components/ParamPanel.jsx";
import PatternCanvas from "./components/PatternCanvas.jsx";
import ColorPalette from "./components/ColorPalette.jsx";
import ExportButtons from "./components/ExportButtons.jsx";
import ExampleGallery from "./components/ExampleGallery.jsx";
import { DEFAULT_TEMPLATE, TEMPLATES } from "./data/templates.js";
import { TOMODACHI_PALETTE } from "./data/palette.js";

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("").toUpperCase();
}
import { processImage, adjustImage } from "./lib/pixelEngine.js";
import { generateSmartTemplateFill, fillTemplateSmart, fillFourViews, adjustAnalysisBrightnessSaturation, adjustColorBrightnessSaturation } from "./lib/smartFill.js";
import { generateTemplateFill } from "./lib/templateFill.js";
import {
  analyzeClothingWithAI,
  aiResultToSmartAnalysis,
  selectTemplateFromAI,
  hasApiKey,
} from "./lib/qwenAI.js";

function App() {
  const [image, setImage] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [imageName, setImageName] = useState("");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [result, setResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCrop, setShowCrop] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [params, setParams] = useState({
    colorCount: 6,
    brushSize: 8,
    gridSize: DEFAULT_TEMPLATE.gridSize,
    showGrid: true,
    showNumbers: false,
    brightness: 0,
    saturation: 0,
    mode: "ai",
  });

  const canvasRef = useRef(null);
  const processTimeoutRef = useRef(null);

  const process = useCallback(async () => {
    if (!image) return;

    setIsProcessing(true);
    setAiError(null);

    try {
      let processed;
      
      if (params.mode === "ai") {
        if (!hasApiKey()) {
          setAiError("请先在左侧面板配置千问 API Key");
          setIsProcessing(false);
          return;
        }

        let aiAnalysis = aiResult;

        if (!aiAnalysis) {
          setIsAiLoading(true);
          try {
            aiAnalysis = await analyzeClothingWithAI(image);
            setAiResult(aiAnalysis);
          } catch (e) {
            setAiError(e.message || "AI识别失败");
            setIsAiLoading(false);
            setIsProcessing(false);
            throw e;
          } finally {
            setIsAiLoading(false);
          }
        }

        const selectedTemplate = selectTemplateFromAI(aiAnalysis);
        if (selectedTemplate && selectedTemplate.id !== template.id) {
          setTemplate(selectedTemplate);
        }

        let smartAnalysis = aiResultToSmartAnalysis(aiAnalysis);

        // 在颜色量化前应用亮度/饱和度调整，确保滑块变化能生效
        if (params.brightness !== 0 || params.saturation !== 0) {
          smartAnalysis = adjustAnalysisBrightnessSaturation(smartAnalysis, params.brightness, params.saturation);
        }

        const gridSize = selectedTemplate.gridSize;

        const fillResult = fillTemplateSmart(
          selectedTemplate.mask,
          smartAnalysis,
          gridSize,
          selectedTemplate.category
        );

        // 从原图提取像素数据用于采样
        let imgData = null;
        try {
          const tmpCanvas = document.createElement("canvas");
          tmpCanvas.width = image.width;
          tmpCanvas.height = image.height;
          const tmpCtx = tmpCanvas.getContext("2d");
          tmpCtx.drawImage(image, 0, 0);
          imgData = tmpCtx.getImageData(0, 0, image.width, image.height);
        } catch (e) {
          console.error("提取图像数据失败:", e);
        }

        const fourViewResult = fillFourViews(selectedTemplate, smartAnalysis, imgData);

        // ===== usedColors：必须100%基于四视图实际绘制的paletteIndices =====
        // 用户反复强调："使用颜色显示的颜色，要和实际使用的颜色相同"
        // 绝对不能再混用AI/像素校正的原始RGB！必须用TOMODACHI_PALETTE中真实绘制的index对应的颜色
        const usedColors = [];
        const seenIdx = new Set();
        const views = [fourViewResult.front, fourViewResult.back, fourViewResult.leftSleeve, fourViewResult.rightSleeve];
        for (const view of views) {
          if (!view || !view.paletteIndices) continue;
          for (const idx of view.paletteIndices) {
            if (idx >= 0 && !seenIdx.has(idx)) {
              seenIdx.add(idx);
              const color = TOMODACHI_PALETTE[idx];
              if (!color) continue;
              usedColors.push({
                index: idx,
                hex: color.hex,
                rgb: color.rgb.slice(),
                row: color.row,
                col: color.col,
                coord: "", // 标签在下面通过"最近调色板颜色匹配"补
              });
            }
          }
        }
        // 对已有usedColors中的color，根据其调色板RGB去匹配"分析对象中带coord标签的最接近颜色"，补标签
        const labelCandidates = [];
        if (smartAnalysis?.innerLayerColor &&
            (smartAnalysis.innerLayerExtendsBelow || smartAnalysis.hasInnerLayerAtCuffs)) {
          labelCandidates.push({ rgb: smartAnalysis.innerLayerColor, name: "内搭" });
        }
        if (smartAnalysis?.collar?.color) {
          labelCandidates.push({ rgb: smartAnalysis.collar.color, name: "领子" });
        }
        if (smartAnalysis?.buttons?.color && smartAnalysis.buttons.count > 0) {
          labelCandidates.push({ rgb: smartAnalysis.buttons.color, name: "纽扣" });
        }
        if (smartAnalysis?.zipper?.color && smartAnalysis.zipper.position) {
          labelCandidates.push({ rgb: smartAnalysis.zipper.color, name: "拉链" });
        }
        if (smartAnalysis?.logo?.hasLogo && smartAnalysis.logo.color) {
          labelCandidates.push({ rgb: smartAnalysis.logo.color, name: "Logo" });
        }
        // 主色/辅色标签
        if (smartAnalysis?.colors && smartAnalysis.colors[0]) {
          labelCandidates.push({ rgb: smartAnalysis.colors[0], name: "主色" });
          if (smartAnalysis.colors[1]) {
            labelCandidates.push({ rgb: smartAnalysis.colors[1], name: "辅色" });
          }
        }
        for (const uc of usedColors) {
          let bestName = null;
          let bestDist = 30; // 与调色板颜色距离<=30才贴标签
          for (const c of labelCandidates) {
            if (!c.rgb) continue;
            const d = Math.abs(c.rgb[0]-uc.rgb[0]) + Math.abs(c.rgb[1]-uc.rgb[1]) + Math.abs(c.rgb[2]-uc.rgb[2]);
            if (d < bestDist) { bestDist = d; bestName = c.name; }
          }
          if (bestName) uc.coord = bestName;
        }

        processed = {
          ...fillResult,
          gridSize,
          usedColors,
          aiResult: aiAnalysis,
          analysis: smartAnalysis,
          template: selectedTemplate,
          fourView: fourViewResult,
        };
      } else if (params.mode === "template") {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = image.width;
        tempCanvas.height = image.height;
        const tempCtx = tempCanvas.getContext("2d");
        tempCtx.drawImage(image, 0, 0);
        let imageData = tempCtx.getImageData(0, 0, image.width, image.height);

        if (params.brightness !== 0 || params.saturation !== 0) {
          imageData = adjustImage(imageData, params.brightness, params.saturation);
        }

        const gridSize = template.gridSize;
        processed = generateTemplateFill(
          imageData,
          template,
          gridSize,
          params.colorCount
        );
      }
      
      setResult(processed);
    } catch (e) {
      console.error("处理失败:", e);
    } finally {
      setIsProcessing(false);
    }
  }, [image, template, params]);

  // 防抖：参数变化后300ms自动重新生成
  useEffect(() => {
    if (!image) return;
    clearTimeout(processTimeoutRef.current);
    processTimeoutRef.current = setTimeout(() => {
      process();
    }, 300);
    return () => clearTimeout(processTimeoutRef.current);
  }, [params, template, image, process]);

  useEffect(() => {
    if (!aiResult) return;
    const newTemplate = selectTemplateFromAI(aiResult);
    if (newTemplate && newTemplate.id !== template.id) {
      setTemplate(newTemplate);
    }
  }, [aiResult]);

  const handleUpload = useCallback((img, name) => {
    setOriginalImage(img);
    setImageName(name);
    setShowCrop(true);
  }, []);

  const handleCrop = useCallback((croppedImage) => {
    setImage(croppedImage);
    setShowCrop(false);
    setAiResult(null);
    setAiError(null);

    setTimeout(() => {
      try {
        const processed = processImage(croppedImage, {
          gridSize: template.gridSize,
          colorCount: 12,
          mask: template.mask,
          template,
          brightness: 0,
          saturation: 0,
        });
        setResult(processed);
      } catch (e) {
        console.error("处理失败:", e);
      }
    }, 0);
  }, [template]);

  const handleTemplateChange = useCallback((newTemplate) => {
    setTemplate(newTemplate);
    setParams((prev) => ({
      ...prev,
      gridSize: newTemplate.gridSize,
    }));
  }, []);

  const handleParamsChange = useCallback((newParams) => {
    setParams(newParams);
  }, []);

  const handleGenerate = useCallback(() => {
    process();
  }, [process]);

  return (
    <div className="min-h-screen bg-game-bg font-body">
      <Header />

      {/* 主区域 */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 pb-8 sm:pb-12">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
          {/* 左栏 */}
          <div className="w-full md:w-[35%] space-y-4 sm:space-y-6">
            {/* 上传区 */}
            <UploadZone onUpload={handleUpload} />

            {/* 原图预览 + 裁剪工具 */}
            {originalImage && showCrop && (
              <CropTool image={originalImage} onCrop={handleCrop} />
            )}

            {image && !showCrop && (
              <div className="bg-white rounded-2xl shadow-md p-3 sm:p-4">
                <h3 className="text-sm font-bold text-gray-700 mb-2">
                  原图预览
                </h3>
                <img
                  src={image.src}
                  alt={imageName}
                  className="max-w-[300px] w-full h-auto rounded-lg border border-gray-200 mx-auto"
                />
              </div>
            )}

            {/* 参数面板 */}
            <ParamPanel
              template={template}
              onTemplateChange={handleTemplateChange}
              params={params}
              onChange={handleParamsChange}
              onGenerate={handleGenerate}
              hasImage={!!image}
            />
          </div>

          {/* 右栏 */}
          <div className="flex-1 space-y-4 sm:space-y-6">
            {/* 模板标签 */}
            <div className="bg-white rounded-2xl shadow-md px-4 sm:px-5 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-700">
                  当前模板：
                </span>
                <span className="text-sm font-semibold text-game-green">
                  {template.name}
                </span>
              </div>
              {isProcessing && (
                <span className="text-xs text-gray-400 animate-pulse">
                  {isAiLoading ? "AI识别中..." : "处理中..."}
                </span>
              )}
            </div>

            {/* AI 识别结果 */}
            {params.mode === "ai" && (
              <div className="bg-white rounded-2xl shadow-md p-4">
                {aiError ? (
                  <div className="text-sm text-red-500">
                    ⚠️ {aiError}
                  </div>
                ) : isAiLoading ? (
                  <div className="text-sm text-gray-500 animate-pulse">
                    🤖 千问大模型正在识别中...
                  </div>
                ) : aiResult ? (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <span>🧠</span> AI识别结果
                      <span className="text-xs font-normal text-gray-400">
                        (置信度: {(aiResult.confidence * 100).toFixed(0)}%)
                      </span>
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-game-bg rounded-lg p-2">
                        <div className="text-gray-500">类型</div>
                        <div className="font-semibold text-gray-700">{aiResult.clothingType}</div>
                      </div>
                      <div className="bg-game-bg rounded-lg p-2">
                        <div className="text-gray-500">袖长</div>
                        <div className="font-semibold text-gray-700">
                          {aiResult.sleeveLength === "short" ? "短袖" : aiResult.sleeveLength === "long" ? "长袖" : "无袖"}
                          {aiResult.hasHood ? " · 连帽" : ""}
                        </div>
                      </div>
                      <div className="bg-game-bg rounded-lg p-2">
                        <div className="text-gray-500">主色</div>
                        <div className="font-semibold flex items-center gap-1">
                          <span
                            className="w-3 h-3 rounded border border-gray-300"
                            style={{ backgroundColor: aiResult.primaryColorHex }}
                          />
                          {aiResult.primaryColor}
                        </div>
                      </div>
                      <div className="bg-game-bg rounded-lg p-2">
                        <div className="text-gray-500">图案</div>
                        <div className="font-semibold text-gray-700">{aiResult.pattern}</div>
                      </div>
                    </div>
                    {aiResult.printPatterns && aiResult.printPatterns.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-500 mb-2">印花细节</div>
                        <div className="flex flex-wrap gap-2">
                          {aiResult.printPatterns.map((p, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1 bg-game-bg rounded px-2 py-1 text-xs"
                            >
                              <span
                                className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0"
                                style={{ backgroundColor: p.color }}
                              />
                              <span className="text-gray-700">{p.type}</span>
                              {p.position && (
                                <span className="text-gray-400">({p.position})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(aiResult.buttons || aiResult.zipper || aiResult.pockets || aiResult.hasStitching) && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-500 mb-2">细节信息</div>
                        <div className="flex flex-wrap gap-2">
                          {aiResult.buttons && (
                            <div className="bg-game-bg rounded px-2 py-1 text-xs">
                              <span className="text-gray-500">纽扣:</span>
                              <span className="text-gray-700 ml-1">{aiResult.buttons.count}颗</span>
                              {aiResult.buttons.position && (
                                <span className="text-gray-400">({aiResult.buttons.position})</span>
                              )}
                            </div>
                          )}
                          {aiResult.zipper && (
                            <div className="bg-game-bg rounded px-2 py-1 text-xs">
                              <span className="text-gray-500">拉链:</span>
                              <span className="text-gray-700 ml-1">{aiResult.zipper.position}</span>
                            </div>
                          )}
                          {aiResult.pockets && aiResult.pockets.count > 0 && (
                            <div className="bg-game-bg rounded px-2 py-1 text-xs">
                              <span className="text-gray-500">口袋:</span>
                              <span className="text-gray-700 ml-1">{aiResult.pockets.count}个</span>
                              <span className="text-gray-400">({aiResult.pockets.position})</span>
                            </div>
                          )}
                          {aiResult.hasStitching && (
                            <div className="bg-game-bg rounded px-2 py-1 text-xs">
                              <span className="text-gray-500">缝线:</span>
                              <span className="text-gray-700 ml-1">有</span>
                            </div>
                          )}
                          {aiResult.isOpenFront && (
                            <div className="bg-game-bg rounded px-2 py-1 text-xs">
                              <span className="text-gray-500">状态:</span>
                              <span className="text-gray-700 ml-1">敞开</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {aiResult.stripeDirection && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-500 mb-2">条纹信息</div>
                        <div className="flex flex-wrap gap-2">
                          <div className="bg-game-bg rounded px-2 py-1 text-xs">
                            <span className="text-gray-500">方向:</span>
                            <span className="text-gray-700 ml-1">{aiResult.stripeDirection === "vertical" ? "竖条纹" : "横条纹"}</span>
                          </div>
                          <div className="bg-game-bg rounded px-2 py-1 text-xs">
                            <span className="text-gray-500">数量:</span>
                            <span className="text-gray-700 ml-1">{aiResult.stripeCount}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">
                    上传图片后 AI 将自动识别
                  </div>
                )}
              </div>
            )}

            {/* 图纸画布 —— 始终渲染（有结果显示图案，无结果显示默认模板） */}
            {/* 画布容器加 max-w-full overflow-x-auto：iPhone SE 375px < 画布 384px 时只在这里出现横向滚动条，不破坏整页布局 */}
            <div className="bg-white rounded-2xl shadow-md p-4 sm:p-5 flex flex-col items-center w-full max-w-full overflow-x-auto">
              <PatternCanvas
                ref={canvasRef}
                result={result}
                template={template}
                showGrid={params.showGrid}
                showNumbers={params.showNumbers}
                analysis={result?.analysis}
              />
              {result && (
                <>
                  <div className="w-full mt-4">
                    <ColorPalette usedColors={result.usedColors} />
                  </div>

                  {/* 显示选项 */}
                  <div className="w-full mt-4">
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <span>⚙️</span> 显示选项
                    </h3>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={params.showGrid}
                          onChange={(e) =>
                            handleParamsChange({ ...params, showGrid: e.target.checked })
                          }
                          className="w-4 h-4 accent-game-green rounded"
                        />
                        <span className="text-sm text-gray-600">显示网格线</span>
                      </label>
                    </div>
                  </div>

                  {/* 图像调整 */}
                  <div className="w-full mt-4">
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <span>🔆</span> 图像调整
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>亮度</span>
                          <span>{params.brightness > 0 ? `+${params.brightness}` : params.brightness}</span>
                        </div>
                        <input
                          type="range"
                          min={-50}
                          max={50}
                          value={params.brightness}
                          onChange={(e) =>
                            handleParamsChange({ ...params, brightness: parseInt(e.target.value) })
                          }
                          className="w-full accent-game-green"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>饱和度</span>
                          <span>{params.saturation > 0 ? `+${params.saturation}` : params.saturation}</span>
                        </div>
                        <input
                          type="range"
                          min={-50}
                          max={50}
                          value={params.saturation}
                          onChange={(e) =>
                            handleParamsChange({ ...params, saturation: parseInt(e.target.value) })
                          }
                          className="w-full accent-game-green"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="w-full mt-4 pt-4 border-t border-gray-100">
                    <ExportButtons
                      canvasRef={canvasRef}
                      result={result}
                      templateName={template.name}
                      params={params}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 示例区 */}
      <ExampleGallery />

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-gray-400">
        <p>Tomodachi Create · 朋友收集图案设计工具</p>
        <p className="mt-1">
          游戏画面及调色板版权归 Nintendo 所有 · 本工具为玩家自制
        </p>
      </footer>
    </div>
  );
}

export default App;
