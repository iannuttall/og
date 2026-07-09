import { htmlDocument, render } from "./lib/render.mjs";

export const renderPhysicsExample = () =>
  render(
    "physics-spheres.png",
    htmlDocument({
      styles: `
        body { background: #080719; color: #fff; }
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
            radial-gradient(circle at 68% 32%, rgba(124, 58, 237, .32), transparent 32%),
            radial-gradient(circle at 47% 62%, rgba(99, 102, 241, .24), transparent 34%),
            linear-gradient(180deg, rgba(8, 7, 25, .1), rgba(8, 7, 25, .58));
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
            ctx.fillStyle = "#080719";
            ctx.fillRect(0, 0, 1200, 630);
            const scene = ctx.createRadialGradient(690, 240, 80, 690, 240, 520);
            scene.addColorStop(0, "rgba(127, 88, 255, .32)");
            scene.addColorStop(1, "rgba(8, 7, 25, 0)");
            ctx.fillStyle = scene;
            ctx.fillRect(0, 0, 1200, 630);

            const spheres = [
              [515, 92, 74, "#080719"],
              [596, 128, 66, "#7e22ce"],
              [462, 220, 88, "#0b1028"],
              [706, 204, 92, "#8b8de8"],
              [592, 278, 84, "#4c1d95"],
              [802, 178, 70, "#080719"],
              [507, 346, 78, "#5b21b6"],
              [646, 352, 84, "#8587dc"],
              [746, 375, 66, "#250b35"],
              [548, 198, 76, "#5b1d67"],
              [430, 315, 74, "#7677d9"],
              [682, 120, 45, "#8b5cf6"],
            ];

            for (const [x, y, radius, color] of spheres) {
              ctx.save();
              ctx.shadowColor = "rgba(139, 92, 246, .42)";
              ctx.shadowBlur = 24;
              const shadow = ctx.createRadialGradient(
                x - radius * 0.4,
                y - radius * 0.5,
                radius * 0.05,
                x,
                y,
                radius,
              );
              shadow.addColorStop(0, "rgba(255,255,255,.95)");
              shadow.addColorStop(0.18, color);
              shadow.addColorStop(1, "rgba(0,0,0,.42)");
              ctx.beginPath();
              ctx.arc(x, y, radius, 0, Math.PI * 2);
              ctx.fillStyle = shadow;
              ctx.fill();
              ctx.lineWidth = 3;
              ctx.strokeStyle = "rgba(221, 214, 254, .55)";
              ctx.stroke();

              ctx.shadowBlur = 0;
              ctx.fillStyle = "rgba(255,255,255,.58)";
              ctx.beginPath();
              ctx.arc(x - radius * 0.32, y - radius * 0.28, radius * 0.15, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "rgba(167, 139, 250, .48)";
              ctx.beginPath();
              ctx.arc(x + radius * 0.34, y - radius * 0.08, radius * 0.12, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }

            ctx.fillStyle = "#ec4899";
            ctx.fillRect(0, 626, 1200, 4);
            window.__OG_READY__ = true;
          })();
        </script>
      `,
    }),
  );
