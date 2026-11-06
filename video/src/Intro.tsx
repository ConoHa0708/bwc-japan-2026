import React from "react";
import { Hacker } from "./Hacker";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const BG = "#2b2f36";
const ORANGE = "#D97757";
const YELLOW = "#FFD400";
const FONT = "'Yu Gothic', 'YuGothic', 'Meiryo', sans-serif";
const PHONE = { x: 762, y: 90, w: 396, h: 860 };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const io = Easing.bezier(0.65, 0, 0.35, 1);
const lerp = (sec: number, a: number, b: number, from: number, to: number, easing = io) =>
  interpolate(sec, [a, b], [from, to], { ...clamp, easing });
const fadeIn = (sec: number, at: number, d = 0.35) => interpolate(sec, [at, at + d], [0, 1], clamp);
const fadeOut = (sec: number, at: number, d = 0.35) => interpolate(sec, [at, at + d], [1, 0], clamp);
const pop = (sec: number, at: number) => interpolate(sec, [at, at + 0.18, at + 0.32], [0.6, 1.08, 1], clamp);

const T: React.FC<{ size: number; color?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ size, color = "white", children, style }) => (
  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: size, color, whiteSpace: "pre", lineHeight: 1.25, ...style }}>{children}</div>
);

const Card: React.FC<{ sec: number; at: number; x: number; a: string; b: string }> = ({ sec, at, x, a, b }) => {
  const y = lerp(sec, at, at + 0.4, 40, 0, Easing.out(Easing.cubic));
  return (
    <div style={{ position: "absolute", left: x, top: 600 + y, width: 400, opacity: fadeIn(sec, at), background: "#2b2f36ee",
      borderRadius: 14, padding: "22px 26px", boxShadow: "0 12px 32px #0009" }}>
      <T size={30} color="#A9AFB8">{a}</T>
      <div style={{ position: "relative", display: "inline-block", marginTop: 10, padding: "4px 14px" }}>
        <T size={66}>{b}</T>
        {sec > at + 0.45 && (
          <div style={{ position: "absolute", inset: 0, border: `6px solid ${YELLOW}`, transform: `scale(${pop(sec, at + 0.45)})`, boxShadow: `0 0 22px ${YELLOW}88` }} />
        )}
      </div>
    </div>
  );
};

const NOTES = [
  { k: "メール", c: "#BBBBBB", t: "【重要】口座情報の確認が必要です" },
  { k: "SMS", c: "#8AB4F8", t: "お荷物をお届けに上がりましたが不在…" },
  { k: "LINE", c: "#6BD66B", t: "新しく LINE グループを作成してください" },
  { k: "メール", c: "#BBBBBB", t: "【警察庁】口座が凍結されます" },
  { k: "SMS", c: "#8AB4F8", t: "ご利用料金の未払いがあります" },
  { k: "LINE", c: "#6BD66B", t: "QR コードを送ってください" },
];

