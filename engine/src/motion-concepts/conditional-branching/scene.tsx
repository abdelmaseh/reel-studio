import React from "react";
import { formatNumber, type DigitSet } from "../../core/numbers";
import { FRAME } from "../../core/safe";
import { measure } from "../../core/type";
import { fitTextLayout, type SceneTheme } from "../../creative-kit/primitives";
import {
  Bidi, ConceptStage, ConceptText, Dressing, alpha, dirOf, numberFont,
  rectStyle, styleShape, surfaceShadow, tint, uiColors, useConcept, useConceptDigits, useConceptTimeline,
} from "../shared";
import type { ConceptSceneProps } from "../types.ts";
import { MIN_FRAMES, layoutFor, stateAt, type BranchingLayout, type ConditionalBranchingState, type RoutePath } from "./math.ts";
import { conditionalBranchingSchema, type ConditionalBranchingData } from "./schema.ts";

/** Keep every supplied digit: a rounded display must not contradict the predicate. */
const valueLabel = (value: number | boolean, arabic: boolean, digits: DigitSet): string => {
  if (typeof value === "boolean") return arabic ? (value ? "نعم" : "لا") : (value ? "true" : "false");
  const raw = String(value);
  const places = raw.includes("e") ? 7 : (raw.split(".")[1]?.length ?? 0);
  if (places <= 6) return formatNumber(value, { digits, decimals: places, grouping: false });
  return digits === "latin" ? raw : raw.replace(/[0-9.]/g, (character) => character === "." ? "٫" : "٠١٢٣٤٥٦٧٨٩"[Number(character)]);
};

/** Keep normal word wrapping first; only an overlong word needs a grapheme-safe line break. */
const fitCopyLabel = (text: string, theme: SceneTheme, width: number, height: number, size = 30, minimum = 20) => {
  const normal = fitTextLayout({text, theme, width, height, size, min: minimum, lines: 2, role: "body"});
  if (normal.fits && normal.height <= height) return normal;
  const clean = text.trim().replace(/\s+/g, " ");
  const graphemes = [...new Intl.Segmenter(undefined, {granularity: "grapheme"}).segment(clean)].map(({segment}) => segment);
  // Only an overlong word can go below the normal minimum; every supplied character stays visible.
  for (let size = minimum; size >= 14; size--) {
    const lineBox = Math.ceil(size * normal.lineHeight);
    if (lineBox * 2 > height) continue;
    const type = {fontFamily: normal.style.fontFamily, fontWeight: normal.style.fontWeight, fontSize: size, letterSpacing: 0, fontVariantNumeric: "tabular-nums"};
    let best: {lines: string[]; width: number; score: number} | undefined;
    for (let at = 1; at < graphemes.length; at++) {
      const a = graphemes.slice(0, at).join("").trimEnd(), b = graphemes.slice(at).join("").trimStart();
      if (!a || !b) continue;
      const widths = [measure(a, type).width, measure(b, type).width];
      if (widths.some(value => value > width)) continue;
      const wordBoundary = graphemes[at - 1] === " " || graphemes[at] === " ";
      const score = (wordBoundary ? 0 : 10_000) + Math.abs(widths[0] - widths[1]);
      if (!best || score < best.score) best = {lines: [a, b], width: Math.max(...widths), score};
    }
    if (best) return {...normal, lines: best.lines, width: best.width, height: lineBox * 2, fits: true, fontSize: size, lineBox,
      style: {...normal.style, fontSize: size, lineHeight: `${lineBox}px`}};
  }
  throw new Error(`conditional-branching: label cannot fit its box: ${JSON.stringify(text)}`);
};

const TokenLabel: React.FC<{text: string; theme: SceneTheme; width: number}> = ({text, theme, width}) => {
  const height = 66;
  const fit = React.useMemo(() => fitCopyLabel(text, theme, width, height), [text, theme, width]);
  return <div data-token-part="label" data-label-lines={fit.lines.length} data-label-font-size={fit.fontSize}
    style={{position: "absolute", left: 16, top: 4, width, height, display: "flex", flexDirection: "column", justifyContent: "center"}}>
    <div style={{...fit.style, width, color: theme.text, textAlign: "center", fontSynthesis: "none", letterSpacing: 0, direction: dirOf(text), unicodeBidi: "isolate"}}>
      {fit.lines.map((line, index) => <div key={index} style={{whiteSpace: "pre"}}>{line}</div>)}
    </div>
  </div>;
};

