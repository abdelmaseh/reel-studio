import React from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { assertFontsReady, FAMILY, fontsReady } from "../core/fonts";
import { clamp01, mix, px, useClock, useEnterF, useRamp } from "../core/motion";
import { CanvasFill, FRAME, zone, SafeExempt, useProbe } from "../core/safe";
import {
  fitOnLines,
  fitPillToSafeWidth,
  isArabic,
  safeWidthFor,
} from "../core/type";
import { getStyleLayout, getStyleTheme } from "../styles/themes";
import type { SceneTheme } from "../styles/theme-types";
import type { MotionVariant, SceneLayout, StyleFamily } from "./schema";
import { SLAB } from "./card-shape";

export type { SceneTheme } from "../styles/theme-types";

export type SceneOptions = {
  style?: StyleFamily;
  motion?: MotionVariant;
  layout?: SceneLayout;

  showCaption?: boolean;
};

export const getSceneTheme = (style: StyleFamily): SceneTheme =>
  getStyleTheme(style);

export type SceneGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
  titleHeight: number;
  bodyTop: number;
  bodyHeight: number;
  captionCenter: number;
  canvasHeight: number;
  compact: boolean;
  titleTop?: number;
};


export const getSceneGeometry = (
  style: StyleFamily,
  layout: SceneLayout,
): SceneGeometry => {
  const styleLayout = getStyleLayout(style);
  const adapted = styleLayout.kind === "adapted";
  const seam = styleLayout.seam;
  const captionCenter = layout === "split" ? seam : styleLayout.caption;
  const top =
    Math.max(zone("ig-reels-organic").top, zone("ig-reels-ads").top) + 24;

  const bottom = captionCenter - 118;

  const band = safeWidthFor(top, bottom - top, "organic", {
    inset: adapted ? 44 : 30,
  });
  const height = bottom - top;
  const compact = height < 410;
  const titleHeight =
    styleLayout.kind === "adapted" ? styleLayout.title : compact ? 82 : 116;
  const bodyTop =
    styleLayout.kind === "adapted"
      ? styleLayout.body
      : 36 + titleHeight + (compact ? 16 : 24);
  return {
    left: band.left,
    top,
    width: band.width,
    height,
    titleHeight,
    bodyTop,
    bodyHeight: height - bodyTop,
    captionCenter,
    canvasHeight: layout === "split" ? seam : FRAME.height,
    compact,
    ...(styleLayout.kind === "adapted" ? { titleTop: styleLayout.titleTop } : {}),
  };
};

export const CreativeFonts: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [ready, setReady] = React.useState(fontsReady);
  const [handle] = React.useState(() =>
    delayRender("creative-kit: local font measurements"),
  );
  React.useEffect(() => {
    if (ready) return;
    let request = 0;
    const check = () => {


      if (!fontsReady()) {
        request = requestAnimationFrame(check);
        return;
      }
      try {
        assertFontsReady();
        setReady(true);
      } catch (error) {
        cancelRender(error);
      }
    };
    check();
    return () => cancelAnimationFrame(request);
  }, [ready]);
  React.useEffect(() => {
    if (ready) continueRender(handle);
  }, [handle, ready]);

  React.useEffect(() => () => continueRender(handle), [handle]);
  return ready ? <>{children}</> : null;
};

