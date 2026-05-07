'use client';

import React, { useEffect, useRef, FC } from 'react';
import { Renderer, Program, Mesh, Triangle, Vec3 } from 'ogl';

interface VoicePoweredOrbProps {
  className?: string;
  hue?: number;
  /** Ref whose .current is a 0-1 audio level updated externally */
  audioLevelRef?: React.MutableRefObject<number>;
  maxRotationSpeed?: number;
  maxHoverIntensity?: number;
}

export const VoicePoweredOrb: FC<VoicePoweredOrbProps> = ({
  className,
  hue = 0,
  audioLevelRef,
  maxRotationSpeed = 1.2,
  maxHoverIntensity = 0.8,
}) => {
  const ctnDom = useRef<HTMLDivElement>(null);

  const vert = /* glsl */ `
    precision highp float;
    attribute vec2 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const frag = /* glsl */ `
    precision highp float;
    uniform float iTime;
    uniform vec3 iResolution;
    uniform float hue;
    uniform float hover;
    uniform float rot;
    uniform float hoverIntensity;
    uniform float scale;
    varying vec2 vUv;

    vec3 rgb2yiq(vec3 c) {
      float y = dot(c, vec3(0.299, 0.587, 0.114));
      float i = dot(c, vec3(0.596, -0.274, -0.322));
      float q = dot(c, vec3(0.211, -0.523, 0.312));
      return vec3(y, i, q);
    }
    vec3 yiq2rgb(vec3 c) {
      float r = c.x + 0.956 * c.y + 0.621 * c.z;
      float g = c.x - 0.272 * c.y - 0.647 * c.z;
      float b = c.x - 1.106 * c.y + 1.703 * c.z;
      return vec3(r, g, b);
    }
    vec3 adjustHue(vec3 color, float hueDeg) {
      float hueRad = hueDeg * 3.14159265 / 180.0;
      vec3 yiq = rgb2yiq(color);
      float cosA = cos(hueRad);
      float sinA = sin(hueRad);
      float i = yiq.y * cosA - yiq.z * sinA;
      float q = yiq.y * sinA + yiq.z * cosA;
      yiq.y = i; yiq.z = q;
      return yiq2rgb(yiq);
    }

    vec3 hash33(vec3 p3) {
      p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
      p3 += dot(p3, p3.yxz + 19.19);
      return -1.0 + 2.0 * fract(vec3(p3.x+p3.y, p3.x+p3.z, p3.y+p3.z) * p3.zyx);
    }
    float snoise3(vec3 p) {
      const float K1 = 0.333333333;
      const float K2 = 0.166666667;
      vec3 i = floor(p + (p.x+p.y+p.z)*K1);
      vec3 d0 = p - (i - (i.x+i.y+i.z)*K2);
      vec3 e = step(vec3(0.0), d0 - d0.yzx);
      vec3 i1 = e*(1.0-e.zxy);
      vec3 i2 = 1.0 - e.zxy*(1.0-e);
      vec3 d1 = d0 - (i1-K2);
      vec3 d2 = d0 - (i2-K1);
      vec3 d3 = d0 - 0.5;
      vec4 h = max(0.6 - vec4(dot(d0,d0),dot(d1,d1),dot(d2,d2),dot(d3,d3)), 0.0);
      vec4 n = h*h*h*h * vec4(dot(d0,hash33(i)),dot(d1,hash33(i+i1)),dot(d2,hash33(i+i2)),dot(d3,hash33(i+1.0)));
      return dot(vec4(31.316), n);
    }

    vec4 extractAlpha(vec3 colorIn) {
      float a = max(max(colorIn.r, colorIn.g), colorIn.b);
      return vec4(colorIn.rgb / (a + 1e-5), a);
    }

    const vec3 baseColor1 = vec3(0.611765, 0.262745, 0.996078);
    const vec3 baseColor2 = vec3(0.298039, 0.760784, 0.913725);
    const vec3 baseColor3 = vec3(0.062745, 0.078431, 0.600000);
    const float noiseScale = 0.65;

    float light1(float intensity, float attenuation, float dist) { return intensity / (1.0 + dist * attenuation); }
    float light2(float intensity, float attenuation, float dist) { return intensity / (1.0 + dist * dist * attenuation); }

    vec4 draw(vec2 uv) {
      vec3 color1 = adjustHue(baseColor1, hue);
      vec3 color2 = adjustHue(baseColor2, hue);
      vec3 color3 = adjustHue(baseColor3, hue);
      float ang = atan(uv.y, uv.x);
      float len = length(uv);
      float invLen = len > 0.0 ? 1.0 / len : 0.0;

      /* Noise for organic variation */
      float noiseSpeed = 0.5 + hover * 1.2;
      float noiseAmp = noiseScale + hover * 0.2;
      float n0 = snoise3(vec3(uv * noiseAmp, iTime * noiseSpeed)) * 0.5 + 0.5;

      /* Noise-distorted sphere edge */
      float edgeR = mix(0.52, 0.68, n0);

      /* Filled sphere mask — bright center, soft fade at edge */
      float sphereMask = smoothstep(edgeR + 0.12, 0.0, len);

      /* Edge rim lighting — glow at the boundary */
      float d0 = distance(uv, (edgeR * invLen) * uv);
      float rim = light1(1.0, 8.0, d0) * smoothstep(edgeR * 1.05, edgeR, len);

      /* Center gaussian glow — makes center bright */
      float centerGlow = exp(-len * len * 5.0);

      /* Orbiting accent light */
      float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;
      float rotSpeed = -1.0 - hover * 3.0;
      float a = iTime * rotSpeed;
      vec2 pos = vec2(cos(a), sin(a)) * edgeR;
      float d = distance(uv, pos);
      float v1 = light2(1.5, 5.0, d) * light1(1.0, 50.0, d0);

      /* Color blending — mix across angle + depth */
      vec3 surfaceCol = mix(color1, color2, cl);
      /* Blend interior: deep color at edges, bright surface color toward center */
      vec3 col = mix(color3, surfaceCol, 0.3 + centerGlow * 0.5 + rim * 0.3);
      col = (col + v1 * 0.4) * sphereMask;

      /* Brightness boost when speaking */
      col *= 1.0 + hover * 0.6;

      col = clamp(col, 0.0, 1.0);
      return extractAlpha(col);
    }

    vec4 mainImage(vec2 fragCoord) {
      vec2 center = iResolution.xy * 0.5;
      float size = min(iResolution.x, iResolution.y);
      vec2 uv = (fragCoord - center) / size * 2.0;

      /* Scale (orb breathes / pulses with audio) */
      uv /= scale;

      float angle = rot;
      float s = sin(angle); float c = cos(angle);
      uv = vec2(c*uv.x - s*uv.y, s*uv.x + c*uv.y);

      /* Wave distortion — gentle organic undulation when speaking */
      float waveAmt = hover * hoverIntensity;
      float waveFreq = 4.0 + hover * 4.0;
      float waveSpeed = iTime * (0.8 + hover * 1.0);
      uv.x += waveAmt * 0.06 * sin(uv.y * waveFreq + waveSpeed);
      uv.y += waveAmt * 0.06 * sin(uv.x * waveFreq + waveSpeed * 1.3);

      return draw(uv);
    }

    void main() {
      vec2 fragCoord = vUv * iResolution.xy;
      vec4 col = mainImage(fragCoord);

      /* Outer glow ring when speaking */
      vec2 center = iResolution.xy * 0.5;
      float size = min(iResolution.x, iResolution.y);
      vec2 uv = (fragCoord - center) / size * 2.0;
      float dist = length(uv);
      float glowRing = smoothstep(0.65, 0.55, dist) * hover * 0.15;
      col.rgb += vec3(0.4, 0.3, 0.9) * glowRing;

      gl_FragColor = vec4(col.rgb * col.a, col.a);
    }
  `;

  useEffect(() => {
    const container = ctnDom.current;
    if (!container) return;

    let rendererInstance: Renderer | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let glContext: any = null;
    let program: Program | null = null;
    let rafId: number;

    try {
      rendererInstance = new Renderer({ alpha: true, premultipliedAlpha: false, antialias: true, dpr: window.devicePixelRatio || 1 });
      glContext = rendererInstance.gl;
      glContext.clearColor(0, 0, 0, 0);
      glContext.enable(glContext.BLEND);
      glContext.blendFunc(glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA);

      while (container.firstChild) container.removeChild(container.firstChild);
      container.appendChild(glContext.canvas as HTMLCanvasElement);

      const geometry = new Triangle(glContext);
      program = new Program(glContext, {
        vertex: vert, fragment: frag,
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: new Vec3(glContext.canvas.width, glContext.canvas.height, glContext.canvas.width / glContext.canvas.height) },
          hue: { value: hue },
          hover: { value: 0 },
          rot: { value: 0 },
          hoverIntensity: { value: 0 },
          scale: { value: 1.0 },
        },
      });

      const mesh = new Mesh(glContext, { geometry, program });

      const resize = () => {
        if (!container || !rendererInstance || !glContext || !program) return;
        const dpr = window.devicePixelRatio || 1;
        const w = container.clientWidth, h = container.clientHeight;
        if (w === 0 || h === 0) return;
        rendererInstance.setSize(w * dpr, h * dpr);
        const canvasEl = glContext.canvas as HTMLCanvasElement;
        canvasEl.style.width = w + 'px';
        canvasEl.style.height = h + 'px';
        program.uniforms.iResolution.value.set(canvasEl.width, canvasEl.height, canvasEl.width / canvasEl.height);
      };
      window.addEventListener('resize', resize);
      resize();

      let lastTime = 0, currentRot = 0;
      const baseRotSpeed = 0.3;
      let smoothScale = 1.0;

      const update = (t: number) => {
        rafId = requestAnimationFrame(update);
        if (!program) return;
        const dt = Math.min((t - lastTime) * 0.001, 0.1); // cap dt
        lastTime = t;
        program.uniforms.iTime.value = t * 0.001;
        program.uniforms.hue.value = hue;

        const level = audioLevelRef?.current ?? 0;

        // Rotation — faster when speaking
        const rotSpeed = baseRotSpeed + level * maxRotationSpeed * 3.0;
        if (level > 0.02) currentRot += dt * rotSpeed;
        else currentRot += dt * baseRotSpeed * 0.3;

        // Hover (drives distortion + brightness in shader)
        program.uniforms.hover.value = Math.min(level * 1.5, 1.0);
        program.uniforms.hoverIntensity.value = Math.min(level * maxHoverIntensity * 1.2, maxHoverIntensity);
        program.uniforms.rot.value = currentRot;

        // Scale — orb breathes/pulses, springs toward target
        const targetScale = 1.0 + level * 0.18;
        smoothScale += (targetScale - smoothScale) * Math.min(dt * 8.0, 1.0);
        program.uniforms.scale.value = smoothScale;

        if (rendererInstance && glContext) {
          glContext.clear(glContext.COLOR_BUFFER_BIT | glContext.DEPTH_BUFFER_BIT);
          rendererInstance.render({ scene: mesh });
        }
      };
      rafId = requestAnimationFrame(update);

      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', resize);
        if (container && glContext?.canvas) {
          try { const c = glContext.canvas as HTMLCanvasElement; if (container.contains(c)) container.removeChild(c); } catch {}
        }
        if (glContext) glContext.getExtension('WEBGL_lose_context')?.loseContext();
      };
    } catch (err) {
      console.error('VoicePoweredOrb init error:', err);
      return () => {};
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hue, maxRotationSpeed, maxHoverIntensity]);

  return <div ref={ctnDom} className={className || ''} style={{ width: '100%', height: '100%', position: 'relative' }} />;
};
