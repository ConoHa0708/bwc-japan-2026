import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const BG = "#2b2f36";
const ORANGE = "#F5A623";
const CLAUDE = "#D97757";
const YELLOW = "#FFD400";
const GREEN = "#7ED321";
const FONT = "'Yu Gothic', 'YuGothic', 'Meiryo', sans-serif";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const lerp = (s: number, a: number, b: number, f: number, t: number, e = Easing.bezier(0.65, 0, 0.35, 1)) =>
  interpolate(s, [a, b], [f, t], { ...clamp, easing: e });
const fadeIn = (s: number, at: number, d = 0.4) => interpolate(s, [at, at + d], [0, 1], clamp);

const T: React.FC<{ size: number; color?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ size, color = "white", style, children }) => (
  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: size, color, whiteSpace: "pre", lineHeight: 1.3, ...style }}>{children}</div>
);

const Line: React.FC<{ s: number; at: number; size: number; color?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ s, at, size, color, children, style }) => (
  <T size={size} color={color} style={{ opacity: fadeIn(s, at), transform: `translateY(${lerp(s, at, at + 0.45, 22, 0, Easing.out(Easing.cubic))}px)`, ...style }}>{children}</T>
);

export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = frame / fps;
  // First half slides up and out, the message settles in the middle.
  const out1 = lerp(s, 3.6, 4.2, 0, 1, Easing.in(Easing.cubic));
  const lineW = lerp(s, 5.2, 5.8, 0, 400, Easing.out(Easing.cubic));
  const glow = interpolate(s, [4.8, 5.4, 9], [0, 1, 0.5], clamp);
  const endFade = lerp(s, 8.4, 9.0, 0, 1);

  return (
    <AbsoluteFill style={{ background: BG }}>
      <div style={{ position: "absolute", left: 360, top: 250, opacity: 1 - out1, transform: `translateY(${-80 * out1}px)` }}>
        <Line s={s} at={0.2} size={34} color={ORANGE}>いまの課題</Line>
        <Line s={s} at={0.4} size={50} style={{ marginTop: 8 }}>新たな手口への対応</Line>
        <Line s={s} at={1.3} size={34} color={GREEN} style={{ marginTop: 70 }}>これから</Line>
        <Line s={s} at={1.5} size={42} color="#E6E8EC" style={{ marginTop: 14 }}>・新しい手口に合わせて、観点を足していく</Line>
        <Line s={s} at={2.1} size={42} color="#E6E8EC" style={{ marginTop: 16 }}>・詐欺ダメ.com とつなぎ、偽通販サイトにも広げる</Line>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 320, textAlign: "center" }}>
        <Line s={s} at={4.3} size={58} color="#D8DBE0">詐欺から守るために、</Line>
        <T size={88} style={{ marginTop: 18, opacity: fadeIn(s, 4.8, 0.5), transform: `scale(${lerp(s, 4.8, 5.4, 0.92, 1, Easing.out(Easing.back(1.6)))})`,
          textShadow: `0 0 ${24 * glow}px ${CLAUDE}` }}>すべての人に Claude アプリを。</T>
        <div style={{ margin: "40px auto 0", width: lineW, height: 4, background: CLAUDE }} />
        <Line s={s} at={5.6} size={42} color={YELLOW} style={{ marginTop: 34 }}>フィッシング詐欺検出コネクター</Line>
      </div>

      <div style={{ position: "absolute", right: 60, bottom: 60, textAlign: "center", opacity: fadeIn(s, 5.0) }}>
        <T size={22} color={ORANGE}>コネクターを試す</T>
        <Img src={staticFile("qr.png")} style={{ width: 210, height: 210, marginTop: 8 }} />
      </div>

      <AbsoluteFill style={{ background: "#000", opacity: endFade }} />
    </AbsoluteFill>
  );
};
