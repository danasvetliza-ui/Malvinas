const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // Allow large payloads (for base64 image uploads)
  maxHttpBufferSize: 1e7 // 10MB
});

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for root, display.html for /display
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

// In-memory cache for the current editor/collage state (Preloaded with Malvinas Memorial Theme)
let currentCollageState = {
  shaderSettings: {
    noiseType: 2, // FBM (Fractal Brownian)
    scale: 2.2,
    speed: 0.25,
    warp: 0.8,
    detail: 4.0,
    color1: '#031026', // Deep oceanic navy blue
    color2: '#4e87bf', // Soft light blue / celeste
    color3: '#ffffff', // White
    brightness: -0.05,
    contrast: 1.15
  },
  layers: [
    {
      id: 'escarapela',
      type: 'shape',
      shapeType: 'escarapela',
      name: 'Escarapela Argentina',
      x: -1.0,
      y: 0.65,
      scaleX: 0.6,
      scaleY: 0.6,
      rotation: 0,
      opacity: 0.8,
      blendMode: 'normal',
      displacement: 0.05,
      fillColor: '#4e87bf',
      fillColor2: '#ffffff',
      fillType: 'solid',
      strokeColor: '#ffffff',
      strokeWidth: 0,
      visible: true
    },
    {
      id: 'islas_malvinas',
      type: 'shape',
      shapeType: 'malvinas',
      name: 'Islas Malvinas (Silueta)',
      x: 0.0,
      y: 0.05,
      scaleX: 2.0,
      scaleY: 2.0,
      rotation: 0,
      opacity: 0.9,
      blendMode: 'normal',
      displacement: 0.15,
      fillColor: '#4e87bf',
      fillColor2: '#ffffff',
      fillType: 'gradient', // Gradient from celeste to white
      strokeColor: '#f6b426', // Golden border
      strokeWidth: 2,
      visible: true
    },
    {
      id: 'fecha_memorial',
      type: 'text',
      name: 'Fecha Conmemorativa',
      text: '2 de Abril',
      fontFamily: 'Outfit',
      fontSize: 80,
      textStyle: 'bold',
      x: 0.0,
      y: 0.6,
      scaleX: 1.2,
      scaleY: 1.2,
      rotation: 0,
      opacity: 1.0,
      blendMode: 'screen',
      displacement: 0.05,
      textColor: '#ffffff',
      strokeColor: '#4e87bf',
      strokeWidth: 6,
      textBgColor: 'transparent',
      visible: true
    },
    {
      id: 'homenaje_texto',
      type: 'text',
      name: 'Homenaje Veteranos',
      text: 'HONOR Y GLORIA',
      fontFamily: 'Space Grotesk',
      fontSize: 48,
      textStyle: 'bold',
      x: 0.0,
      y: -0.45,
      scaleX: 1.0,
      scaleY: 1.0,
      rotation: 0,
      opacity: 0.95,
      blendMode: 'add', // additive glow
      displacement: 0.1,
      textColor: '#f6b426', // Gold
      strokeColor: '#031026',
      strokeWidth: 3,
      textBgColor: 'transparent',
      visible: true
    },
    {
      id: 'lema_soberania',
      type: 'text',
      name: 'Soberanía Nacional',
      text: 'Las Malvinas son Argentinas',
      fontFamily: 'Outfit',
      fontSize: 32,
      textStyle: 'bold',
      x: 0.0,
      y: -0.7,
      scaleX: 0.9,
      scaleY: 0.9,
      rotation: 0,
      opacity: 0.85,
      blendMode: 'normal',
      displacement: 0.08,
      textColor: '#ffffff',
      strokeColor: '#4e87bf',
      strokeWidth: 2,
      textBgColor: 'transparent',
      visible: true
    }
  ]
};

const PRESETS_DIR = path.join(__dirname, 'presets');

// Ensure presets directory exists
if (!fs.existsSync(PRESETS_DIR)) {
  fs.mkdirSync(PRESETS_DIR);
}

