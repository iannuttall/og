import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const imageDir = join(root, "..", "images");
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

const magick = (() => {
  try {
    return execFileSync("which", ["magick"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
})();

mkdirSync(imageDir, { recursive: true });

export const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const render = (file, html) => {
  const htmlPath = join(tmpdir(), `og-example-${file}.html`);
  const outPath = join(imageDir, file);

  writeFileSync(htmlPath, html);
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--hide-scrollbars",
      `--screenshot=${outPath}`,
      "--window-size=1200,630",
      `file://${htmlPath}`,
    ],
    { stdio: "inherit" },
  );

  if (magick) {
    execFileSync(
      magick,
      [
        outPath,
        "-strip",
        "-quality",
        "86",
        "-define",
        "png:compression-level=9",
        outPath,
      ],
      { stdio: "inherit" },
    );
  }
};

export const htmlDocument = ({ styles, body, script = "" }) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        width: 1200px;
        height: 630px;
        overflow: hidden;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      ${styles}
    </style>
  </head>
  <body>
    <template data-og-template data-og-width="1200" data-og-height="630">
      ${body}
    </template>
    <script>
      const tpl = document.querySelector("template[data-og-template]");
      document.body.innerHTML = "";
      document.body.appendChild(tpl.content.cloneNode(true));
    </script>
    ${script}
  </body>
</html>`;