const OutcomeLabel: React.FC<{text: string; theme: SceneTheme; width: number; height: number}> = ({text, theme, width, height}) => {
  const fit = React.useMemo(() => fitCopyLabel(text, theme, width, height, 31, 18), [text, theme, width, height]);
  return <div data-copy-part="outcome-label" data-copy-lines={fit.lines.length} data-copy-font-size={fit.fontSize}
    style={{width, height, display: "flex", flexDirection: "column", justifyContent: "center"}}>
    <div style={{...fit.style, width, color: theme.text, textAlign: "center", fontSynthesis: "none", letterSpacing: 0, direction: dirOf(text), unicodeBidi: "isolate"}}>
      {fit.lines.map((line, index) => <div key={index} style={{whiteSpace: "pre"}}>{line}</div>)}
    </div>
  </div>;
};

type GraphicProps = { data: ConditionalBranchingData; layout: BranchingLayout; state: ConditionalBranchingState; theme: SceneTheme };

/** Native drawing is separate from the Remotion clock so the whole graphic is inspectable. */
export const ConditionalBranchingGraphic: React.FC<GraphicProps> = ({ data, layout: L, state: S, theme }) => {
  const colors = uiColors(theme), shape = styleShape(theme);
  const copy = [data.input.label, data.condition.label, data.branches.whenTrue, data.branches.whenFalse].join(" ");
  const arabic = dirOf(copy) === "rtl", digits = useConceptDigits(copy);
  const yes = arabic ? "نعم" : "Yes", no = arabic ? "لا" : "No";
  const conditionValue = data.condition.kind === "boolean-equals" ? data.condition.equals : data.condition.threshold;
  const expression = `${data.condition.kind === "boolean-equals" ? "=" : "≥"} ${valueLabel(conditionValue, arabic, digits)}`;
  const result = S.condition.result === null ? (arabic ? "تقييم الشرط" : "Evaluate condition")
    : S.condition.result ? (arabic ? "الشرط متحقق" : "Condition matched") : (arabic ? "الشرط غير متحقق" : "Condition not matched");
  const tokenRect = { x: S.token.x - S.token.width / 2, y: S.token.y - S.token.height / 2, width: S.token.width, height: S.token.height };
  const radius = Math.min(26, shape.windowRadius);
  const idleWire = alpha(theme.dim, 0.48);
  const path = (route: RoutePath, progress: number, key: string, selected: boolean) => (
    <g key={key}>
      <path d={route.d} fill="none" stroke={idleWire} strokeWidth={3} strokeDasharray={selected ? undefined : "7 9"} />
      {progress > 0 ? <path d={route.d} pathLength={1} fill="none" stroke={colors.accentInk} strokeWidth={5}
        strokeDasharray="1 1" strokeDashoffset={1 - progress} /> : null}
    </g>
  );
  return (
    <div data-conditional-branching="graphic" data-selected-route={S.selected ?? "pending"} style={{ opacity: S.presence }}>
      <div style={{ ...rectStyle(L.title), display: "flex", alignItems: "center" }}>
        <ConceptText text={arabic ? "شرط واحد، مسار واحد" : "One condition. One route."} theme={theme} role="title"
          width={L.title.width} height={L.title.height} size={44} min={32} lines={1} align="center" style={{ letterSpacing: 0 }} />
      </div>
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
        aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "visible", strokeLinecap: "round", strokeLinejoin: "round" }}>
        {path(L.approach, S.approach, "approach", true)}
        {path(L.trunk, S.trunk, "trunk", true)}
        <path d={`M${L.condition.x + (arabic ? 0 : L.condition.width)} ${L.gate.y} H${L.gate.x}`}
          fill="none" stroke={tint(theme.border, colors.accentInk, S.condition.evaluation)} strokeWidth={3} strokeDasharray="3 7" />
        {L.branches.map((branch) => {
          const state = S.branches.find((item) => item.key === branch.key)!;
          const index = branch.path.points.findIndex((point) => point.y >= branch.rect.y - 16);
          const p = branch.path.points[Math.max(1, index)], q = branch.path.points[Math.max(0, index - 1)];
          const angle = Math.atan2(p.y - q.y, p.x - q.x) * 180 / Math.PI - 90;
          return <g key={branch.key} data-route={branch.key} data-active={String(state.active)}>
            {path(branch.path, state.progress, branch.key, state.active)}
            <path d="M-8 -10 L0 0 L8 -10" fill="none" stroke={state.active ? colors.accentInk : theme.dim}
              strokeWidth={4} transform={`translate(${p.x} ${p.y}) rotate(${angle})`} />
          </g>;
        })}
        <circle cx={L.fork.x} cy={L.fork.y} r={7} fill={S.selected ? colors.accentInk : theme.dim} />
      </svg>

      <div style={{ ...rectStyle(L.condition), borderRadius: radius, background: theme.card,
        boxShadow: surfaceShadow(theme, tint(theme.border, colors.accentInk, S.condition.evaluation)) }}>
        <div style={{ position: "absolute", left: 20, top: 14 }}>
          <ConceptText text={data.condition.label} theme={theme} role="body" width={L.condition.width - 40} height={46}
            size={36} min={24} lines={1} align="center" style={{ letterSpacing: 0 }} />
        </div>
        <div style={{ position: "absolute", left: 20, top: 65 }}>
          <ConceptText text={expression} theme={theme} role="body" width={L.condition.width - 40} height={58}
            size={48} min={24} lines={1} align="center" color={colors.accentInk}
            style={{ direction: "ltr", fontFamily: numberFont(theme, digits), letterSpacing: 0, fontVariantNumeric: "tabular-nums" }} />
        </div>
        <div style={{ position: "absolute", left: 24, right: 24, top: 130, height: 3, background: alpha(theme.dim, 0.18) }}>
          <div style={{ width: `${100 * S.condition.evaluation}%`, height: "100%", background: colors.accentInk }} />
        </div>
        <div style={{ position: "absolute", left: 20, top: 140 }}>
          <ConceptText text={result} theme={theme} role="body" width={L.condition.width - 40} height={38}
            size={27} min={20} lines={1} align="center" color={theme.text} style={{ letterSpacing: 0 }} />
        </div>
      </div>

      {L.branches.map((branch) => {
        const state = S.branches.find((item) => item.key === branch.key)!;
        return <div key={branch.key} data-outcome={branch.key} data-active={String(state.active)}
          style={{ ...rectStyle(branch.rect), borderRadius: radius, background: tint(theme.card, colors.accentFill, state.active ? 0.13 : 0),
            boxShadow: surfaceShadow(theme, state.active ? colors.accentInk : theme.border) }}>
          <div style={{ position: "absolute", left: arabic ? branch.rect.width - 72 : 16, top: 166, width: 56, height: 32, borderRadius: 16 * shape.pillK,
            background: state.active ? colors.accentFill : alpha(theme.dim, 0.12), color: state.active ? colors.onAccentFill : theme.text,
            display: "flex", alignItems: "center", justifyContent: "center", fontFamily: theme.ar, fontWeight: 700, fontSize: 23 }}>
            <Bidi>{branch.key === "whenTrue" ? yes : no}</Bidi>
          </div>
          <div style={{ position: "absolute", left: branch.label.x - branch.rect.x, top: branch.label.y - branch.rect.y }}>
            <OutcomeLabel text={data.branches[branch.key]} theme={theme} width={branch.label.width} height={branch.label.height}/>
          </div>
          {state.active && S.resolved > 0 ? <div style={{ position: "absolute", top: 2, left: 16, right: 16, height: 3,
            background: colors.accentInk, opacity: S.resolved }} /> : null}
        </div>;
      })}

      <Dressing>
        <div style={{ ...rectStyle({ ...tokenRect, x: tokenRect.x - 8, y: tokenRect.y - 8, width: tokenRect.width + 16, height: tokenRect.height + 16 }),
          border: `2px solid ${alpha(colors.accentInk, 0.16 + 0.18 * S.condition.evaluation)}`, boxSizing: "border-box", borderRadius: radius + 8 }} />
      </Dressing>
      <div data-token-id={S.token.id} style={{ ...rectStyle(tokenRect), borderRadius: radius, background: theme.card,
        boxShadow: surfaceShadow(theme, colors.accentInk) }}>
        <TokenLabel text={S.token.label} theme={theme} width={S.token.width - 32}/>
        <div style={{ position: "absolute", left: 16, top: 72 }}>
          <ConceptText text={valueLabel(S.token.value, arabic, digits)} theme={theme} role="body" width={S.token.width - 32} height={34}
            size={29} min={17} lines={1} align="center" color={colors.accentInk}
            style={{ direction: "ltr", fontFamily: numberFont(theme, digits), letterSpacing: 0, fontVariantNumeric: "tabular-nums" }} />
        </div>
        <div style={{ position: "absolute", left: 14, top: 111 }}>
          <ConceptText text={S.token.id} theme={theme} role="body" width={S.token.width - 28} height={20}
            size={17} min={12} lines={1} align="center" color={theme.dim} style={{ letterSpacing: 0, fontFamily: theme.display }} />
        </div>
      </div>
    </div>
  );
};

const Scene: React.FC<{ data: ConditionalBranchingData }> = ({ data }) => {
  const { theme, box, mode } = useConcept();
  const { frame, duration } = useConceptTimeline(MIN_FRAMES);
  const rtl = dirOf([data.input.label, data.condition.label, data.branches.whenTrue, data.branches.whenFalse].join(" ")) === "rtl";
  return <ConditionalBranchingGraphic data={data} theme={theme} layout={layoutFor(box, rtl)} state={stateAt(frame, duration, { data, box, rtl, mode })} />;
};

export const ConditionalBranching: React.FC<ConceptSceneProps<ConditionalBranchingData>> = ({ data, ...props }) => (
  <ConceptStage {...props}><Scene data={conditionalBranchingSchema.parse(data)} /></ConceptStage>
);
