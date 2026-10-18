import React from "react";
import {formatNumber} from "../../core/numbers.ts";
import {fitTextLayout, type SceneTheme} from "../../creative-kit/primitives.tsx";
import {
  ConceptStage, ConceptText, Dressing, alpha, digitsFor, dirOf, numberFont,
  rectStyle, styleShape, surfaceShadow, tint, uiColors, useConcept, useConceptDigits, useConceptTimeline,
} from "../shared.tsx";
import type {Rect} from "../geometry.ts";
import type {ConceptSceneProps} from "../types.ts";
import {MIN_FRAMES, layoutFor, stateAt, type FilteringCardState} from "./math.ts";
import {identityFilteringSchema, type FilteringCriterion, type IdentityFilteringData} from "./schema.ts";

const statusPath = (status: FilteringCardState["status"]): string => status === "rejected"
  ? "M8 8L24 24M24 8L8 24"
  : status === "retained" ? "M6 17L13 24L27 8" : "M8 16H24M18 10L24 16L18 22";

const TextBox: React.FC<{
  rect: Rect; text: string; theme: SceneTheme; color?: string; size?: number; min?: number; lines?: number; align?: "left" | "right" | "center";
}> = ({rect, text, theme, color, size = 30, min = 22, lines = 1, align}) => (
  <div style={{...rectStyle(rect), display: "flex", alignItems: "center", justifyContent: align === "center" ? "center" : undefined}}>
    <ConceptText text={text} theme={theme} role="body" width={rect.width} height={rect.height} size={size} min={min} lines={lines} color={color} align={align} />
  </div>
);

/** Arabic-indic digits are weak bidi characters: an LTR paragraph alone can still reverse their separators. */
const NumericExpression: React.FC<{children: string; style?: React.CSSProperties}> = ({children, style}) => (
  <bdi dir="ltr" style={{...style, direction: "ltr", unicodeBidi: "isolate-override", display: "inline-block"}}>{children}</bdi>
);

const NumericText: React.FC<{
  text: string; theme: SceneTheme; width: number; height: number; color: string; size?: number; min?: number; align?: "left" | "right" | "center";
}> = ({text, theme, width, height, color, size = 20, min = 14, align = "center"}) => {
  const fit = fitTextLayout({text, theme, width, height, size, min, lines: 1, role: "body"});
  if (!fit.fits || fit.height > height) throw new Error(`identity-filtering: numeric expression does not fit its ${width}x${height}px box: ${JSON.stringify(text)}`);
  return <NumericExpression style={{...fit.style, width, color, textAlign: align, whiteSpace: "pre", fontSynthesis: "none", fontVariantNumeric: "tabular-nums"}}>{text}</NumericExpression>;
};

const typedValueText = (value: number | boolean, digits: ReturnType<typeof digitsFor>): string => typeof value === "boolean"
  ? (value ? "✓" : "×")
  : formatNumber(value, {digits, decimals: String(value).split(".")[1]?.length ?? 0, grouping: false});
const predicateText = (criterion: FilteringCriterion, digits: ReturnType<typeof digitsFor>): string => {
  const op = criterion.op === "gte" ? "≥" : criterion.op === "lte" ? "≤" : "=";
  return `${op} ${typedValueText(criterion.value, digits)}`;
};

