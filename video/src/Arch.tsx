import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const BG = "#2b2f36";
const PANEL = "#353a43";
const ORANGE = "#F5A623";
const CLAUDE = "#D97757";
const CLAUDE_HI = "#FF9A6E";
const YELLOW = "#FFD400";
const GREEN = "#7ED321";
const GRAY = "#8A8F98";
const FONT = "'Yu Gothic', 'YuGothic', 'Meiryo', sans-serif";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const lerp = (s: number, a: number, b: number, f: number, t: number, e = Easing.bezier(0.65, 0, 0.35, 1)) =>
  interpolate(s, [a, b], [f, t], { ...clamp, easing: e });
const fadeIn = (s: number, at: number, d = 0.35) => interpolate(s, [at, at + d], [0, 1], clamp);
const fadeOut = (s: number, at: number, d = 0.35) => 1 - fadeIn(s, at, d);
const up = (s: number, at: number, px = 20) => `translateY(${lerp(s, at, at + 0.45, px, 0, Easing.out(Easing.cubic))}px)`;

const T: React.FC<{ size: number; color?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ size, color = "white", style, children }) => (
  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: size, color, whiteSpace: "pre", lineHeight: 1.35, ...style }}>{children}</div>
);

// ---- timeline (seconds) ----
const STEPS = [
  { box: 1, at: 2.0, end: 5.0, text: "① 届いたメッセージを\n　 受け取る" },
  { box: 2, at: 5.0, end: 8.2, text: "② 判定の作法と\n　 27 の観点を返す" },
  { box: 1, at: 8.2, end: 11.6, text: "③ 読み取り、公式サイトで\n　 確かめ、観点に答える" },
  { box: 2, at: 11.6, end: 15.0, text: "④ 開かずに調べ、採点し\n　 カードを作る" },
];
const CARD_AT = 15.0, CARD_END = 18.2;
const NEXT_IN = 18.8, NEXT_OUT = 20.2; // section jingle
const B1 = 20.3, B1b = 22.6, B2 = 25.2, B2_END = 29.4; // challenge / next steps
const MSG = 29.6, END = 35;

const Y = 280, H = 430;
const BOXES = [
  { x: 45, w: 380, color: GRAY, glow: "#ffffff", title: "届いたメール・SMS・LINE", size: 27 },
  { x: 485, w: 440, color: CLAUDE, glow: CLAUDE_HI, title: "Claude アプリ", size: 36 },
  { x: 985, w: 500, color: YELLOW, glow: YELLOW, title: "フィッシング詐欺検出コネクター", size: 31, sub: "リモート MCP サーバー（Cloudflare Workers）" },
  { x: 1545, w: 330, color: GREEN, glow: GREEN, title: "診断カード", size: 36 },
];

const Box: React.FC<{ i: number; active: boolean; children?: React.ReactNode }> = ({ i, active, children }) => {
  const b = BOXES[i];
  return (
    <div style={{ position: "absolute", left: b.x, top: Y, width: b.w, height: H, background: PANEL,
      borderTop: `8px solid ${b.color}`, outline: `3px solid ${b.color}`, outlineOffset: -3,
      boxShadow: active ? `0 0 0 3px ${b.color}, 0 0 36px ${b.glow}99` : "none" }}>
      <T size={b.size} style={{ textAlign: "center", marginTop: 26 }}>{b.title}</T>
      {b.sub && <T size={21} color="#A9AFB8" style={{ textAlign: "center", marginTop: 6, fontWeight: 500 }}>{b.sub}</T>}
      <div style={{ position: "absolute", left: 24, right: 24, top: b.sub ? 128 : 104, height: 2, background: "#555b66" }} />
      {children}
    </div>
  );
};

const Arrow: React.FC<{ x: number; y: number; ch: string; on: boolean; color: string }> = ({ x, y, ch, on, color }) => (
  <T size={48} color={on ? color : "#5A606B"} style={{ position: "absolute", left: x - 24, top: y, textShadow: on ? `0 0 18px ${color}` : "none",
    transform: `scale(${on ? 1.18 : 1})` }}>{ch}</T>
);

