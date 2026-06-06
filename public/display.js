// display.js - Display/Visualizer Frontend Controller

document.addEventListener('DOMContentLoaded', () => {
  // 1. WebSocket Setup
  const socket = io();
  
  socket.on('connect', () => {
    console.log('Connected to socket synchronization server');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from socket synchronization server');
  });

  // 2. Initialize Three.js Full-screen Renderer
  const canvas = document.getElementById('fullscreen-canvas');
  const renderer = new CollageRenderer(canvas);

  // 3. Listen for state updates from the Socket.io server
  socket.on('stateUpdate', (state) => {
    if (!state) return;
    
    // Pass the state directly to the shared rendering engine
    renderer.updateState(state);
  });

  // 4. Handle Window Resize
  window.addEventListener('resize', () => {
    renderer.resize();
  });
  
  // Trigger initial resize to fit the viewport
  setTimeout(() => {
    renderer.resize();
  }, 100);
});