export const SceneCanvas: React.FC<{
  theme: SceneTheme;
  geometry: SceneGeometry;
  children: React.ReactNode;
}> = ({ theme, geometry, children }) => {
  const {frame}=useClock();
  const composition=theme.grammar?.composition;
  return <>
    <CanvasFill
      background={theme.background}
      style={{ bottom: "auto", height: geometry.canvasHeight }}
    />
    <SafeExempt>
      {composition==='aurora-lens'?<div style={{position:'absolute',left:0,top:0,width:FRAME.width,height:geometry.canvasHeight,background:`radial-gradient(ellipse 68% 52% at ${30+Math.sin(frame/110)*10}% 35%, #514AC86B, transparent 76%), radial-gradient(ellipse 55% 50% at 78% ${52+Math.sin(frame/130)*9}%, #10ADC047, transparent 75%)`}}/>:null}
      {composition==='ticket-stack'?<div style={{position:'absolute',left:0,top:0,width:FRAME.width,height:geometry.canvasHeight,background:'radial-gradient(ellipse 80% 55% at 50% 48%, #B9772A35, transparent 75%), repeating-conic-gradient(from 20deg at 50% 55%, transparent 0deg 14deg, #FFC86B09 14deg 22deg)'}}/>:null}
      {composition==='magazine-column'?<div style={{position:'absolute',left:geometry.left,top:geometry.top-48,width:geometry.width,height:geometry.height+70,borderTop:`1px solid ${theme.accent}`,borderBottom:`1px solid ${theme.border}`}}/>:null}
      {composition==='route-map'?<div style={{position:'absolute',left:0,top:0,width:FRAME.width,height:geometry.canvasHeight,backgroundImage:'linear-gradient(#625D4B0B 1px, transparent 1px), linear-gradient(90deg,#625D4B0B 1px, transparent 1px)',backgroundSize:'42px 42px'}}/>:null}
    </SafeExempt>
    <div
      style={{
        position: "absolute",
        left: geometry.left,
        top: geometry.top,
        width: geometry.width,
        height: geometry.height,
      }}
    >
      {children}
    </div>
  </>;
};


export const Reveal: React.FC<{
  motion: MotionVariant;
  order?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ motion, order = 0, children, style }) => {
  const { fps } = useClock();
  const start = -2 + (motion === "stagger" ? order * 4 : 0);
  const landed = useEnterF(start, "card");
  const calm = useRamp(start / fps, 14);
  const alpha = useRamp(start / fps, 5);
  const progress = clamp01(motion === "quiet" ? calm : landed);
  return (
    <div
      style={{
        ...style,
        opacity: alpha,
        transform: `translateY(${px(mix(motion === "quiet" ? 10 : 28, 0, progress))}px) scale(${mix(0.985, 1, progress)})`,
        transformOrigin: "50% 50%",
      }}
    >
      {children}
    </div>
  );
};

export type TextRole = "title" | "body" | "label";

export type FitTextLayoutOptions = {
  text: string;
  theme: SceneTheme;
  width: number;
  height: number;
  size?: number;
  min?: number;
  lines?: number;
  role?: TextRole;
  fitTo?: string;
};







export const fitTextLayout = ({
  text,
  theme,
  width,
  height,
  size = 48,
  min = 22,
  lines = 2,
  role = "body",
  fitTo,
}: FitTextLayoutOptions) => {
  const arabic = isArabic(text);
  const adapted = Boolean(theme.grammar);
  const naskh = arabic && theme.ar === FAMILY.naskh;
  const lineHeight = naskh ? 1.6 : 1.28;
  const measured = fitTo ?? text;
  assertFontsReady();
  const descriptor = {
    fontFamily: arabic
      ? theme.ar
      : role === "label"
        ? theme.mono
        : theme.display,
    fontSize: size,

    fontWeight: adapted
      ? role === "label" && !arabic
        ? 600
        : role === "title" && arabic && theme.ar === FAMILY.cairo
          ? 900
          : 700
      : role === "title"
        ? 800
        : role === "label"
          ? 600
          : 700,
    letterSpacing: role === "label" ? 1.5 : 0,
    fontVariantNumeric: "tabular-nums",
  };
  let fitted = fitOnLines(measured, descriptor, {
    maxBoxWidth: width,
    maxLines: lines,
    min,
    max: size,
    lineHeight,
  });

  let ceiling = size;
  while (fitted.height > height && ceiling > min) {
    ceiling = Math.max(
      min,
      Math.min(
        ceiling - 1,
        Math.floor(height / (fitted.lines.length * lineHeight)),
      ),
    );
    fitted = fitOnLines(measured, descriptor, {
      maxBoxWidth: width,
      maxLines: lines,
      min,
      max: ceiling,
      lineHeight,
    });
  }
  return { ...fitted, lineHeight };
};


