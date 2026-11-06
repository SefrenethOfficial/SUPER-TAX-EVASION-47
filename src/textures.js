import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Procedural tiling textures, painted on canvases at load time, so the world
// needs no image files. Muted, weathered colours.
// ---------------------------------------------------------------------------

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Specks of colour over a base (dirt, sand, grass, stone).
function speckle(g, n, r, count, colours, w = 2, h = 1) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colours[Math.floor(r() * colours.length)];
    g.fillRect(Math.floor(r() * n), Math.floor(r() * n), 1 + Math.floor(r() * w), 1 + Math.floor(r() * h));
  }
}

export function sandTexture() {
  return canvasTexture(128, (g, n) => {
    const r = rng(7);
    g.fillStyle = '#b9aa88'; g.fillRect(0, 0, n, n);
    speckle(g, n, r, 3200, ['rgba(120,110,90,0.35)', 'rgba(215,205,185,0.3)', 'rgba(80,72,60,0.4)', 'rgba(160,148,120,0.4)']);
    // faint ripples left by the tide
    g.strokeStyle = 'rgba(90,80,62,0.12)'; g.lineWidth = 2;
    for (let y = 6; y < n; y += 13) { g.beginPath(); for (let x = 0; x <= n; x += 8) g.lineTo(x, y + Math.sin((x + y) * 0.09) * 2.5); g.stroke(); }
  });
}

export function grassTexture() {
  return canvasTexture(128, (g, n) => {
    const r = rng(19);
    g.fillStyle = '#6a8c40'; g.fillRect(0, 0, n, n);
    speckle(g, n, r, 2600, ['rgba(52,84,36,0.5)', 'rgba(120,150,78,0.45)', 'rgba(84,112,52,0.5)', 'rgba(140,140,86,0.25)']);
    // blades
    for (let i = 0; i < 700; i++) {
      const x = r() * n, y = r() * n, l = 2 + r() * 4;
      g.strokeStyle = r() < 0.5 ? 'rgba(140,176,92,0.5)' : 'rgba(40,66,30,0.45)';
      g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2, y - l); g.stroke();
    }
  });
}

export function rockTexture() {
  return canvasTexture(128, (g, n) => {
    const r = rng(31);
    g.fillStyle = '#6a6964'; g.fillRect(0, 0, n, n);
    // blotches of lighter and darker stone
    for (let i = 0; i < 90; i++) {
      const x = r() * n, y = r() * n, s = 6 + r() * 20;
      g.fillStyle = r() < 0.5 ? 'rgba(130,128,120,0.18)' : 'rgba(40,40,38,0.2)';
      for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) { g.beginPath(); g.ellipse(x + dx, y + dy, s, s * 0.6, r() * 3, 0, Math.PI * 2); g.fill(); }
    }
    speckle(g, n, r, 1800, ['rgba(30,30,28,0.35)', 'rgba(160,158,150,0.25)']);
    // cracks
    g.strokeStyle = 'rgba(28,28,26,0.5)'; g.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      let x = r() * n, y = r() * n; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 18; y += r() * 12; g.lineTo(x, y); }
      g.stroke();
    }
  });
}

export function dirtTexture() {
  return canvasTexture(64, (g, n) => {
    const r = rng(43);
    g.fillStyle = '#5e5242'; g.fillRect(0, 0, n, n);
    speckle(g, n, r, 1400, ['rgba(40,34,26,0.5)', 'rgba(120,108,88,0.35)', 'rgba(80,70,56,0.5)']);
  });
}

// Weathered planks running along u.
export function plankTexture() {
  return canvasTexture(128, (g, n) => {
    const r = rng(57);
    g.fillStyle = '#6b5a47'; g.fillRect(0, 0, n, n);
    const rows = 4, h = n / rows;
    for (let k = 0; k < rows; k++) {
      const shade = 0.85 + r() * 0.3;
      g.fillStyle = `rgba(${Math.floor(107 * shade)},${Math.floor(90 * shade)},${Math.floor(71 * shade)},1)`;
      g.fillRect(0, k * h + 1, n, h - 2);
      // grain
      for (let i = 0; i < 26; i++) {
        g.strokeStyle = r() < 0.5 ? 'rgba(40,32,24,0.25)' : 'rgba(150,132,108,0.18)';
        g.beginPath(); const y = k * h + 2 + r() * (h - 4); g.moveTo(0, y);
        for (let x = 0; x <= n; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 1.2);
        g.stroke();
      }
      g.fillStyle = 'rgba(25,20,15,0.8)'; g.fillRect(0, k * h, n, 1.5);              // gaps
      const seam = Math.floor(r() * n); g.fillRect(seam, k * h, 1.5, h);              // butt joint
      g.fillStyle = 'rgba(30,30,34,0.7)'; g.fillRect((seam + 6) % n, k * h + h / 2 - 1, 2, 2);   // nail
    }
  });
}

