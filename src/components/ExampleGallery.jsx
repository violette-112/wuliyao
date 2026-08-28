/**
 * 示例展示区
 * 4组 Before/After 对比卡片
 * 使用内置示例图片展示效果
 */
export default function ExampleGallery() {
  const examples = [
    {
      template: "简易T恤",
      params: "12色 · 8px笔刷",
      description: "适合图案设计和创意纹样",
      image: "/examples/simple-tshirt.jpg",
    },
    {
      template: "短袖T恤",
      params: "16色 · 8px笔刷",
      description: "标准短袖设计，含领口和腰带",
      image: "/examples/short-sleeve-tshirt.jpg",
    },
    {
      template: "坦克背心",
      params: "8色 · 8px笔刷",
      description: "短款背心，大面积锁定",
      image: "/examples/tank-top.jpg",
    },
    {
      template: "长袖T恤",
      params: "24色 · 8px笔刷",
      description: "长袖设计，两侧袖子锁定",
      image: "/examples/long-sleeve-tshirt.jpg",
    },
  ];

  return (
    <section className="w-full max-w-7xl mx-auto px-4 py-12">
      <h2
        className="text-sm font-bold text-gray-700 text-center mb-8"
        style={{ fontFamily: '"SimHei", "Microsoft YaHei", "PingFang SC", "Heiti SC", sans-serif' }}
      >
        效果示例
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {examples.map((ex, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl shadow-md p-4 border border-gray-100 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="aspect-square bg-gray-50 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
              <img
                src={ex.image}
                alt={ex.template}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <h4 className="text-sm font-bold text-gray-700 mb-1">
              {ex.template}
            </h4>
            <p className="text-xs text-gray-500 mb-1">{ex.params}</p>
            <p className="text-xs text-gray-400">{ex.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
