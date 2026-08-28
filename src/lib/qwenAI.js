/**
 * 千问视觉大模型识别服务
 * 通过阿里云 DashScope API 调用 Qwen-VL-Plus 模型
 * 识别图片中的衣服类型、颜色、图案等信息
 */

import { TEMPLATES, DEFAULT_TEMPLATE } from "../data/templates.js";
import { TOMODACHI_PALETTE } from "../data/palette.js";
import { findClosestColor } from "./colorDistance.js";

const DASHSCOPE_API_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

const STORAGE_KEY = "tomodachi_qwen_api_key";
const DEFAULT_API_KEY = "sk-ws-H.RXHDDHE.FEMz.MEQCIDaQmkJpQfKo4u58zsUQQHu_hul7FLNmk-DvNdS7czIaAiANaoizp0unsxzd0_Zx_eEJD94g_SsmvVrHyWdgov387A";

export function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_API_KEY;
}

export function setApiKey(key) {
  if (key) {
    localStorage.setItem(STORAGE_KEY, key);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function hasApiKey() {
  return !!getApiKey();
}

/**
 * 将图片转换为 base64
 */
function imageToBase64(img) {
  const canvas = document.createElement("canvas");
  const maxSize = 1024;
  let width = img.width;
  let height = img.height;

  if (width > maxSize || height > maxSize) {
    if (width > height) {
      height = (height / width) * maxSize;
      width = maxSize;
    } else {
      width = (width / height) * maxSize;
      height = maxSize;
    }
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.8);
}

const SYSTEM_PROMPT = `你是一个专业的服装识别助手。请仔细分析图片中的服装，并以JSON格式返回识别结果。

要求：
1. 识别服装类型（短袖T恤、长袖T恤、背心/吊带、卫衣、外套、连衣裙、衬衫、毛衣、长裤、短裤、半身短裙、半身长裙、鸭舌帽/棒球帽、针织帽/毛线帽、礼帽/高顶帽、长袍、礼服等）
   - **帽子类型识别非常重要**：
     - "鸭舌帽"或"棒球帽"：有帽檐、帽身较圆润的运动帽
     - "针织帽"或"毛线帽"：针织材质、顶部圆润、可能有毛球
     - "礼帽"或"高顶帽"：高帽身、宽帽檐、正式场合的帽子
   - **裙子类型识别**：
     - "半身短裙"：短款半身裙，长度在膝盖以上
     - "半身长裙"：长款半身裙，长度在膝盖以下
     - "无袖连衣裙"：无袖的连衣裙
     - "短袖连衣裙"：短袖的连衣裙
     - "长袖连衣裙"：长袖的连衣裙
     - "长袍"：长款袍子、睡袍、浴袍等
     - "礼服"：正式礼服、婚纱、晚礼服等
2. 识别主要颜色（主色、次色、装饰色），特别注意两色服装（上下不同颜色），颜色要尽量准确，不要过度加深深色区域。对于灰绿色、鼠尾草绿、卡其色、米色、浅灰等中性色，要仔细区分：灰绿色（sage green）偏向绿中带灰，不要识别为棕色或灰色；卡其色（khaki）偏向黄棕；米色偏向暖白
3. 识别图案类型（条纹、格子、印花、logo、纯色等）。**重要：缝线/车线/装饰线不属于条纹**，只有明显的、大面积的、重复的线条才算条纹
4. 识别领口类型（圆领、V领、翻领、立领、连帽等）。如果有翻领、立领、衬衫领等，统一识别为"翻领"
5. 识别袖长（短袖、长袖、无袖）
6. 如果有条纹，说明条纹方向（横条纹/竖条纹）和颜色。**只有当条纹宽度超过衣服宽度的5%且长度超过衣服长度的20%时才识别为条纹**，细小的装饰线、缝线不算条纹。注意袖子上的竖条纹（如Adidas三道杠）必须是明显的品牌条纹才算
7. 如果有logo，说明logo位置和颜色。logoType字段说明：
   - "adidas"：Adidas 三叶草/三道杠（必须是清晰的三叶草图案或三道杠条纹）
   - "nike"：Nike Swoosh（必须是清晰的勾形标志）
   - "star"：五角星（必须是明确的五角星形状）
   - "text"：文字logo（字母、单词、品牌名等，必须有可辨认的文字）
   - "emblem"：徽章/盾牌/标志形状
   - "crown"：皇冠形状
   - "triangle"：三角形
   - "diamond"：菱形
   - "circle"：圆形/椭圆形
   - "other"：其他形状（无法归类为以上类型）
   - 注意：不要随便把logo识别为"star"或"adidas"，只有明确对应形状才用。如果是文字logo，必须用text并在logoShape中描述文字内容。如果是小徽章/标志，用emblem。
   - logoShape：用简单文字描述logo的大致形状和内容，如"三角形"、"菱形"、"字母K"、"皇冠"、"马"、"字母FASHION"、"小盾牌带文字"等
8. 如果服装上半部分和下半部分颜色不同，设置isTwoTone为true。注意：内搭颜色（如T恤、衬衫）与外套颜色不同不属于两色服装，只有衣服本身上下部分颜色不同才算
9. 识别条纹：**条纹颜色和数量都非常重要，必须准确识别**。
   - stripeDirection：条纹方向（horizontal=横条纹/vertical=竖条纹/null=无条纹）
   - stripeCount：条纹数量（1-10）。**请仔细数清楚袖子上或身体上的条纹有几条**。一条粗条纹算1条，三条细条纹并排算3条，不要数错
   - stripeColors：条纹颜色名称数组，如["白色", "黑色"]。**条纹颜色通常是装饰色（accentColor），不是两色服装的下半部分颜色（secondaryColor）**。例如蓝色运动外套上的白色三道杠，条纹颜色是白色（accentColor），不是深蓝色
   - 注意：装饰性线条（如缝线、滚边、单条宽饰带）不算条纹，只有多条重复的明显条纹才算
   - 竖条纹常见于袖子外侧（如Adidas三道杠），横条纹常见于身体或下摆
   - 如果条纹颜色与主色不同，一定要返回准确的条纹颜色名称，如"白色"、"黑色"、"红色"等
10. 识别印花图案：仔细识别印花的具体类型和颜色，如红色蝴蝶、白色蝴蝶、粉色花朵、黄色圆点等
   - printPatterns数组中每个元素包含：type（具体图案类型，如"蝴蝶"、"花朵"、"圆点"等）、color（该印花的颜色Hex）、position（位置描述，如"左侧"、"右侧"、"胸口"、"下摆"、"全身"等）
   - 如果有多种不同颜色的同款印花（如红色蝴蝶和白色蝴蝶），分别列出
11. 识别纽扣与拉链：
    - 纽扣：圆形/扁圆形的小扣子，通常有扣眼或纽扣柄。如果没有纽扣，buttons字段必须设为null；如果有纽扣，必须准确返回count（数量，1-10）、color（颜色Hex）、position（位置：前中/左侧/右侧/前襟）、type（类型：纽扣=传统穿线纽扣，按扣=金属按扣/四合扣，卡扣=塑料卡扣）。**仔细数清楚纽扣数量**。
    - 拉链：细长金属/塑料齿，有拉链头/拉片。半拉链毛衣、立领拉链、运动外套等属于拉链。如果没有拉链，zipper字段必须设为null；如果有拉链，必须准确返回color（颜色Hex）、position（位置）和alignment（对齐方式）。
      **alignment判断非常重要**：
      - center：拉链在衣服正中间（如套头衫、半拉链毛衣、立领拉链）。这类衣服没有敞开的前襟，拉链从领口正中向下
      - left：拉链在左襟片线上（如敞开式外套的左侧前襟）
      - right：拉链在右襟片线上（如敞开式外套的右侧前襟）
      **半拉链毛衣、套头衫、立领拉链必须设为center，因为它们的拉链在正中间**
    - 注意：同一件衣服通常只有纽扣或拉链其中一种，不会同时有。有拉链头/拉片的一定是拉链，不是纽扣。有纽扣的外套（风衣、大衣、西装等）通常没有拉链。
12. 识别领子：只有当图片中确实有明显的翻领、立领时才识别为"翻领"。**圆领T恤、套头衫、连衣裙等没有翻领的衣服，collar字段必须设为null**。领子的颜色必须根据实际图片中领子的颜色来识别（不是衣服主色）。如果没有明显的翻领或立领，不要假设存在领子
13. 识别内搭颜色：只有当衣服确实有内搭露出（如敞开的外套内的T恤）时才识别。**大部分衣服没有内搭，innerLayerColor应设为null**。连衣裙、T恤、套头衫等通常没有内搭
    - 内搭条纹样式包括：innerLayerStripeDirection（vertical=竖条纹/horizontal=横条纹/null=纯色）、innerLayerStripeColor（条纹颜色Hex）
    - hasInnerLayerAtCuffs：内搭是否在袖口处可见（true/false）
    - innerLayerExtendsBelow：内搭是否超过外套底部（true/false）
    - **重要**：内搭条纹只有在内搭露出且有明显条纹时才设置。如果没有内搭或内搭是纯色，相关字段全部设为null
14. 识别口袋：仔细观察衣服是否有口袋。口袋可能是胸口口袋、腰部侧口袋、下摆口袋等。
   - 如果有口袋，count必须>0，并返回color、position、style
   - **重要**：如果确实没有口袋，count设为0
15. 识别袖口：仔细观察长袖袖口是否有细节设计。
    - hasCuffs：是否有明显的袖口设计（true/false）。**只有当袖口确实有特殊设计时才设为true**
    - cuffStyle：袖口样式（翻边/收口/松紧/罗纹/纽扣/条纹/印花/无特殊设计）
    - cuffColor：袖口颜色（如果和衣服主色不同，返回Hex；如果相同，设为null）
    - cuffPattern：袖口花纹/图案类型
    - **重要**：短袖衣服或袖口没有特殊设计时，hasCuffs设为false，相关字段设为null
16. 识别衣服是否敞开：**这是一个非常重要的判断，请仔细观察**。
    - isOpenFront=true：只有当衣服前襟明显敞开、未扣扣子、能看到大面积内搭（如T恤、毛衣等）时，设置为true
    - isOpenFront=false：以下情况必须设置为false：
      - 扣子已扣上，衣服完全闭合
      - 拉链已拉到脖子/胸部位置（如半拉链毛衣、立领拉链）
      - 衣服没有前襟开口设计（如套头衫、卫衣、连衣裙等）
    - **判断依据**：如果能看到衣服正面中间有明显的空隙，露出了内搭或皮肤，说明衣服是敞开的。但连衣裙、套头衫等通常是闭合的，isOpenFront必须为false
    - **不要错误判断**：只有领口处露出一点点皮肤或内搭（圆领、V领），不等于衣服敞开。衣服整体是闭合的，isOpenFront必须为false
17. 缝线识别：如果衣服上有明显的白色/浅色缝线（如牛仔夹克的白色车线），设置hasStitching为true，stitchingColor为缝线颜色。缝线不算条纹，仅作为装饰。
19. 识别领结/蝴蝶结：仔细观察领口位置是否有领结或蝴蝶结装饰。
    - 如果有领结/蝴蝶结，设置hasLogo为true，logoType设为"other"，logoShape设为"蝴蝶结"或"领结"，logoColor设为领结颜色，logoPosition设为"领口"。同时在printPatterns中添加一个类型为"蝴蝶结"或"领结"的图案
    - 如果领结是纯色的（如黑色小领结），一定要准确识别颜色
20. 识别花边/荷叶边：**只有当图片中确实有明显的花边或荷叶边装饰时才识别**。仔细观察衣服的袖口、领口、裙摆等边缘是否有花边或荷叶边。
    - **重要**：花边/荷叶边是额外的装饰层，不是衣服本身的边缘颜色。如果衣服只是有不同颜色的边缘（如裙摆有不同颜色的条纹），那可能是印花或条纹，不是花边
    - **不要假设**：不要假设裙子底部一定有白色蕾丝边。只有当图片中确实能看到蕾丝边或荷叶边的纹理和层次时，才识别为花边。大部分衣服没有花边
    - 如果确实有花边：在printPatterns中添加类型为"花边"或"荷叶边"的图案，position设为相应位置（下摆/袖口/领口），color设为花边的实际颜色
    - 连衣裙的裙摆通常没有额外的花边装饰，除非图片中确实能看到
21. 识别裙摆细节：对于连衣裙或半身裙，仔细观察裙摆是否有荷叶边、褶皱、开叉等设计。如果有，在printPatterns中添加相应的图案描述
22. 识别图案的尺寸和密度：**这是非常重要的判断，请仔细观察图案的实际大小和分布**。
    - 大朵花卉/大花（单朵花占整个面积10%以上）：type设为"大花"或"大朵花"
    - 中等花卉（单朵花占面积3-10%）：type设为"中花"或"花"
    - 小碎花（单朵花占面积3%以下）：type设为"小碎花"或"碎花"
    - 叶子（单独存在或与花搭配）：type设为"叶子"
    - 密度描述：对于"全身"位置，必须在type中说明密度，如"稀疏大花"、"密集小碎花"、"中等密度花"等
    - **判断标准**：
      - 如果图案是稀疏分布的（如大面积空白+少量大花），type应为"稀疏花"或"稀疏大花"
      - 如果图案是密集分布的（如波点、小碎花密布），type应为"密集花"或"密集小碎花"
    - 颜色：使用准确的Hex颜色值。如果图案是粉色花朵，颜色应为粉色Hex（如#FF69B4、#FFB6C1等）

请严格按照以下JSON格式返回，不要有额外的文字说明：

{
  "clothingType": "长袖外套",
  "sleeveLength": "long",
  "hasHood": false,
  "neckline": "连帽",
  "primaryColor": "浅蓝色",
  "primaryColorHex": "#4169E1",
  "secondaryColor": "深蓝色",
  "secondaryColorHex": "#00008B",
  "accentColor": "白色",
  "accentColorHex": "#FFFFFF",
  "pattern": "logo+条纹",
  "stripeDirection": "vertical",
  "stripeColors": ["白色"],
  "stripeCount": 3,
  "hasLogo": true,
  "logoPosition": "左胸",
  "logoColor": "#FFFFFF",
  "logoType": "adidas",
  "logoShape": "三叶草",
  "isTwoTone": true,
  "confidence": 0.95,
  "printPatterns": [
    {"type": "蝴蝶", "color": "#FF0000", "position": "左侧"},
    {"type": "花朵", "color": "#FF69B4", "position": "右侧"}
  ],
  "buttons": {"count": 5, "color": "#000000", "position": "前中", "type": "纽扣"},
  "zipper": {"color": "#808080", "position": "前中", "alignment": "center"},
  "collar": {"type": "翻领", "color": "#4169E1"},
  "innerLayerColor": "#FFFFFF",
  "innerLayerStripeDirection": "vertical",
  "innerLayerStripeColor": "#000000",
  "hasInnerLayerAtCuffs": false,
  "innerLayerExtendsBelow": false,
  "isOpenFront": true,
  "pockets": {"count": 2, "color": "#1E3A8A", "position": "胸前", "style": "贴袋"},
  "hasCuffs": true,
  "cuffStyle": "翻边",
  "cuffColor": null,
  "cuffButton": false,
  "cuffPattern": "条纹",
  "cuffPatternColor": "#FFFFFF",
  "hasStitching": true,
  "stitchingColor": "#FFFFFF",
  "hasDrawstrings": false,
  "drawstringColor": null,
  "drawstringPosition": "领口两侧",
  "drawstringLength": "short",
  "layout": {
    "collar": {"type": "翻领", "color": "#4169E1", "leftStart": {"row": 1, "col": 2}, "leftEnd": {"row": 3, "col": 3}, "rightStart": {"row": 1, "col": 5}, "rightEnd": {"row": 3, "col": 4}},
    "buttons": [{"row": 5, "col": 3}, {"row": 7, "col": 3}],
    "logo": {"row": 3, "col": 6, "type": "text", "shape": "字母K"},
    "pockets": [{"row": 6, "col": 1}, {"row": 6, "col": 6}],
    "zipper": {"startRow": 2, "endRow": 8, "col": 4, "alignment": "center"},
    "innerLayer": {"visibleRows": [2,3,4,5,6,7,8], "centerCol": 3, "width": 2}
  }
}

字段说明：
- clothingType: 服装类型，如"短袖T恤"、"长袖连衣裙"、"鸭舌帽"、"针织帽"、"礼帽"、"短裤"、"长裤"、"半身短裙"、"半身长裙"、"长袍"、"礼服"等
- sleeveLength: "short" | "long" | "sleeveless"
- pattern: "纯色" | "条纹" | "格子" | "印花" | "logo" | "其他"
- stripeDirection: "horizontal" | "vertical" | null
- confidence: 0-1 之间的置信度
- isTwoTone: 当服装上下部分颜色明显不同时为true，primaryColor为上半部分颜色，secondaryColor为下半部分颜色
- printPatterns: 印花图案数组，每个元素包含type（图案类型）、color（颜色Hex）、position（位置描述）
- buttons: 纽扣信息，包含count（数量）、color（颜色Hex）、position（位置）、type（类型：纽扣/按扣/卡扣）
- zipper: 拉链信息，包含color（颜色Hex）、position（位置）、alignment（对齐方式：center=正中间如套头衫/半拉链毛衣，left=左襟片线如敞开外套，right=右襟片线）
- collar: 领子信息，包含type（类型：翻领、立领等）、color（颜色Hex，根据实际领子颜色，不是主色）
- innerLayerColor: 内搭颜色Hex，如白色#FFFFFF
- innerLayerStripeDirection: 内搭条纹方向（vertical=竖条纹/horizontal=横条纹/null=纯色）
- innerLayerStripeColor: 内搭条纹颜色Hex
- hasInnerLayerAtCuffs: 内搭是否在袖口处可见（true/false），默认false
- innerLayerExtendsBelow: 内搭是否超过外套底部（true/false），默认false
- isOpenFront: 衣服是否敞开（true=敞开，前胸可见内搭/false=闭合）
- pockets: 口袋信息，包含count（数量，0-4）、color（颜色Hex）、position（位置：胸前/腰部/下摆）、style（贴袋/插袋/牛仔袋）
- hasCuffs: 是否有明显的袖口翻边设计（true/false）
- cuffStyle: 袖口样式（翻边/收口/松紧/罗纹/纽扣/条纹/印花/无特殊设计）
- cuffColor: 袖口颜色（如果和衣服主色不同，返回Hex；如果相同，设为null）
- cuffButton: 袖口是否有纽扣（true/false）
- cuffPattern: 袖口花纹/图案类型（条纹/格子/印花/纯色），如果袖口有明显花纹，返回具体类型；否则设为null
- cuffPatternColor: 袖口花纹/条纹颜色（Hex）。如果袖口有条纹或花纹，必须返回其准确颜色Hex值，不要设为null
- layout: 正面视图各部件的精确绘制坐标，基于9行×8列的网格：
  - 行0-2：领口/肩部区域，行3-8：身体区域，列3-4：中间区域
  - collar: 领子位置，leftStart/leftEnd/rightStart/rightEnd分别指定左右领的起点和终点坐标（row, col）
  - buttons: 纽扣数组，每个元素指定row和col（行必须在4-8之间，避开领口区域）
  - logo: logo位置，row和col指定中心点
  - pockets: 口袋数组，每个元素指定row和col（行必须在5-8之间）
  - zipper: 拉链起止位置，startRow/endRow/col/alignment指定。alignment是最重要的字段：center=正中间（套头衫/半拉链毛衣/立领拉链），left=左襟片线（敞开外套），right=右襟片线。col作为辅助：center时col设为4（中间偏右列），left时col设为3，right时col设为4
  - innerLayer: 内搭显示区域，visibleRows为可见行数组，centerCol为中间列，width为宽度（格子数）
  - 注意：坐标必须根据实际图片中部件的位置来确定，不要套用固定模板

注意：
- 颜色名称用中文描述，Hex颜色尽量准确
- 如果某项无法确定，设为null或false
- 优先识别logo（如Adidas三叶草、Nike Swoosh等品牌标志）
- 如果没有印花、纽扣、拉链、领子、内搭，对应字段设为null
- **帽子类服装：sleeveLength设为"none"，hasHood设为false**
- **裤子类服装：sleeveLength设为"none"，hasHood设为false**
- **裙子类服装：根据实际袖长设置sleeveLength，半身裙设为"none"**`;

/**
 * 调用千问视觉模型识别服装
 */
export async function analyzeClothingWithAI(image, apiKey) {
  const key = apiKey || getApiKey();
  if (!key) {
    throw new Error("请先配置千问 API Key");
  }

  const base64Image = imageToBase64(image);

  const requestBody = {
    model: "qwen3-vl-plus",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: base64Image,
            },
          },
          {
            type: "text",
            text: "请识别这张图片中的服装信息，返回JSON格式。",
          },
        ],
      },
    ],
    temperature: 0.1,
  };

  try {
    const response = await fetch(DASHSCOPE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API调用失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("API返回为空");
    }

    return parseAIResponse(content);
  } catch (error) {
    console.error("AI识别失败:", error);
    throw error;
  }
}

