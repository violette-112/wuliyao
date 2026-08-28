/**
 * 图片上传区
 * 支持拖拽上传 + 点击上传
 * 支持 JPG / PNG / WEBP / GIF，≤ 10MB
 */
import { useState, useRef, useCallback } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export default function UploadZone({ onUpload }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const validateAndLoad = useCallback(
    (file) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("仅支持 JPG / PNG / WEBP / GIF 格式");
        return;
      }

      if (file.size > MAX_SIZE) {
        setError("图片大小不能超过 10MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => onUpload(img, file.name);
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    },
    [onUpload]
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndLoad(file);
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) validateAndLoad(file);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
          transition-all duration-300
          ${
            isDragOver
              ? "border-game-green bg-green-50 animate-breathe"
              : "border-gray-300 hover:border-game-green hover:bg-green-50"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleChange}
          className="hidden"
        />
        <div className="text-4xl mb-3">📁</div>
        <p className="text-gray-700 font-body font-semibold mb-1">
          点击或拖拽上传图片
        </p>
        <p className="text-xs text-gray-500">
          JPG / PNG / WEBP / GIF，最大 10MB
        </p>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  );
}
