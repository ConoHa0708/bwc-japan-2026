// 診断結果はカードに出すため、Claude の回答ではなく採点の道具の結果から診断文を取り出す。
export function diagnosisText(block) {
  const parts = typeof block.content === "string" ? [block.content] : (block.content ?? []).map((c) => c.text ?? "");
  for (const part of parts) {
    try {
      const parsed = JSON.parse(part);
      if (parsed?.text) return parsed.text;
    } catch {
      // JSON でなければ文面として扱う。
    }
    if (part.includes("【判断】")) return part;
  }
  return "";
}
