// ---------------------------------------------------------------------------
// Triangle-mesh collision, in the spirit of SM64's: every triangle is a floor,
// a wall or (seen from below) a ceiling. Flat-ish triangles (|normal.y| > 0.62)
// are floors when you're above them and ceilings when you're below, whichever
// way they're wound. Steeper ones are walls. Triangles are bucketed in an XZ
// grid so each query only looks at a few of them.
// ---------------------------------------------------------------------------

const FLOOR_NY = 0.62;   // steeper than ~52 degrees is a wall

export class MeshCollider {
  // tris: Float32Array of 9 floats per triangle (world space)
  constructor(tris, cell = 6) {
    this.t = tris;
    this.n = tris.length / 9;
    this.cell = cell;
    this.kind = new Uint8Array(this.n);          // 1 = floor/ceiling, 2 = wall
    this.nrm = new Float32Array(this.n * 3);
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < this.n; i++) {
      const o = i * 9;
      const ax = tris[o], ay = tris[o + 1], az = tris[o + 2];
      const ux = tris[o + 3] - ax, uy = tris[o + 4] - ay, uz = tris[o + 5] - az;
      const vx = tris[o + 6] - ax, vy = tris[o + 7] - ay, vz = tris[o + 8] - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      this.nrm[i * 3] = nx; this.nrm[i * 3 + 1] = ny; this.nrm[i * 3 + 2] = nz;
      this.kind[i] = Math.abs(ny) > FLOOR_NY ? 1 : 2;
      for (let k = 0; k < 3; k++) {
        minX = Math.min(minX, tris[o + k * 3]); maxX = Math.max(maxX, tris[o + k * 3]);
        minZ = Math.min(minZ, tris[o + k * 3 + 2]); maxZ = Math.max(maxZ, tris[o + k * 3 + 2]);
      }
    }
    this.minX = minX; this.minZ = minZ;
    this.gx = Math.ceil((maxX - minX) / cell) + 1;
    this.gz = Math.ceil((maxZ - minZ) / cell) + 1;
    this.grid = Array.from({ length: this.gx * this.gz }, () => []);
    for (let i = 0; i < this.n; i++) {
      const o = i * 9;
      const x0 = Math.min(tris[o], tris[o + 3], tris[o + 6]), x1 = Math.max(tris[o], tris[o + 3], tris[o + 6]);
      const z0 = Math.min(tris[o + 2], tris[o + 5], tris[o + 8]), z1 = Math.max(tris[o + 2], tris[o + 5], tris[o + 8]);
      const i0 = this.ci(x0 - 0.5), i1 = this.ci(x1 + 0.5), j0 = this.cj(z0 - 0.5), j1 = this.cj(z1 + 0.5);
      for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) this.grid[j * this.gx + k].push(i);
    }
    this._seen = new Uint32Array(this.n);
    this._stamp = 0;
  }

  ci(x) { return Math.max(0, Math.min(this.gx - 1, Math.floor((x - this.minX) / this.cell))); }
  cj(z) { return Math.max(0, Math.min(this.gz - 1, Math.floor((z - this.minZ) / this.cell))); }

  // Height of triangle i at (x, z), or NaN if (x, z) isn't over it.
  heightOn(i, x, z) {
    const t = this.t, o = i * 9;
    const ax = t[o], az = t[o + 2], bx = t[o + 3], bz = t[o + 5], cx = t[o + 6], cz = t[o + 8];
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-9) return NaN;
    const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
    const w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
    const w2 = 1 - w0 - w1;
    if (w0 < -1e-5 || w1 < -1e-5 || w2 < -1e-5) return NaN;
    return w0 * t[o + 1] + w1 * t[o + 4] + w2 * t[o + 7];
  }

  // Highest floor at (x, z) that is at or below yMax (-Infinity if none).
  floor(x, z, yMax) {
    let best = -Infinity;
    for (const i of this.grid[this.cj(z) * this.gx + this.ci(x)]) {
      if (this.kind[i] !== 1) continue;
      const y = this.heightOn(i, x, z);
      if (y === y && y <= yMax && y > best) best = y;
    }
    return best;
  }

  // Lowest floor/ceiling surface at (x, z) strictly between y0 and y1 (Infinity if none).
  ceiling(x, z, y0, y1) {
    let best = Infinity;
    for (const i of this.grid[this.cj(z) * this.gx + this.ci(x)]) {
      if (this.kind[i] !== 1) continue;
      const y = this.heightOn(i, x, z);
      if (y === y && y > y0 && y < y1 && y < best) best = y;
    }
    return best;
  }

  // Push a vertical cylinder (centre pos, radius r, from feet+step to head)
  // out of walls. Returns hits [{ nx, nz, top }].
  walls(pos, feet, head, r, step, hits) {
    const samples = [feet + step + 0.12, (feet + head) / 2, head - 0.12];
    const t = this.t;
    const stamp = ++this._stamp;
    const i0 = this.ci(pos.x - r - 1), i1 = this.ci(pos.x + r + 1), j0 = this.cj(pos.z - r - 1), j1 = this.cj(pos.z + r + 1);
    for (let j = j0; j <= j1; j++) {
      for (let k = i0; k <= i1; k++) {
        for (const i of this.grid[j * this.gx + k]) {
          if (this.kind[i] !== 2 || this._seen[i] === stamp) continue;
          this._seen[i] = stamp;
          const o = i * 9;
          const ymax = Math.max(t[o + 1], t[o + 4], t[o + 7]), ymin = Math.min(t[o + 1], t[o + 4], t[o + 7]);
          if (ymax <= feet + step || ymin >= head) continue;
          let pushed = false;
          for (const sy of samples) {
            if (sy < ymin - 0.05 || sy > ymax + 0.05) continue;
            closest(t, o, pos.x, sy, pos.z, C);
            if (Math.abs(C[1] - sy) > 0.35) continue;
            let dx = pos.x - C[0], dz = pos.z - C[2];
            let d = Math.hypot(dx, dz);
            if (d >= r) continue;
            if (d < 1e-6) {
              // centre right on the wall: leave along its horizontal normal
              dx = this.nrm[i * 3]; dz = this.nrm[i * 3 + 2]; d = Math.hypot(dx, dz) || 1;
              dx /= d; dz /= d; d = 0;
            } else { dx /= d; dz /= d; }
            pos.x += dx * (r - d); pos.z += dz * (r - d);
            if (!pushed) {
              const top = this.floor(pos.x - dx * 0.9, pos.z - dz * 0.9, feet + 3);
              hits.push({ nx: dx, nz: dz, top: top > -Infinity ? top : ymax, mesh: true });
              pushed = true;
            }
          }
        }
      }
    }
    return hits;
  }
}

const C = [0, 0, 0];
// Closest point on triangle (at offset o in t) to point p -> out. (Ericson)
function closest(t, o, px, py, pz, out) {
  const ax = t[o], ay = t[o + 1], az = t[o + 2], bx = t[o + 3], by = t[o + 4], bz = t[o + 5], cx = t[o + 6], cy = t[o + 7], cz = t[o + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { out[0] = ax; out[1] = ay; out[2] = az; return; }
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { out[0] = bx; out[1] = by; out[2] = bz; return; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); out[0] = ax + abx * v; out[1] = ay + aby * v; out[2] = az + abz * v; return; }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { out[0] = cx; out[1] = cy; out[2] = cz; return; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); out[0] = ax + acx * w; out[1] = ay + acy * w; out[2] = az + acz * w; return; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    out[0] = bx + (cx - bx) * w; out[1] = by + (cy - by) * w; out[2] = bz + (cz - bz) * w; return;
  }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  out[0] = ax + abx * v + acx * w; out[1] = ay + aby * v + acy * w; out[2] = az + abz * v + acz * w;
}
