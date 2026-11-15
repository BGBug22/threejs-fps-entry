// Keyboard, mouse and pointer lock. It never touches the simulation: it reports keys,
// mouse deltas and clicks, and main.js decides what they mean. Right mouse is the zoom
// (aim-down-sights) hold; B opens the buy menu; E is use (plant / defuse / pick up).
export function createInput(dom, onLockChange) {
  const state = { keys: new Set(), firing: false, zooming: false };
  let locked = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    state.keys.add(event.code);
    if (event.code === 'Tab') event.preventDefault();
  }
  function onKeyUp(event) {
    state.keys.delete(event.code);
  }
  function onMouseDown(event) {
    if (!locked) return;
    if (event.button === 0) state.firing = true;
    if (event.button === 2) state.zooming = true;
  }
  function onMouseUp(event) {
    if (event.button === 0) state.firing = false;
    if (event.button === 2) state.zooming = false;
  }
  function onLock() {
    locked = document.pointerLockElement === dom;
    if (!locked) {
      state.firing = false;
      state.zooming = false;
    }
    onLockChange(locked);
  }
  function onContextMenu(event) {
    event.preventDefault();
  }

  let lookX = 0;
  let lookY = 0;
  function onMouseMove(event) {
    if (!locked) return;
    lookX += event.movementX;
    lookY += event.movementY;
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLock);
  dom.addEventListener('contextmenu', onContextMenu);

  return {
    state,
    requestLock() {
      try {
        const p = dom.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch { /* pointer lock unavailable */ }
    },
    releaseLock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    isLocked() {
      return locked;
    },
    takeLook() {
      const out = { x: lookX, y: lookY };
      lookX = 0;
      lookY = 0;
      return out;
    },
  };
}
