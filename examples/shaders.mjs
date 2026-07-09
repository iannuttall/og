import { escapeHtml, htmlDocument, render } from "./lib/render.mjs";

const shaderVertex = `
  attribute vec2 position;
  varying vec2 uv;
  void main() {
    uv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const shaderRunner = (fragmentShader) => `
  <script type="x-shader/x-vertex" id="vertex">${shaderVertex}</script>
  <script type="x-shader/x-fragment" id="fragment">${fragmentShader}</script>
  <script>
    (() => {
      const canvas = document.querySelector("canvas");
      const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(shader));
        }
        return shader;
      };
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, document.querySelector("#vertex").textContent));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, document.querySelector("#fragment").textContent));
      gl.linkProgram(program);
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      window.__OG_READY__ = true;
    })();
  </script>
`;

const grainGradientShader = `
  precision highp float;
  varying vec2 uv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 p = uv;
    vec3 a = vec3(0.07, 0.10, 0.24);
    vec3 b = vec3(0.95, 0.34, 0.15);
    vec3 c = vec3(0.16, 0.45, 0.96);
    float sweep = smoothstep(-0.12, 1.05, p.x + p.y * 0.52);
    float glow = 0.55 + 0.45 * sin((p.x * 5.2) + (p.y * 3.8));
    vec3 color = mix(a, b, sweep);
    color = mix(color, c, (1.0 - p.y) * 0.34 * glow);
    color += (hash(floor(gl_FragCoord.xy / 2.0)) - 0.5) * 0.045;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const ditherPatternShader = `
  precision highp float;
  varying vec2 uv;

  float threshold(vec2 p) {
    vec2 cell = mod(floor(p), 4.0);
    float x = cell.x;
    float y = cell.y;
    if (y == 0.0) return (x == 0.0 ? 0.0 : x == 1.0 ? 8.0 : x == 2.0 ? 2.0 : 10.0) / 16.0;
    if (y == 1.0) return (x == 0.0 ? 12.0 : x == 1.0 ? 4.0 : x == 2.0 ? 14.0 : 6.0) / 16.0;
    if (y == 2.0) return (x == 0.0 ? 3.0 : x == 1.0 ? 11.0 : x == 2.0 ? 1.0 : 9.0) / 16.0;
    return (x == 0.0 ? 15.0 : x == 1.0 ? 7.0 : x == 2.0 ? 13.0 : 5.0) / 16.0;
  }

  void main() {
    vec2 p = uv;
    float radial = distance(p, vec2(0.66, 0.48));
    float wave = 0.5 + 0.5 * sin((p.x * 11.0) - (p.y * 7.0));
    float value = smoothstep(0.72, 0.08, radial) * 0.75 + wave * 0.25;
    float dither = step(threshold(gl_FragCoord.xy), value);
    vec3 dark = vec3(0.04, 0.05, 0.07);
    vec3 light = vec3(0.93, 0.88, 0.78);
    vec3 warm = vec3(0.96, 0.44, 0.16);
    vec3 color = mix(dark, light, dither);
    color = mix(color, warm, smoothstep(0.56, 0.0, radial) * 0.42);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export const renderShaderExamples = () => {
  renderShader({
    file: "grain-gradient.png",
    label: "Grain gradient",
    title: "WebGL shader as an OG background",
    fragmentShader: grainGradientShader,
  });

  renderShader({
    file: "dither-pattern.png",
    label: "Dither pattern",
    title: "A shader-driven preview card",
    fragmentShader: ditherPatternShader,
  });
};

const renderShader = ({ file, title, label, fragmentShader }) =>
  render(
    file,
    htmlDocument({
      styles: `
        body { background: #09090b; color: #fff; }
        canvas {
          position: absolute;
          inset: 0;
          width: 1200px;
          height: 630px;
        }
        .shade {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(0,0,0,.78), rgba(0,0,0,.14));
        }
        .content {
          position: relative;
          z-index: 1;
          width: 1200px;
          height: 630px;
          padding: 72px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .label {
          margin: 0;
          color: rgba(255,255,255,.72);
          font-size: 28px;
          font-weight: 600;
        }
        h1 {
          max-width: 770px;
          margin: 0;
          font-size: 92px;
          line-height: .96;
          letter-spacing: -.055em;
        }
      `,
      body: `
        <canvas width="1200" height="630"></canvas>
        <div class="shade"></div>
        <div class="content">
          <p class="label">${escapeHtml(label)}</p>
          <h1>${escapeHtml(title)}</h1>
        </div>
      `,
      script: shaderRunner(fragmentShader),
    }),
  );
