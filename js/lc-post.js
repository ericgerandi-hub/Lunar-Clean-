'use strict';
/* =========================================================
   Lunar Clean – Bildnachbearbeitung: HDR, Leuchten (Bloom),
   Filmkurve, Vignette. Fällt ohne Float-Unterstützung auf
   direktes Zeichnen zurück.
   ========================================================= */
(function (LC) {
  const P = { enabled: false, exposure: 0.74, bloom: 0.36 };
  const LEVELS = 5;
  let rt, mips = [], quadScene, quadCam, quad, matPre, matDown, matUp, matFinal;

  const VERT = 'varying vec2 vUv;\nvoid main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

  function mk(frag, uniforms, extra) {
    return new THREE.ShaderMaterial(Object.assign({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false }, extra || {}));
  }

  P.init = function (renderer, w, h, quality) {
    const ok = renderer.capabilities.isWebGL2 && !!renderer.extensions.get('EXT_color_buffer_float') && !/[?&]nopost/.test(location.search);
    P.enabled = ok;
    if (!ok) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = P.exposure;
      renderer.outputEncoding = THREE.sRGBEncoding;
      return;
    }
    renderer.toneMapping = THREE.NoToneMapping; renderer.outputEncoding = THREE.LinearEncoding;
    quadScene = new THREE.Scene(); quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); quad.frustumCulled = false; quadScene.add(quad);

    matPre = mk([
      'uniform sampler2D tex; uniform vec2 texel; uniform float thr; varying vec2 vUv;',
      'vec3 s(vec2 o){ return min(texture2D(tex, vUv + o * texel).rgb, vec3(30.0)); }',
      'void main(){ vec3 c = (s(vec2(-0.5,-0.5)) + s(vec2(0.5,-0.5)) + s(vec2(-0.5,0.5)) + s(vec2(0.5,0.5))) * 0.25;',
      ' float br = max(c.r, max(c.g, c.b)); float k = max(br - thr, 0.0) / max(br, 1e-4);',
      ' gl_FragColor = vec4(c * k, 1.0); }'
    ].join('\n'), { tex: { value: null }, texel: { value: new THREE.Vector2() }, thr: { value: 1.9 } });

    matDown = mk([
      'uniform sampler2D tex; uniform vec2 texel; varying vec2 vUv;',
      'void main(){ vec3 c = texture2D(tex, vUv).rgb * 4.0;',
      ' c += texture2D(tex, vUv + vec2(-1.0,-1.0) * texel).rgb + texture2D(tex, vUv + vec2(1.0,-1.0) * texel).rgb;',
      ' c += texture2D(tex, vUv + vec2(-1.0,1.0) * texel).rgb + texture2D(tex, vUv + vec2(1.0,1.0) * texel).rgb;',
      ' gl_FragColor = vec4(c / 8.0, 1.0); }'
    ].join('\n'), { tex: { value: null }, texel: { value: new THREE.Vector2() } });

    matUp = mk([
      'uniform sampler2D tex; uniform vec2 texel; uniform float gain; varying vec2 vUv;',
      'void main(){ vec3 c = texture2D(tex, vUv).rgb * 4.0;',
      ' c += (texture2D(tex, vUv + vec2(-1.0,0.0) * texel).rgb + texture2D(tex, vUv + vec2(1.0,0.0) * texel).rgb + texture2D(tex, vUv + vec2(0.0,-1.0) * texel).rgb + texture2D(tex, vUv + vec2(0.0,1.0) * texel).rgb) * 2.0;',
      ' c += texture2D(tex, vUv + vec2(-1.0,-1.0) * texel).rgb + texture2D(tex, vUv + vec2(1.0,-1.0) * texel).rgb + texture2D(tex, vUv + vec2(-1.0,1.0) * texel).rgb + texture2D(tex, vUv + vec2(1.0,1.0) * texel).rgb;',
      ' gl_FragColor = vec4(c / 16.0 * gain, 1.0); }'
    ].join('\n'), { tex: { value: null }, texel: { value: new THREE.Vector2() }, gain: { value: 1.0 } },
      { blending: THREE.AdditiveBlending, transparent: true });

    matFinal = mk([
      'uniform sampler2D tScene; uniform sampler2D tBloom; uniform float exposure; uniform float bloomStr; uniform float uTime; uniform float uFade; uniform float uWarn;',
      'varying vec2 vUv;',
      'vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }',
      'vec3 aces(vec3 c){',
      ' const mat3 mi = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);',
      ' const mat3 mo = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);',
      ' return clamp(mo * fit(mi * c), 0.0, 1.0); }',
      'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
      'void main(){',
      ' vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * bloomStr;',
      ' c = aces(c * exposure / 0.6);',
      ' c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));',
      ' vec2 q = vUv - 0.5; float vg = smoothstep(0.95, 0.30, length(q * vec2(1.0, 0.82)));',
      ' c *= mix(0.62, 1.0, vg);',
      ' c += vec3(0.9, 0.12, 0.05) * uWarn * (1.0 - vg) * 0.5;',
      ' c += (hash(vUv * 917.0 + uTime) - 0.5) * (1.6 / 255.0);',
      ' gl_FragColor = vec4(c * uFade, 1.0); }'
    ].join('\n'), { tScene: { value: null }, tBloom: { value: null }, exposure: { value: 1 }, bloomStr: { value: 0.5 }, uTime: { value: 0 }, uFade: { value: 1 }, uWarn: { value: 0 } });

    P.setSize(renderer, w, h, quality);
  };

  P.setSize = function (renderer, w, h, quality) {
    if (!P.enabled) return;
    if (rt) rt.dispose();
    mips.forEach(m => m.dispose()); mips = [];
    const par = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false };
    const samples = quality === 'niedrig' ? 0 : 4;
    if (samples > 0) { rt = new THREE.WebGLMultisampleRenderTarget(w, h, par); rt.samples = samples; }
    else rt = new THREE.WebGLRenderTarget(w, h, par);
    let mw = w, mh = h;
    for (let i = 0; i < LEVELS; i++) {
      mw = Math.max(2, Math.floor(mw / 2)); mh = Math.max(2, Math.floor(mh / 2));
      mips.push(new THREE.WebGLRenderTarget(mw, mh, Object.assign({}, par, { depthBuffer: false })));
    }
    P.w = w; P.h = h;
  };

  function pass(renderer, mat, target, clear) {
    quad.material = mat;
    renderer.setRenderTarget(target);
    if (clear) renderer.clear();
    renderer.render(quadScene, quadCam);
  }

  P.fade = 1; P.warn = 0;
  P.render = function (renderer, scene, cam, vmScene, vmCam, time) {
    if (!P.enabled) {
      renderer.setRenderTarget(null); renderer.autoClear = true;
      renderer.render(scene, cam);
      if (vmScene) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(vmScene, vmCam); renderer.autoClear = true; }
      return;
    }
    renderer.setRenderTarget(rt); renderer.autoClear = true;
    renderer.render(scene, cam);
    renderer.autoClear = false;
    if (vmScene) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }

    matPre.uniforms.tex.value = rt.texture; matPre.uniforms.texel.value.set(1 / P.w, 1 / P.h);
    pass(renderer, matPre, mips[0], true);
    for (let i = 1; i < LEVELS; i++) {
      matDown.uniforms.tex.value = mips[i - 1].texture; matDown.uniforms.texel.value.set(1 / mips[i - 1].width, 1 / mips[i - 1].height);
      pass(renderer, matDown, mips[i], true);
    }
    for (let i = LEVELS - 2; i >= 0; i--) {
      matUp.uniforms.tex.value = mips[i + 1].texture; matUp.uniforms.texel.value.set(1 / mips[i + 1].width, 1 / mips[i + 1].height);
      pass(renderer, matUp, mips[i], false);
    }
    const u = matFinal.uniforms;
    u.tScene.value = rt.texture; u.tBloom.value = mips[0].texture; u.exposure.value = P.exposure; u.bloomStr.value = P.bloom;
    u.uTime.value = time % 10; u.uFade.value = P.fade; u.uWarn.value = P.warn;
    pass(renderer, matFinal, null, false);
    renderer.autoClear = true;
  };

  LC.Post = P;
})(window.LC);
