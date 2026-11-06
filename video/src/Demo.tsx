import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const BG = "#2b2f36";
const ORANGE = "#F5A623";
const YELLOW = "#FFD400";
const GREEN = "#7ED321";
const FONT = "'Yu Gothic', 'YuGothic', 'Meiryo', sans-serif";
const FPS = 30;
const JIN = 1.4; // content starts this long after the scene starts (under the jingle wipe-out)

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const io = Easing.bezier(0.65, 0, 0.35, 1);
const lerp = (s: number, a: number, b: number, f: number, t: number, e = io) => interpolate(s, [a, b], [f, t], { ...clamp, easing: e });
const fadeIn = (s: number, at: number, d = 0.3) => interpolate(s, [at, at + d], [0, 1], clamp);

type Seg = [number, number, number]; // source from, source to, playback rate
type Phone = { x: number; src: string; segs: Seg[]; label: string };
type Zoom = { at: number; end?: number; still: string; w: number; cropY: number; cropH: number; phone: number; label: string };
type Box = [number, number, number, number]; // y, h, from, to
type Scene = {
  dur: number; // content seconds
  no: string; noColor: string; title: string; sub?: string;
  colW: number; stepX: number; stepSize: number;
  steps: { file: string; text: string; at: number }[];
  phones: Phone[];
  zooms: Zoom[];
  boxX: number; boxW: number; boxes: Box[];
  ffw: [number, number][];
};

const T: React.FC<{ size: number; color?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ size, color = "white", style, children }) => (
  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: size, color, whiteSpace: "pre", lineHeight: 1.3, ...style }}>{children}</div>
);

const PhoneVideo: React.FC<{ p: Phone; dur: number }> = ({ p, dur }) => {
  let at = 0;
  const parts = p.segs.map(([from, to, rate], i) => {
    const len = Math.round(((to - from) / rate) * FPS);
    const el = (
      <Sequence key={i} from={at} durationInFrames={len} layout="none">
        <OffthreadVideo src={staticFile(p.src + ".mp4")} startFrom={Math.round(from * FPS)} endAt={Math.round(to * FPS) + 2} playbackRate={rate} muted
          style={{ position: "absolute", left: 0, top: 0, width: 396, height: 860 }} />
      </Sequence>
    );
    at += len;
    return el;
  });
  const holdLen = Math.round(dur * FPS) - at;
  return (
    <div style={{ position: "absolute", left: p.x, top: 90, width: 396, height: 860, overflow: "hidden" }}>
      {parts}
      {holdLen > 0 && (
        <Sequence from={at} durationInFrames={holdLen} layout="none">
          <Img src={staticFile(p.src + "_end.png")} style={{ position: "absolute", left: 0, top: 0, width: 396, height: 860 }} />
        </Sequence>
      )}
    </div>
  );
};

