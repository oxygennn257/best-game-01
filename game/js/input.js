// Keyboard + mouse state, in canvas coordinates. The canvas is drawn at a
// fixed logical size (1280x720) and scaled by CSS, so mouse positions are
// converted with the canvas bounding box.

export const keys = Object.create(null);

export const mouse = {
  x: 640,
  y: 300,
  down: false,
  clicked: false, // set for one frame when the button goes down
};

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'shoot',
  KeyP: 'pause', Escape: 'pause',
  KeyR: 'restart',
  KeyM: 'mute',
  Digit1: 'buy1', Digit2: 'buy2', Digit3: 'buy3', Digit4: 'buy4',
  Enter: 'confirm',
};

export function attachInput(canvas, onFirstGesture) {
  window.addEventListener('keydown', (e) => {
    const name = KEYMAP[e.code];
    if (name) {
      keys[name] = true;
      if (name === 'shoot' || name === 'confirm' || name === 'pause') e.preventDefault();
    }
    if (onFirstGesture) onFirstGesture();
  });
  window.addEventListener('keyup', (e) => {
    const name = KEYMAP[e.code];
    if (name) keys[name] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    mouse.down = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
    if (onFirstGesture) onFirstGesture();
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function endFrame() {
  mouse.clicked = false;
}