export const FitText: React.FC<{
  text: string;
  theme: SceneTheme;
  width: number;
  height: number;
  size?: number;
  min?: number;
  lines?: number;
  role?: TextRole;
  color?: string;
  align?: "left" | "center" | "right";
  style?: React.CSSProperties;


  fitTo?: string;
}> = ({
  text,
  theme,
  width,
  height,
  size = 48,
  min = 22,
  lines = 2,
  role = "body",
  color,
  align,
  style,
  fitTo,
}) => {
  const arabic = isArabic(text);
  const adapted = Boolean(theme.grammar);
  const naskh = arabic && theme.ar === FAMILY.naskh;
  const lineHeight = naskh ? 1.6 : 1.28;
  const measured = fitTo ?? text;
  const fit = React.useMemo(
    () => fitTextLayout({ text, theme, width, height, size, min, lines, role, fitTo }),

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [measured, arabic, theme.ar, theme.mono, theme.display, adapted, lineHeight, role, size, width, height, lines, min],
  );
  if (fitTo !== undefined && lines !== 1) {
    throw new Error(
      "creative-kit: FitText fitTo needs lines={1}.",
    );
  }
  if (!fit.fits || fit.height > height) {
    throw new Error(
      `creative-kit: text does not fit its ${width}x${height}px box: ${JSON.stringify(text)}. Shorten the copy or choose a larger layout.`,
    );
  }
  return (
    <div
      style={{
        ...fit.style,
        position: "relative",
        width,
        color: color ?? theme.text,
        textAlign: align ?? (arabic ? "right" : "left"),
        ...(adapted ? { fontSynthesis: "none" as const } : {}),
        ...style,
      }}
    >
      {(fitTo === undefined ? fit.lines : [text]).map((line, index) => (
        <div key={index} style={{ whiteSpace: "pre" }}>
          {!adapted &&
          role === "title" &&
          index === fit.lines.length - 1 &&
          line.endsWith(".") ? (
            <>
              {line.slice(0, -1)}
              <span style={{ color: theme.accent }}>.</span>
            </>
          ) : (
            line
          )}
        </div>
      ))}
    </div>
  );
};

