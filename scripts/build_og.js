/* Build Open Graph card images (1200x630) for Fine Print CA.
   Usage:  node scripts/build_og.js
   Needs:  npm i -D playwright @fontsource/source-serif-4 @fontsource/inter  (once)
   Output: og/site.png and og/prop-N.png, plus og/preview.html for eyeballing. */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "measures.json"), "utf8"));
const OUT = path.join(ROOT, "og");
fs.mkdirSync(OUT, { recursive: true });

// Resolve fonts from node_modules (works whether installed in repo or in a scratch dir)
function findFont(pkg, file) {
  for (const base of [path.join(ROOT, "node_modules"), path.join(process.cwd(), "node_modules"), path.join(__dirname, "node_modules")]) {
    const p = path.join(base, "@fontsource", pkg, "files", file);
    if (fs.existsSync(p)) return "file://" + p;
  }
  return null;
}
const fonts = {
  serif700: findFont("source-serif-4", "source-serif-4-latin-700-normal.woff2"),
  serif600: findFont("source-serif-4", "source-serif-4-latin-600-normal.woff2"),
  sans500: findFont("inter", "inter-latin-500-normal.woff2"),
  sans600: findFont("inter", "inter-latin-600-normal.woff2"),
};

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function card({ kicker, title, tagline, footer, big }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:"SS4";font-weight:700;src:url("${fonts.serif700}") format("woff2")}
  @font-face{font-family:"SS4";font-weight:600;src:url("${fonts.serif600}") format("woff2")}
  @font-face{font-family:"Inter";font-weight:500;src:url("${fonts.sans500}") format("woff2")}
  @font-face{font-family:"Inter";font-weight:600;src:url("${fonts.sans600}") format("woff2")}
  html,body{margin:0}
  .card{width:1200px;height:630px;box-sizing:border-box;position:relative;overflow:hidden;
    background:#faf9f6;color:#1c1b18;font-family:Inter,system-ui,sans-serif;padding:64px 72px}
  .rule{position:absolute;left:0;top:0;bottom:0;width:18px;background:#2f4f4f}
  .brand{display:flex;align-items:center;gap:14px;font-family:SS4,Georgia,serif;font-weight:700;font-size:34px;letter-spacing:.01em}
  .brand .mark{color:#2f4f4f;font-size:44px;line-height:1}
  .brand .ca{color:#2f4f4f}
  .kicker{margin-top:56px;font-weight:600;font-size:22px;letter-spacing:.14em;text-transform:uppercase;color:#2f4f4f}
  .title{margin-top:14px;font-family:SS4,Georgia,serif;font-weight:700;line-height:1.08;letter-spacing:-.01em;
    font-size:${big ? 84 : 72}px;max-width:1000px}
  .tag{margin-top:26px;font-size:30px;color:#4c4a44;font-weight:500;max-width:960px;line-height:1.3}
  .foot{position:absolute;left:72px;right:72px;bottom:52px;display:flex;justify-content:space-between;
    font-size:22px;color:#7d7a72;font-weight:500;border-top:2px solid #e4e1da;padding-top:22px}
  .yn{position:absolute;right:72px;top:64px;display:flex;gap:10px}
  .pill{padding:8px 18px;border-radius:999px;font-weight:600;font-size:20px;letter-spacing:.02em}
  .yes{background:#e6f2f3;color:#1f6f78}.no{background:#f6eee2;color:#8a5a1c}
  </style></head><body><div class="card">
    <div class="rule"></div>
    <div class="brand"><span class="mark">§</span><span>Fine Print <span class="ca">CA</span></span></div>
    <div class="yn"><span class="pill yes">Yes</span><span class="pill no">No</span></div>
    ${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ""}
    <div class="title">${esc(title)}</div>
    <div class="tag">${esc(tagline)}</div>
    <div class="foot"><span>fineprintca.com</span><span>${esc(footer)}</span></div>
  </div></body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const footer = "California · November 3, 2026";
  const jobs = [
    { file: "site.png", html: card({ kicker: "California ballot measures · 2026", title: "Every ballot-measure ad, and what it leaves out.", tagline: "Fourteen propositions. Both sides, same treatment: what each measure does, who is paying, and what the ads skip.", footer, big: false }) },
    ...data.measures.map((m) => ({
      file: `prop-${m.number}.png`,
      html: card({ kicker: `Proposition ${m.number}`, title: m.short_title, tagline: "Every ad for and against it, and what each side leaves out.", footer, big: m.short_title.length < 28 }),
    })),
  ];
  const previews = [];
  for (const j of jobs) {
    await page.setContent(j.html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, j.file), type: "png" });
    previews.push(`<figure><img src="${j.file}" width="600"><figcaption>${j.file}</figcaption></figure>`);
    console.log("wrote og/" + j.file);
  }
  fs.writeFileSync(path.join(OUT, "preview.html"), `<!doctype html><meta charset="utf-8"><style>body{font-family:sans-serif;background:#eee;padding:20px}figure{display:inline-block;margin:10px}img{box-shadow:0 2px 8px rgba(0,0,0,.2)}</style>${previews.join("")}`);
  await browser.close();
})();