const Note: React.FC<{ sec: number; i: number }> = ({ sec, i }) => {
  const at = 11.6 + [0, 0.5, 0.9, 1.2, 1.45, 1.65][i];
  const left = i % 2 === 0;
  const tx = left ? 290 : 1190;
  const ty = 260 + Math.floor(i / 2) * 200 + (left ? 0 : 90);
  const inP = lerp(sec, at, at + 0.4, 0, 1, Easing.out(Easing.cubic));
  const outP = lerp(sec, 13.6 + i * 0.05, 14.1 + i * 0.05, 0, 1, Easing.in(Easing.cubic));
  const x = tx + (1600 - tx) * (1 - inP) + (PHONE.x + 198 - 220 - tx) * outP;
  const y = ty + (820 - ty) * (1 - inP) + (PHONE.y + 430 - ty) * outP;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 400, opacity: Math.min(1, inP * 1.5) * (1 - outP), transform: `scale(${(0.3 + 0.7 * inP) * (1 - 0.8 * outP)})`,
      background: "#3a3f48", borderRadius: 18, padding: "16px 22px", borderLeft: `8px solid ${NOTES[i].c}`, boxShadow: "0 8px 24px #0006" }}>
      <T size={23} color={NOTES[i].c}>{NOTES[i].k}</T>
      <T size={25} style={{ marginTop: 4, whiteSpace: "normal" }}>{NOTES[i].t}</T>
    </div>
  );
};

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const raw = frame / fps;
  const sec = raw < 0.9 ? raw : raw < 6.45 ? 0.9 + (raw - 0.9) * (7.55 / 5.55) : raw + 2;

  // 1. Counter: big in the middle, then settles above the site image.
  const count = Math.round(interpolate(sec, [0.9, 2.6], [0, 90550], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const cP = lerp(sec, 2.4, 3.3, 0, 1);
  const cScale = 2.3 - 1.3 * cP;
  const cX = 960 + (330 - 960) * cP;
  const cY = 470 + (150 - 470) * cP;

  // 2. Site and cards fall forward, the phone stands up.
  const fall = lerp(sec, 9.65, 10.5, 0, 1, Easing.in(Easing.cubic));
  const stand = lerp(sec, 10.2, 11.1, 0, 1, Easing.out(Easing.back(1.2)));
  const phoneGlow = interpolate(sec, [14.1, 14.5, 16.5], [0, 1, 0.5], clamp);

  // 3. Jingle wipe into the demo.
  const wIn = lerp(sec, 17.8, 18.2, 0, 1);
  const wOut = 0; // stays yellow: the demo starts with its own yellow jingle

  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, perspective: 1800 }}>
        <div style={{ position: "absolute", inset: 0, transformOrigin: "50% 100%", transform: `rotateX(${-88 * fall}deg)`, opacity: 1 - fall }}>
          {sec >= 8.45 && sec < 8.85 && (
            <div style={{ position: "absolute", left: 1330, top: 420 - 330 * lerp(sec, 8.45, 8.8, 0, 1, Easing.out(Easing.back(1.6))) }}>
              <Hacker pose="stand" />
            </div>
          )}
          <div style={{ position: "absolute", left: 310, top: 250, opacity: fadeIn(sec, 2.6, 0.5) }}>
            <Img src={staticFile("sagidame.png")} style={{ width: 1300, display: "block", boxShadow: "0 12px 40px #0008" }} />
            <T size={22} color="#8A8F98" style={{ marginTop: 10 }}>詐欺ダメ.com（ハッカソン以前から運営）</T>
          </div>
          <div style={{ position: "absolute", left: cX, top: cY, transform: `translate(${-50 * (1 - cP)}%, -50%) scale(${cScale})`, transformOrigin: "0 50%", opacity: fadeIn(sec, 0.6, 0.4) }}>
            <T size={30} color={ORANGE}>累計検知件数</T>
            <T size={84} color={YELLOW}>{count.toLocaleString("en-US")}<span style={{ fontSize: 42, color: "white" }}> 件</span></T>
          </div>
          <Card sec={sec} at={3.6} x={330} a="偽通販サイトを" b="見抜く。" />
          <Card sec={sec} at={4.9} x={760} a="偽警察・サポート詐欺を" b="止める。" />
          <Card sec={sec} at={6.2} x={1190} a="見つけた詐欺を" b="通報する。" />
          <T size={60} color={YELLOW} style={{ position: "absolute", left: 0, right: 0, top: 930, textAlign: "center", opacity: fadeIn(sec, 7.4) }}>ブラウザでは、守ってきた。</T>
        </div>

        <div style={{ position: "absolute", left: PHONE.x - 14, top: PHONE.y - 14, width: PHONE.w + 28, height: PHONE.h + 28,
          transformOrigin: "50% 100%", transform: `rotateX(${90 * (1 - stand)}deg)`, opacity: stand }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 64, border: "4px solid #8A8F98", boxShadow: `0 0 ${60 * phoneGlow}px ${ORANGE}` }} />
          <Img src={staticFile("home.png")} style={{ position: "absolute", left: 14, top: 14, width: PHONE.w, height: PHONE.h, borderRadius: 50 }} />
        </div>
      </div>

      {NOTES.map((_, i) => <Note key={i} sec={sec} i={i} />)}
      <div style={{ position: "absolute", left: 60, top: 80, opacity: fadeIn(sec, 11.1) * fadeOut(sec, 13.8) }}>
        <T size={46} color="#D8DBE0">でも、詐欺の最前線のスマホは</T>
        <T size={86} color={YELLOW}>まだ、手つかず。</T>
      </div>
      {(() => {
        // Hacker enters, kicks the browser layer down, types at the phone, gets squashed by the title and kicked away.
        const peek = lerp(sec, 8.45, 8.8, 0, 1, Easing.out(Easing.back(1.6)));
        const hop = lerp(sec, 8.85, 9.25, 0, 1, Easing.inOut(Easing.quad));
        const kick = interpolate(sec, [9.35, 9.6, 9.9], [0, 1, 0], clamp);
        const move = lerp(sec, 10.3, 11.0, 0, 1);
        const hx = 1330 + (1640 - 1330) * hop + (1600 - 1640) * move;
        const hy = (sec < 8.85 ? 420 - 330 * peek : 90 + (560 - 90) * hop - 260 * Math.sin(Math.PI * hop)) + (650 - 560) * move;
        const t1 = lerp(sec, 14.4, 14.75, -200, 600, Easing.in(Easing.quad));
        const squash = interpolate(sec, [14.72, 14.82, 14.9], [1, 0.3, 0.38], clamp);
        const t2 = lerp(sec, 15.3, 15.6, 1200, 690, Easing.out(Easing.back(1.3)));
        const fly = lerp(sec, 15.5, 16.3, 0, 1, Easing.in(Easing.quad));
        const pose = sec < 9.3 ? "stand" : sec < 10.0 ? "kick" : sec < 14.72 ? "type" : sec < 15.5 ? "squash" : "fly";
        const show = sec >= 8.85 && fly < 1;
        return (<>
          {show && (
            <div style={{ position: "absolute", left: hx + 700 * fly, top: hy - 1100 * fly + 300 * fly * fly, transformOrigin: "50% 100%",
              transform: `rotate(${900 * fly}deg) scale(${pose === "squash" ? 1.35 : 1}, ${pose === "squash" ? squash : 1})` }}>
              <Hacker pose={pose} kick={kick} typing={sec} />
            </div>
          )}
          {sec >= 14.4 && <T size={42} color={ORANGE} style={{ position: "absolute", left: 1220, top: t1 }}>Claude アプリで始める詐欺対策</T>}
          {sec >= 15.3 && <T size={74} style={{ position: "absolute", left: 1220, top: t2 }}>{"フィッシング詐欺\n検出コネクター"}</T>}
        </>);
      })()}

      {/* Under the jingle, switch to the demo's first frame so the wipe reveals the demo. */}
      
      {/* Jingle */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${-100 + 100 * wIn + 100 * wOut}%`, width: "100%", background: YELLOW,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <T size={40} color="#2b2f36" style={{ opacity: fadeIn(sec, 18.1, 0.3), letterSpacing: 8 }}>DEMO</T>
        <T size={92} color="#2b2f36" style={{ marginTop: 10, opacity: fadeIn(sec, 18.2, 0.3),
          transform: `translateY(${lerp(sec, 18.2, 18.6, 30, 0, Easing.out(Easing.cubic))}px)` }}>4 つの手口で、試す。</T>
        <T size={34} color="#2b2f36" style={{ marginTop: 22, opacity: fadeIn(sec, 18.5, 0.3) }}>本文コピー ・ スクショ ・ 共有</T>
      </div>
      <AbsoluteFill style={{ background: "#000", opacity: interpolate(sec, [0, 0.7], [1, 0], clamp) }} />
    </AbsoluteFill>
  );
};
