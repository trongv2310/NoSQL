import * as THREE from "three";

/**
 * Hậu kỳ HDR kiểu điện ảnh: cảnh vẽ vào bộ đệm nửa-float (giá trị > 1 được giữ lại), rồi
 * chuỗi bloom 4 mức (tách vùng sáng → thu nhỏ → làm mờ Gauss → cộng ngược lên), và một lượt tổng hợp:
 * tán sắc nhẹ ở rìa, ACES, chỉnh màu (bóng ngả xanh ngọc, vùng sáng ấm), vignette, hạt phim.
 * Đèn trần, vạch sân, chữ khổng lồ và các bảng quảng cáo sáng hơn 1 nên tự tỏa sáng mà không cần ảnh quầng nướng sẵn.
 */

const QUAD_VS = "varying vec2 vUv;\nvoid main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

export interface PostParams {
  time: number;
  /** 0 → 1: màn đen mở dần lúc vào trang. */
  fade: number;
}

export interface Post {
  readonly scene: THREE.WebGLRenderTarget;
  /**
   * Làm mờ nội dung đang có trong `scene` (hậu cảnh) rồi phủ bản mờ lên chính nó với độ đậm `amount` ∈ [0,1].
   * Gọi sau khi vẽ hậu cảnh và trước khi vẽ vật thể chính lên trên: vật thể giữ nguyên độ nét như ống kính lấy nét cận cảnh.
   * Mượn các bộ đệm của chuỗi bloom làm chỗ nháp (bloom ghi đè lại ở bước `render`).
   */
  blurBackground(amount: number): void;
  setSize(w: number, h: number): void;
  render(p: PostParams): void;
  dispose(): void;
}

