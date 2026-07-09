import { htmlDocument, render } from "./lib/render.mjs";

export const renderPhysicsExample = () =>
  render(
    "physics-spheres.png",
    htmlDocument({
      styles: `
        body { background: #070618; color: #fff; }
        canvas {
          position: absolute;
          inset: 0;
          width: 1200px;
          height: 630px;
        }
        .glow {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 62% 19%, rgba(236, 72, 153, .22), transparent 22%),
            radial-gradient(circle at 63% 40%, rgba(124, 58, 237, .32), transparent 33%),
            radial-gradient(circle at 45% 52%, rgba(99, 102, 241, .2), transparent 30%),
            linear-gradient(180deg, rgba(7, 6, 24, .04), rgba(7, 6, 24, .72));
        }
        .content {
          position: relative;
          z-index: 1;
          width: 1200px;
          height: 630px;
          padding: 72px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .label {
          width: max-content;
          margin: 0 0 18px;
          color: #f472b6;
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: .34em;
          text-transform: uppercase;
        }
        .label::before {
          content: "";
          display: inline-block;
          width: 32px;
          height: 1px;
          margin-right: 12px;
          vertical-align: middle;
          background: currentColor;
        }
        h1 {
          max-width: 560px;
          margin: 0;
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          font-size: 46px;
          line-height: 1.14;
          letter-spacing: -.05em;
          text-shadow: 0 0 24px rgba(255, 255, 255, .18);
        }
        .description {
          max-width: 620px;
          margin: 24px 0 8px;
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          color: rgba(255,255,255,.88);
          font-size: 21px;
          line-height: 1.5;
          letter-spacing: -.03em;
        }
      `,
      body: `
        <canvas width="1200" height="630"></canvas>
        <div class="glow"></div>
        <div class="content">
          <p class="label">React Three Fiber + Rapier</p>
          <h1>Physics-based 3D animations</h1>
          <p class="description">Building interactive experiences with React Three Fiber and Rapier</p>
        </div>
      `,
      script: `
        <script>
          (() => {
            const canvas = document.querySelector("canvas");
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#070618";
            ctx.fillRect(0, 0, 1200, 630);
            const scene = ctx.createRadialGradient(650, 210, 90, 650, 230, 500);
            scene.addColorStop(0, "rgba(167, 139, 250, .3)");
            scene.addColorStop(0.55, "rgba(76, 29, 149, .18)");
            scene.addColorStop(1, "rgba(7, 6, 24, 0)");
            ctx.fillStyle = scene;
            ctx.fillRect(0, 0, 1200, 630);

            const spheres = [
              [528, 112, 74, "#060518", 0.94],
              [624, 138, 70, "#8b35c9", 1.02],
              [462, 236, 84, "#08071d", 0.96],
              [530, 244, 86, "#6b2aa2", 0.9],
              [700, 236, 92, "#797bdb", 0.88],
              [802, 196, 72, "#060518", 1.06],
              [596, 285, 88, "#6930ba", 1.1],
              [666, 355, 84, "#8586da", 1.04],
              [752, 382, 62, "#2d0b38", 0.92],
              [514, 370, 76, "#4d299d", 0.98],
              [426, 330, 70, "#7475d6", 0.84],
              [680, 132, 48, "#9d4edd", 0.76],
              [744, 266, 54, "#30306f", 0.78],
            ];

            const drawSphere = (x, y, radius, color, scale) => {
              const r = radius * scale;
              ctx.save();
              ctx.shadowColor = "rgba(167, 139, 250, .38)";
              ctx.shadowBlur = 28 * scale;
              ctx.shadowOffsetY = 5 * scale;
              const material = ctx.createRadialGradient(
                x - r * 0.42,
                y - r * 0.5,
                r * 0.06,
                x + r * 0.18,
                y + r * 0.18,
                r * 1.12,
              );
              material.addColorStop(0, "rgba(255,255,255,.96)");
              material.addColorStop(0.13, color);
              material.addColorStop(0.74, color);
              material.addColorStop(1, "rgba(0,0,0,.72)");
              ctx.beginPath();
              ctx.arc(x, y, r, 0, Math.PI * 2);
              ctx.fillStyle = material;
              ctx.fill();

              ctx.shadowBlur = 0;
              ctx.lineWidth = Math.max(2, 3.4 * scale);
              ctx.strokeStyle = "rgba(238, 242, 255, .62)";
              ctx.stroke();

              ctx.clip();
              const rim = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
              rim.addColorStop(0, "rgba(255,255,255,.56)");
              rim.addColorStop(0.28, "rgba(255,255,255,0)");
              rim.addColorStop(0.78, "rgba(0,0,0,0)");
              rim.addColorStop(1, "rgba(255,255,255,.22)");
              ctx.strokeStyle = rim;
              ctx.lineWidth = 7 * scale;
              ctx.beginPath();
              ctx.arc(x, y, r - 2, 0, Math.PI * 2);
              ctx.stroke();

              ctx.fillStyle = "rgba(255,255,255,.5)";
              ctx.beginPath();
              ctx.ellipse(x - r * 0.36, y - r * 0.26, r * 0.12, r * 0.08, .55, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "rgba(196, 181, 253, .46)";
              ctx.beginPath();
              ctx.ellipse(x - r * 0.18, y - r * 0.22, r * 0.09, r * 0.06, .55, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "rgba(79, 70, 229, .38)";
              ctx.beginPath();
              ctx.ellipse(x + r * 0.38, y - r * 0.1, r * 0.12, r * 0.16, .15, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            };

            ctx.save();
            ctx.filter = "blur(18px)";
            ctx.fillStyle = "rgba(15, 12, 42, .72)";
            ctx.beginPath();
            ctx.ellipse(690, 364, 270, 64, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            for (const [x, y, ...sphere] of spheres) {
              drawSphere(x + 70, y - 8, ...sphere);
            }

            ctx.fillStyle = "#ec4899";
            ctx.fillRect(0, 626, 1200, 4);
            window.__OG_READY__ = true;
          })();
        </script>
      `,
    }),
  );
