import { escapeHtml, htmlDocument, render } from "./lib/render.mjs";

const simpleExamples = [
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

export const renderSimpleExamples = () => {
  for (const example of simpleExamples) {
    renderSimple(example);
  }
};

const renderSimple = (example) =>
  render(
    example.file,
    htmlDocument({
      styles: `
        body { background: ${example.background}; color: ${example.foreground}; }
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
        .content { max-width: 960px; }
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
      `,
      body: `
        <div class="frame">
          <div class="brand"><div class="mark"></div><span>OG</span></div>
          <div class="content">
            <p class="eyebrow">${escapeHtml(example.eyebrow)}</p>
            <h1>${escapeHtml(example.title)}</h1>
            <p class="description">${escapeHtml(example.description)}</p>
          </div>
          <div class="footer">example.com</div>
        </div>
      `,
    }),
  );
