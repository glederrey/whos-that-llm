export function Avatar({ seed, size = 40, src = null }: { seed: string; size?: number; src?: string | null }) {
  if (src) {
    return <img className="avatar" src={src} alt="" width={size} height={size} />;
  }
  const bits = pattern(seed);
  const paint = bits[0] % 2 === 0 ? "#00bbc9" : "#141414";
  const cells: { x: number; y: number }[] = [];
  const origin = 7;
  const step = 5.2;
  const cellSize = 4.2;
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      if (bits[row * 3 + col + 1] % 3 === 0) continue;
      const y = origin + row * step;
      cells.push({ x: origin + col * step, y });
      if (col < 2) cells.push({ x: origin + (4 - col) * step, y });
    }
  }
  if (cells.length < 4) {
    cells.push({ x: origin + 2 * step, y: origin + 2 * step });
  }
  const left = Math.min(...cells.map((cell) => cell.x));
  const right = Math.max(...cells.map((cell) => cell.x)) + cellSize;
  const top = Math.min(...cells.map((cell) => cell.y));
  const bottom = Math.max(...cells.map((cell) => cell.y)) + cellSize;
  const shiftX = 20 - (left + right) / 2;
  const shiftY = 20 - (top + bottom) / 2;
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#ebebeb" />
      <g transform={`translate(${shiftX} ${shiftY})`}>
        {cells.map((cell, index) => (
          <rect key={index} x={cell.x} y={cell.y} width={cellSize} height={cellSize} rx="1.2" fill={paint} />
        ))}
      </g>
    </svg>
  );
}

function pattern(seed: string): number[] {
  let x = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    x ^= seed.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < 16; i += 1) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    out.push(x);
  }
  return out;
}
