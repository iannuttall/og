import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const chromeCandidates = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "google-chrome",
  "chromium",
].filter(Boolean);

const chrome = chromeCandidates.find((candidate) => {
  if (candidate.includes("/")) return existsSync(candidate);

  try {
    execFileSync("which", [candidate], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
});

if (!chrome) {
  throw new Error(
    "Could not find Chrome. Set CHROME_BIN to generate examples.",
  );
}

const examples = [
  {
    file: "minimal.png",
    eyebrow: "Personal site",
    title: "Designing a markdown-first website",
    description: "A hidden template rendered by a Cloudflare Worker.",
    background: "#f9fafb",
    foreground: "#111827",
    muted: "#6b7280",
    accent: "#2563eb",
  },
  {
    file: "dark.png",
    eyebrow: "Worker template",
    title: "Safe OG images from your own pages",
    description: "Allowlisted hosts, R2, Workers Cache, and render budgets.",
    background: "#111827",
    foreground: "#f9fafb",
    muted: "#9ca3af",
    accent: "#fb923c",
  },
  {
    file: "editorial.png",
    eyebrow: "Open Graph",
    title: "No separate design system",
    description:
      "Your page owns the HTML. The worker screenshots the template.",
    background: "#fff7ed",
    foreground: "#1f2937",
    muted: "#78716c",
    accent: "#ea580c",
  },
];

mkdirSync(join(root, "images"), { recursive: true });

for (const example of examples) {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        width: 1200px;
        height: 630px;
        background: ${example.background};
        color: ${example.foreground};
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .frame {
        width: 1200px;
        height: 630px;
        padding: 72px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 18px;
        color: ${example.muted};
        font-size: 28px;
        font-weight: 600;
      }
      .mark {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        background: ${example.accent};
      }
      .content {
        max-width: 960px;
      }
      .eyebrow {
        margin: 0 0 22px;
        color: ${example.accent};
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      h1 {
        margin: 0;
        font-size: 86px;
        line-height: 0.98;
        letter-spacing: -0.055em;
      }
      .description {
        max-width: 760px;
        margin: 30px 0 0;
        color: ${example.muted};
        font-size: 34px;
        line-height: 1.25;
        letter-spacing: -0.025em;
      }
      .footer {
        color: ${example.muted};
        font-size: 26px;
        font-weight: 500;
      }
    </style>
  </head>
  <body>
    <template data-og-template data-og-width="1200" data-og-height="630">
      <div class="frame">
        <div class="brand"><div class="mark"></div><span>OG</span></div>
        <div class="content">
          <p class="eyebrow">${example.eyebrow}</p>
          <h1>${example.title}</h1>
          <p class="description">${example.description}</p>
        </div>
        <div class="footer">example.com</div>
      </div>
    </template>
    <script>
      const tpl = document.querySelector("template[data-og-template]");
      document.body.innerHTML = "";
      document.body.appendChild(tpl.content.cloneNode(true));
    </script>
  </body>
</html>`;

  const htmlPath = join(tmpdir(), `og-example-${example.file}.html`);
  const outPath = join(root, "images", example.file);
  writeFileSync(htmlPath, html);
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--screenshot=${outPath}`,
      "--window-size=1200,630",
      `file://${htmlPath}`,
    ],
    { stdio: "inherit" },
  );
}
