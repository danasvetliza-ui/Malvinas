const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

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
