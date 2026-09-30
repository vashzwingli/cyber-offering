import type { Analysis } from "./experience-match.ts";

export function parseBlessingContent(content: string): string | null {
  try {
    const data = JSON.parse(content);
    if (!data || typeof data.message !== "string") return null;
    const message = data.message.trim();
    if (message.length < 12 || message.length > 180 || /[<>]|```|神谕|天意已定|保证|必定|包你/.test(message)) return null;
    return message;
  } catch { return null; }
}
export function buildLocalBlessing(query: string, analysis: Analysis) {
  const wishes = [...new Set(analysis.intents.map((intent, index) => index === 0 && /面试|求职|应聘|offer/i.test(query)
    ? "面试顺利、求职如愿" : intent.wish))].slice(0, 2).join("与");
  return `愿这份关于${wishes || "日常安稳"}的心愿，陪你从容往前走。把能准备的事一步步做好，也给自己留一点余地，让期待在踏实行动中渐有着落。`;
}
