(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.KitTokenEstimator = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULT_CHAT_TOKEN_LIMIT = 120;

  function isWhitespace(code) {
    return code === 9 || code === 10 || code === 13 || code === 32 || code === 0x3000;
  }

  function isAsciiLetter(code) {
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
  }

  function isDigit(code) {
    return code >= 48 && code <= 57;
  }

  function isCjkLike(code) {
    return (
      (code >= 0x1100 && code <= 0x11ff) ||
      (code >= 0x3130 && code <= 0x318f) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0x3400 && code <= 0x9fff)
    );
  }

  function isEmojiLike(code) {
    return code >= 0x1f000 || (code >= 0x2600 && code <= 0x27bf);
  }

  function estimateTokens(text) {
    const value = String(text || "").trim();
    let tokens = 0;
    let index = 0;

    while (index < value.length) {
      const code = value.codePointAt(index);
      const size = code > 0xffff ? 2 : 1;

      if (isWhitespace(code)) {
        index += size;
        continue;
      }

      if (isAsciiLetter(code)) {
        let end = index + size;
        while (end < value.length && isAsciiLetter(value.codePointAt(end))) {
          end += value.codePointAt(end) > 0xffff ? 2 : 1;
        }
        tokens += Math.max(1, Math.ceil((end - index) / 4));
        index = end;
        continue;
      }

      if (isDigit(code)) {
        let end = index + size;
        while (end < value.length && isDigit(value.codePointAt(end))) {
          end += value.codePointAt(end) > 0xffff ? 2 : 1;
        }
        tokens += Math.max(1, Math.ceil((end - index) / 3));
        index = end;
        continue;
      }

      tokens += isEmojiLike(code) ? 2 : 1;
      index += size;
    }

    return tokens;
  }

  function tokenState(text, limit = DEFAULT_CHAT_TOKEN_LIMIT) {
    const count = estimateTokens(text);
    const normalizedLimit = Number.isFinite(Number(limit)) && Number(limit) > 0
      ? Number(limit)
      : DEFAULT_CHAT_TOKEN_LIMIT;
    return {
      count,
      limit: normalizedLimit,
      remaining: Math.max(0, normalizedLimit - count),
      over: count > normalizedLimit,
      ratio: normalizedLimit ? count / normalizedLimit : 0
    };
  }

  return {
    DEFAULT_CHAT_TOKEN_LIMIT,
    estimateTokens,
    tokenState
  };
});