/**
 * 解析 AI 返回的 JSON
 */
function parseAIResponse(content) {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return validateResult(result);
    }
    throw new Error("无法解析JSON");
  } catch (error) {
    console.error("解析AI响应失败:", error);
    throw new Error("AI返回格式错误");
  }
}

/**
 * 验证和标准化识别结果
 */
function validateResult(result) {
  return {
    clothingType: result.clothingType || "T恤",
    sleeveLength: result.sleeveLength || "short",
    hasHood: !!result.hasHood,
    neckline: result.neckline || "圆领",
    primaryColor: result.primaryColor || "未知",
    primaryColorHex: result.primaryColorHex || "#808080",
    secondaryColor: result.secondaryColor || null,
    secondaryColorHex: result.secondaryColorHex || null,
    accentColor: result.accentColor || null,
    accentColorHex: result.accentColorHex || null,
    pattern: result.pattern || "纯色",
    stripeDirection: result.stripeDirection || null,
    stripeColors: result.stripeColors || [],
    stripeCount: result.stripeCount || 0,
    hasLogo: !!result.hasLogo,
    logoPosition: result.logoPosition || null,
    logoColor: result.logoColor || null,
    logoType: result.logoType || null,
    logoShape: result.logoShape || null,
    isTwoTone: !!result.isTwoTone,
    confidence: result.confidence || 0.5,
    printPatterns: result.printPatterns || null,
    buttons: result.buttons || null,
    zipper: result.zipper || null,
    collar: result.collar || null,
    innerLayerColor: result.innerLayerColor || null,
    innerLayerStripeDirection: result.innerLayerStripeDirection || null,
    innerLayerStripeColor: result.innerLayerStripeColor || null,
    hasInnerLayerAtCuffs: !!result.hasInnerLayerAtCuffs,
    innerLayerExtendsBelow: !!result.innerLayerExtendsBelow,
    isOpenFront: !!result.isOpenFront,
    pockets: result.pockets || null,
    hasCuffs: !!result.hasCuffs,
    cuffStyle: result.cuffStyle || null,
    cuffColor: result.cuffColor || null,
    cuffButton: !!result.cuffButton,
    cuffPattern: result.cuffPattern || null,
    cuffPatternColor: result.cuffPatternColor || null,
    hasStitching: !!result.hasStitching,
    stitchingColor: result.stitchingColor || null,
    hasDrawstrings: !!result.hasDrawstrings,
    drawstringColor: result.drawstringColor || null,
    drawstringPosition: result.drawstringPosition || "领口两侧",
    layout: result.layout || null,
  };
}

