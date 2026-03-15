import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT_DIR = '/Users/ibrahimkasap/CornerClashApp/icons';

const ICON_SPECS = [
  { size: 512, name: 'icon-512.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32, name: 'icon-32.png' }
];

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const srcStart = y * stride;
    const dstStart = y * (stride + 1);
    raw[dstStart] = 0;
    rgba.copy(raw, dstStart + 1, srcStart, srcStart + stride);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function rgb(hex) {
  const normalized = hex.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mixColor(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t))
  ];
}

function setPixel(buffer, size, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const index = ((y * size) + x) * 4;
  const srcAlpha = clamp(alpha, 0, 1);
  const invAlpha = 1 - srcAlpha;
  buffer[index] = Math.round((color[0] * srcAlpha) + (buffer[index] * invAlpha));
  buffer[index + 1] = Math.round((color[1] * srcAlpha) + (buffer[index + 1] * invAlpha));
  buffer[index + 2] = Math.round((color[2] * srcAlpha) + (buffer[index + 2] * invAlpha));
  buffer[index + 3] = 255;
}

function fill(buffer, size, color) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      setPixel(buffer, size, x, y, color, 1);
    }
  }
}

function drawBackground(buffer, size) {
  const top = rgb('#09172a');
  const bottom = rgb('#050a13');
  const warm = rgb('#f59e0b');
  const cold = rgb('#22d3ee');

  for (let y = 0; y < size; y += 1) {
    const ny = y / (size - 1);
    for (let x = 0; x < size; x += 1) {
      const nx = x / (size - 1);
      let color = mixColor(top, bottom, (ny * 0.7) + (nx * 0.18));

      const dxWarm = nx - 0.84;
      const dyWarm = ny - 0.1;
      const warmGlow = Math.max(0, 1 - ((dxWarm * dxWarm) + (dyWarm * dyWarm)) / 0.11);
      color = mixColor(color, warm, warmGlow * 0.14);

      const dxCold = nx - 0.14;
      const dyCold = ny - 0.18;
      const coldGlow = Math.max(0, 1 - ((dxCold * dxCold) + (dyCold * dyCold)) / 0.15);
      color = mixColor(color, cold, coldGlow * 0.1);

      setPixel(buffer, size, x, y, color, 1);
    }
  }
}

function drawRoundedRect(buffer, size, x, y, width, height, radius, color, alpha = 1) {
  const r2 = radius * radius;
  const xMax = x + width;
  const yMax = y + height;

  for (let py = Math.floor(y); py < Math.ceil(yMax); py += 1) {
    for (let px = Math.floor(x); px < Math.ceil(xMax); px += 1) {
      const dx = Math.max(x + radius - px, 0, px - (xMax - radius));
      const dy = Math.max(y + radius - py, 0, py - (yMax - radius));
      if ((dx * dx) + (dy * dy) <= r2) {
        setPixel(buffer, size, px, py, color, alpha);
      }
    }
  }
}

function drawRoundedRectStroke(buffer, size, x, y, width, height, radius, strokeWidth, color, alpha = 1) {
  drawRoundedRect(buffer, size, x, y, width, height, radius, color, alpha);
  drawRoundedRect(
    buffer,
    size,
    x + strokeWidth,
    y + strokeWidth,
    width - (strokeWidth * 2),
    height - (strokeWidth * 2),
    Math.max(0, radius - strokeWidth),
    rgb('#081220'),
    1
  );
}

function drawGrid(buffer, size, panel, color) {
  const step = panel.size / 5;
  const alpha = 0.12;
  for (let i = 1; i < 5; i += 1) {
    const vx = Math.round(panel.x + (step * i));
    const hy = Math.round(panel.y + (step * i));
    for (let y = Math.round(panel.y); y <= Math.round(panel.y + panel.size); y += 1) {
      setPixel(buffer, size, vx, y, color, alpha);
      setPixel(buffer, size, vx + 1, y, color, alpha * 0.6);
    }
    for (let x = Math.round(panel.x); x <= Math.round(panel.x + panel.size); x += 1) {
      setPixel(buffer, size, x, hy, color, alpha);
      setPixel(buffer, size, x, hy + 1, color, alpha * 0.6);
    }
  }
}

function drawCircle(buffer, size, cx, cy, radius, color, alpha = 1) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if ((dx * dx) + (dy * dy) <= r2) {
        setPixel(buffer, size, x, y, color, alpha);
      }
    }
  }
}

