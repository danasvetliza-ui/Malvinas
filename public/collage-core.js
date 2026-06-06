// collage-core.js - Shared Three.js Rendering Engine for Editor & Display

class CollageRenderer {
  constructor(canvasElement, onLayerLoaded = null) {
    this.canvas = canvasElement;
    this.onLayerLoaded = onLayerLoaded; // Callback when an image/texture loads (to refresh UI)
    
    // Core Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();
    
    // State cache
    this.state = {
      shaderSettings: {},
      layers: []
    };
    
    // WebGL objects
    this.bgMesh = null;
    this.bgMaterial = null;
    
    this.layerMeshes = new Map(); // map of layerId -> THREE.Mesh
    this.texturesCache = new Map(); // map of layerId -> THREE.Texture
    this.canvasCache = new Map(); // map of layerId -> HTMLCanvasElement (for text/shapes)
    
    this.init();
  }

  init() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    
    // 1. Scene & Renderer (use WebGL2)
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true // useful if we want to save screenshots
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 2. Orthographic Camera (Perfect for 2D Collage)
    const aspect = width / height;
    this.camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 100);
    this.camera.position.z = 10;
    
    // 3. Background Shader Plane
    // It should fit the screen exactly. Height is 2 units (-1 to 1). Width is aspect * 2.
    const bgGeo = new THREE.PlaneGeometry(aspect * 2, 2);
    
    // Initial uniform values
    const initialSettings = {
      noiseType: 0,
      scale: 2.5,
      speed: 0.4,
      warp: 0.5,
      detail: 4.0,
      color1: '#0d0221',
      color2: '#0f4c5c',
      color3: '#e36414',
      brightness: 0.0,
      contrast: 1.0
    };
    
    this.bgMaterial = new THREE.ShaderMaterial({
      vertexShader: window.Shaders.background.vertexShader,
      fragmentShader: window.Shaders.background.fragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_scale: { value: initialSettings.scale },
        u_speed: { value: initialSettings.speed },
        u_warp: { value: initialSettings.warp },
        u_detail: { value: initialSettings.detail },
        u_noise_type: { value: initialSettings.noiseType },
        u_color1: { value: new THREE.Color(initialSettings.color1) },
        u_color2: { value: new THREE.Color(initialSettings.color2) },
        u_color3: { value: new THREE.Color(initialSettings.color3) },
        u_brightness: { value: initialSettings.brightness },
        u_contrast: { value: initialSettings.contrast }
      },
      depthWrite: false,
      depthTest: false
    });
    
    this.bgMesh = new THREE.Mesh(bgGeo, this.bgMaterial);
    this.bgMesh.position.z = -5; // Make sure it sits behind all layers
    this.scene.add(this.bgMesh);
    
    // Start animation loop
    this.animate();
  }

  // Handle Window Resize
  resize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    
    if (this.renderer) {
      this.renderer.setSize(width, height, false);
      const aspect = width / height;
      
      // Update camera projection
      this.camera.left = -aspect;
      this.camera.right = aspect;
      this.camera.top = 1;
      this.camera.bottom = -1;
      this.camera.updateProjectionMatrix();
      
      // Resize background mesh to fill screen
      if (this.bgMesh) {
        this.bgMesh.geometry.dispose();
        this.bgMesh.geometry = new THREE.PlaneGeometry(aspect * 2, 2);
      }
    }
  }

  // Update rendering state
  updateState(newState) {
    if (!newState) return;
    this.state = newState;
    
    // 1. Update Background Shader Uniforms
    const s = this.state.shaderSettings;
    if (s && this.bgMaterial) {
      this.bgMaterial.uniforms.u_scale.value = parseFloat(s.scale);
      this.bgMaterial.uniforms.u_speed.value = parseFloat(s.speed);
      this.bgMaterial.uniforms.u_warp.value = parseFloat(s.warp);
      this.bgMaterial.uniforms.u_detail.value = parseFloat(s.detail);
      this.bgMaterial.uniforms.u_noise_type.value = parseFloat(s.noiseType);
      this.bgMaterial.uniforms.u_color1.value.set(s.color1);
      this.bgMaterial.uniforms.u_color2.value.set(s.color2);
      this.bgMaterial.uniforms.u_color3.value.set(s.color3);
      this.bgMaterial.uniforms.u_brightness.value = parseFloat(s.brightness);
      this.bgMaterial.uniforms.u_contrast.value = parseFloat(s.contrast);
    }
    
    // 2. Synchronize Layers
    const activeLayerIds = new Set();
    
    if (this.state.layers) {
      this.state.layers.forEach((layer, index) => {
        activeLayerIds.add(layer.id);
        
        // If layer mesh doesn't exist, create it
        if (!this.layerMeshes.has(layer.id)) {
          this.createLayerMesh(layer, index);
        } else {
          // Update existing layer mesh properties
          this.updateLayerMesh(layer, index);
        }
      });
    }
    
    // 3. Remove deleted layers
    for (let [layerId, mesh] of this.layerMeshes.entries()) {
      if (!activeLayerIds.has(layerId)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        
        // Clean up material
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
        
        // Clean up textures
        const texture = this.texturesCache.get(layerId);
        if (texture) {
          texture.dispose();
          this.texturesCache.delete(layerId);
        }
        
        this.layerMeshes.delete(layerId);
        this.canvasCache.delete(layerId);
      }
    }
  }

  // Create a Three.js mesh for a new layer
  createLayerMesh(layer, index) {
    // 1. Create a dummy geometry first (will resize once texture loads)
    const geometry = new THREE.PlaneGeometry(1, 1);
    
    // 2. Create custom ShaderMaterial for the layer
    const material = new THREE.ShaderMaterial({
      vertexShader: window.Shaders.layer.vertexShader,
      fragmentShader: window.Shaders.layer.fragmentShader,
      uniforms: {
        u_texture: { value: new THREE.Texture() },
        u_opacity: { value: layer.opacity !== undefined ? layer.opacity : 1.0 },
        u_tint: { value: new THREE.Color(layer.tint || '#ffffff') },
        u_tint_amount: { value: layer.tintAmount !== undefined ? layer.tintAmount : 0.0 },
        
        // Copy background noise variables so displacement matches exactly
        u_displacement: { value: layer.displacement !== undefined ? layer.displacement : 0.0 },
        u_time: { value: 0 },
        u_scale: { value: this.state.shaderSettings.scale || 2.5 },
        u_speed: { value: this.state.shaderSettings.speed || 0.4 },
        u_warp: { value: this.state.shaderSettings.warp || 0.5 },
        u_detail: { value: this.state.shaderSettings.detail || 4.0 },
        u_noise_type: { value: this.state.shaderSettings.noiseType || 0 }
      },
      transparent: true,
      depthWrite: false, // Prevent layering artifacts
      depthTest: true
    });

    // Handle blending modes
    this.applyBlendMode(material, layer.blendMode);
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position on Z based on index to enforce draw order (layer 0 is back, layer N is front)
    // Z will range from -1 (bottom layer) to 8 (top layer)
    const zOffset = -1 + (index * 0.05);
    mesh.position.set(layer.x || 0, layer.y || 0, zOffset);
    mesh.rotation.z = (layer.rotation || 0) * (Math.PI / 180);
    mesh.scale.set(layer.scaleX || 1, layer.scaleY || 1, 1);
    mesh.visible = layer.visible !== false;

    this.scene.add(mesh);
    this.layerMeshes.set(layer.id, mesh);
    
    // 3. Load actual texture content
    this.loadLayerTexture(layer, mesh);
  }

  // Update existing mesh properties
  updateLayerMesh(layer, index) {
    const mesh = this.layerMeshes.get(layer.id);
    if (!mesh) return;
    
    // Set position, Z-index is determined by layer list order
    const zOffset = -1 + (index * 0.05);
    mesh.position.set(layer.x || 0, layer.y || 0, zOffset);
    mesh.rotation.z = (layer.rotation || 0) * (Math.PI / 180);
    mesh.scale.set(layer.scaleX || 1, layer.scaleY || 1, 1);
    mesh.visible = layer.visible !== false;
    
    const mat = mesh.material;
    mat.uniforms.u_opacity.value = layer.opacity !== undefined ? layer.opacity : 1.0;
    mat.uniforms.u_displacement.value = layer.displacement !== undefined ? layer.displacement : 0.0;
    mat.uniforms.u_tint.value.set(layer.tint || '#ffffff');
    mat.uniforms.u_tint_amount.value = layer.tintAmount !== undefined ? layer.tintAmount : 0.0;
    
    // Sync noise uniforms to layer
    const s = this.state.shaderSettings;
    if (s) {
      mat.uniforms.u_scale.value = parseFloat(s.scale);
      mat.uniforms.u_speed.value = parseFloat(s.speed);
      mat.uniforms.u_warp.value = parseFloat(s.warp);
      mat.uniforms.u_detail.value = parseFloat(s.detail);
      mat.uniforms.u_noise_type.value = parseFloat(s.noiseType);
    }

    this.applyBlendMode(mat, layer.blendMode);

    // If text content, shapes, or procedural textures changed, we need to redraw them
    if (layer.type === 'text' || layer.type === 'shape' || layer.type === 'texture') {
      this.redrawCanvasLayer(layer, mesh);
    }
  }

  // Load image texture (web/pc) or initialize canvas for shapes/texts
  loadLayerTexture(layer, mesh) {
    if (layer.type === 'image') {
      if (!layer.src) return;
      
      const loader = new THREE.TextureLoader();
      loader.load(
        layer.src,
        (texture) => {
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          
          mesh.material.uniforms.u_texture.value = texture;
          this.texturesCache.set(layer.id, texture);
          
          // Adjust geometry aspect ratio based on image dimensions
          const imgAspect = texture.image.width / texture.image.height;
          
          // Dispose old geometry and create new one maintaining aspect ratio
          mesh.geometry.dispose();
          // Let's make height 0.5 default, width matches aspect ratio
          mesh.geometry = new THREE.PlaneGeometry(0.5 * imgAspect, 0.5);
          
          if (this.onLayerLoaded) this.onLayerLoaded(layer.id);
        },
        undefined,
        (err) => {
          console.error(`Failed to load image texture for layer ${layer.name}:`, err);
        }
      );
    } else {
      // It's a text, shape, or procedural texture layer -> create canvas texture
      const canvas = document.createElement('canvas');
      this.canvasCache.set(layer.id, canvas);
      
      this.drawCanvasContent(layer, canvas);
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      
      mesh.material.uniforms.u_texture.value = texture;
      this.texturesCache.set(layer.id, texture);
      
      // Update mesh geometry size
      const canvasAspect = canvas.width / canvas.height;
      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(0.5 * canvasAspect, 0.5);
    }
  }

  // Redraw Canvas content (texts, shapes) and upload texture to WebGL
  redrawCanvasLayer(layer, mesh) {
    const canvas = this.canvasCache.get(layer.id);
    const texture = this.texturesCache.get(layer.id);
    if (!canvas || !texture) return;
    
    const prevWidth = canvas.width;
    const prevHeight = canvas.height;
    
    // Draw content (resizes canvas dynamically if needed)
    this.drawCanvasContent(layer, canvas);
    
    // Tell Three.js that the texture needs updating
    texture.needsUpdate = true;
    
    // If the canvas aspect ratio changed, update the geometry
    if (canvas.width !== prevWidth || canvas.height !== prevHeight) {
      const canvasAspect = canvas.width / canvas.height;
      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(0.5 * canvasAspect, 0.5);
    }
  }

  // Apply blend modes to material
  applyBlendMode(material, mode) {
    if (!mode) mode = 'normal';
    
    material.blending = THREE.CustomBlending;
    material.blendEquation = THREE.AddEquation;
    material.blendSrc = THREE.SrcAlphaFactor;
    material.blendDst = THREE.OneMinusSrcAlphaFactor;
    
    switch (mode) {
      case 'add':
        material.blending = THREE.AdditiveBlending;
        break;
      case 'sub':
        material.blending = THREE.SubtractiveBlending;
        break;
      case 'multiply':
        material.blending = THREE.MultiplyBlending;
        break;
      case 'screen':
        // Screen Blending Formula: Color = SrcColor * 1 + DstColor * (1 - SrcColor)
        material.blendSrc = THREE.OneFactor;
        material.blendDst = THREE.OneMinusSrcColorFactor;
        material.blendEquation = THREE.AddEquation;
        break;
      case 'normal':
      default:
        material.blending = THREE.NormalBlending;
        break;
    }
    material.needsUpdate = true;
  }

  // Draw content for canvas layers: text, shape, or procedural texture
  drawCanvasContent(layer, canvas) {
    const ctx = canvas.getContext('2d');
    
    if (layer.type === 'text') {
      const fontSize = layer.fontSize || 48;
      const text = layer.text || 'TEXT';
      const font = `${layer.textStyle || 'normal'} ${fontSize}px "${layer.fontFamily || 'Space Grotesk'}"`;
      
      ctx.font = font;
      // Measure text to size canvas correctly
      const metrics = ctx.measureText(text);
      
      // Calculate width and height with padding
      const textWidth = Math.max(10, Math.ceil(metrics.width));
      const textHeight = Math.ceil(fontSize * 1.3);
      
      canvas.width = textWidth + 40; // horizontal padding
      canvas.height = textHeight + 20; // vertical padding
      
      // Re-apply font since width/height resets context
      ctx.font = font;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background if any
      if (layer.textBgColor && layer.textBgColor !== 'transparent') {
        ctx.fillStyle = layer.textBgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // Draw stroke if configured
      if (layer.strokeWidth && layer.strokeColor) {
        ctx.strokeStyle = layer.strokeColor;
        ctx.lineWidth = parseInt(layer.strokeWidth);
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
      }
      
      // Draw fill text
      ctx.fillStyle = layer.textColor || '#ffffff';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      
    } else if (layer.type === 'shape') {
      // Shapes are drawn into a square canvas
      const size = 512;
      canvas.width = size;
      canvas.height = size;
      
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      
      // Center coordinates
      const cx = size / 2;
      const cy = size / 2;
      const r = size * 0.45; // radius
      
      // Setup Fill Style (Solid or Gradient)
      if (layer.fillType === 'gradient' && layer.fillColor2) {
        let grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, layer.fillColor || '#ffffff');
        grad.addColorStop(1, layer.fillColor2);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = layer.fillColor || '#00f2fe';
      }
      
      ctx.strokeStyle = layer.strokeColor || '#ffffff';
      ctx.lineWidth = layer.strokeWidth !== undefined ? parseInt(layer.strokeWidth) : 0;
      
      ctx.beginPath();
      const shape = layer.shapeType || 'rect';
      
      if (shape === 'escarapela') {
        // Concentric Escarapela Argentina
        // 1. Outer celeste circle
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = layer.fillColor || '#4e87bf';
        ctx.fill();
        if (ctx.lineWidth > 0) ctx.stroke();

        // 2. Middle white circle
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // 3. Inner celeste circle
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = layer.fillColor || '#4e87bf';
        ctx.fill();

        // 4. Center sun core (gold)
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.14, 0, Math.PI * 2);
        ctx.fillStyle = '#f6b426';
        ctx.fill();

        ctx.restore();
        return;
      } else if (shape === 'sun') {
        // Sol de Mayo
        ctx.fillStyle = '#f6b426';
        ctx.strokeStyle = '#f6b426';
        
        // Draw core
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
        ctx.fill();
        if (ctx.lineWidth > 0) {
          ctx.strokeStyle = layer.strokeColor || '#ffffff';
          ctx.stroke();
        }

        // Draw 16 rays
        const rays = 16;
        ctx.strokeStyle = '#f6b426';
        ctx.lineWidth = 4;
        for (let i = 0; i < rays; i++) {
          const angle = (i * Math.PI * 2) / rays;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          
          ctx.beginPath();
          ctx.moveTo(cx + cos * (r * 0.42), cy + sin * (r * 0.42));
          const rayLen = i % 2 === 0 ? r * 0.85 : r * 0.7;
          ctx.lineTo(cx + cos * rayLen, cy + sin * rayLen);
          ctx.stroke();
        }
        ctx.restore();
        return;
      } else if (shape === 'malvinas') {
        // Silhouette of Malvinas Islands (Gran Malvina left, Isla Soledad right)
        // Draw West island (Gran Malvina)
        ctx.beginPath();
        ctx.moveTo(110, 240);
        ctx.bezierCurveTo(120, 200, 150, 160, 180, 180);
        ctx.bezierCurveTo(200, 190, 220, 170, 230, 200);
        ctx.bezierCurveTo(240, 220, 225, 250, 235, 270);
        ctx.bezierCurveTo(245, 290, 220, 310, 200, 310);
        ctx.bezierCurveTo(180, 310, 160, 280, 140, 290);
        ctx.bezierCurveTo(120, 300, 100, 270, 110, 240);
        ctx.closePath();
        ctx.fill();
        if (ctx.lineWidth > 0) ctx.stroke();
        
        // Draw East island (Isla Soledad)
        ctx.beginPath();
        ctx.moveTo(270, 220);
        ctx.bezierCurveTo(290, 190, 320, 180, 350, 180);
        ctx.bezierCurveTo(380, 180, 410, 160, 420, 190);
        ctx.bezierCurveTo(430, 220, 390, 240, 410, 260);
        ctx.bezierCurveTo(430, 280, 410, 310, 390, 320);
        ctx.bezierCurveTo(360, 330, 340, 300, 320, 310);
        ctx.bezierCurveTo(300, 320, 280, 290, 290, 270);
        ctx.bezierCurveTo(300, 250, 260, 240, 270, 220);
        ctx.closePath();
        ctx.fill();
        if (ctx.lineWidth > 0) ctx.stroke();
        
        ctx.restore();
        return;
      } else if (shape === 'rect') {
        const w = size * 0.8;
        const h = size * 0.8;
        ctx.rect(cx - w / 2, cy - h / 2, w, h);
      } else if (shape === 'circle') {
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      } else if (shape === 'triangle') {
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r * 0.866, cy + r * 0.5);
        ctx.lineTo(cx - r * 0.866, cy + r * 0.5);
        ctx.closePath();
      } else if (shape === 'star') {
        const spikes = 5;
        const outerRadius = r;
        const innerRadius = r * 0.4;
        let rot = (Math.PI / 2) * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
          x = cx + Math.cos(rot) * outerRadius;
          y = cy + Math.sin(rot) * outerRadius;
          ctx.lineTo(x, y);
          rot += step;

          x = cx + Math.cos(rot) * innerRadius;
          y = cy + Math.sin(rot) * innerRadius;
          ctx.lineTo(x, y);
          rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
      }
      
      // Fill and Stroke
      ctx.fill();
      if (ctx.lineWidth > 0) {
        ctx.stroke();
      }
      ctx.restore();
      
    } else if (layer.type === 'texture') {
      // Procedural textures
      const size = 512;
      canvas.width = size;
      canvas.height = size;
      ctx.clearRect(0, 0, size, size);
      
      const textureType = layer.textureType || 'grid';
      
      if (textureType === 'grid') {
        ctx.strokeStyle = layer.fillColor || '#ffffff';
        ctx.lineWidth = layer.strokeWidth !== undefined ? parseInt(layer.strokeWidth) : 2;
        const divisions = layer.gridDivisions ? parseInt(layer.gridDivisions) : 10;
        const step = size / divisions;
        
        ctx.beginPath();
        for (let i = 0; i <= divisions; i++) {
          // Horizontal lines
          ctx.moveTo(0, i * step);
          ctx.lineTo(size, i * step);
          // Vertical lines
          ctx.moveTo(i * step, 0);
          ctx.lineTo(i * step, size);
        }
        ctx.stroke();
        
      } else if (textureType === 'noise') {
        // High density visual grain
        const imgData = ctx.createImageData(size, size);
        const data = imgData.data;
        const grainColor = layer.fillColor || '#ffffff';
        const colorRGB = this.hexToRgb(grainColor);
        const density = layer.noiseDensity !== undefined ? parseFloat(layer.noiseDensity) : 0.5;

        for (let i = 0; i < data.length; i += 4) {
          const rand = Math.random();
          if (rand < density) {
            data[i] = colorRGB.r;
            data[i+1] = colorRGB.g;
            data[i+2] = colorRGB.b;
            data[i+3] = Math.random() * 255; // random opacity
          } else {
            data[i+3] = 0; // transparent
          }
        }
        ctx.putImageData(imgData, 0, 0);
        
      } else if (textureType === 'scanlines') {
        ctx.fillStyle = layer.fillColor || '#ffffff';
        const spacing = layer.scanlineSpacing ? parseInt(layer.scanlineSpacing) : 4;
        const thickness = layer.scanlineThickness ? parseInt(layer.scanlineThickness) : 2;
        
        for (let y = 0; y < size; y += spacing) {
          ctx.fillRect(0, y, size, thickness);
        }
      } else if (textureType === 'dots') {
        ctx.fillStyle = layer.fillColor || '#ffffff';
        const spacing = layer.dotSpacing ? parseInt(layer.dotSpacing) : 20;
        const radius = layer.dotRadius ? parseFloat(layer.dotRadius) : 3;
        
        for (let y = spacing / 2; y < size; y += spacing) {
          for (let x = spacing / 2; x < size; x += spacing) {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  // Convert Hex color to RGB
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  // Animation Loop
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.render();
  }

  render() {
    if (!this.renderer || !this.scene || !this.camera) return;
    
    const elapsed = this.clock.getElapsedTime();
    
    // 1. Update backgrounds shader u_time
    if (this.bgMaterial) {
      this.bgMaterial.uniforms.u_time.value = elapsed;
    }
    
    // 2. Update layers shader u_time
    this.layerMeshes.forEach((mesh) => {
      if (mesh.material && mesh.material.uniforms && mesh.material.uniforms.u_time) {
        mesh.material.uniforms.u_time.value = elapsed;
      }
    });
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Export for Node/Browser compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CollageRenderer;
} else {
  window.CollageRenderer = CollageRenderer;
}
