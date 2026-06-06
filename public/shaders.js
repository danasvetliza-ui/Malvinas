// Shaders.js - Custom GLSL Shader Definitions for background noise and collage layers

const Shaders = {
  // Shared GLSL Noise Functions
  noiseGLSL: `
    // Modulo 289 without divisions
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 permute(vec4 x) { return mod(x * x * 34.0 + x, 289.0); }

    // Ashima Arts 2D Simplex Noise
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                          0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                         -0.577350269189626,  // -1.0 + 2.0 * C.x
                          0.024390243902439); // 1.0 / 41.0
      vec2 i  = floor(v + vec2(dot(v, C.yy)) );
      vec2 x0 = v -   i + vec2(dot(i, C.xx)) ;
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute( permute( vec3(i.y) + vec3(0.0, i1.y, 1.0) )
            + vec3(i.x) + vec3(0.0, i1.x, 1.0) );
      vec3 m = max(vec3(0.5) - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - vec3(1.0);
      vec3 h = abs(x) - vec3(0.5);
      vec3 a0 = x - floor(x + vec3(0.5));
      vec3 g;
      g.x = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    // 2D Hash function
    vec2 hash2(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return fract(sin(p) * 43758.5453123);
    }

    // Worley / Cellular Noise 2D
    // Simple cellular noise algorithm
    float cellular(vec2 P) {
      vec2 Pi = floor(P);
      vec2 Pf = fract(P);
      float minDist = 1.0;
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = hash2(Pi + g);
          vec2 r = g - Pf + o;
          float d = dot(r, r);
          if (d < minDist) {
            minDist = d;
          }
        }
      }
      return sqrt(minDist);
    }

    // Fractal Brownian Motion (FBM) with Simplex Noise
    float fbm(vec2 p, float octaves) {
      float value = 0.0;
      float amplitude = 0.5;
      float frequency = 1.0;
      // Loop over octaves (max 6 for performance)
      for (int i = 0; i < 6; i++) {
        if (float(i) < octaves) {
          value += amplitude * snoise(p * frequency);
        }
        frequency *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }

    // Domain Warped Noise
    float warpNoise(vec2 p, float time, float warpIntensity, float noiseType, float octaves) {
      vec2 q = vec2(0.0);
      vec2 r = vec2(0.0);

      // We calculate different styles depending on noiseType
      if (noiseType < 0.5) { // Simplex
        q.x = snoise(p + vec2(0.0, 0.0) + vec2(time * 0.1));
        q.y = snoise(p + vec2(5.2, 1.3) + vec2(time * 0.15));
        r.x = snoise(p + 4.0 * q + vec2(1.7, 9.2) + vec2(time * 0.2));
        r.y = snoise(p + 4.0 * q + vec2(8.3, 2.8) + vec2(time * 0.1));
        return snoise(p + warpIntensity * r);
      } else if (noiseType < 1.5) { // Worley/Cellular
        q.x = cellular(p + vec2(time * 0.05));
        q.y = cellular(p + vec2(5.2, 1.3) + vec2(time * 0.03));
        r.x = cellular(p + 2.0 * q + vec2(time * 0.04));
        return cellular(p + warpIntensity * r);
      } else { // FBM
        q.x = fbm(p + vec2(time * 0.08), octaves);
        q.y = fbm(p + vec2(5.2, 1.3) + vec2(time * 0.05), octaves);
        r.x = fbm(p + 3.0 * q + vec2(1.7, 9.2) + vec2(time * 0.05), octaves);
        r.y = fbm(p + 3.0 * q + vec2(8.3, 2.8) + vec2(time * 0.03), octaves);
        return fbm(p + warpIntensity * r, octaves);
      }
    }
  `,

  // 1. Background Shader
  background: {
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float u_time;
      uniform float u_scale;
      uniform float u_speed;
      uniform float u_warp;
      uniform float u_detail;
      uniform float u_noise_type; // 0: Simplex, 1: Worley, 2: FBM
      uniform vec3 u_color1;
      uniform vec3 u_color2;
      uniform vec3 u_color3;
      uniform float u_brightness;
      uniform float u_contrast;

      varying vec2 vUv;

      // INSERT SHARED NOISE FUNCTIONS
      {NOISE_GLSL}

      void main() {
        // Center UV and apply scale
        vec2 p = (vUv - vec2(0.5)) * u_scale;
        
        // Calculate interactive noise
        float n = warpNoise(p, u_time * u_speed, u_warp, u_noise_type, u_detail);
        
        // Map noise [-1, 1] (or [0, 1] for worley) to [0, 1]
        float t = n * 0.5 + 0.5;
        if (u_noise_type > 0.5 && u_noise_type < 1.5) {
          t = n; // Worley is already positive
        }

        // Three-color gradient interpolation
        vec3 finalColor = vec3(0.0);
        if (t < 0.5) {
          finalColor = mix(u_color1, u_color2, t * 2.0);
        } else {
          finalColor = mix(u_color2, u_color3, (t - 0.5) * 2.0);
        }

        // Apply brightness and contrast (clean vector-scalar arithmetic)
        finalColor = (finalColor - vec3(0.5)) * u_contrast + vec3(0.5) + vec3(u_brightness);
        
        // Clamp output
        finalColor = clamp(finalColor, 0.0, 1.0);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
  },

  // 2. Custom Layer Shader (supports texture displacement via noise)
  layer: {
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      void main() {
        vUv = uv;
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D u_texture;
      uniform float u_opacity;
      uniform vec3 u_tint;
      uniform float u_tint_amount; // 0: raw texture, 1: fully tinted
      
      // Noise and displacement uniforms
      uniform float u_displacement; // How much the noise deforms the layer
      uniform float u_time;
      uniform float u_scale;
      uniform float u_speed;
      uniform float u_warp;
      uniform float u_detail;
      uniform float u_noise_type;

      varying vec2 vUv;
      varying vec3 vWorldPosition;

      // INSERT SHARED NOISE FUNCTIONS
      {NOISE_GLSL}

      void main() {
        // Calculate noise based on the world position or UVs to align displacement with background noise!
        // We use world position coordinates so the deformation aligns nicely with the background noise.
        vec2 noisePos = vWorldPosition.xy * 0.2 * u_scale;
        
        // Calculate displacement vectors by sampling noise at slightly offset coordinates
        float noiseValX = warpNoise(noisePos + vec2(0.0, 0.0), u_time * u_speed, u_warp, u_noise_type, u_detail);
        float noiseValY = warpNoise(noisePos + vec2(10.0, 10.0), u_time * u_speed, u_warp, u_noise_type, u_detail);
        
        vec2 displacement = vec2(noiseValX, noiseValY) * u_displacement * 0.15;
        
        // Sample the layer texture with displaced UVs
        vec2 displacedUv = clamp(vUv + displacement, 0.0, 1.0);
        vec4 texColor = texture2D(u_texture, displacedUv);

        // Apply tint color
        vec3 tintedColor = mix(texColor.rgb, u_tint, u_tint_amount);
        
        // Final alpha computation
        float finalAlpha = texColor.a * u_opacity;

        // Discard pixel if almost fully transparent (prevent blending issues)
        if (finalAlpha < 0.005) discard;

        gl_FragColor = vec4(tintedColor, finalAlpha);
      }
    `
  }
};

// Insert noise functions into both shaders before exporting
Shaders.background.fragmentShader = Shaders.background.fragmentShader.replace('{NOISE_GLSL}', Shaders.noiseGLSL);
Shaders.layer.fragmentShader = Shaders.layer.fragmentShader.replace('{NOISE_GLSL}', Shaders.noiseGLSL);

// If running in Node.js, export. If in browser, make it global.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Shaders;
} else {
  window.Shaders = Shaders;
}
