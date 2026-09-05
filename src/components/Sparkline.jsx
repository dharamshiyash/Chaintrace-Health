import React from 'react';

export default function Sparkline({ data = [10, 20, 15, 30, 25, 40, 35], color = "#3b82f6" }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const width = 100;
  const height = 30;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 -5 ${width} ${height + 10}`} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* End point dot */}
      {data.length > 0 && (
        <circle 
          cx={width} 
          cy={height - ((data[data.length - 1] - min) / range) * height} 
          r="2.5" 
          fill={color} 
        />
      )}
    </svg>
  );
}
