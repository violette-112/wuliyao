/**
 * 跨浏览器复制到剪贴板（含 iOS Safari HTTP 非安全上下文 fallback）
 *
 * navigator.clipboard API 仅在「安全上下文」（HTTPS / localhost）中可用；
 * 手机用局域网 IP HTTP 访问开发服务器、或老浏览器下必须回退。
 *
 * @param {string} text 要复制的文本
 * @returns {Promise<void>} 成功 resolve；任何形式的失败都 reject（外层应 catch 给提示）
 */
export async function copyToClipboard(text) {
  // 1) 优先现代 API（HTTPS / localhost 安全上下文时）
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (_) {
      // 失败不直接抛，继续走 fallback（例如 user gesture token 丢失导致 reject 时）
    }
  }

  // 2) Fallback：动态 textarea + execCommand('copy')
  //    —— iPhone Safari HTTP 访问、老浏览器全兼容，只要在用户手势点击同步链里就成功
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  // fixed + 移出视口，避免插入时 iOS 自动滚动/放大
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (_) {
    ok = false;
  } finally {
    document.body.removeChild(textarea);
  }

  if (!ok) {
    throw new Error("当前浏览器/环境不支持自动复制");
  }
}
