export function Avatar({ seed, size = 40 }: { seed: string; size?: number }) {
  const bits = pattern(seed);
  const paint = bits[0] % 2 === 0 ? "#00bbc9" : "#141414";
  const cells: { x: number; y: number }[] = [];
  const origin = 7;
  const step = 5.2;
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
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#ebebeb" />
      {cells.map((cell, index) => (
        <rect key={index} x={cell.x} y={cell.y} width="4.2" height="4.2" rx="1.2" fill={paint} />
      ))}
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
