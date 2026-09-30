import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Original vector artwork: uniform fills, editable geometry, no gradients.
// Raster exports are generated from this source, never from an edited AI draft.
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const destination = new URL("../public/images/rituals/", import.meta.url);
fs.mkdirSync(destination, { recursive: true });
const gold = "#D7AB59", red = "#B54D39", cream = "#F0E9DC", green = "#4E6453";
const shape = (tag, attrs, color) => `<${tag} ${attrs} fill="${color}"/>`;
const p = (d, color) => shape("path", `d="${d}"`, color);
const ellipse = (cx, cy, rx, ry, color) => shape("ellipse", `cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"`, color);
const rect = (x, y, width, height, color) => shape("rect", `x="${x}" y="${y}" width="${width}" height="${height}"`, color);
const circle = (cx, cy, r, color) => shape("circle", `cx="${cx}" cy="${cy}" r="${r}"`, color);

const art = {
  incense: {
    label: "香炉",
    shapes: p("M158 132 C130 113 144 100 168 84 C190 69 191 57 176 43 C203 57 209 81 185 101 C163 120 156 121 158 132Z", cream)
      + rect(156, 132, 8, 64, green) + rect(156, 127, 8, 9, red)
      + rect(147, 238, 26, 17, red) + p("M117 264 L129 252 H191 L203 264Z", gold)
      + p("M53 188 H267 C263 226 229 246 160 246 C91 246 57 226 53 188Z", gold)
      + ellipse(160, 188, 107, 16, red) + ellipse(160, 187, 84, 9, gold) + rect(156, 176, 8, 20, green),
  },
  flower: {
    label: "花供",
    shapes: rect(155, 123, 10, 99, green)
      + p("M164 178 C168 149 195 137 221 145 C211 167 190 179 164 178Z", green)
      + p("M157 152 C130 154 115 142 106 120 C131 113 151 128 157 152Z", green)
      + p("M159 134 C121 128 102 98 109 63 C140 75 158 99 159 134Z", gold)
      + p("M161 134 C199 128 218 98 211 63 C180 75 162 99 161 134Z", gold)
      + p("M159 133 C129 119 129 80 160 47 C191 80 191 119 161 133Z", red)
      + p("M131 205 H189 L184 224 C207 239 209 253 198 264 H122 C111 253 113 239 136 224Z", gold)
      + rect(132, 206, 56, 8, red),
  },
  lamp: {
    label: "供灯",
    shapes: p("M154 154 C128 130 133 98 161 54 C175 81 174 94 187 112 C201 135 181 158 154 154Z", cream)
      + p("M157 155 C143 139 150 123 161 105 C174 123 181 145 165 155Z", red)
      + rect(147, 223, 26, 29, red) + p("M119 264 L132 250 H188 L201 264Z", gold)
      + p("M58 174 H262 C257 213 226 234 160 234 C94 234 63 213 58 174Z", gold)
      + ellipse(160, 174, 102, 14, red) + ellipse(160, 173, 80, 7, green)
      + p("M153 177 C149 165 152 155 160 143 C166 156 174 168 164 177Z", cream),
  },
  meal: {
    label: "供馔",
    shapes: p("M83 204 C81 180 95 166 111 158 C126 135 145 132 164 146 C187 130 213 150 222 173 C237 178 247 194 237 211Z", cream)
      + p("M128 195 C140 176 159 164 184 170 C202 177 213 187 219 205 H128Z", red)
      + p("M41 218 H279 L257 244 H63Z", gold) + ellipse(160, 217, 119, 13, gold)
      + rect(105, 244, 110, 11, red) + p("M89 264 L103 254 H217 L231 264Z", gold),
  },
  fruit: {
    label: "果盘",
    shapes: circle(111, 188, 35, red)
      + p("M166 202 C151 195 148 177 157 160 C165 148 172 148 176 129 H192 C195 145 206 151 212 165 C224 195 206 207 184 207Z", green)
      + circle(222, 192, 27, gold)
      + p("M114 157 C110 143 123 131 137 135 C138 149 129 157 114 157Z", green)
      + rect(179, 121, 7, 16, red)
      + p("M43 221 H277 L253 245 H67Z", gold) + ellipse(160, 221, 117, 11, gold)
      + rect(116, 245, 88, 10, red) + p("M101 264 L114 254 H206 L219 264Z", gold),
  },
  tea: {
    label: "茶盏",
    shapes: p("M72 180 H248 L227 242 H93Z", cream)
      + ellipse(160, 180, 88, 19, cream) + ellipse(160, 178, 69, 12, gold)
      + rect(117, 242, 86, 11, red) + rect(107, 253, 106, 11, red),
  },
  wine: {
    label: "酒器",
    shapes: rect(151, 209, 18, 42, gold)
      + p("M107 264 L126 249 H194 L213 264Z", red)
      + p("M91 135 H229 C228 188 204 216 160 216 C116 216 92 188 91 135Z", cream)
      + ellipse(160, 135, 69, 16, gold) + ellipse(160, 134, 51, 8, red),
  },
  scroll: {
    label: "祝文卷轴",
    shapes: rect(52, 152, 216, 112, cream) + rect(79, 171, 162, 74, gold)
      + rect(46, 145, 23, 119, red) + ellipse(57.5, 145, 11.5, 6, gold)
      + rect(251, 145, 23, 119, red) + ellipse(262.5, 145, 11.5, 6, gold),
  },
  grain: {
    label: "谷物供器",
    shapes: p("M78 196 Q107 169 133 168 Q151 145 174 157 Q203 161 242 196Z", gold)
      + ellipse(117, 184, 9, 4, cream) + ellipse(158, 173, 9, 4, cream) + ellipse(195, 184, 9, 4, cream)
      + p("M65 207 H255 C247 241 216 257 160 257 C104 257 73 241 65 207Z", red)
      + ellipse(160, 207, 95, 12, red) + ellipse(160, 205, 78, 6, gold)
      + rect(124, 254, 72, 10, gold),
  },
};

const manifest = {
  created_at: "2026-09-30",
  method: "Original SVG geometry with PNG raster exports. Imagegen was used for exploratory drafts; generated drafts are not production assets.",
  style: "Geometric solid-color minimalist poster graphics; transparent; no gradients, textures, shadows, lettering or religious symbols.",
  palette: [gold, red, cream, green],
  scope: "Abstract category illustrations. Object counts, ingredients, vessel shapes and placement do not define ritual rules.",
  assets: [],
};

for (const [id, { label, shapes }] of Object.entries(art)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><title>${label}</title>${shapes}</svg>\n`;
  fs.writeFileSync(new URL(`${id}.svg`, destination), svg);
  await sharp(Buffer.from(svg)).resize(640, 640).png().toFile(path.join(fileURLToPath(destination), `${id}.png`));
  manifest.assets.push({ id, label, svg: `/images/rituals/${id}.svg`, png: `/images/rituals/${id}.png` });
}
fs.writeFileSync(new URL("../data/ritual-assets.manifest.json", import.meta.url), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Created ${manifest.assets.length} SVG originals and transparent PNG exports.`);