/**
 * Hex 转 RGB
 */
function hexToRgb(hex) {
  if (!hex) return [128, 128, 128];
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [128, 128, 128];
}

/**
 * 根据 AI 识别结果选择模板
 */
export function selectTemplateFromAI(aiResult) {
  if (!aiResult) return DEFAULT_TEMPLATE;

  const find = (id) => TEMPLATES.find((t) => t.id === id) || DEFAULT_TEMPLATE;

  const type = aiResult.clothingType || "";
  const lowerType = type.toLowerCase();

  if (lowerType.includes("长裤") || lowerType.includes("牛仔裤") || lowerType.includes("休闲裤") || lowerType.includes("西裤")) {
    return find("long-pants");
  }
  if (lowerType.includes("短裤") || lowerType.includes("热裤") || lowerType.includes("五分裤")) {
    return find("shorts");
  }
  if (lowerType.includes("半身短裙") || (lowerType.includes("短裙") && lowerType.includes("半身"))) {
    return find("short-skirt");
  }
  if (lowerType.includes("半身长裙") || (lowerType.includes("长裙") && lowerType.includes("半身"))) {
    return find("long-skirt");
  }
  if (lowerType.includes("半身裙")) {
    return find("long-skirt");
  }
  if (lowerType.includes("礼服")) {
    return find("gown");
  }
  if (lowerType.includes("长袍") || lowerType.includes("睡袍") || lowerType.includes("浴袍")) {
    return find("robe");
  }
  if (lowerType.includes("长袖连衣裙") || (lowerType.includes("连衣裙") && aiResult.sleeveLength === "long")) {
    return find("long-sleeve-dress");
  }
  if (lowerType.includes("短袖连衣裙") || (lowerType.includes("连衣裙") && aiResult.sleeveLength === "short")) {
    return find("short-sleeve-dress");
  }
  if (lowerType.includes("无袖连衣裙") || lowerType.includes("背心裙") || (lowerType.includes("连衣裙") && aiResult.sleeveLength === "sleeveless")) {
    return find("sleeveless-dress");
  }
  if (lowerType.includes("连衣裙") || lowerType.includes("裙")) {
    if (aiResult.sleeveLength === "long") {
      return find("long-sleeve-dress");
    }
    if (aiResult.sleeveLength === "short") {
      return find("short-sleeve-dress");
    }
    return find("sleeveless-dress");
  }
  if (lowerType.includes("针织帽") || lowerType.includes("毛线帽") || lowerType.includes("冷帽") || lowerType.includes("豆豆帽")) {
    return find("beanie");
  }
  if (lowerType.includes("礼帽") || lowerType.includes("高顶帽") || lowerType.includes("绅士帽") || lowerType.includes("爵士帽")) {
    return find("top-hat");
  }
  if (lowerType.includes("鸭舌帽") || lowerType.includes("棒球帽") || lowerType.includes("运动帽") || lowerType.includes("帽")) {
    return find("cap");
  }

  if (lowerType.includes("连帽") || lowerType.includes("卫衣") || lowerType.includes("帽衫") || aiResult.hasHood) {
    if (aiResult.sleeveLength === "short") {
      return find("short-sleeve");
    }
    return find("long-sleeve");
  }
  if (lowerType.includes("背心") || lowerType.includes("吊带") || lowerType.includes("无袖") || aiResult.sleeveLength === "sleeveless") {
    return find("tank-top");
  }
  if (lowerType.includes("长袖") || lowerType.includes("外套") || lowerType.includes("夹克") || lowerType.includes("风衣") || lowerType.includes("毛衣") || aiResult.sleeveLength === "long") {
    return find("long-sleeve");
  }
  if (lowerType.includes("短袖") || lowerType.includes("t恤") || lowerType.includes("polo") || aiResult.sleeveLength === "short") {
    return find("short-sleeve");
  }

  return find("short-sleeve");
}