export function waterTexture() {
  return canvasTexture(128, (g, n) => {
    g.fillStyle = '#344b55'; g.fillRect(0, 0, n, n);
    g.strokeStyle = 'rgba(190,205,210,0.2)'; g.lineWidth = 2;
    for (let k = 0; k < 9; k++) {
      const y0 = (k * 37) % n, x0 = (k * 53) % n;
      g.beginPath();
      for (let x = 0; x <= 40; x += 4) g.lineTo((x0 + x) % n, y0 + Math.sin(x * 0.3) * 3);
      g.stroke();
    }
  });
}

// Black volcanic glass: near-black with glassy violet and grey streaks.
export function obsidianTexture() {
  return canvasTexture(128, (g, n) => {
    const r = rng(71);
    g.fillStyle = '#2b2933'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 40; i++) {
      const x = r() * n, y = r() * n, l = 20 + r() * 60, a = -0.6 + r() * 0.3;
      g.strokeStyle = r() < 0.5 ? 'rgba(120,100,170,0.16)' : 'rgba(200,200,215,0.10)';
      g.lineWidth = 1 + r() * 3;
      for (const dx of [-n, 0, n]) { g.beginPath(); g.moveTo(x + dx, y); g.lineTo(x + dx + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    }
    speckle(g, n, r, 500, ['rgba(0,0,0,0.5)', 'rgba(150,140,190,0.2)']);
  });
}

// One tuft of tall grass: tapering blades on a transparent background.
export function grassTuftTexture() {
  const t = canvasTexture(64, (g, n) => {
    const r = rng(83);
    g.clearRect(0, 0, n, n);
    for (let i = 0; i < 40; i++) {
      const x = 6 + r() * (n - 12), h = n * (0.45 + r() * 0.55), lean = (r() - 0.5) * 18, w = 2 + r() * 2.5;
      const shade = 0.75 + r() * 0.35;
      g.fillStyle = `rgb(${Math.floor(58 * shade)},${Math.floor(112 * shade)},${Math.floor(44 * shade)})`;
      g.beginPath(); g.moveTo(x - w, n); g.quadraticCurveTo(x + lean * 0.3, n - h * 0.6, x + lean, n - h); g.quadraticCurveTo(x + lean * 0.3 + 1, n - h * 0.6, x + w, n); g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Layered cliff rock, light grey and buff, in horizontal strata (cliffs are
// textured with world height as one axis, so the bands run level).
export function strataTexture() {
  const t = canvasTexture(256, (g, n) => {
    const r = rng(97);
    let y = 0;
    while (y < n) {
      const h = 6 + r() * 22, k = r();
      const base = k < 0.33 ? [178, 172, 160] : k < 0.66 ? [156, 150, 140] : [194, 184, 162];
      const v = 0.9 + r() * 0.16;
      g.fillStyle = `rgb(${Math.floor(base[0] * v)},${Math.floor(base[1] * v)},${Math.floor(base[2] * v)})`;
      g.fillRect(0, y, n, h + 1);
      g.fillStyle = 'rgba(70,64,56,0.35)'; g.fillRect(0, y + h - 1.5, n, 1.5);      // the seam under each layer
      y += h;
    }
    speckle(g, n, r, 4000, ['rgba(90,84,74,0.25)', 'rgba(230,226,214,0.22)']);
    // vertical cracks
    g.strokeStyle = 'rgba(60,56,50,0.35)'; g.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) { let x = r() * n, yy = r() * n; g.beginPath(); g.moveTo(x, yy); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 8; yy += 6 + r() * 12; g.lineTo(x, yy); } g.stroke(); }
  });
  return t;
}

// Bright river and lake water, with glints.
export function brightWaterTexture() {
  return canvasTexture(128, (g, n) => {
    const r = rng(101);
    g.fillStyle = '#3f9fcf'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 14; i++) {
      const y0 = r() * n, x0 = r() * n, l = 20 + r() * 30;
      g.strokeStyle = 'rgba(220,245,255,0.45)'; g.lineWidth = 1.5;
      g.beginPath(); for (let x = 0; x <= l; x += 4) g.lineTo((x0 + x) % n, y0 + Math.sin(x * 0.35) * 2.5); g.stroke();
    }
    speckle(g, n, r, 120, ['rgba(255,255,255,0.6)']);
  });
}

// One small wildflower head (white, yellow or pink petals) on a transparent background.
export function flowerTexture() {
  const t = canvasTexture(64, (g, n) => {
    g.clearRect(0, 0, n, n);
    const r = rng(113);
    const cols = ['#f4f1e4', '#f2d64a', '#ee9ab8', '#c9b6f0'];
    for (let i = 0; i < 9; i++) {
      const x = 7 + r() * (n - 14), y = n * 0.2 + r() * n * 0.4, s = 4 + r() * 3, c = cols[Math.floor(r() * cols.length)];
      g.strokeStyle = '#4c7a34'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, n); g.stroke();
      g.fillStyle = c;
      for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.7, s * 0.55, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#e8b030'; g.beginPath(); g.arc(x, y, s * 0.35, 0, Math.PI * 2); g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