function drawLine(buffer, size, x1, y1, x2, y2, thickness, color, alphaStart, alphaEnd) {
  const minX = Math.floor(Math.min(x1, x2) - thickness);
  const maxX = Math.ceil(Math.max(x1, x2) + thickness);
  const minY = Math.floor(Math.min(y1, y2) - thickness);
  const maxY = Math.ceil(Math.max(y1, y2) + thickness);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = (dx * dx) + (dy * dy);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const tRaw = (((x - x1) * dx) + ((y - y1) * dy)) / lengthSquared;
      const t = clamp(tRaw, 0, 1);
      const projX = x1 + (dx * t);
      const projY = y1 + (dy * t);
      const dist = Math.hypot(x - projX, y - projY);
      if (dist <= thickness) {
        const edgeFade = 1 - (dist / thickness);
        const alpha = lerp(alphaStart, alphaEnd, t) * edgeFade * edgeFade;
        setPixel(buffer, size, x, y, color, alpha);
      }
    }
  }
}

function drawDiamond(buffer, size, cx, cy, radius, color, alpha = 1) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const md = Math.abs(x - cx) + Math.abs(y - cy);
      if (md <= radius) {
        setPixel(buffer, size, x, y, color, alpha);
      }
    }
  }
}

function renderIcon(size) {
  const buffer = Buffer.alloc(size * size * 4);
  fill(buffer, size, rgb('#050a13'));
  drawBackground(buffer, size);

  const panelInset = size * 0.11;
  const panelSize = size - (panelInset * 2);
  const panelRadius = size * 0.18;
  drawRoundedRect(buffer, size, panelInset, panelInset, panelSize, panelSize, panelRadius, rgb('#081220'), 1);
  drawRoundedRectStroke(buffer, size, panelInset, panelInset, panelSize, panelSize, panelRadius, Math.max(4, size * 0.008), rgb('#2f435f'), 0.95);

  drawGrid(
    buffer,
    size,
    { x: panelInset + (size * 0.06), y: panelInset + (size * 0.06), size: panelSize - (size * 0.12) },
    rgb('#9fc3ea')
  );

  const center = size / 2;
  const orbOffset = panelInset + (size * 0.1);
  const tl = [orbOffset, orbOffset];
  const tr = [size - orbOffset, orbOffset];
  const bl = [orbOffset, size - orbOffset];
  const br = [size - orbOffset, size - orbOffset];

  drawLine(buffer, size, tl[0], tl[1], center, center, size * 0.05, rgb('#22c55e'), 0.28, 0);
  drawLine(buffer, size, tr[0], tr[1], center, center, size * 0.05, rgb('#2dd4bf'), 0.28, 0);
  drawLine(buffer, size, bl[0], bl[1], center, center, size * 0.05, rgb('#3b82f6'), 0.28, 0);
  drawLine(buffer, size, br[0], br[1], center, center, size * 0.05, rgb('#fb923c'), 0.28, 0);

  const orbOuter = size * 0.075;
  const orbInner = size * 0.048;
  [
    { pos: tl, outer: '#16a34a', inner: '#dcfce7' },
    { pos: tr, outer: '#14b8a6', inner: '#ccfbf1' },
    { pos: bl, outer: '#3b82f6', inner: '#dbeafe' },
    { pos: br, outer: '#fb923c', inner: '#ffedd5' }
  ].forEach(({ pos, outer, inner }) => {
    drawCircle(buffer, size, pos[0], pos[1], orbOuter, rgb(outer), 1);
    drawCircle(buffer, size, pos[0], pos[1], orbInner, rgb(inner), 0.95);
  });

  drawCircle(buffer, size, center, center, size * 0.13, rgb('#ffffff'), 0.06);
  drawCircle(buffer, size, center, center, size * 0.1, rgb('#ffffff'), 0.08);
  drawDiamond(buffer, size, center, center, size * 0.115, rgb('#f59e0b'), 1);
  drawDiamond(buffer, size, center, center, size * 0.101, rgb('#fde68a'), 0.95);
  drawDiamond(buffer, size, center, center, size * 0.074, rgb('#09172a'), 1);
  drawRoundedRect(
    buffer,
    size,
    center - (size * 0.012),
    center - (size * 0.048),
    size * 0.024,
    size * 0.096,
    size * 0.012,
    rgb('#f8fafc'),
    0.9
  );
  drawRoundedRect(
    buffer,
    size,
    center - (size * 0.048),
    center - (size * 0.012),
    size * 0.096,
    size * 0.024,
    size * 0.012,
    rgb('#f8fafc'),
    0.9
  );

  return buffer;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const spec of ICON_SPECS) {
  const rgba = renderIcon(spec.size);
  const png = encodePng(spec.size, spec.size, rgba);
  fs.writeFileSync(path.join(OUT_DIR, spec.name), png);
}

console.log(`Generated ${ICON_SPECS.length} icons in ${OUT_DIR}`);
