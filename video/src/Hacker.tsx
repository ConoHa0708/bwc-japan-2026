import React from "react";

// Original two-head-tall hacker: dark hood, glowing green eyes, small laptop.
// pose: "stand" | "kick" | "type" | "squash" | "fly"
export const Hacker: React.FC<{ pose: string; kick?: number; blink?: boolean; typing?: number }> = ({ pose, kick = 0, blink = false, typing = 0 }) => {
  const knocked = pose === "squash" || pose === "fly";
  const eyes = knocked ? (
    <g stroke="#7CFF6B" strokeWidth={7} strokeLinecap="round">
      <line x1={92} y1={112} x2={112} y2={132} /><line x1={112} y1={112} x2={92} y2={132} />
      <line x1={148} y1={112} x2={168} y2={132} /><line x1={168} y1={112} x2={148} y2={132} />
    </g>
  ) : (
    <g fill="#7CFF6B" style={{ filter: "drop-shadow(0 0 8px #7CFF6B)" }}>
      <ellipse cx={102} cy={122} rx={13} ry={blink ? 2 : 10} />
      <ellipse cx={158} cy={122} rx={13} ry={blink ? 2 : 10} />
    </g>
  );
  const legKick = pose === "kick" ? 75 * kick : 0;
  const tap = Math.sin(typing * 40) * 4;
  return (
    <svg width={260} height={300} viewBox="0 0 260 300" style={{ overflow: "visible" }}>
      {/* legs */}
      <rect x={138} y={235} width={28} height={50} rx={12} fill="#1a1d23" />
      <ellipse cx={156} cy={286} rx={22} ry={11} fill="#0f1115" />
      <g transform={`rotate(${legKick} 109 240)`}>
        <rect x={95} y={235} width={28} height={50} rx={12} fill="#1a1d23" />
        <ellipse cx={104} cy={286} rx={22} ry={11} fill="#0f1115" />
      </g>
      {/* body */}
      <path d="M70 175 Q130 150 190 175 L205 250 Q130 268 55 250 Z" fill="#23272f" />
      {/* hood + head */}
      <path d="M30 120 Q30 20 130 18 Q230 20 230 120 Q230 200 130 200 Q30 200 30 120 Z" fill="#23272f" />
      <ellipse cx={130} cy={125} rx={78} ry={62} fill="#0d0f13" />
      {eyes}
      {!knocked && <path d="M108 160 Q130 172 152 160" stroke="#7CFF6B" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.8} />}
      {knocked && <ellipse cx={130} cy={165} rx={10} ry={7} fill="#7CFF6B" opacity={0.8} />}
      {/* laptop */}
      {(pose === "type" || pose === "stand") && (
        <g transform={`translate(0 ${pose === "type" ? tap : 0})`}>
          <rect x={60} y={205} width={140} height={10} rx={4} fill="#3a3f48" />
          <path d="M70 205 L84 150 L196 150 L190 205 Z" fill="#4a505b" />
          <circle cx={137} cy={176} r={7} fill="#7CFF6B" opacity={0.6} />
        </g>
      )}
    </svg>
  );
};