// Default presets templates to populate if empty
const defaultPresets = {
  "Mar_Argentino.json": {
    shaderSettings: {
      noiseType: 2,
      scale: 2.2,
      speed: 0.25,
      warp: 0.8,
      detail: 4.0,
      color1: '#031026',
      color2: '#4e87bf',
      color3: '#ffffff',
      brightness: -0.05,
      contrast: 1.15
    },
    layers: [
      {
        id: 'escarapela',
        type: 'shape',
        shapeType: 'escarapela',
        name: 'Escarapela Argentina',
        x: -1.0,
        y: 0.65,
        scaleX: 0.6,
        scaleY: 0.6,
        rotation: 0,
        opacity: 0.8,
        blendMode: 'normal',
        displacement: 0.05,
        fillColor: '#4e87bf',
        fillColor2: '#ffffff',
        fillType: 'solid',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        visible: true
      },
      {
        id: 'islas_malvinas',
        type: 'shape',
        shapeType: 'malvinas',
        name: 'Islas Malvinas (Silueta)',
        x: 0.0,
        y: 0.05,
        scaleX: 2.0,
        scaleY: 2.0,
        rotation: 0,
        opacity: 0.9,
        blendMode: 'normal',
        displacement: 0.15,
        fillColor: '#4e87bf',
        fillColor2: '#ffffff',
        fillType: 'gradient',
        strokeColor: '#f6b426',
        strokeWidth: 2,
        visible: true
      },
      {
        id: 'fecha_memorial',
        type: 'text',
        name: 'Fecha Conmemorativa',
        text: '2 de Abril',
        fontFamily: 'Outfit',
        fontSize: 80,
        textStyle: 'bold',
        x: 0.0,
        y: 0.6,
        scaleX: 1.2,
        scaleY: 1.2,
        rotation: 0,
        opacity: 1.0,
        blendMode: 'screen',
        displacement: 0.05,
        textColor: '#ffffff',
        strokeColor: '#4e87bf',
        strokeWidth: 6,
        textBgColor: 'transparent',
        visible: true
      },
      {
        id: 'homenaje_texto',
        type: 'text',
        name: 'Homenaje Veteranos',
        text: 'HONOR Y GLORIA',
        fontFamily: 'Space Grotesk',
        fontSize: 48,
        textStyle: 'bold',
        x: 0.0,
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
      },
      {
        id: 'lema_soberania',
        type: 'text',
        name: 'Soberanía Nacional',
        text: 'Las Malvinas son Argentinas',
        fontFamily: 'Outfit',
        fontSize: 32,
        textStyle: 'bold',
        x: 0.0,
        y: -0.7,
        scaleX: 0.9,
        scaleY: 0.9,
        rotation: 0,
        opacity: 0.85,
        blendMode: 'normal',
        displacement: 0.08,
        textColor: '#ffffff',
        strokeColor: '#4e87bf',
        strokeWidth: 2,
        textBgColor: 'transparent',
        visible: true
      }
    ]
  },
  "Llama_Eterna.json": {
    shaderSettings: {
      noiseType: 1,
      scale: 3.5,
      speed: 0.5,
      warp: 1.2,
      detail: 3.0,
      color1: '#0a0515',
      color2: '#c2410c',
      color3: '#f6b426',
      brightness: 0.0,
      contrast: 1.3
    },
    layers: [
      {
        id: 'sol_bandera',
        type: 'shape',
        shapeType: 'sun',
        name: 'Sol de Mayo',
        x: 0.0,
        y: 0.15,
        scaleX: 1.2,
        scaleY: 1.2,
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
      },
      {
        id: 'texto_honor',
        type: 'text',
        name: 'Texto: Honor y Gloria',
        text: 'HONOR Y GLORIA',
        fontFamily: 'Space Grotesk',
        fontSize: 56,
        textStyle: 'bold',
        x: 0.0,
        y: -0.45,
        scaleX: 1.1,
        scaleY: 1.1,
        rotation: 0,
        opacity: 0.95,
        blendMode: 'add',
        displacement: 0.12,
        textColor: '#f6b426',
        strokeColor: '#0a0515',
        strokeWidth: 4,
        textBgColor: 'transparent',
        visible: true
      }
    ]
  },
  "Cielo_Solemne.json": {
    shaderSettings: {
      noiseType: 0,
      scale: 1.8,
      speed: 0.15,
      warp: 0.4,
      detail: 2.0,
      color1: '#5ba6e0',
      color2: '#ffffff',
      color3: '#f6d27e',
      brightness: 0.05,
      contrast: 1.0
    },
    layers: [
      {
        id: 'islas_malvinas',
        type: 'shape',
        shapeType: 'malvinas',
        name: 'Islas Malvinas (Silueta)',
        x: 0,
        y: 0.05,
        scaleX: 1.8,
        scaleY: 1.8,
        rotation: 0,
        opacity: 0.9,
        blendMode: 'normal',
        displacement: 0.1,
        fillColor: '#ffffff',
        fillColor2: '#4e87bf',
        fillType: 'gradient',
        strokeColor: '#f6b426',
        strokeWidth: 2,
        visible: true
      },
      {
        id: 'escarapela',
        type: 'shape',
        shapeType: 'escarapela',
        name: 'Escarapela Argentina',
        x: 1.0,
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
      },
      {
        id: 'texto-heroes',
        type: 'text',
        name: 'Texto: Héroes',
        text: 'HÉROES DE LA PATRIA',
        fontFamily: 'Space Grotesk',
        fontSize: 40,
        textStyle: 'bold',
        x: 0,
        y: -0.6,
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
      }
    ]
  }
};

