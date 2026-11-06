import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

const BG = "#2b2f36";
const ORANGE = "#F5A623";
const CLAUDE = "#D97757";
const YELLOW = "#FFD400";
const FONT = "'Yu Gothic', 'YuGothic', 'Meiryo', sans-serif";

const T: React.FC<{ size: number; color?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ size, color = "white", style, children }) => (
  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: size, color, whiteSpace: "pre", lineHeight: 1.2, ...style }}>{children}</div>
);

// 1280x720 thumbnail.
export const Thumb: React.FC = () => (
  <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 14, background: YELLOW }} />
    <div style={{ position: "absolute", left: 70, top: 90 }}>
      <T size={34} color={ORANGE}>Claude アプリで始める詐欺対策</T>
      <T size={80} style={{ marginTop: 18 }}>{"フィッシング詐欺\n検出コネクター"}</T>
      <div style={{ marginTop: 34, width: 120, height: 6, background: CLAUDE }} />
      <T size={38} color="#E6E8EC" style={{ marginTop: 30 }}>{"届いたメール・SMS・LINE を\n見せるだけで診断"}</T>
    </div>
    {/* card from the demo, with the yellow box */}
    <div style={{ position: "absolute", right: 50, top: 120, width: 430, height: 418, overflow: "hidden", borderRadius: 14, boxShadow: "0 18px 50px #000c",
      border: "3px solid #555b66", transform: "rotate(2.5deg)" }}>
      <Img src={staticFile("n_s2.png")} style={{ width: 430 }} />
      <div style={{ position: "absolute", left: 5, top: 3, width: 414, height: 86, border: `6px solid ${YELLOW}`, boxShadow: `0 0 24px ${YELLOW}` }} />
    </div>
    <T size={24} color="#8A8F98" style={{ position: "absolute", left: 70, bottom: 40 }}>Built with Claude: Japan 2026</T>
  </AbsoluteFill>
);
