import React from 'react';

// Code 39 Barcode SVG Generator
const CODE39_PATTERNS: Record<string, string> = {
  '0': '000110100',
  '1': '100100001',
  '2': '001100001',
  '3': '101100000',
  '4': '000110001',
  '5': '100110000',
  '6': '001110000',
  '7': '000100101',
  '8': '100100100',
  '9': '001100100',
  'A': '100001001',
  'B': '001001001',
  'C': '101001000',
  'D': '000011001',
  'E': '100011000',
  'F': '001011000',
  'G': '000001101',
  'H': '100001100',
  'I': '001001100',
  'J': '000011100',
  'K': '100000011',
  'L': '001000011',
  'M': '101000010',
  'N': '000010011',
  'O': '100010010',
  'P': '001010010',
  'Q': '000000111',
  'R': '100000110',
  'S': '001000110',
  'T': '000010110',
  'U': '110000001',
  'V': '011000001',
  'W': '111000000',
  'X': '010010001',
  'Y': '110010000',
  'Z': '011010000',
  '-': '010000101',
  '.': '110000100',
  ' ': '011000100',
  '$': '010101000',
  '/': '010100010',
  '+': '010001010',
  '%': '000101010',
  '*': '010010100',
};

interface Barcode1DProps {
  value: string;
  height?: number;
  showText?: boolean;
  className?: string;
}

export const Barcode1D: React.FC<Barcode1DProps> = ({
  value,
  height = 50,
  showText = true,
  className = '',
}) => {
  // Sanitize value for Code 39 (letters, digits, -, ., space)
  const clean = value.toUpperCase().replace(/[^A-Z0-9\-.\s$%+/]/g, '-');
  const full = `*${clean}*`;

  const narrowWidth = 2;
  const wideWidth = 5;
  const gapWidth = 2;

  const elements: { isBar: boolean; width: number }[] = [];

  for (let i = 0; i < full.length; i++) {
    const char = full[i];
    const pattern = CODE39_PATTERNS[char] || CODE39_PATTERNS['-'];

    for (let j = 0; j < 9; j++) {
      const isBar = j % 2 === 0;
      const isWide = pattern[j] === '1';
      elements.push({
        isBar,
        width: isWide ? wideWidth : narrowWidth,
      });
    }

    // Inter-character gap
    if (i < full.length - 1) {
      elements.push({ isBar: false, width: gapWidth });
    }
  }

  const totalWidth = elements.reduce((acc, curr) => acc + curr.width, 0);

  let currentX = 0;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full h-auto max-h-14"
        style={{ width: `${Math.min(totalWidth, 180)}px`, height: `${height}px` }}
        shapeRendering="crispEdges"
      >
        {elements.map((el, idx) => {
          const x = currentX;
          currentX += el.width;
          if (!el.isBar) return null;
          return (
            <rect
              key={idx}
              x={x}
              y={0}
              width={el.width}
              height={height}
              fill="#000000"
            />
          );
        })}
      </svg>
      {showText && (
        <span className="font-mono text-[9px] font-bold tracking-widest text-slate-900 mt-0.5">
          {clean}
        </span>
      )}
    </div>
  );
};