const SceneView: React.FC<{ sc: Scene }> = ({ sc }) => {
  const frame = useCurrentFrame();
  const s = frame / FPS - JIN; // content time
  const zoomNow = sc.zooms.find((z) => s >= z.at && (z.end === undefined || s < z.end + 0.35));
  const anyZoom = Boolean(zoomNow);
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Sequence from={Math.round(JIN * FPS)} layout="none">
        {sc.phones.map((p, i) => <PhoneVideo key={i} p={p} dur={sc.dur} />)}
      </Sequence>

      {/* labels above phones */}
      {sc.phones.map((p, i) => (
        <T key={i} size={sc.phones.length > 1 ? 32 : 36} style={{ position: "absolute", left: p.x, width: 396, top: 36, textAlign: "center", opacity: anyZoom ? 0 : 1 }}>{p.label}</T>
      ))}
      {/* fast-forward badge */}
      {sc.ffw.some(([a, b]) => s >= a && s < b) && sc.phones.map((p, i) => (
        <div key={i} style={{ position: "absolute", left: p.x, width: 396, top: 440, textAlign: "center" }}>
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, color: "white", background: "#000a", padding: "8px 18px", borderRadius: 8 }}>早送り ▶▶</span>
        </div>
      ))}

      {/* zoomed card: grows out of its spot on the phone */}
      {zoomNow && (() => {
        const z = zoomNow;
        const p = sc.phones[z.phone];
        const k = 860 / 2622;
        const inP = lerp(s, z.at, z.at + 0.45, 0, 1, Easing.out(Easing.cubic));
        const outP = z.end === undefined ? 0 : lerp(s, z.end, z.end + 0.35, 0, 1, Easing.in(Easing.cubic));
        const p01 = inP * (1 - outP);
        const from = { x: p.x, y: 90 + z.cropY * k, w: 396, h: z.cropH * k };
        const to = { x: 1330 - z.w / 2, y: 90, w: z.w, h: 960 };
        const r = { x: from.x + (to.x - from.x) * p01, y: from.y + (to.y - from.y) * p01, w: from.w + (to.w - from.w) * p01, h: from.h + (to.h - from.h) * p01 };
        return (<>
          <div style={{ position: "absolute", left: 720, top: 70, width: 1200, height: 1010, background: BG, opacity: Math.min(1, p01 * 2) }} />
          <Img src={staticFile(z.still)} style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, boxShadow: `0 20px 60px #000c`, opacity: Math.min(1, inP * 3) * (1 - outP) }} />
          <T size={34} color={ORANGE} style={{ position: "absolute", left: 1330 - 400, width: 800, top: 30, textAlign: "center", opacity: p01 }}>{z.label}</T>
        </>);
      })()}

      {/* yellow boxes, with a small pop */}
      {zoomNow && sc.boxes.map(([y, h, a0, b]) => {
        // Wait until the card has finished zooming in, and hide while it zooms back out.
        const a = Math.max(a0, zoomNow.at + 0.5);
        const stop = zoomNow.end === undefined ? b : Math.min(b, zoomNow.end);
        return [y, h, a, stop] as Box;
      }).filter(([, , a, b]) => s >= a && s < b).map(([y, h, a], i) => {
        const sc2 = interpolate(s, [a, a + 0.15, a + 0.3], [0.94, 1.03, 1], clamp);
        return <div key={i} style={{ position: "absolute", left: sc.boxX, top: y, width: sc.boxW, height: h, border: `6px solid ${YELLOW}`,
          boxShadow: `0 0 26px ${YELLOW}aa, inset 0 0 18px ${YELLOW}55`, transform: `scale(${sc2})`, borderRadius: 6 }} />;
      })}

      {/* heading */}
      <div style={{ position: "absolute", left: 0, width: sc.colW, top: 126, textAlign: "center" }}>
        <T size={34} color={sc.noColor}>{sc.no}</T>
        <T size={38} style={{ marginTop: 4 }}>{sc.title}</T>
        {sc.sub && <T size={30} color="#BBBBBB" style={{ marginTop: 6 }}>{sc.sub}</T>}
      </div>

      {/* steps: slide in, current one glows, finished ones turn grey with a check */}
      {sc.steps.map((st, i) => {
        const next = sc.steps[i + 1]?.at ?? 999;
        if (s < st.at) return null;
        const cur = s < next;
        const slide = lerp(s, st.at, st.at + 0.4, 30, 0, Easing.out(Easing.cubic));
        return (
          <div key={i} style={{ position: "absolute", left: sc.stepX + slide, top: 300 + i * 125, opacity: fadeIn(s, st.at) }}>
            {!cur && <span style={{ position: "absolute", left: -38, top: 0, fontFamily: FONT, fontWeight: 700, fontSize: sc.stepSize + 4, color: GREEN }}>✓</span>}
            <T size={sc.stepSize} color={cur ? "white" : "#8A8F98"} style={{ textShadow: cur ? `0 0 14px #ffffff88` : "none" }}>{st.text}</T>
          </div>
        );
      })}

      {/* jingle */}
      {(() => {
        const t = frame / FPS;
        const wIn = 1; // fully covered at scene start (the previous scene's end wipes in)
        const wOut = lerp(t, JIN - 0.05, JIN + 0.3, 0, 1);
        if (wOut >= 1) return null;
        return (
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(-100 + 100 * wIn + 100 * wOut)}%`, width: "100%", background: YELLOW,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <T size={44} color={BG} style={{ letterSpacing: 6, opacity: fadeIn(t, 0.05, 0.25) }}>{sc.no}</T>
            <T size={80} color={BG} style={{ marginTop: 8, opacity: fadeIn(t, 0.2, 0.25), transform: `translateY(${lerp(t, 0.2, 0.55, 24, 0, Easing.out(Easing.cubic))}px)` }}>{sc.title}</T>
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};

// Wipe-in at the end of a scene, so the next jingle starts fully covered.
const WipeIn: React.FC<{ text?: string; sub?: string }> = ({ text, sub }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const w = lerp(t, 0, 0.3, 0, 1);
  return (
    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${-100 + 100 * w}%`, width: "100%", background: YELLOW,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {text && <T size={44} color={BG} style={{ letterSpacing: 6, opacity: fadeIn(t, 0.25, 0.2) }}>{text}</T>}
      {sub && <T size={80} color={BG} style={{ marginTop: 8, opacity: fadeIn(t, 0.3, 0.2) }}>{sub}</T>}
    </div>
  );
};

const L = (s: string) => s; // text helper (keeps line breaks)

export const SCENES: Scene[] = [
  {
    dur: 30.6, no: "手口 1", noColor: ORANGE, title: "社長を名乗り、LINE グループを作らせる", colW: 760, stepX: 60, stepSize: 31,
    steps: [
      { file: "", at: 0, text: L("① 届いたメールを開く") },
      { file: "", at: 8, text: L("② 本文をコピーして\n　 Claude アプリに貼り付け") },
      { file: "", at: 20, text: L("③ コネクターが判定の作法を渡し\n　 Claude アプリが観点に答える") },
      { file: "", at: 25.5, text: L("④ コネクターが採点\n　 60点「疑い大」") },
      { file: "", at: 28.4, text: L("⑤ 対処：グループは作らず\n　 QR コードも送らない") },
    ],
    phones: [{ x: 762, src: "r3", label: "本文を貼り付ける", segs: [[0, 19.95, 1], [19.95, 33, 1 / 0.153], [33, 40.8, 1]] }],
    zooms: [{ at: 23, still: "n_s1.png", w: 948, cropY: 790, cropH: 1220, phone: 0, label: "カードを拡大" }],
    boxX: 862, boxW: 936, boxes: [[292, 204, 23, 25.5], [98, 186, 25.5, 28.4], [522, 140, 28.4, 99]],
    ffw: [[20, 22]],
  },
  {
    dur: 29.6, no: "手口 2", noColor: ORANGE, title: "警察を名乗り、お金を振り込ませる", colW: 760, stepX: 60, stepSize: 31,
    steps: [
      { file: "", at: 0, text: L("① 届いたメールを開く") },
      { file: "", at: 6, text: L("② スクショを撮って\n　 Claude アプリに送る") },
      { file: "", at: 17.7, text: L("③ Claude アプリが本文を読み\n　 観点に答える") },
      { file: "", at: 23.8, text: L("④ コネクターが採点\n　 100点「疑い大」") },
      { file: "", at: 27.3, text: L("⑤ 決め手：警察を名乗り、\n　 安全な口座への振替を求める") },
    ],
    phones: [{ x: 762, src: "r2", label: "スクリーンショットを見せる", segs: [[0, 17.7, 1], [17.7, 33.6, 1 / 0.126], [33.6, 40.5, 1]] }],
    zooms: [{ at: 21.5, still: "n_s2.png", w: 990, cropY: 430, cropH: 1170, phone: 0, label: "カードを拡大" }],
    boxX: 842, boxW: 977, boxes: [[331, 532, 21.5, 23.8], [100, 188, 23.8, 27.3], [376, 128, 27.3, 99]],
    ffw: [[17.7, 19.7]],
  },
  {
    dur: 43.4, no: "手口 3", noColor: ORANGE, title: "銀行を名乗るフィッシングメール", colW: 720, stepX: 44, stepSize: 29,
    steps: [
      { file: "", at: 0, text: L("① スクショと本文を、それぞれ\n　 Claude アプリに渡す") },
      { file: "", at: 17.3, text: L("② コネクターが「決め手なし」で59点に止め\n　 差出人のアドレスを質問（左右とも）") },
      { file: "", at: 25.5, text: L("③ メールで差出人の名前を\n　 押してアドレスを確認") },
      { file: "", at: 33, text: L("④ アドレスを答えて\n　 もう一度診断") },
      { file: "", at: 39.5, text: L("⑤ 公式ドメインと違う\n　 → コネクターが100点（左右とも）") },
    ],
    phones: [
      { x: 740, src: "r4", label: "スクリーンショットを見せる", segs: [[2.2, 20.5, 1 / 0.82], [20.5, 34.8, 1 / 0.14], [34.8, 38.8, 1 / 2.125], [38.8, 50.8, 1], [50.8, 65.4, 1 / 0.137], [65.4, 72.3, 1]] },
      { x: 1200, src: "r1", label: "本文を貼り付ける", segs: [[0, 20.35, 1 / 0.737], [20.35, 33, 1 / 0.158], [33, 37.4, 1 / 1.932], [37.4, 53.74, 1 / 0.734], [53.74, 68.43, 1 / 0.136], [68.43, 76.4, 1 / 0.94]] },
    ],
    zooms: [
      { at: 17.3, end: 25.5, still: "n_b1.png", w: 934, cropY: 440, cropH: 1240, phone: 1, label: "本文側のカードを拡大" },
      { at: 39.5, still: "n_b2.png", w: 934, cropY: 300, cropH: 1240, phone: 1, label: "本文側のカードを拡大" },
    ],
    boxX: 869, boxW: 922, boxes: [[777, 81, 17.3, 21.4], [897, 124, 21.4, 25.5], [99, 180, 39.5, 41.3], [359, 292, 41.3, 99]],
    ffw: [[15, 17], [37.5, 39.5]],
  },
  {
    dur: 15.8, no: "誤って止めない", noColor: GREEN, title: "家族からの LINE", sub: "共有からの判定", colW: 760, stepX: 60, stepSize: 31,
    steps: [
      { file: "", at: 0, text: L("① LINE のリンクを\n　 Claude アプリに共有") },
      { file: "", at: 8.85, text: L("② コネクターが短縮 URL の\n　 行き先を開かずに調べる") },
      { file: "", at: 13.3, text: L("③ 本物の Amazon の\n　 商品ページ → 15点、疑いは低い") },
    ],
    phones: [{ x: 762, src: "r5", label: "URL を共有する", segs: [[2.0, 4.5, 1 / 1.15], [9.2, 14.4, 1 / 1.15], [14.4, 24.5, 1 / 0.198], [24.5, 28.2, 1]] }],
    zooms: [{ at: 11.5, still: "n_s4.png", w: 1062, cropY: 900, cropH: 1090, phone: 0, label: "カードを拡大" }],
    boxX: 832, boxW: 996, boxes: [[456, 206, 11.5, 13.3], [168, 206, 13.3, 99]],
    ffw: [[8.85, 10.85]],
  },
];

export const sceneFrames = (sc: Scene) => Math.round((JIN + sc.dur) * FPS);
const WIPE = 0.3;

export const Demo: React.FC = () => {
  let at = 0;
  const items: React.ReactNode[] = [];
  SCENES.forEach((sc, i) => {
    const len = sceneFrames(sc);
    items.push(<Sequence key={"s" + i} from={at} durationInFrames={len}><SceneView sc={sc} /></Sequence>);
    // wipe-in over the last WIPE seconds of each scene (next jingle / mechanism)
    const next = SCENES[i + 1];
    items.push(
      <Sequence key={"w" + i} from={at + len - Math.round(WIPE * FPS)} durationInFrames={Math.round((next ? WIPE : 1.3) * FPS)}>
        <WipeIn text={next ? next.no : "HOW IT WORKS"} sub={next ? next.title : "仕組み"} />
      </Sequence>,
    );
    at += len;
  });
  return <AbsoluteFill style={{ background: BG }}>{items}</AbsoluteFill>;
};
