export function hand(ext, at = { x: 0.5, y: 0.8 }, s = 0.1) {
  const P = (dx, dy) => ({ x: at.x + dx * s, y: at.y + dy * s, z: 0 });
  const h = [P(0, 0)];
  // thumb: 1..4 out to the side, tip up when extended, folded across the palm when not
  h.push(P(-0.4, -0.3), P(-0.7, -0.6));
  h.push(ext[0] ? P(-0.8, -1.0) : P(-0.4, -0.75), ext[0] ? P(-0.85, -1.4) : P(-0.1, -0.8));
  const xs = [-0.3, 0, 0.3, 0.55];
  for (let f = 0; f < 4; f++) {
    const x = xs[f];
    h.push(P(x, -1.0), P(x, -1.4));                       // mcp, pip
    if (ext[f + 1]) h.push(P(x, -1.75), P(x, -2.05));     // dip, tip: straight up
    else h.push(P(x, -1.2), P(x, -0.95));                 // curled back towards the palm
  }
  return h;
}