// Check if presets dir is empty, if so, write default presets
if (fs.readdirSync(PRESETS_DIR).length === 0) {
  for (let filename in defaultPresets) {
    fs.writeFileSync(path.join(PRESETS_DIR, filename), JSON.stringify(defaultPresets[filename], null, 2));
  }
}

// API Presets Endpoints

// 1. GET: List all presets
app.get('/api/presets', (req, res) => {
  try {
    const files = fs.readdirSync(PRESETS_DIR);
    const presetsList = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const name = file.replace('.json', '').replace(/_/g, ' ');
        return { name, filename: file };
      });
    res.json(presetsList);
  } catch (err) {
    console.error('Error listing presets:', err);
    res.status(500).json({ error: 'Failed to read presets' });
  }
});

// 2. GET: Get specific preset content
app.get('/api/presets/:filename', (req, res) => {
  try {
    const file = path.basename(req.params.filename);
    const filePath = path.join(PRESETS_DIR, file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    const rawData = fs.readFileSync(filePath, 'utf-8');
    res.json(JSON.parse(rawData));
  } catch (err) {
    console.error('Error reading preset:', err);
    res.status(500).json({ error: 'Failed to load preset' });
  }
});

// 3. POST: Save new preset
app.post('/api/presets', (req, res) => {
  try {
    const { name, state } = req.body;
    if (!name || !state) {
      return res.status(400).json({ error: 'Missing name or state payload' });
    }
    
    // Sanitize name to make a safe filename
    const sanitizedFilename = name.trim().replace(/[^a-zA-Z0-9_\s-]/g, '').replace(/\s+/g, '_') + '.json';
    const filePath = path.join(PRESETS_DIR, sanitizedFilename);
    
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
    res.json({ success: true, filename: sanitizedFilename });
  } catch (err) {
    console.error('Error saving preset:', err);
    res.status(500).json({ error: 'Failed to save preset' });
  }
});

// 4. DELETE: Delete preset
app.delete('/api/presets/:filename', (req, res) => {
  try {
    const file = req.params.filename;
    // Prevent directory traversal attacks
    const sanitizedFilename = path.basename(file);
    const filePath = path.join(PRESETS_DIR, sanitizedFilename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting preset:', err);
    res.status(500).json({ error: 'Failed to delete preset' });
  }
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send the current cached state to the newly connected client
  socket.emit('stateUpdate', currentCollageState);

  // Listen for updates from the editor
  socket.on('stateUpdate', (newState) => {
    currentCollageState = newState;
    // Broadcast the update to all OTHER connected clients
    socket.broadcast.emit('stateUpdate', currentCollageState);
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` Shader Collage Editor Server is running!`);
  console.log(` Editor Interface:  http://localhost:${PORT}`);
  console.log(` Visualizer Output: http://localhost:${PORT}/display`);
  console.log(`===================================================`);
});
