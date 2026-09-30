import themes from "../data/experience-themes.json" with { type: "json" };
import type { Deity } from "./match.ts";
const wishes: Record<string, string> = {
  learning: "学习顺利、思路清明", wealth: "经营顺遂、收支安稳", relationships: "相处和睦、心意相通",
  health: "身心安康", family: "家人平安、成长顺遂", travel: "旅途平安、此行如愿", craft: "创作顺利、事情做成",
  performance: "表达顺畅、相见如愿", food: "日常安稳、劳作有获", home: "居所安宁", protection: "平安顺遂",
  ethics: "合作顺利、公正有信", nature: "亲近自然、行程顺遂", practice: "心有所定、行动有力", remembrance: "思念有所寄托",
  care: "善意有所回应", everyday: "心有所定、所行顺遂",
};
export function getTravelDomain(query: string, deity: Deity) {
  if (/出海|航海|坐船|乘船|海钓|海上/.test(query)) {
    const sea = deity.domains.find((domain) => /航海|沿海|海上/.test(domain));
    if (sea) return sea;
  }
  if (/登山|徒步|山岳|露营/.test(query)) {
    const mountain = deity.domains.find((domain) => /山岳|山林/.test(domain));
    if (mountain) return mountain;
  }
  return deity.domains.find((domain) => /救苦|救难|解厄/.test(domain));
}
export function buildMatchReason(query: string, deity: Deity, category: string, relation: string, explicit = false) {
  if (explicit) return `你点名了${deity.canonical_name}，便向这一位寄托心愿，愿${wishes[category] ?? wishes.everyday}。`;
  if (relation === "symbolic_only") return `为你选${deity.canonical_name}作为这次心愿的象征，愿${wishes[category] ?? wishes.everyday}。`;
  const theme = themes.find((item) => item.id === category);
  const domain = (category === "travel" ? getTravelDomain(query, deity) : undefined)
    ?? deity.domains.find((domain) => theme?.domains.some((term) => domain.includes(term))) ?? deity.domains[0];
  if (!domain) return `向${deity.canonical_name}寄托这次心愿，愿${wishes[category] ?? wishes.everyday}。`;
  const fanTrip = category === "travel" && /偶像|追星|应援|演唱会|见面会/.test(query);
  const aim = fanTrip ? "旅途平安、相见如愿" : category === "performance" && /偶像|追星|应援|演唱会|见面会/.test(query)
    ? "现场尽兴、相见如愿" : wishes[category] ?? wishes.everyday;
  // Quote existing domains; modern wishes never become new traditional offices.
  return `这次取${deity.canonical_name}所关联的“${domain}”之意，寄托${aim}的心愿。`;
}