export function createPost(renderer: THREE.WebGLRenderer, w: number, h: number, light: boolean): Post | null {
  const ext = renderer.extensions;
  if (!ext.has("EXT_color_buffer_float") && !ext.has("EXT_color_buffer_half_float")) return null;

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const qScene = new THREE.Scene();
  qScene.add(quad);

  const base = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false } as const;
  const scene = new THREE.WebGLRenderTarget(w, h, { ...base, depthBuffer: true, samples: light ? 0 : 2 });
  const N = light ? 3 : 4;
  const levels: { a: THREE.WebGLRenderTarget; b: THREE.WebGLRenderTarget; w: number; h: number }[] = [];
  const sizeLevels = (pw: number, ph: number) => {
    let lw = Math.max(2, pw >> 1), lh = Math.max(2, ph >> 1);
    for (let i = 0; i < N; i++) {
      const L = levels[i] ?? (levels[i] = { a: new THREE.WebGLRenderTarget(lw, lh, base), b: new THREE.WebGLRenderTarget(lw, lh, base), w: lw, h: lh });
      L.a.setSize(lw, lh); L.b.setSize(lw, lh); L.w = lw; L.h = lh;
      lw = Math.max(2, lw >> 1); lh = Math.max(2, lh >> 1);
    }
  };
  sizeLevels(w, h);

  const up = new THREE.ShaderMaterial({
    uniforms: { tS: { value: null }, uAmt: { value: 1 } },
    vertexShader: QUAD_VS,
    fragmentShader: "uniform sampler2D tS; uniform float uAmt; varying vec2 vUv;\nvoid main(){ gl_FragColor = vec4(texture2D(tS, vUv).rgb * uAmt, 1.0); }",
    transparent: true, depthTest: false, depthWrite: false,
  });
  const bright = new THREE.ShaderMaterial({
    uniforms: { tS: { value: null }, uThr: { value: 1.25 }, uKnee: { value: 0.9 } },
    vertexShader: QUAD_VS,
    fragmentShader:
      "uniform sampler2D tS; uniform float uThr; uniform float uKnee; varying vec2 vUv;\n" +
      "void main(){ vec3 c = texture2D(tS, vUv).rgb;\n" +
      " float l = dot(c, vec3(0.2126, 0.7152, 0.0722));\n" +
      " float k = smoothstep(uThr, uThr + uKnee, l);\n" +
      " gl_FragColor = vec4(c * k, 1.0); }",
  });
  const blur = new THREE.ShaderMaterial({
    uniforms: { tS: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } },
    vertexShader: QUAD_VS,
    fragmentShader:
      "uniform sampler2D tS; uniform vec2 uDir; varying vec2 vUv;\n" +
      "void main(){ vec3 c = texture2D(tS, vUv).rgb * 0.2270270270;\n" +
      " c += texture2D(tS, vUv + uDir * 1.3846153846).rgb * 0.3162162162;\n" +
      " c += texture2D(tS, vUv - uDir * 1.3846153846).rgb * 0.3162162162;\n" +
      " c += texture2D(tS, vUv + uDir * 3.2307692308).rgb * 0.0702702703;\n" +
      " c += texture2D(tS, vUv - uDir * 3.2307692308).rgb * 0.0702702703;\n" +
      " gl_FragColor = vec4(c, 1.0); }",
  });
  const comp = new THREE.ShaderMaterial({
    uniforms: {
      tS: { value: null }, tB: { value: null }, uRes: { value: new THREE.Vector2(w, h) },
      uT: { value: 0 }, uBloom: { value: 0.5 }, uCA: { value: 1 }, uGrain: { value: 0.014 },
      uVig: { value: 1 }, uExp: { value: 1.0 }, uFade: { value: 1 }, uSat: { value: 1.08 },
    },
    vertexShader: QUAD_VS,
    fragmentShader:
      "uniform sampler2D tS; uniform sampler2D tB; uniform vec2 uRes;\n" +
      "uniform float uT, uBloom, uCA, uGrain, uVig, uExp, uFade, uSat;\n" +
      "varying vec2 vUv;\n" +
      "vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }\n" +
      "void main(){\n" +
      " vec2 d = vUv - 0.5; float r2 = dot(d, d);\n" +
      " float ca = uCA * (0.30 + r2 * 2.6) * 0.0012;\n" +
      " vec3 c;\n" +
      " c.r = texture2D(tS, vUv + d * ca).r;\n" +
      " c.g = texture2D(tS, vUv).g;\n" +
      " c.b = texture2D(tS, vUv - d * ca).b;\n" +
      " c += texture2D(tB, vUv).rgb * uBloom;\n" +
      " c *= uExp;\n" +
      " c = aces(c);\n" +
      " float l = dot(c, vec3(0.2126, 0.7152, 0.0722));\n" +
      " c = mix(vec3(l), c, uSat);\n" +
      " c = mix(c, c * vec3(0.80, 1.04, 1.08), smoothstep(0.5, 0.0, l) * 0.7);\n" + // bóng ngả xanh ngọc
      " c = mix(c, c * vec3(1.04, 0.995, 0.96), smoothstep(0.5, 1.0, l) * 0.25);\n" + // vùng sáng ấm
      " float v = smoothstep(1.22, 0.26, length(d * vec2(1.0, 0.94)) * 1.42);\n" +
      " c *= mix(1.0, v, uVig);\n" +
      " float g = fract(sin(dot(vUv * uRes + uT * 137.0, vec2(12.9898, 78.233))) * 43758.5453);\n" +
      " c += (g - 0.5) * uGrain;\n" +
      " c *= uFade;\n" +
      " gl_FragColor = vec4(pow(max(c, 0.0), vec3(1.0 / 2.2)), 1.0);\n" +
      "}",
  });

  // lớp phủ bản mờ: vẽ lại ảnh đã làm mờ lên bộ đệm cảnh với độ đậm uAmt
  const mix = new THREE.ShaderMaterial({
    uniforms: { tS: { value: null }, uAmt: { value: 1 } },
    vertexShader: QUAD_VS,
    fragmentShader: "uniform sampler2D tS; uniform float uAmt; varying vec2 vUv;\nvoid main(){ gl_FragColor = vec4(texture2D(tS, vUv).rgb, uAmt); }",
    transparent: true, depthTest: false, depthWrite: false,
  });

  const pass = (mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null, additive = false) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    if (!additive) renderer.clear(true, false, false);
    renderer.render(qScene, cam);
  };

  return {
    scene,
    setSize(pw, ph) {
      scene.setSize(pw, ph);
      sizeLevels(pw, ph);
      comp.uniforms.uRes.value.set(pw, ph);
    },
    blurBackground(amount) {
      // thu nhỏ còn 1/8 (qua 1/2, 1/4 để mỗi bước là một lần lấy trung bình 2×2) rồi làm mờ Gauss hai lượt
      const L = levels;
      up.blending = THREE.NoBlending; up.uniforms.uAmt.value = 1;
      up.uniforms.tS.value = scene.texture; pass(up, L[0].a);
      up.uniforms.tS.value = L[0].a.texture; pass(up, L[1].a);
      up.uniforms.tS.value = L[1].a.texture; pass(up, L[2].a);
      for (let k = 0; k < 2; k++) {
        blur.uniforms.tS.value = L[2].a.texture; blur.uniforms.uDir.value.set(1 / L[2].w, 0); pass(blur, L[2].b);
        blur.uniforms.tS.value = L[2].b.texture; blur.uniforms.uDir.value.set(0, 1 / L[2].h); pass(blur, L[2].a);
      }
      mix.uniforms.tS.value = L[2].a.texture;
      mix.uniforms.uAmt.value = amount;
      quad.material = mix;
      renderer.setRenderTarget(scene);
      renderer.render(qScene, cam);
    },
    render(p) {
      bright.uniforms.tS.value = scene.texture;
      pass(bright, levels[0].a);
      for (let i = 0; i < levels.length; i++) {
        if (i > 0) { up.blending = THREE.NoBlending; up.uniforms.uAmt.value = 1; up.uniforms.tS.value = levels[i - 1].a.texture; pass(up, levels[i].a); }
        blur.uniforms.tS.value = levels[i].a.texture; blur.uniforms.uDir.value.set(1 / levels[i].w, 0); pass(blur, levels[i].b);
        blur.uniforms.tS.value = levels[i].b.texture; blur.uniforms.uDir.value.set(0, 1 / levels[i].h); pass(blur, levels[i].a);
      }
      up.blending = THREE.AdditiveBlending; up.uniforms.uAmt.value = 0.55;
      for (let i = levels.length - 1; i > 0; i--) { up.uniforms.tS.value = levels[i].a.texture; pass(up, levels[i - 1].a, true); }
      comp.uniforms.tS.value = scene.texture;
      comp.uniforms.tB.value = levels[0].a.texture;
      comp.uniforms.uT.value = p.time;
      comp.uniforms.uFade.value = p.fade;
      comp.uniforms.uBloom.value = 0.38;
      comp.uniforms.uExp.value = 1.0;
      pass(comp, null);
    },
    dispose() {
      scene.dispose();
      levels.forEach((l) => { l.a.dispose(); l.b.dispose(); });
      [up, bright, blur, comp, mix].forEach((m) => m.dispose());
      quad.geometry.dispose();
    },
  };
}
