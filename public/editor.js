// editor.js - Editor Frontend Controller

document.addEventListener('DOMContentLoaded', () => {
  // 1. WebSocket Setup
  const socket = io();
  const statusDot = document.getElementById('socket-status-dot');
  const statusText = document.getElementById('socket-status-text');
  
  socket.on('connect', () => {
    statusDot.classList.add('connected');
    statusText.innerText = 'CONECTADO';
  });
  
  socket.on('disconnect', () => {
    statusDot.classList.remove('connected');
    statusText.innerText = 'DESCONECTADO';
  });

  // 2. Local State
  let state = {
    shaderSettings: {
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
    },
    layers: []
  };
  
  let selectedLayerId = null;

  // 3. Initialize Three.js Renderer
  const canvas = document.getElementById('canvas-3d');
  const renderer = new CollageRenderer(canvas, (layerId) => {
    // Callback when texture finishes loading (e.g. image)
    console.log(`Layer texture loaded: ${layerId}`);
  });

  // 4. Tab Navigation
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-content-panel');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      
      tab.classList.add('active');
      const panelId = `panel-${tab.dataset.tab}`;
      document.getElementById(panelId).classList.add('active');
    });
  });

  function switchTab(tabName) {
    const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (tab) tab.click();
  }

  // 5. Open Display Tab
  document.getElementById('btn-open-display').addEventListener('click', () => {
    window.open('/display', '_blank');
  });

  // 6. Bind Socket Updates (from server / other tabs)
  socket.on('stateUpdate', (newState) => {
    if (!newState) return;
    
    // Check if we need to preserve selectedLayerId (if it still exists in the new state)
    const exists = newState.layers.some(l => l.id === selectedLayerId);
    if (!exists) selectedLayerId = null;
    
    state = newState;
    
    // Sync the UI controls and rendering engine
    syncControlsToState();
    renderer.updateState(state);
    renderLayersList();
    renderTransformPanel();
  });

  // Helper to send current state to server (debounced slightly to prevent socket flood)
  let sendTimeout;
  function emitStateChange() {
    clearTimeout(sendTimeout);
    sendTimeout = setTimeout(() => {
      socket.emit('stateUpdate', state);
      renderer.updateState(state);
    }, 30);
  }

  // 7. Bind Shader Background Controls
  const noiseType = document.getElementById('noise-type');
  const fbmOctavesGroup = document.getElementById('fbm-octaves-group');
  const noiseDetail = document.getElementById('noise-detail');
  const noiseScale = document.getElementById('noise-scale');
  const noiseSpeed = document.getElementById('noise-speed');
  const noiseWarp = document.getElementById('noise-warp');
  const noiseColor1 = document.getElementById('noise-color1');
  const noiseColor2 = document.getElementById('noise-color2');
  const noiseColor3 = document.getElementById('noise-color3');
  const noiseBrightness = document.getElementById('noise-brightness');
  const noiseContrast = document.getElementById('noise-contrast');

  function updateShaderState() {
    state.shaderSettings = {
      noiseType: parseInt(noiseType.value),
      scale: parseFloat(noiseScale.value),
      speed: parseFloat(noiseSpeed.value),
      warp: parseFloat(noiseWarp.value),
      detail: parseFloat(noiseDetail.value),
      color1: noiseColor1.value,
      color2: noiseColor2.value,
      color3: noiseColor3.value,
      brightness: parseFloat(noiseBrightness.value),
      contrast: parseFloat(noiseContrast.value)
    };
    
    // Toggle FBM octaves slider visibility
    fbmOctavesGroup.style.display = noiseType.value === "2" ? "flex" : "none";
    
    // Update numeric labels
    document.getElementById('val-noise-detail').innerText = noiseDetail.value;
    document.getElementById('val-noise-scale').innerText = parseFloat(noiseScale.value).toFixed(1);
    document.getElementById('val-noise-speed').innerText = parseFloat(noiseSpeed.value).toFixed(2);
    document.getElementById('val-noise-warp').innerText = parseFloat(noiseWarp.value).toFixed(1);
    document.getElementById('val-noise-brightness').innerText = parseFloat(noiseBrightness.value).toFixed(2);
    document.getElementById('val-noise-contrast').innerText = parseFloat(noiseContrast.value).toFixed(2);
    
    // Update color preview backgrounds
    document.getElementById('preview-color1').style.backgroundColor = noiseColor1.value;
    document.getElementById('preview-color2').style.backgroundColor = noiseColor2.value;
    document.getElementById('preview-color3').style.backgroundColor = noiseColor3.value;
    
    emitStateChange();
  }

  [noiseType, noiseDetail, noiseScale, noiseSpeed, noiseWarp, noiseColor1, noiseColor2, noiseColor3, noiseBrightness, noiseContrast].forEach(input => {
    input.addEventListener('input', updateShaderState);
  });

  // 8. Add Layer Events
  // PC Image Upload
  const fileUploader = document.getElementById('file-uploader');
  document.getElementById('btn-add-pc-image').addEventListener('click', () => {
    fileUploader.click();
  });

  fileUploader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const newLayer = {
        id: 'img_' + Date.now(),
        type: 'image',
        name: file.name.substring(0, 15) || 'Imagen PC',
        src: event.target.result, // base64
        x: 0,
        y: 0,
        scaleX: 1.0,
        scaleY: 1.0,
        rotation: 0,
        opacity: 1.0,
        blendMode: 'normal',
        displacement: 0.2, // Default deformation
        tint: '#ffffff',
        tintAmount: 0.0,
        visible: true
      };
      
      state.layers.push(newLayer);
      selectedLayerId = newLayer.id;
      fileUploader.value = ''; // reset
      
      emitStateChange();
      renderLayersList();
      renderTransformPanel();
      switchTab('transform');
    };
    reader.readAsDataURL(file);
  });

  // Web Image Upload (Modal)
  const modalUrl = document.getElementById('modal-url');
  const inputImageUrl = document.getElementById('input-image-url');
  
  document.getElementById('btn-add-web-image').addEventListener('click', () => {
    modalUrl.classList.add('open');
    inputImageUrl.focus();
  });
  
  document.getElementById('modal-url-cancel').addEventListener('click', () => {
    modalUrl.classList.remove('open');
    inputImageUrl.value = '';
  });
  
  document.getElementById('modal-url-confirm').addEventListener('click', () => {
    const url = inputImageUrl.value.trim();
    if (!url) return;
    
    const newLayer = {
      id: 'web_' + Date.now(),
      type: 'image',
      name: 'Imagen Web',
      src: url,
      x: 0,
      y: 0,
      scaleX: 1.0,
      scaleY: 1.0,
      rotation: 0,
      opacity: 1.0,
      blendMode: 'normal',
      displacement: 0.2,
      tint: '#ffffff',
      tintAmount: 0.0,
      visible: true
    };
    
    state.layers.push(newLayer);
    selectedLayerId = newLayer.id;
    
    modalUrl.classList.remove('open');
    inputImageUrl.value = '';
    
    emitStateChange();
    renderLayersList();
    renderTransformPanel();
    switchTab('transform');
  });

  // Add Shape Layer
  document.getElementById('btn-add-shape').addEventListener('click', () => {
    const newLayer = {
      id: 'shape_' + Date.now(),
      type: 'shape',
      shapeType: 'malvinas',
      name: 'Silueta Malvinas',
      x: 0,
      y: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      rotation: 0,
      opacity: 1.0,
      blendMode: 'normal',
      displacement: 0.15,
      fillType: 'gradient',
      fillColor: '#4e87bf',
      fillColor2: '#ffffff',
      strokeColor: '#f6b426',
      strokeWidth: 2,
      visible: true
    };
    
    state.layers.push(newLayer);
    selectedLayerId = newLayer.id;
    
    emitStateChange();
    renderLayersList();
    renderTransformPanel();
    switchTab('transform');
  });

  // Add Text Layer
  document.getElementById('btn-add-text').addEventListener('click', () => {
    const newLayer = {
      id: 'text_' + Date.now(),
      type: 'text',
      name: 'Texto Memorial',
      text: 'Las Malvinas son Argentinas',
      fontFamily: 'Outfit',
      fontSize: 48,
      textStyle: 'bold',
      x: 0,
      y: 0,
      scaleX: 1.0,
      scaleY: 1.0,
      rotation: 0,
      opacity: 1.0,
      blendMode: 'normal',
      displacement: 0.1,
      textColor: '#ffffff',
      strokeColor: '#4e87bf',
      strokeWidth: 3,
      textBgColor: 'transparent',
      visible: true
    };
    
    state.layers.push(newLayer);
    selectedLayerId = newLayer.id;
    
    emitStateChange();
    renderLayersList();
    renderTransformPanel();
    switchTab('transform');
  });

  // Add Texture Layer
  document.getElementById('btn-add-texture').addEventListener('click', () => {
    const newLayer = {
      id: 'tex_' + Date.now(),
      type: 'texture',
      textureType: 'grid',
      name: 'Grilla Neon',
      x: 0,
      y: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      rotation: 0,
      opacity: 0.4,
      blendMode: 'screen',
      displacement: 0.25,
      fillColor: '#00f2fe',
      strokeWidth: 2,
      gridDivisions: 12,
      noiseDensity: 0.5,
      scanlineSpacing: 8,
      scanlineThickness: 3,
      dotSpacing: 25,
      dotRadius: 4,
      visible: true
    };
    
    state.layers.push(newLayer);
    selectedLayerId = newLayer.id;
    
    emitStateChange();
    renderLayersList();
    renderTransformPanel();
    switchTab('transform');
  });

  // Preset Backgrounds Click Handlers
  document.querySelectorAll('.btn-preset-bg').forEach(btn => {
    btn.addEventListener('click', () => {
      const presetType = btn.dataset.preset;
      if (presetType === 'mar') {
        state.shaderSettings = {
          noiseType: 2, // FBM
          scale: 2.2,
          speed: 0.25,
          warp: 0.8,
          detail: 4.0,
          color1: '#031026', // Deep navy
          color2: '#4e87bf', // Celeste
          color3: '#ffffff', // White
          brightness: -0.05,
          contrast: 1.15
        };
      } else if (presetType === 'fuego') {
        state.shaderSettings = {
          noiseType: 1, // Worley
          scale: 3.5,
          speed: 0.5,
          warp: 1.2,
          detail: 3.0,
          color1: '#0a0515', // Midnight purple
          color2: '#c2410c', // Dark orange
          color3: '#f6b426', // Gold
          brightness: 0.0,
          contrast: 1.3
        };
      } else if (presetType === 'cielo') {
        state.shaderSettings = {
          noiseType: 0, // Simplex
          scale: 1.8,
          speed: 0.15,
          warp: 0.4,
          detail: 2.0,
          color1: '#5ba6e0', // Bright Celeste
          color2: '#ffffff', // White
          color3: '#f6d27e', // Pale gold
          brightness: 0.05,
          contrast: 1.0
        };
      }
      syncControlsToState();
      emitStateChange();
    });
  });

  // Preset Layers Click Handlers
  document.querySelectorAll('.btn-preset-layer').forEach(btn => {
    btn.addEventListener('click', () => {
      const presetType = btn.dataset.preset;
      let newLayer = null;
      const timestamp = Date.now();

      if (presetType === 'islas-acuarela') {
        newLayer = {
          id: 'shape_preset_' + timestamp,
          type: 'shape',
          shapeType: 'malvinas',
          name: 'Islas (Acuarela)',
          x: 0,
          y: 0,
          scaleX: 1.8,
          scaleY: 1.8,
          rotation: 0,
          opacity: 0.9,
          blendMode: 'normal',
          displacement: 0.35, // High displacement
          fillType: 'gradient',
          fillColor: '#4e87bf',
          fillColor2: '#ffffff',
          strokeColor: '#f6b426',
          strokeWidth: 2,
          visible: true
        };
      } else if (presetType === 'escarapela-neon') {
        newLayer = {
          id: 'shape_preset_' + timestamp,
          type: 'shape',
          shapeType: 'escarapela',
          name: 'Escarapela Neon',
          x: -1.0,
          y: 0.65,
          scaleX: 0.55,
          scaleY: 0.55,
          rotation: 0,
          opacity: 0.9,
          blendMode: 'screen',
          displacement: 0.05,
          fillColor: '#4e87bf',
          fillColor2: '#ffffff',
          fillType: 'solid',
          strokeColor: '#ffffff',
          strokeWidth: 0,
          visible: true
        };
      } else if (presetType === 'sol-bandera') {
        newLayer = {
          id: 'shape_preset_' + timestamp,
          type: 'shape',
          shapeType: 'sun',
          name: 'Sol de Mayo',
          x: 1.0,
          y: 0.65,
          scaleX: 0.7,
          scaleY: 0.7,
          rotation: 0,
          opacity: 0.95,
          blendMode: 'screen',
          displacement: 0.08,
          fillColor: '#f6b426',
          fillColor2: '#f6b426',
          fillType: 'solid',
          strokeColor: '#ffffff',
          strokeWidth: 0,
          visible: true
        };
      } else if (presetType === 'texto-honor') {
        newLayer = {
          id: 'text_preset_' + timestamp,
          type: 'text',
          name: 'Texto: Honor y Gloria',
          text: 'HONOR Y GLORIA',
          fontFamily: 'Space Grotesk',
          fontSize: 44,
          textStyle: 'bold',
          x: 0,
          y: -0.45,
          scaleX: 1.0,
          scaleY: 1.0,
          rotation: 0,
          opacity: 0.95,
          blendMode: 'add',
          displacement: 0.1,
          textColor: '#f6b426',
          strokeColor: '#031026',
          strokeWidth: 3,
          textBgColor: 'transparent',
          visible: true
        };
      } else if (presetType === 'texto-soberania') {
        newLayer = {
          id: 'text_preset_' + timestamp,
          type: 'text',
          name: 'Texto: Las Malvinas',
          text: 'Las Malvinas son Argentinas',
          fontFamily: 'Outfit',
          fontSize: 34,
          textStyle: 'bold',
          x: 0,
          y: -0.7,
          scaleX: 0.9,
          scaleY: 0.9,
          rotation: 0,
          opacity: 0.9,
          blendMode: 'normal',
          displacement: 0.08,
          textColor: '#ffffff',
          strokeColor: '#4e87bf',
          strokeWidth: 2,
          textBgColor: 'transparent',
          visible: true
        };
      } else if (presetType === 'texto-heroes') {
        newLayer = {
          id: 'text_preset_' + timestamp,
          type: 'text',
          name: 'Texto: Héroes',
          text: 'HÉROES DE LA PATRIA',
          fontFamily: 'Space Grotesk',
          fontSize: 36,
          textStyle: 'bold',
          x: 0,
          y: 0.45,
          scaleX: 1.0,
          scaleY: 1.0,
          rotation: 0,
          opacity: 0.95,
          blendMode: 'normal',
          displacement: 0.07,
          textColor: '#ffffff',
          strokeColor: '#4e87bf',
          strokeWidth: 3,
          textBgColor: 'transparent',
          visible: true
        };
      } else if (presetType === 'img-monumento') {
        newLayer = {
          id: 'img_preset_' + timestamp,
          type: 'image',
          name: 'Monumento Caídos',
          src: 'monumento_malvinas.png',
          x: 0,
          y: 0,
          scaleX: 1.3,
          scaleY: 1.3,
          rotation: 0,
          opacity: 0.8,
          blendMode: 'screen', // Screen blending makes it blend beautifully into the background!
          displacement: 0.15,
          tint: '#4e87bf',
          tintAmount: 0.1,
          visible: true
        };
      } else if (presetType === 'img-mapa') {
        newLayer = {
          id: 'img_preset_' + timestamp,
          type: 'image',
          name: 'Mapa Histórico',
          src: 'mapa_malvinas.png',
          x: 0,
          y: 0.05,
          scaleX: 1.4,
          scaleY: 1.4,
          rotation: 0,
          opacity: 0.7,
          blendMode: 'normal',
          displacement: 0.12,
          tint: '#4e87bf',
          tintAmount: 0.2,
          visible: true
        };
      }

      if (newLayer) {
        state.layers.push(newLayer);
        selectedLayerId = newLayer.id;
        emitStateChange();
        renderLayersList();
        renderTransformPanel();
        switchTab('transform');
      }
    });
  });

  // 9. Layers List UI Rendering
  const layersContainer = document.getElementById('layers-container');
  const layerCountBadge = document.getElementById('layer-count');

  function renderLayersList() {
    layerCountBadge.innerText = state.layers.length;
    
    if (state.layers.length === 0) {
      layersContainer.innerHTML = `<div class="layers-empty">Haz click en "Crear Capa" para comenzar a diseñar tu collage.</div>`;
      return;
    }
    
    layersContainer.innerHTML = '';
    
    // Render layers in reverse order so the top-most layer is shown first in the list
    for (let i = state.layers.length - 1; i >= 0; i--) {
      const layer = state.layers[i];
      const item = document.createElement('div');
      item.className = `layer-item ${layer.id === selectedLayerId ? 'active' : ''}`;
      
      // Select SVG icon based on layer type
      let icon = '';
      if (layer.type === 'image') {
        icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
      } else if (layer.type === 'shape') {
        icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 22h20L12 2z"/></svg>`;
      } else if (layer.type === 'text') {
        icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`;
      } else if (layer.type === 'texture') {
        icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>`;
      }

      item.innerHTML = `
        <div class="layer-drag">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="16" x2="21" y2="16"/>
          </svg>
        </div>
        <div class="layer-icon">${icon}</div>
        <div class="layer-name">${layer.name}</div>
        <div style="display: flex; gap: 4px;">
          <!-- Move Up -->
          <button class="layer-visibility btn-move-up" data-index="${i}" title="Subir Capa">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <!-- Move Down -->
          <button class="layer-visibility btn-move-down" data-index="${i}" title="Bajar Capa">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <!-- Toggle Visibility -->
          <button class="layer-visibility btn-visibility ${layer.visible ? '' : 'hidden'}" data-id="${layer.id}" title="Ocultar/Mostrar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          <!-- Delete -->
          <button class="layer-delete btn-delete" data-id="${layer.id}" title="Eliminar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;
      
      // Select layer item when clicking body
      item.addEventListener('click', (e) => {
        // Prevent trigger selection if clicking buttons
        if (e.target.closest('button') || e.target.closest('.layer-drag')) return;
        selectedLayerId = layer.id;
        renderLayersList();
        renderTransformPanel();
        switchTab('transform');
      });
      
      layersContainer.appendChild(item);
    }
    
    // Bind Reorder & Visibility / Delete listeners
    layersContainer.querySelectorAll('.btn-visibility').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        const layer = state.layers.find(l => l.id === id);
        if (layer) {
          layer.visible = !layer.visible;
          emitStateChange();
          renderLayersList();
          if (selectedLayerId === id) renderTransformPanel();
        }
      });
    });
    
    layersContainer.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        state.layers = state.layers.filter(l => l.id !== id);
        if (selectedLayerId === id) selectedLayerId = null;
        emitStateChange();
        renderLayersList();
        renderTransformPanel();
      });
    });

    layersContainer.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.index);
        if (idx < state.layers.length - 1) {
          // Swap idx with idx + 1
          const temp = state.layers[idx];
          state.layers[idx] = state.layers[idx + 1];
          state.layers[idx + 1] = temp;
          emitStateChange();
          renderLayersList();
        }
      });
    });

    layersContainer.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.index);
        if (idx > 0) {
          // Swap idx with idx - 1
          const temp = state.layers[idx];
          state.layers[idx] = state.layers[idx - 1];
          state.layers[idx - 1] = temp;
          emitStateChange();
          renderLayersList();
        }
      });
    });
  }

  // 10. Transform FX Panel UI logic
  const transformNoSel = document.getElementById('transform-no-selection');
  const transformWrapper = document.getElementById('transform-controls-wrapper');
  
  // Transform panel inputs
  const propTitle = document.getElementById('selected-layer-title');
  const propTextGroup = document.getElementById('layer-prop-text-group');
  const propText = document.getElementById('layer-prop-text');
  
  const propShapeGroup = document.getElementById('layer-prop-shape-group');
  const propShapeType = document.getElementById('layer-prop-shape-type');
  
  const propTextureGroup = document.getElementById('layer-prop-texture-group');
  const propTextureType = document.getElementById('layer-prop-texture-type');
  
  const propColorGroup = document.getElementById('layer-prop-color-group');
  const propColor = document.getElementById('layer-prop-color');
  const propColor2 = document.getElementById('layer-prop-color2');
  const propFillType = document.getElementById('layer-prop-fill-type');
  
  const propX = document.getElementById('layer-prop-x');
  const propY = document.getElementById('layer-prop-y');
  const propScaleX = document.getElementById('layer-prop-scale-x');
  const propScaleY = document.getElementById('layer-prop-scale-y');
  const propRotation = document.getElementById('layer-prop-rotation');
  
  const propDisplacement = document.getElementById('layer-prop-displacement');
  const propOpacity = document.getElementById('layer-prop-opacity');
  const propBlend = document.getElementById('layer-prop-blend');
  const propTintAmount = document.getElementById('layer-prop-tint-amount');
  const propTintColor = document.getElementById('layer-prop-tint-color');
  const previewTintColor = document.getElementById('preview-tint-color');

  function renderTransformPanel() {
    if (!selectedLayerId) {
      transformNoSel.style.display = 'block';
      transformWrapper.style.display = 'none';
      return;
    }
    
    const layer = state.layers.find(l => l.id === selectedLayerId);
    if (!layer) {
      selectedLayerId = null;
      renderTransformPanel();
      return;
    }
    
    transformNoSel.style.display = 'none';
    transformWrapper.style.display = 'block';
    
    // Set Header
    propTitle.innerText = `Propiedades: ${layer.name}`;
    
    // Toggle Inputs based on type
    propTextGroup.style.display = layer.type === 'text' ? 'block' : 'none';
    propShapeGroup.style.display = layer.type === 'shape' ? 'block' : 'none';
    propTextureGroup.style.display = layer.type === 'texture' ? 'block' : 'none';
    
    // Show colorpicker if shape, text or texture pattern
    propColorGroup.style.display = (layer.type === 'text' || layer.type === 'shape' || layer.type === 'texture') ? 'block' : 'none';
    
    // Populate field values
    if (layer.type === 'text') {
      propText.value = layer.text || '';
      propColor.value = layer.textColor || '#ffffff';
      propColor2.style.display = 'none';
      propFillType.style.display = 'none';
    } else if (layer.type === 'shape') {
      propShapeType.value = layer.shapeType || 'circle';
      propColor.value = layer.fillColor || '#00f2fe';
      propColor2.value = layer.fillColor2 || '#4facfe';
      propFillType.value = layer.fillType || 'solid';
      
      // Show gradient color 2 if gradient mode active
      propColor2.style.display = propFillType.value === 'gradient' ? 'block' : 'none';
      propFillType.style.display = 'block';
    } else if (layer.type === 'texture') {
      propTextureType.value = layer.textureType || 'grid';
      propColor.value = layer.fillColor || '#ffffff';
      propColor2.style.display = 'none';
      propFillType.style.display = 'none';
    }
    
    propX.value = layer.x || 0;
    propY.value = layer.y || 0;
    propScaleX.value = layer.scaleX || 1.0;
    propScaleY.value = layer.scaleY || 1.0;
    propRotation.value = layer.rotation || 0;
    
    propDisplacement.value = layer.displacement !== undefined ? layer.displacement : 0.0;
    propOpacity.value = layer.opacity !== undefined ? layer.opacity : 1.0;
    propBlend.value = layer.blendMode || 'normal';
    propTintAmount.value = layer.tintAmount !== undefined ? layer.tintAmount * 100 : 0;
    propTintColor.value = layer.tint || '#ffffff';
    previewTintColor.style.backgroundColor = layer.tint || '#ffffff';

    // Show/hide tint color input based on type (disable for text/shapes/texture as they have direct color)
    const showTintColor = layer.type === 'image';
    document.getElementById('layer-prop-tint-color-wrapper').style.display = showTintColor ? 'block' : 'none';
    document.getElementById('val-layer-tint-amount').parentElement.parentElement.style.display = showTintColor ? 'flex' : 'none';
    
    // Update labels
    document.getElementById('val-layer-x').innerText = parseFloat(propX.value).toFixed(2);
    document.getElementById('val-layer-y').innerText = parseFloat(propY.value).toFixed(2);
    document.getElementById('val-layer-scale-x').innerText = parseFloat(propScaleX.value).toFixed(2);
    document.getElementById('val-layer-scale-y').innerText = parseFloat(propScaleY.value).toFixed(2);
    document.getElementById('val-layer-rotation').innerText = `${propRotation.value}°`;
    document.getElementById('val-layer-displacement').innerText = parseFloat(propDisplacement.value).toFixed(2);
    document.getElementById('val-layer-opacity').innerText = parseFloat(propOpacity.value).toFixed(2);
    document.getElementById('val-layer-tint-amount').innerText = `${propTintAmount.value}%`;
  }

  // Handle Layer edits
  function updateSelectedLayer() {
    if (!selectedLayerId) return;
    const layer = state.layers.find(l => l.id === selectedLayerId);
    if (!layer) return;
    
    // 1. Read values from inputs
    layer.x = parseFloat(propX.value);
    layer.y = parseFloat(propY.value);
    layer.scaleX = parseFloat(propScaleX.value);
    layer.scaleY = parseFloat(propScaleY.value);
    layer.rotation = parseFloat(propRotation.value);
    
    layer.displacement = parseFloat(propDisplacement.value);
    layer.opacity = parseFloat(propOpacity.value);
    layer.blendMode = propBlend.value;
    layer.tint = propTintColor.value;
    layer.tintAmount = parseFloat(propTintAmount.value) / 100;
    
    if (layer.type === 'text') {
      layer.text = propText.value;
      layer.textColor = propColor.value;
      layer.name = propText.value.substring(0, 12) || 'Texto GLSL';
    } else if (layer.type === 'shape') {
      layer.shapeType = propShapeType.value;
      layer.fillColor = propColor.value;
      layer.fillColor2 = propColor2.value;
      layer.fillType = propFillType.value;
      
      const shapeNames = { 
        rect: 'Rectángulo', 
        circle: 'Círculo', 
        triangle: 'Triángulo', 
        star: 'Estrella', 
        escarapela: 'Escarapela', 
        sun: 'Sol de Mayo', 
        malvinas: 'Silueta Malvinas' 
      };
      layer.name = shapeNames[layer.shapeType] || 'Forma';
    } else if (layer.type === 'texture') {
      layer.textureType = propTextureType.value;
      layer.fillColor = propColor.value;
      
      const texNames = { grid: 'Grilla', noise: 'Textura Ruido', scanlines: 'CRT Scanlines', dots: 'Halftone Dots' };
      layer.name = texNames[layer.textureType] || 'Patrón';
    }
    
    // Update active label display
    document.getElementById('val-layer-x').innerText = layer.x.toFixed(2);
    document.getElementById('val-layer-y').innerText = layer.y.toFixed(2);
    document.getElementById('val-layer-scale-x').innerText = layer.scaleX.toFixed(2);
    document.getElementById('val-layer-scale-y').innerText = layer.scaleY.toFixed(2);
    document.getElementById('val-layer-rotation').innerText = `${layer.rotation}°`;
    document.getElementById('val-layer-displacement').innerText = layer.displacement.toFixed(2);
    document.getElementById('val-layer-opacity').innerText = layer.opacity.toFixed(2);
    document.getElementById('val-layer-tint-amount').innerText = `${Math.round(layer.tintAmount * 100)}%`;
    previewTintColor.style.backgroundColor = layer.tint;
    
    // Toggle gradient color picker display depending on state
    if (layer.type === 'shape') {
      propColor2.style.display = propFillType.value === 'gradient' ? 'block' : 'none';
    }
    
    // Trigger update
    emitStateChange();
    
    // Refresh layer name in layers list
    const nameEl = document.querySelector(`.layer-item.active .layer-name`);
    if (nameEl) nameEl.innerText = layer.name;
  }

  // Bind input events for all layer properties
  const allTransformInputs = [
    propText, propShapeType, propTextureType, propColor, propColor2, propFillType,
    propX, propY, propScaleX, propScaleY, propRotation,
    propDisplacement, propOpacity, propBlend, propTintAmount, propTintColor
  ];
  
  allTransformInputs.forEach(input => {
    input.addEventListener('input', updateSelectedLayer);
  });

  // 11. Sync UI Controls with loaded state (e.g. on load / WebSocket reception)
  function syncControlsToState() {
    const s = state.shaderSettings;
    if (!s) return;
    
    noiseType.value = s.noiseType;
    noiseScale.value = s.scale;
    noiseSpeed.value = s.speed;
    noiseWarp.value = s.warp;
    noiseDetail.value = s.detail;
    noiseColor1.value = s.color1;
    noiseColor2.value = s.color2;
    noiseColor3.value = s.color3;
    noiseBrightness.value = s.brightness;
    noiseContrast.value = s.contrast;
    
    fbmOctavesGroup.style.display = s.noiseType === 2 ? 'flex' : 'none';
    
    // Update numeric labels
    document.getElementById('val-noise-detail').innerText = s.detail;
    document.getElementById('val-noise-scale').innerText = parseFloat(s.scale).toFixed(1);
    document.getElementById('val-noise-speed').innerText = parseFloat(s.speed).toFixed(2);
    document.getElementById('val-noise-warp').innerText = parseFloat(s.warp).toFixed(1);
    document.getElementById('val-noise-brightness').innerText = parseFloat(s.brightness).toFixed(2);
    document.getElementById('val-noise-contrast').innerText = parseFloat(s.contrast).toFixed(2);
    
    // Update colors
    document.getElementById('preview-color1').style.backgroundColor = s.color1;
    document.getElementById('preview-color2').style.backgroundColor = s.color2;
    document.getElementById('preview-color3').style.backgroundColor = s.color3;
  }

  // 11. Presets Logic (Save / Load / Delete)
  const inputPresetName = document.getElementById('input-preset-name');
  const btnSavePreset = document.getElementById('btn-save-preset');
  const presetsContainer = document.getElementById('presets-container');

  async function loadPresetsList() {
    try {
      const response = await fetch('/api/presets');
      if (!response.ok) throw new Error('Failed to fetch presets');
      const presets = await response.json();

      if (presets.length === 0) {
        presetsContainer.innerHTML = `<div class="layers-empty">No hay presets guardados.</div>`;
        return;
      }

      presetsContainer.innerHTML = '';
      presets.forEach(preset => {
        const item = document.createElement('div');
        item.className = 'layer-item';
        item.innerHTML = `
          <div class="layer-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="layer-name" style="font-weight: 500;">${preset.name}</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <!-- Load Button -->
            <button class="btn btn-load-preset" data-file="${preset.filename}" style="padding: 4px 10px; font-size: 11px; height: 26px; flex: none;">
              Cargar
            </button>
            <!-- Delete Button -->
            <button class="layer-delete btn-delete-preset" data-file="${preset.filename}" title="Eliminar Preset" style="padding: 4px; flex: none; background: none; border: none; cursor: pointer;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        `;

        // Bind Load Event
        item.querySelector('.btn-load-preset').addEventListener('click', async (e) => {
          const file = e.target.dataset.file;
          await loadPreset(file);
        });

        // Bind Delete Event
        item.querySelector('.btn-delete-preset').addEventListener('click', async (e) => {
          const btn = e.target.closest('button');
          const file = btn.dataset.file;
          if (confirm(`¿Estás seguro de que deseas eliminar el preset "${preset.name}"?`)) {
            await deletePreset(file);
          }
        });

        presetsContainer.appendChild(item);
      });
    } catch (err) {
      console.error('Error loading presets list:', err);
      presetsContainer.innerHTML = `<div class="layers-empty" style="color: var(--danger-color);">Error al cargar presets.</div>`;
    }
  }

  async function loadPreset(filename) {
    try {
      const response = await fetch(`/api/presets/${filename}`);
      if (!response.ok) throw new Error('Failed to load preset data');
      const presetState = await response.json();

      // Update state
      state = presetState;
      selectedLayerId = null;

      // Sync views and controls
      syncControlsToState();
      renderer.updateState(state);
      renderLayersList();
      renderTransformPanel();

      // Emit to all socket clients (other tabs, visualizer)
      socket.emit('stateUpdate', state);
      
      console.log(`Loaded preset successfully: ${filename}`);
    } catch (err) {
      console.error('Error loading preset:', err);
      alert('Error al cargar el preset seleccionado.');
    }
  }

  async function deletePreset(filename) {
    try {
      const response = await fetch(`/api/presets/${filename}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete preset');
      
      // Refresh list
      await loadPresetsList();
    } catch (err) {
      console.error('Error deleting preset:', err);
      alert('Error al eliminar el preset.');
    }
  }

  // Bind Save Preset Button
  btnSavePreset.addEventListener('click', async () => {
    const name = inputPresetName.value.trim();
    if (!name) {
      alert('Por favor ingresa un nombre para el preset.');
      inputPresetName.focus();
      return;
    }

    try {
      const response = await fetch('/api/presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          state: state
        })
      });

      if (!response.ok) throw new Error('Failed to save preset');
      
      // Reset input and refresh list
      inputPresetName.value = '';
      await loadPresetsList();
      alert(`Preset "${name}" guardado con éxito.`);
    } catch (err) {
      console.error('Error saving preset:', err);
      alert('Error al guardar el preset actual.');
    }
  });

  // Load presets list on startup
  loadPresetsList();

  // 12. Handle Resizing
  window.addEventListener('resize', () => {
    renderer.resize();
  });
  
  // Initial resize to set correct dimensions
  setTimeout(() => {
    renderer.resize();
  }, 100);
});