const Scene: React.FC<{data: IdentityFilteringData}> = ({data}) => {
  const {theme, box, mode} = useConcept();
  const {frame, duration} = useConceptTimeline(MIN_FRAMES);
  const rtl = dirOf(`${data.title} ${data.cards.map(({label}) => label).join(" ")}`) === "rtl";
  const L = layoutFor(box, data.cards.length, data.criteria.length, rtl);
  const S = stateAt(frame, duration, {data, box, mode, rtl});
  const shape = styleShape(theme);
  const colors = uiColors(theme);
  const digits = useConceptDigits(data.title);
  const numFont = numberFont(theme, digits);
  const number = (value: number): string => formatNumber(value, {digits, grouping: false});
  const cardRadius = Math.min(shape.windowRadius, 20);
  const left = L.region.x;
  const right = L.region.x + L.region.width;
  const footerLabel = S.resolved > 0 ? data.retainedLabel : data.sourceLabel;

  return (
    <div data-concept="identity-filtering" style={{position: "absolute", inset: 0, opacity: S.presence}}>
      <TextBox rect={L.title} text={data.title} theme={theme} size={48} min={32} align={rtl ? "right" : "left"} />

      {data.criteria.map((criterion, i) => {
        const rect = L.criteria[i];
        const state = S.criteria[i];
        const fill = state.active ? colors.accentFill : theme.card;
        const ink = state.active ? colors.onAccentFill : theme.text;
        const ring = state.active || state.completed ? colors.accentFill : theme.border;
        const badgeSize = 28;
        return (
          <div key={criterion.id} data-criterion-id={criterion.id} style={{...rectStyle(rect), borderRadius: cardRadius, background: fill, boxShadow: `0 0 0 ${shape.ring}px ${ring}`, overflow: "hidden"}}>
            <div style={{position: "absolute", left: 14, top: 11, width: badgeSize, height: badgeSize, border: `1.5px solid ${ink}`, borderRadius: shape.pillK * badgeSize / 2, color: ink, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: numFont, fontWeight: 700, fontSize: 20}}>
              <NumericExpression>{state.completed ? "✓" : number(i + 1)}</NumericExpression>
            </div>
            <div style={{...rectStyle({x: 54, y: 11, width: rect.width - 146, height: 28}), display: "flex", alignItems: "center"}}>
              <NumericText text={predicateText(criterion, digits)} theme={theme} color={ink} width={rect.width - 146} height={28} />
            </div>
            <div style={{position: "absolute", right: 14, top: 11, height: 28, color: ink, fontFamily: numFont, fontSize: 20, display: "flex", alignItems: "center"}}>
              <NumericExpression>{state.completed ? `${number(state.inputCount)} → ${number(state.retainedCount)}` : `${number(i + 1)} / ${number(data.criteria.length)}`}</NumericExpression>
            </div>
            <TextBox rect={{x: 14, y: 44, width: rect.width - 28, height: 74}} text={criterion.label} theme={theme} color={ink} size={data.criteria.length === 3 ? 26 : 30} min={22} lines={2} align="center" />
            <div style={{position: "absolute", bottom: 0, left: rtl ? undefined : 0, right: rtl ? 0 : undefined, width: rect.width * state.progress, height: 4, background: state.active ? ink : colors.accentFill}} />
          </div>
        );
      })}

      <TextBox rect={L.laneLabels[0]} text={S.resolved > 0 ? data.retainedLabel : data.sourceLabel} theme={theme} size={27} min={22} align="center" />
      <TextBox rect={L.laneLabels[1]} text={data.rejectedLabel} theme={theme} size={27} min={22} align="center" />

      <Dressing>
        <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{position: "absolute", inset: 0, overflow: "visible"}} aria-hidden="true">
          {L.rows.map((row, i) => {
            const y = row.y + row.height / 2;
            return <g key={data.cards[i].id}>
              <path d={`M${left + 18} ${y}H${right - 18}`} stroke={alpha(theme.dim, .24)} strokeWidth="2" strokeDasharray="5 10" fill="none" />
              <path d={`M${L.gateX} ${y - 12}L${L.gateX + 12} ${y}L${L.gateX} ${y + 12}L${L.gateX - 12} ${y}Z`} fill={theme.background} stroke={alpha(theme.dim, .4)} strokeWidth="2" />
            </g>;
          })}
        </svg>
      </Dressing>

      {S.cards.map((state, i) => {
        const card = data.cards[i];
        const rejected = state.status === "rejected";
        const retained = state.status === "retained";
        const ink = rejected ? theme.badInk ?? theme.text : theme.text;
        const ring = rejected ? theme.bad : retained ? colors.accentFill : theme.border;
        const fill = retained ? tint(theme.card, colors.accentFill, .08) : theme.card;
        const w = state.rect.width;
        const statusX = rtl ? 12 : w - 42;
        const labelX = rtl ? 50 : 16;
        const idX = rtl ? w - 146 : 16;
        const evidenceX = rtl ? 16 : 160;
        const marker = rejected ? `× ${number(state.rejectedAt + 1)}` : retained ? `✓ ${number(state.criterionIndex + 1)}` : number(state.criterionIndex + 1);
        return (
          <div key={card.id} data-card-id={card.id} data-status={state.status} data-rejected-at={state.rejectedAt} style={{...rectStyle(state.rect), borderRadius: cardRadius, background: fill, boxShadow: surfaceShadow(theme, ring), opacity: state.presence, overflow: "hidden"}}>
            <svg width="30" height="30" viewBox="0 0 32 32" style={{position: "absolute", left: statusX, top: 7}} aria-hidden="true">
              <path d={statusPath(state.status)} stroke={rejected ? theme.bad : retained ? colors.accentFill : theme.dim} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <TextBox rect={{x: labelX, y: 4, width: w - 66, height: 36}} text={card.label} theme={theme} color={ink} size={30} min={22} align={rtl ? "right" : "left"} />
            <TextBox rect={{x: idX, y: 43, width: 130, height: 24}} text={card.id} theme={theme} color={theme.dim} size={21} min={14} align={rtl ? "right" : "left"} />
            <div style={{position: "absolute", left: evidenceX, top: 43, height: 24, width: w - 176, display: "flex", alignItems: "center", justifyContent: rtl ? "flex-start" : "flex-end", gap: 10, fontFamily: numFont, fontSize: 20, color: ink, fontVariantNumeric: "tabular-nums"}}>
              <NumericText text={typedValueText(state.value, digits)} theme={theme} width={w - 230} height={24} color={ink} align={rtl ? "left" : "right"} />
              <span style={{border: `1px solid ${ring}`, borderRadius: shape.pillK * 10, padding: "0 5px", fontSize: 17, lineHeight: "21px"}}><NumericExpression>{marker}</NumericExpression></span>
            </div>
          </div>
        );
      })}

      <div style={{...rectStyle(L.footer), borderTop: `2px solid ${theme.border}`}}>
        <TextBox rect={{x: rtl ? 166 : 0, y: 10, width: L.footer.width - 166, height: 40}} text={footerLabel} theme={theme} size={29} min={24} align={rtl ? "right" : "left"} />
        <div style={{position: "absolute", left: rtl ? 0 : undefined, right: rtl ? undefined : 0, top: 6, height: 44, display: "flex", alignItems: "center", fontFamily: numFont, color: theme.text, fontSize: 36, fontWeight: 700, fontVariantNumeric: "tabular-nums"}}>
          <NumericExpression>{`${number(S.remainingCount)} / ${number(data.cards.length)}`}</NumericExpression>
        </div>
      </div>
    </div>
  );
};

export const IdentityFiltering: React.FC<ConceptSceneProps<IdentityFilteringData>> = ({style, data, mode = "once", backdrop, caption}) => {
  if (mode !== "once") throw new RangeError("identity-filtering supports once mode only");
  const validated = identityFilteringSchema.parse(data);
  return <ConceptStage style={style} mode={mode} backdrop={backdrop} caption={caption}><Scene data={validated} /></ConceptStage>;
};