export const SceneHeader: React.FC<{
  kicker: string;
  title: string;
  theme: SceneTheme;
  geometry: SceneGeometry;
  motion: MotionVariant;
}> = ({ kicker, title, theme, geometry: g, motion }) => {
  const grammar = theme.grammar;
  const strip = grammar?.annotation === "signal-strip";
  const tape = grammar?.annotation === "tape-tabs";
  const board = grammar?.annotation === "verdict-divider";
  const marked =
    grammar?.annotation === "brush-rule" ||
    grammar?.annotation === "yellow-marker";
  const labelWidth = strip || tape ? Math.round(g.width * 0.86) : g.width;
  const { fps } = useClock();
  const mark = useRamp(3 / fps, 17);
  return (
    <>
      <Reveal
        motion={motion}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          ...(strip
            ? {
                background: theme.text,
                paddingLeft: 12,
                width: labelWidth,
                height: 34,
              }
            : {}),
          ...(tape
            ? {
                background: "#DDD2AC",
                paddingLeft: 12,
                width: labelWidth,
                height: 34,
                transformOrigin: "0 50%",
              }
            : {}),
          ...(board
            ? { borderBottom: `2px solid ${theme.border}`, height: 34 }
            : {}),
        }}
      >
        <FitText
          text={kicker}
          theme={theme}
          role="label"
          width={labelWidth - (strip || tape ? 24 : 0)}
          height={32}
          size={23}
          min={18}
          lines={1}
          color={
            strip
              ? theme.accent
              : grammar
                ? (theme.accentInk ?? theme.accent)
                : theme.dim
          }
          align={board ? "center" : undefined}
        />
      </Reveal>
      <Reveal
        motion={motion}
        order={1}
        style={{ position: "absolute", left: 0, top: g.titleTop ?? 36 }}
      >
        <FitText
          text={title}
          theme={theme}
          role="title"
          width={g.width}
          height={g.titleHeight}
          size={
            g.compact
              ? 44
              : grammar?.typography === "heavy-poster"
                ? 76
                : grammar?.typography === "naskh-receipt"
                  ? 78
                  : 66
          }
          min={28}
          lines={2}
          align={board ? "center" : undefined}
        />
      </Reveal>
      {marked ? (
        <svg
          aria-hidden="true"
          width={Math.round(g.width * 0.7)}
          height={14}
          style={{
            position: "absolute",
            left: grammar?.annotation === "brush-rule" ? g.width * 0.3 : 0,
            top: g.bodyTop - 20,
          }}
          viewBox="0 0 600 14"
          preserveAspectRatio="none"
        >
          <path
            d={
              grammar?.annotation === "brush-rule"
                ? "M 5 9 Q 270 1 593 6"
                : "M 5 8 L 593 5"
            }
            pathLength={1}
            stroke={theme.accent}
            strokeWidth={grammar?.annotation === "brush-rule" ? 5 : 10}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={1}
            strokeDashoffset={1 - mark}
          />
        </svg>
      ) : null}
      {strip ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: g.bodyTop - 18,
            width: g.width * mark,
            height: 8,
            background: theme.accent,
          }}
        />
      ) : null}
    </>
  );
};

export const SceneCard: React.FC<{
  theme: SceneTheme;
  motion: MotionVariant;
  order?: number;
  left?: number;
  top: number;
  width: number;
  height: number;
  children: React.ReactNode;
}> = ({ theme, motion, order = 2, left = 0, top, width, height, children }) => {
  const card = theme.grammar?.card;
  const probe=useProbe();
  const slab=card==='bevel-slab';
  const treatment: React.CSSProperties =
    card === "ink-frame"
      ? {
          borderRadius: 0,
          border: `3px solid ${theme.border}`,
          boxShadow: `7px 7px 0 ${theme.border}`,
        }
      : card === "receipt-sheet"
        ? {
            borderRadius: 2,
            border: `1px solid ${theme.border}`,
            borderTop: `3px solid ${theme.text}`,
            borderBottom: `3px dotted ${theme.border}`,
          }
        : card === "taped-paper"
          ? {
              borderRadius: 1,
              border: "4px solid #FFFFFF",
              outline: `1px solid ${theme.border}`,
              boxShadow: "5px 6px 0 #BAB8AA",
              transform: `rotate(${order % 2 === 0 ? -0.6 : 0.6}deg)`,
            }
          : card === "verdict-board"
            ? {
                borderRadius: 2,
                border: `1px solid ${theme.border}`,
                borderTop: `4px solid ${theme.border}`,
              }
            : card === "offset-plate"
              ? {
                  borderRadius: 0,
                  border: `2px solid ${theme.border}`,
                  boxShadow: `7px 7px 0 ${theme.border}`,
                  transform: `rotate(${order % 2 === 0 ? -0.4 : 0.4}deg)`,
                }
              : {};
  const modernTreatment:React.CSSProperties=card==='glass-panel'?{
    borderRadius:32,background:'linear-gradient(140deg,#FFFFFF28,#FFFFFF08 65%), #102139B8',border:'1.5px solid #D5F3FF55',
    backdropFilter:probe?undefined:'blur(18px) saturate(150%)',boxShadow:probe?undefined:'inset 2px 2px 0 #FFFFFF40, inset -2px -2px 0 #72D8FF20, 0 15px 30px #00000030',
  }:card==='perforated-ticket'?{borderRadius:16,border:`2px solid ${theme.border}`,borderInlineEnd:`4px dashed ${theme.accent}`,background:`linear-gradient(110deg,${theme.card},#463021)`,boxShadow:probe?undefined:'0 14px 28px #00000035'}
    :card==='magazine-rule'?{borderRadius:0,border:0,borderInlineStart:`5px solid ${theme.accent}`,background:'transparent'}
    :card==='route-paper'?{borderRadius:2,border:`2px solid ${theme.border}`,boxShadow:probe?undefined:'5px 6px 0 #B6AC984A',transform:`rotate(${order%2===0?-0.6:0.6}deg)`}
    :slab?{borderRadius:SLAB.radius,border:0,boxShadow:probe?undefined:`${SLAB.bevel}, ${SLAB.shadow}`}:{};
  return (
    <Reveal
      motion={motion}
      order={order}
      style={{ position: "absolute", left, top, width, height }}
    >
      <div
        style={{
          position: "relative",
          width,
          height,
          borderRadius: 26,
          border: `2px solid ${theme.border}`,
          boxSizing: "border-box",
          background: theme.card,
          ...treatment,
          ...modernTreatment,
        }}
      >
        {card === "taped-paper" || card==='route-paper' ? (
          <>
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: -10,
                left: 18,
                width: 62,
                height: 19,
                background: "#D8CCA4",
                transform: "rotate(-4deg)",
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: -10,
                right: 18,
                width: 62,
                height: 19,
                background: "#D8CCA4",
                transform: "rotate(4deg)",
              }}
            />
          </>
        ) : null}
        {card === "offset-plate" ? (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: Math.round(width * 0.25),
              height: 7,
              background: theme.accent,
            }}
          />
        ) : null}
        {slab ? <div aria-hidden="true" style={{ position: "absolute", inset: SLAB.inset, borderRadius: SLAB.innerRadius, background: SLAB.screen }} /> : null}
        {children}
      </div>
    </Reveal>
  );
};


