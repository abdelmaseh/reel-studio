import React from "react";
import type { LookKind } from "../../looks/index.ts";
import type { PanelProps } from "../panels.ts";
import * as ops from "../ops/index.ts";
import { NoticeBar, Section, memoWithoutPlayhead, useNotice, useRunner } from "./kit.tsx";
import {
  DIGITS_VALUES, GROUPING_LABEL, LOOK_EFFECT_LABEL, LOOK_TEXT, PRESENTATION_LABEL, SKIN_LABEL, digitsLabel, digitsPatchValue, fontLabel, inksWith, lookChange, lookReset, type LookCommand,
} from "./look-state.ts";

const LookPanelBody: React.FC<PanelProps> = ({ manifest, apply }) => {
  const { notice, show, clear } = useNotice();
  const run = useRunner(apply, show);
  const view = ops.lookView(manifest);
  const go = (command: LookCommand) => run(command.label, command.fn, command.options);
  const change = (key: ops.LookKey, patch: ops.LookPatch) => go(lookChange(key, patch));
  const reset = (key: ops.LookKey) => go(lookReset(key));

  const captionNote = view.graphics ? LOOK_TEXT.graphicsNote : !view.captionsShown ? LOOK_TEXT.hiddenNote : null;
  const groupingNote = captionNote ?? (view.grouping.ignored ? LOOK_TEXT.phrasesNote : null);
  const digitsValue = view.digits.value ?? "auto";

  return (
    <div className="lk" dir="rtl">
      <NoticeBar notice={notice} onClose={clear} />
      <Section title={LOOK_TEXT.title}>
        <p className="pk-muted">{LOOK_TEXT.hint}</p>
        <dl className="lk-style">
          <dt>{LOOK_TEXT.style}</dt>
          <dd dir="ltr">{view.style}</dd>
        </dl>
        <p className="pk-muted">{LOOK_TEXT.styleNote}</p>
      </Section>

      <Section title={LOOK_TEXT.font}>
        <div className="lk-row">
          <select aria-label={LOOK_TEXT.font} value={view.font.value ?? ""}
            onChange={(e) => { if (e.target.value) change("fontFamily", { fontFamily: e.target.value as ops.LookPatch["fontFamily"] }); }}>
            {view.font.value === null ? <option value="">{`${LOOK_TEXT.fontDefault} (${fontLabel(view.font.styleDefault)})`}</option> : null}
            {ops.LOOK_OPTIONS.fonts.map((font) => <option key={font} value={font}>{fontLabel(font)}</option>)}
          </select>
          <button type="button" aria-label={`${LOOK_TEXT.reset}: ${LOOK_TEXT.font}`} disabled={view.font.value === null || view.font.value === view.font.styleDefault}
            onClick={() => reset("fontFamily")}>{LOOK_TEXT.reset}</button>
        </div>
        <p className="pk-muted">{LOOK_TEXT.fontNote}</p>
      </Section>

      <Section title={LOOK_TEXT.grouping}>
        <div className="lk-row">
          <select aria-label={LOOK_TEXT.grouping} value={view.grouping.effective} disabled={groupingNote !== null}
            onChange={(e) => change("captionsGrouping", { captionsGrouping: e.target.value as ops.LookPatch["captionsGrouping"] })}>
            {ops.LOOK_OPTIONS.groupings.map((grouping) => <option key={grouping} value={grouping}>{GROUPING_LABEL[grouping]}</option>)}
          </select>
          <button type="button" aria-label={`${LOOK_TEXT.reset}: ${LOOK_TEXT.grouping}`} disabled={groupingNote !== null || view.grouping.value === null}
            onClick={() => reset("captionsGrouping")}>{LOOK_TEXT.reset}</button>
        </div>
        {groupingNote ? <p className="lk-note">{groupingNote}</p> : view.font.value === null ? <p className="pk-muted">{LOOK_TEXT.clausesNote}</p> : null}
      </Section>

      <Section title={LOOK_TEXT.presentation}>
        <div className="lk-row">
          <select aria-label={LOOK_TEXT.presentation} value={view.presentation.effective} disabled={captionNote !== null || view.skin.value !== null}
            onChange={(e) => change("captionsPresentation", { captionsPresentation: e.target.value as ops.LookPatch["captionsPresentation"] })}>
            {ops.LOOK_OPTIONS.presentations.map((shape) => <option key={shape} value={shape}>{PRESENTATION_LABEL[shape]}</option>)}
          </select>
          <button type="button" aria-label={`${LOOK_TEXT.reset}: ${LOOK_TEXT.presentation}`} disabled={captionNote !== null || view.presentation.effective === view.presentation.styleDefault}
            onClick={() => reset("captionsPresentation")}>{LOOK_TEXT.reset}</button>
        </div>
        {captionNote ? <p className="lk-note">{captionNote}</p> : null}
      </Section>

      <Section title={LOOK_TEXT.skin}>
        <div className="lk-row">
          <select aria-label={LOOK_TEXT.skin} value={view.skin.value ?? ''} disabled={captionNote !== null}
            onChange={(e) => change('captionsSkin', {captionsSkin: (e.target.value || null) as ops.LookPatch['captionsSkin']})}>
            <option value="">{LOOK_TEXT.reset}</option>
            {ops.LOOK_OPTIONS.skins.map((skin) => <option key={skin} value={skin}>{SKIN_LABEL[skin]}</option>)}
          </select>
          <button type="button" aria-label={`${LOOK_TEXT.reset}: ${LOOK_TEXT.skin}`} disabled={captionNote !== null || view.skin.value === null} onClick={() => reset('captionsSkin')}>{LOOK_TEXT.reset}</button>
        </div>
        <p className="pk-muted">{captionNote ?? LOOK_TEXT.skinNote}</p>
      </Section>

      <Section title={LOOK_TEXT.digits}>
        <div className="lk-row">
          <select aria-label={LOOK_TEXT.digits} value={digitsValue} onChange={(e) => change("digits", { digits: digitsPatchValue(e.target.value) })}>
            {DIGITS_VALUES.map((value) => <option key={value} value={value}>{digitsLabel(value)}</option>)}
          </select>
          <button type="button" aria-label={`${LOOK_TEXT.resetDigits}: ${LOOK_TEXT.digits}`} disabled={view.digits.value === null}
            onClick={() => reset("digits")}>{LOOK_TEXT.resetDigits}</button>
        </div>
        <p className="pk-muted">{LOOK_TEXT.digitsNote}</p>
      </Section>

      <Section title={LOOK_TEXT.look}>
        <div className="lk-row">
          <select aria-label={LOOK_TEXT.look} value={view.look.kind ?? "none"}
            onChange={(e) => { if (e.target.value === "none") reset("look"); else change("look", { look: { kind: e.target.value as LookKind } }); }}>
            <option value="none">{LOOK_EFFECT_LABEL.none}</option>
            {ops.LOOK_OPTIONS.looks.map((kind) => <option key={kind} value={kind}>{LOOK_EFFECT_LABEL[kind]}</option>)}
          </select>
          <button type="button" aria-label={`${LOOK_TEXT.lookOff}: ${LOOK_TEXT.look}`} disabled={view.look.value === null} onClick={() => reset("look")}>{LOOK_TEXT.lookOff}</button>
        </div>
        {view.look.kind === "riso" ? (
          <div className="lk-row lk-inks">
            {([0, 1] as const).map((index) => {
              const name = index === 0 ? LOOK_TEXT.inkOne : LOOK_TEXT.inkTwo;
              return (
                <label key={index} className="lk-ink">
                  <span>{name}</span>
                  <input type="color" aria-label={name} value={view.look.inks[index]}
                    onChange={(e) => change("look", { look: { kind: "riso", inks: inksWith(view.look.inks, index, e.target.value) } })} />
                  <code dir="ltr">{view.look.inks[index]}</code>
                </label>
              );
            })}
            <button type="button" aria-label={`${LOOK_TEXT.inksDefault}`} disabled={!view.look.custom} onClick={() => change("look", { look: { kind: "riso" } })}>{LOOK_TEXT.inksDefault}</button>
          </div>
        ) : null}
        {view.look.kind === "riso" ? <p className="pk-muted">{LOOK_TEXT.inksNote}</p> : null}
        <p className="pk-muted">{LOOK_TEXT.lookNote}</p>
      </Section>
    </div>
  );
};

export const LookPanel = memoWithoutPlayhead(LookPanelBody);