/**
 * 将 AI 识别结果转换为 smartFill 兼容的格式
 * 这样可以复用现有的填充逻辑
 */
/**
 * 优化颜色亮度，避免颜色过深
 * 对蓝色/深色系做额外提亮处理
 */
function adjustColorBrightness(rgb, minBrightness = 50) {
  const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  
  let targetBrightness = minBrightness;
  const isBlueish = rgb[2] > rgb[0] && rgb[2] > rgb[1];
  if (isBlueish && brightness < 100) {
    targetBrightness = Math.max(minBrightness, brightness + 15);
  }
  
  if (brightness >= targetBrightness) {
    return rgb;
  }
  
  const factor = targetBrightness / Math.max(brightness, 1);
  return [
    Math.min(255, Math.round(rgb[0] * factor)),
    Math.min(255, Math.round(rgb[1] * factor)),
    Math.min(255, Math.round(rgb[2] * factor)),
  ];
}

export function aiResultToSmartAnalysis(aiResult) {
  if (!aiResult) return null;

  let primaryRgb = hexToRgb(aiResult.primaryColorHex);
  primaryRgb = adjustColorBrightness(primaryRgb, 60);
  
  let secondaryRgb = aiResult.secondaryColorHex
    ? hexToRgb(aiResult.secondaryColorHex)
    : primaryRgb;
  secondaryRgb = adjustColorBrightness(secondaryRgb, 60);
  
  let accentRgb = aiResult.accentColorHex
    ? hexToRgb(aiResult.accentColorHex)
    : primaryRgb;
  accentRgb = adjustColorBrightness(accentRgb, 60);

  const colors = [primaryRgb];
  if (aiResult.secondaryColorHex && aiResult.secondaryColorHex !== aiResult.primaryColorHex) {
    colors.push(secondaryRgb);
  }
  if (aiResult.accentColorHex && aiResult.accentColorHex !== aiResult.primaryColorHex && aiResult.accentColorHex !== aiResult.secondaryColorHex) {
    colors.push(accentRgb);
  }

  const horizontalStripes = { hasStripes: false, stripes: [] };
  if (aiResult.pattern === "条纹" && aiResult.stripeDirection === "horizontal" && aiResult.stripeCount > 0) {
    horizontalStripes.hasStripes = true;

    const stripeColors = aiResult.stripeColors || [];
    const lighten = (rgb, ratio=0.2) => [
      Math.min(255, Math.round(rgb[0] + (255 - rgb[0]) * ratio)),
      Math.min(255, Math.round(rgb[1] + (255 - rgb[1]) * ratio)),
      Math.min(255, Math.round(rgb[2] + (255 - rgb[2]) * ratio)),
    ];

    const colorMappings = {};
    for (const colorName of stripeColors) {
      if (colorName === aiResult.secondaryColor && aiResult.secondaryColorHex) {
        colorMappings[colorName] = aiResult.secondaryColorHex;
      } else if (colorName === aiResult.accentColor && aiResult.accentColorHex) {
        colorMappings[colorName] = aiResult.accentColorHex;
      } else if (colorName.includes("白")) {
        colorMappings[colorName] = "#FFFFFF";
      } else if (colorName.includes("黑")) {
        colorMappings[colorName] = "#000000";
      } else if (colorName === aiResult.primaryColor) {
        // 主色同名条纹 = 近色微光（如黄裙金色闪线）→ 提亮20%派生，不再跳过
        colorMappings[colorName] = "__LIGHTEN__";
      } else {
        colorMappings[colorName] = "__LIGHTEN__"; // 未知颜色名 = 派生
      }
    }

    const maxStripes = Math.min(aiResult.stripeCount, 6);
    const positions = [];

    // 没有任何stripeColors（只有数量）→ 全部派生
    const alwaysLighten = stripeColors.length === 0;

    for (let i = 0; i < maxStripes; i++) {
      const colorName = alwaysLighten ? null : stripeColors[i % stripeColors.length];
      let stripeRgb;
      if (!colorName) {
        stripeRgb = lighten(primaryRgb, 0.2);
      } else {
        const mapped = colorMappings[colorName];
        if (mapped === "__LIGHTEN__") {
          stripeRgb = lighten(primaryRgb, 0.2);
        } else if (mapped) {
          const raw = hexToRgb(mapped);
          if (!rgbClose(raw, primaryRgb, 25)) stripeRgb = raw;
          else stripeRgb = lighten(raw, 0.2);
        } else {
          stripeRgb = lighten(primaryRgb, 0.2);
        }
      }
      const yRatio = 0.15 + (i / (maxStripes - 1 || 1)) * 0.7;
      positions.push({ color: stripeRgb, yRatio, isBright: true });
    }

    // 保留所有条纹！即使与主色只差很小也要显示（因为AI说了有条纹）
    horizontalStripes.stripes = positions;
  }

  const hasInnerLayerAtCuffs = !!aiResult.hasInnerLayerAtCuffs;
  const isOpenFront = !!aiResult.isOpenFront;

  // === 严格的 twoTone 判定 ===
  // 只有当 AI 明确说双色 + 不是开衫 + 辅助色(secondary) 没有被"小面积点缀(领口/袖口/下摆/花边)"独占时才算双色
  // 避免"米白底+蓝领+蓝袖口+蓝下摆"这种polo/衬衫被误判为下半截蓝色的色块拼接
  const rgbClose = (a, b, tol = 40) => a && b && (
    Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < tol
  );
  let accentAtEdgesOnly = false;
  if (aiResult.printPatterns && Array.isArray(aiResult.printPatterns) && secondaryRgb) {
    const edgePatterns = aiResult.printPatterns.filter(p => {
      const pos = p.position || "";
      return pos.includes("下摆") || pos.includes("袖口") || pos.includes("领口") ||
             (p.type && (p.type.includes("花边") || p.type.includes("荷叶边") || p.type.includes("蕾丝")));
    });
    // 如果边缘位置的图案颜色都接近 secondaryRgb + 非边缘图案很少 → 辅助色只是小面积点缀
    if (edgePatterns.length > 0) {
      const edgeMatchesSecondary = edgePatterns.every(p => {
        if (!p.color) return true;
        const pc = hexToRgb(p.color);
        return rgbClose(pc, secondaryRgb, 50);
      });
      const nonEdgePatterns = (aiResult.printPatterns || []).filter(p => {
        const pos = p.position || "";
        return !(pos.includes("下摆") || pos.includes("袖口") || pos.includes("领口") ||
                 (p.type && (p.type.includes("花边") || p.type.includes("荷叶边") || p.type.includes("蕾丝"))));
      });
      if (edgeMatchesSecondary && nonEdgePatterns.length === 0) {
        accentAtEdgesOnly = true;
      }
    }
  }
  // 如果存在领子/翻领，也倾向于不是大色块的 two-tone（领子是独立细节，不是上下色块）
  if (aiResult.collar) accentAtEdgesOnly = true;

  const twoToneRaw = aiResult.isTwoTone && !isOpenFront && !accentAtEdgesOnly;
  const twoTone = {
    hasTwoTone: twoToneRaw,
    topColor: twoToneRaw ? primaryRgb : null,
    bottomColor: twoToneRaw ? secondaryRgb : null,
    splitRatio: 0.5,
  };

  // 更严格的logo识别逻辑 - 需要满足多个条件
  const hasLogoFromAI = aiResult.hasLogo === true;
  const hasLogoColor = !!aiResult.logoColor;
  const hasLogoType = !!aiResult.logoType;
  const hasLogoShape = !!aiResult.logoShape;
  const patternIndicatesLogo = aiResult.pattern && (aiResult.pattern.includes("logo") || aiResult.pattern.includes("标志") || aiResult.pattern.includes("LOGO"));
  
  // 只有当AI明确识别到logo，且有足够的logo信息时，才认为有logo
  const hasLogo = hasLogoFromAI && hasLogoColor && (hasLogoType || hasLogoShape || patternIndicatesLogo);
  
  const logo = {
    hasLogo: hasLogo,
    // 只有真正有logo时才记录颜色，避免App.jsx把假Logo颜色加入"使用颜色"
    color: hasLogo && hasLogoColor ? hexToRgb(aiResult.logoColor) : null,
    type: aiResult.logoType || null,
    shape: aiResult.logoShape || null,
  };

  // 竖条纹（如 Adidas 三道杠）
  const verticalStripes = { hasStripes: false, color: null };
  if (aiResult.stripeDirection === "vertical" && aiResult.stripeCount > 0) {
    verticalStripes.hasStripes = true;
    verticalStripes.count = aiResult.stripeCount;

    const stripeColors = aiResult.stripeColors || [];
    let stripeColorHex = null;

    // 辅助：提亮颜色RGB（同色系近色条纹 → 提亮成为肉眼可见的差异）
    const lighten = (rgb, ratio=0.2) => [
      Math.min(255, Math.round(rgb[0] + (255 - rgb[0]) * ratio)),
      Math.min(255, Math.round(rgb[1] + (255 - rgb[1]) * ratio)),
      Math.min(255, Math.round(rgb[2] + (255 - rgb[2]) * ratio)),
    ];

    if (stripeColors.length > 0) {
      const firstColor = stripeColors[0];
      if (firstColor === aiResult.accentColor && aiResult.accentColorHex) {
        stripeColorHex = aiResult.accentColorHex;
      } else if (firstColor === aiResult.secondaryColor && aiResult.secondaryColorHex) {
        stripeColorHex = aiResult.secondaryColorHex;
      } else if (firstColor.includes("白")) {
        stripeColorHex = "#FFFFFF";
      } else if (firstColor.includes("黑")) {
        stripeColorHex = "#000000";
      } else if (firstColor === aiResult.primaryColor) {
        // 条纹名 = 主色名（黄裙竖条：stripeColors=["黄色"] = primaryColor="黄色"）
        // 说明是同色系近色条纹（微光/闪线/提花）→ 用"主色提亮20%"派生色绘制（有可见差异但不换色）
        const lighter = lighten(primaryRgb, 0.2);
        verticalStripes.color = lighter;
        // 注意：下面的色差判断 <60 可能会被触发close，但没关系——因为下面改成即使close也保留
        stripeColorHex = null; // 已通过派生设置，不需要再从hex走
      } else {
        // 未知颜色名：fallback 为 null，后续会派生
        stripeColorHex = null;
      }
    } else {
      // 没有 stripeColors 明细 → 默认"主色提亮18%"派生画（因为AI明确说了有N条条纹，就一定要画）
      const lighter = lighten(primaryRgb, 0.18);
      verticalStripes.color = lighter;
      stripeColorHex = null;
    }

    if (stripeColorHex) {
      const stripeRgb = hexToRgb(stripeColorHex);
      // 放宽阈值：即使和主色很近也要保留（条纹=必须画），除非几乎完全相同才跳过
      if (!rgbClose(stripeRgb, primaryRgb, 25)) {
        verticalStripes.color = stripeRgb;
      } else {
        // 极近色，提亮20%派生
        verticalStripes.color = lighten(stripeRgb, 0.2);
      }
    } else if (!verticalStripes.color) {
      // 仍没设上（如firstColor=未知但stripeColors.length>0）→ 派生
      verticalStripes.color = lighten(primaryRgb, 0.2);
    }
  }

  if (!logo.color && aiResult.accentColorHex) {
    logo.color = hexToRgb(aiResult.accentColorHex);
  }
  if (!logo.color && aiResult.secondaryColorHex) {
    logo.color = hexToRgb(aiResult.secondaryColorHex);
  }

  if (
    aiResult.logoType === "adidas" ||
    aiResult.clothingType?.includes("阿迪") ||
    aiResult.pattern?.toLowerCase?.().includes("adidas") ||
    aiResult.pattern?.includes("阿迪")
  ) {
    logo.type = "adidas";
  }

  const printPatterns = [];
  if (aiResult.printPatterns && Array.isArray(aiResult.printPatterns)) {
    for (const p of aiResult.printPatterns) {
      const pType = p.type || "印花";
      const pPos = p.position || "";

      // 过滤掉AI误识别的花边/荷叶边/蕾丝等装饰图案
      if (pType.includes("花边") || pType.includes("荷叶边") || pType.includes("蕾丝") || pType.includes("波浪边") || pType.includes("装饰边")) {
        continue;
      }

      let color = p.color ? hexToRgb(p.color) : accentRgb;
      
      const bgBrightness = (primaryRgb[0] * 299 + primaryRgb[1] * 587 + primaryRgb[2] * 114) / 1000;
      const patternBrightness = (color[0] * 299 + color[1] * 587 + color[2] * 114) / 1000;
      
      // 只在印花颜色非常接近背景颜色时才调整（亮度差小于30）
      if (Math.abs(patternBrightness - bgBrightness) < 30) {
        if (bgBrightness > 128) {
          color = [50, 50, 50];
        } else {
          color = [255, 255, 255];
        }
      }

      printPatterns.push({
        type: pType,
        color: color,
        position: pPos || "随机",
      });
    }
  }

  const buttons = aiResult.buttons && aiResult.buttons.count > 0
    ? {
        count: aiResult.buttons.count,
        // 只有AI明确返回color时才使用，否则null，不编造黑色
        color: aiResult.buttons.color ? hexToRgb(aiResult.buttons.color) : null,
        position: aiResult.buttons.position || "前中",
        type: aiResult.buttons.type || "纽扣",
      }
    : null;

  const zipper = aiResult.zipper
    ? {
        // 只有AI明确返回color时才使用，否则null，不编造灰色
        color: aiResult.zipper.color ? hexToRgb(aiResult.zipper.color) : null,
        position: aiResult.zipper.position || "前中",
        hasPuller: true,
      }
    : null;

  let collar = null;
  if (aiResult.collar) {
    // 只有当AI明确返回了领子颜色且与主色不同时，才传具体颜色
    // 领子颜色经常是格子/条纹复杂图案，无法用单一颜色表示
    const collarObj = (typeof aiResult.collar === "object" && aiResult.collar !== null) ? aiResult.collar : {};
    const collarTypeStr = (typeof aiResult.collar === "string") ? aiResult.collar : (collarObj.type || "翻领");
    const aiCollarColor = collarObj.color || aiResult.collarColorHex || null;
    let collarRgb = null;

    // 判断领子是否是复杂多色图案（格子、条纹、花型、碎花、提花等）→ 无法单色还原，不传color
    let isComplexPatternCollar =
      /格|纹|条|花|碎|印|提|拼|撞|千鸟/i.test(collarTypeStr) ||
      (collarObj.pattern && /格|纹|条|花|碎|印|提|拼|撞|千鸟|豹纹|波点/i.test(collarObj.pattern)) ||
      (aiResult.pattern && /格|千鸟/i.test(aiResult.pattern) && aiCollarColor === secondaryColorHex);
    const collarFullText = collarTypeStr + " " + (typeof collarObj === "object" ? JSON.stringify(collarObj) : "");
    if (!isComplexPatternCollar && /plaid|check|stripe|floral|print|gingham/i.test(collarFullText)) {
      isComplexPatternCollar = true;
    }

    if (aiCollarColor && !isComplexPatternCollar) {
      collarRgb = hexToRgb(aiCollarColor);
      // 与主色几乎相同 = 没有独立领子颜色
      if (rgbClose(collarRgb, primaryRgb, 25)) collarRgb = null;
      // 与辅助色(colors[1])相近 → 合并成辅助色，避免两个蓝（#3778DC vs #4682B4）
      if (collarRgb && secondaryRgb && rgbClose(collarRgb, secondaryRgb, 45)) {
        collarRgb = secondaryRgb.slice();
      }
    }
    collar = {
      type: collarTypeStr,
      color: collarRgb,
    };
  }

  // 只有当AI明确返回了内搭颜色才使用，不默认白色！
  const innerLayerColor = aiResult.innerLayerColor
    ? hexToRgb(aiResult.innerLayerColor)
    : null;

  const innerLayerStripeDirection = aiResult.innerLayerStripeDirection || null;
  const innerLayerStripeColor = aiResult.innerLayerStripeColor
    ? hexToRgb(aiResult.innerLayerStripeColor)
    : null;

  const pockets = aiResult.pockets && aiResult.pockets.count > 0
    ? {
        count: aiResult.pockets.count ?? 2,
        color: aiResult.pockets.color ? hexToRgb(aiResult.pockets.color) : primaryRgb,
        position: aiResult.pockets.position || "胸前",
        style: aiResult.pockets.style || "贴袋",
      }
    : null;

  return {
    colors,
    horizontalStripes,
    verticalStripes,
    twoTone,
    logo,
    printPatterns,
    buttons,
    zipper,
    collar,
    innerLayerColor,
    innerLayerStripeDirection,
    innerLayerStripeColor,
    hasInnerLayerAtCuffs,
    innerLayerExtendsBelow: !!aiResult.innerLayerExtendsBelow,
    isOpenFront,
    pockets,
    hasHood: aiResult.hasHood,
    sleeveLength: aiResult.sleeveLength,
    hasCuffs: !!aiResult.hasCuffs,
    cuffStyle: aiResult.cuffStyle || null,
    cuffColor: aiResult.cuffColor ? hexToRgb(aiResult.cuffColor) : null,
    cuffButton: !!aiResult.cuffButton,
    cuffPattern: aiResult.cuffPattern || null,
    cuffPatternColor: aiResult.cuffPatternColor ? hexToRgb(aiResult.cuffPatternColor) : null,
    hasStitching: !!aiResult.hasStitching,
    stitchingColor: aiResult.stitchingColor ? hexToRgb(aiResult.stitchingColor) : null,
    hasDrawstrings: !!aiResult.hasDrawstrings,
    drawstringColor: aiResult.drawstringColor ? hexToRgb(aiResult.drawstringColor) : null,
    drawstringPosition: aiResult.drawstringPosition || "领口两侧",
    layout: aiResult.layout || null,
  };
}