export const SceneCaption: React.FC<{
  text: string;
  theme: SceneTheme;
  center: number;
}> = ({ text, theme, center }) => {
  const caption = theme.grammar?.caption;
  const naskh = theme.ar === FAMILY.naskh;
  const pill = React.useMemo(() => {
    assertFontsReady();
    return fitPillToSafeWidth(
      text,
      { fontFamily: theme.ar, fontSize: 44, fontWeight: 700 },
      {
        top: center - 48,
        padding: { x: 28, y: 14 },
        min: 27,
        max: 44,
        inset: 30,
        shadow: 0,
        lineHeight: naskh ? 1.7 : 1.35,
      },
    );
  }, [text, theme.ar, center, naskh]);
  if (!pill.fits)
    throw new Error(
      `creative-kit: caption cannot fit safely: ${JSON.stringify(text)}. Shorten or split the clause.`,
    );
  return (
    <div
      style={{
        position: "absolute",
        left: px(pill.band.left + (pill.band.width - pill.width) / 2),
        top: px(center - pill.height / 2),
        width: pill.width,
        height: pill.height,
        borderRadius:
          caption === "ink-strip" ? 7 : caption === "paper-label" ? 0 : 24,
        background: theme.pill,
        ...(caption === "paper-label"
          ? { outline: `1px solid ${theme.border}` }
          : {}),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          ...pill.style,
          color: theme.pillText,
          ...(caption === "boxless"
            ? {
                textShadow:
                  theme.grammar?.composition === "two-column-board"
                    ? "0 2px 2px #171C24, 1px 0 1px #171C24, -1px 0 1px #171C24"
                    : "0 2px 2px #FFFCF5, 1px 0 1px #FFFCF5, -1px 0 1px #FFFCF5",
              }
            : {}),
        }}
      >
        {text}
      </span>
    </div>
  );
};