const Jingle: React.FC<{ s: number; at: number; out: number; top: string; main: string }> = ({ s, at, out, top, main }) => {
  if (s < at || s >= out) return null;
  const wi = lerp(s, at, at + 0.3, 0, 1);
  const wo = lerp(s, out - 0.35, out, 0, 1);
  return (
    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${-100 + 100 * wi + 100 * wo}%`, width: "100%", background: YELLOW,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <T size={44} color={BG} style={{ letterSpacing: 6, opacity: fadeIn(s, at + 0.2, 0.2) }}>{top}</T>
      <T size={80} color={BG} style={{ marginTop: 8, opacity: fadeIn(s, at + 0.3, 0.25) }}>{main}</T>
    </div>
  );
};

export const Arch: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = frame / fps;

  const cur = STEPS.findIndex((st) => s >= st.at && s < st.end);
  const activeBox = s >= 1.0 && s < 2.0 ? 0 : cur >= 0 ? STEPS[cur].box : s >= CARD_AT && s < CARD_END ? 3 : -1;
  const cardP = lerp(s, CARD_AT, CARD_AT + 0.5, 0, 1, Easing.out(Easing.back(1.4)));
  const future = s >= NEXT_IN + 0.3;
  const dim = future ? 0.66 : 0;
  const worldO = lerp(s, MSG - 0.4, MSG + 0.6, 1, 0.12);
  const camS = lerp(s, MSG - 0.4, MSG + 0.6, 1, 0.9);
  const wipeIn = lerp(s, 0, 0.45, 0, 1);

  const perBox: Record<number, number> = {};

  return (
    <AbsoluteFill style={{ background: BG }}>
      <div style={{ position: "absolute", inset: 0, transformOrigin: "960px 560px", transform: `scale(${camS})`, opacity: worldO }}>
        {/* heading: mechanism */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 46, textAlign: "center", opacity: future ? 0 : 1 }}>
          <T size={36} color={ORANGE} style={{ opacity: fadeIn(s, 0.3) }}>仕組み</T>
          <T size={52} style={{ marginTop: 4, opacity: fadeIn(s, 0.5), transform: up(s, 0.5) }}>Claude アプリは読んで答えるだけ。判定はコネクターが決める</T>
        </div>

        {/* hackathon range */}
        <div style={{ position: "absolute", left: 963, top: 246, width: 934, height: 488, border: `3px dashed ${YELLOW}`, borderRadius: 6, opacity: fadeIn(s, 0.6) * (future ? 0 : 1) }} />
        <T size={24} color={YELLOW} style={{ position: "absolute", left: 972, top: 210, opacity: fadeIn(s, 0.6) * (future ? 0 : 1) }}>ハッカソンで開発した範囲</T>

        <Box i={0} active={activeBox === 0}>
          {["メール本文をコピー", "スクショを添付・共有", "LINE からの共有"].map((t, k) => (
            <T key={k} size={28} color={activeBox === 0 ? "white" : "#D0D3D9"} style={{ position: "absolute", left: 26, top: 130 + k * 66,
              textShadow: activeBox === 0 ? "0 0 14px #ffffffaa" : "none" }}>{t}</T>
          ))}
        </Box>
        <Box i={1} active={activeBox === 1} />
        <Box i={2} active={activeBox === 2} />
        <div style={{ position: "absolute", inset: 0, opacity: cardP, transform: `scale(${0.85 + 0.15 * cardP})`, transformOrigin: "1710px 495px" }}>
          <Box i={3} active={activeBox === 3}>
            {["点数と判断", "決め手の行", "対処方法", "確認したいこと"].map((t, k) => (
              <T key={k} size={28} style={{ position: "absolute", left: 26, top: 126 + k * 66 }}>{t}</T>
            ))}
          </Box>
        </div>

        {/* steps, in processing order */}
        {STEPS.map((st, i) => {
          const n = perBox[st.box] ?? 0;
          perBox[st.box] = n + 1;
          if (s < st.at) return null;
          const b = BOXES[st.box];
          const on = i === cur;
          const color = st.box === 1 ? CLAUDE_HI : YELLOW;
          const top = Y + (st.box === 2 ? 150 : 126) + n * 130;
          return (
            <T key={i} size={30} color={on ? "white" : "#D0D3D9"} style={{ position: "absolute", left: b.x + 26 + lerp(s, st.at, st.at + 0.4, 24, 0, Easing.out(Easing.cubic)),
              top, opacity: fadeIn(s, st.at, 0.3), textShadow: on ? `0 0 10px ${color}, 0 0 22px ${color}` : "none" }}>{st.text}</T>
          );
        })}

        <Arrow x={455} y={455} ch="▶" on={s >= 1.0 && s < 2.6} color="#BBBBBB" />
        <Arrow x={955} y={405} ch="◀" on={s >= 5.0 && s < 8.2} color={YELLOW} />
        <Arrow x={955} y={560} ch="▶" on={s >= 10.4 && s < 12.4} color={CLAUDE_HI} />
        <Arrow x={1515} y={455} ch="▶" on={s >= 14.4 && s < 16.0} color={YELLOW} />

        {/* QR while the mechanism is shown */}
        <div style={{ opacity: future ? 0 : 1 }}>
          <T size={26} color={ORANGE} style={{ position: "absolute", left: 95, width: 248, top: 758, textAlign: "center" }}>コネクターを試す</T>
          <Img src={staticFile("qr.png")} style={{ position: "absolute", left: 95, top: 798, width: 220, height: 220, marginLeft: 14 }} />
          <T size={18} color="#BBBBBB" style={{ position: "absolute", left: 40, width: 360, top: 1028, textAlign: "center", fontWeight: 500, lineHeight: 1.3 }}>
            {"Claude アプリの「コネクタを追加」にこの URL を入れてください"}
          </T>
        </div>

        {/* --- challenges and next steps --- */}
        <div style={{ position: "absolute", left: -200, top: -200, width: 2400, height: 1500, background: BG, opacity: dim }} />
        {[
          { at: B1, end: B1b, tag: "いまの課題", tagColor: ORANGE, text: "新たな手口への対応" },
          { at: B1b, end: B2, tag: "これから", tagColor: GREEN, text: "新しい手口に合わせて、観点を足していく" },
          { at: B2, end: 99, tag: "これから", tagColor: GREEN, text: "詐欺ダメ.com とつなぎ、偽通販サイトにも広げる" },
        ].map((h, k) => (
          <div key={k} style={{ position: "absolute", left: 0, right: 0, top: 26, textAlign: "center", opacity: fadeIn(s, h.at, 0.35) * fadeOut(s, h.end - 0.05, 0.3) }}>
            <T size={46} color={h.tagColor}>{h.tag}</T>
            <T size={72} style={{ marginTop: 2, transform: up(s, h.at, 18) }}>{h.text}</T>
          </div>
        ))}
        {[
          { at: B1, end: B2, color: ORANGE, x: 45, w: 380, lineX: 233, title: "新たな手口", sub: "見たことのない詐欺が届く" },
          { at: B2, end: B2_END, color: GREEN, x: 985, w: 500, lineX: 1233, title: "詐欺ダメ.com", sub: "9 万件の偽サイトのデータ（今後の連携）" },
        ].map((f, k) => {
          if (s < f.at) return null;
          const p = lerp(s, f.at, f.at + 0.45, 0, 1);
          const on = s < f.end;
          const c = on ? f.color : GRAY;
          return (
            <React.Fragment key={k}>
              <div style={{ position: "absolute", left: f.lineX, top: Y + H + 2, width: 4, height: 60 * p, background: c, boxShadow: on ? `0 0 12px ${f.color}` : "none" }} />
              <div style={{ position: "absolute", left: f.x, top: Y + H + 62, width: f.w, height: 180, border: `4px dashed ${c}`, borderRadius: 10,
                background: PANEL, opacity: fadeIn(s, f.at + 0.25, 0.35), boxShadow: on ? `0 0 30px ${f.color}88` : "none", transform: up(s, f.at + 0.25) }}>
                <T size={42} style={{ textAlign: "center", marginTop: 32 }}>{f.title}</T>
                <T size={26} color="#D0D3D9" style={{ textAlign: "center", marginTop: 10, fontWeight: 500 }}>{f.sub}</T>
              </div>
            </React.Fragment>
          );
        })}
        {s >= B1 && s < B2 && <div style={{ position: "absolute", left: 39, top: Y - 6, width: 392, height: H + 12, border: `6px solid ${ORANGE}`, boxShadow: `0 0 30px ${ORANGE}88` }} />}
        {s >= B1b && (
          <div style={{ position: "absolute", left: 1235, top: Y - 80, transform: `translate(-50%, 0) scale(${interpolate(s, [B1b, B1b + 0.2, B1b + 0.35], [0.4, 1.12, 1], clamp)})`,
            padding: "8px 26px", borderRadius: 40, background: s < B2 ? GREEN : "#5e7a3a", boxShadow: s < B2 ? `0 0 34px ${GREEN}` : "none", whiteSpace: "nowrap" }}>
            <T size={34} color={BG}>＋ 新しい手口の観点を足す</T>
          </div>
        )}
        {s >= B1b && s < B2_END && <div style={{ position: "absolute", left: 979, top: Y - 6, width: 512, height: H + 12, border: `6px solid ${GREEN}`, boxShadow: `0 0 30px ${GREEN}88` }} />}
      </div>

      {/* closing message */}
      {s >= MSG && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 330, textAlign: "center" }}>
          <T size={60} color="#D8DBE0" style={{ opacity: fadeIn(s, MSG + 0.1, 0.5), transform: up(s, MSG + 0.1, 22) }}>詐欺から守るために、</T>
          <T size={92} style={{ marginTop: 18, opacity: fadeIn(s, MSG + 0.8, 0.5), transform: `scale(${lerp(s, MSG + 0.8, MSG + 1.4, 0.92, 1, Easing.out(Easing.back(1.6)))})`,
            textShadow: `0 0 ${24 * interpolate(s, [MSG + 0.8, MSG + 1.4, END], [0, 1, 0.5], clamp)}px ${CLAUDE}` }}>すべての人に Claude アプリを。</T>
          <div style={{ margin: "40px auto 0", width: lerp(s, MSG + 1.4, MSG + 2.0, 0, 420, Easing.out(Easing.cubic)), height: 4, background: CLAUDE }} />
          <T size={44} color={YELLOW} style={{ marginTop: 34, opacity: fadeIn(s, MSG + 1.7, 0.4) }}>フィッシング詐欺検出コネクター</T>
        </div>
      )}
      {s >= MSG && (
        <div style={{ position: "absolute", right: 60, bottom: 60, textAlign: "center", opacity: fadeIn(s, MSG + 1.9) }}>
          <T size={24} color={ORANGE}>コネクターを試す</T>
          <Img src={staticFile("qr.png")} style={{ width: 220, height: 220, marginTop: 8 }} />
        </div>
      )}
      <AbsoluteFill style={{ background: "#000", opacity: lerp(s, END - 0.7, END, 0, 1) }} />

      <Jingle s={s} at={NEXT_IN} out={NEXT_OUT} top="NEXT" main="課題と、これから" />
      {wipeIn < 1 && (
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${100 * wipeIn}%`, width: "100%", background: YELLOW,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <T size={44} color={BG} style={{ letterSpacing: 6 }}>HOW IT WORKS</T>
          <T size={80} color={BG} style={{ marginTop: 8 }}>仕組み</T>
        </div>
      )}
    </AbsoluteFill>
  );
};
