// The middle-band cards. Each kind is a small component that reads its beats from the stage (word anchors resolved on the compiled words)
// and draws inside the shared shell. All copy is the creator's; item 0 of every row sits on the right (RTL).
import React from 'react';
import {FAMILY} from '../../../../core/fonts';
import {CARD, CARD_LAYOUT, EASE, anchorFrame, termFontSize, type CardT, type WordAnchor} from '../math.ts';
import type {CartoonCard} from '../schema';
import type {Stage} from '../scene';
import {Check, X} from 'lucide-react';
import {Img, OffthreadVideo, Sequence, staticFile} from 'remotion';
import {useProbe} from '../../../../core/safe';
import {CardBox, CardGroup, EDITOR_FILL, Icon, Label, Mono, Pill, Shp, Stamp, Tile, TrafficLights, pop, sec, typedChars} from './card-shell';

type CardOf<K extends CardT['kind']> = CardT & {kind: K; data: Extract<CartoonCard, {kind: K}>['data']};
/** A beat of a card as a scene frame: its word anchor when the author gave one and the word resolves, else the fallback. */
export const beatFrame = (stage: Stage, anchor: WordAnchor | undefined, fallback: number): number => {
  if (!anchor) return fallback;
  const frame = anchorFrame(anchor, stage.wordsIndex, stage.fps);
  return frame === null ? fallback : frame - stage.sceneFrom;
};
const isLatin = (text: string): boolean => /[A-Za-z]/.test(text) && !/[؀-ۿ]/.test(text);

const Term: React.FC<{stage: Stage; card: CardOf<'term'>}> = ({stage, card}) => {
  const L = CARD_LAYOUT.term, ink = stage.ink, d = card.data, latin = isLatin(d.term);
  return <CardBox stage={stage} card={card} {...L}>
    {d.tag ? <Mono color={ink.dim} style={{position: 'absolute', left: 24, top: 18}}>{d.tag}</Mono> : null}
    <div dir={latin ? 'ltr' : 'rtl'} style={{position: 'absolute', left: 0, right: 0, top: 50, textAlign: 'center', whiteSpace: 'nowrap', fontFamily: latin ? FAMILY.latinSerif : FAMILY.plexDisplay,
      fontStyle: latin ? 'italic' : 'normal', fontWeight: latin ? 400 : 700, fontSize: termFontSize(d.term, latin), color: ink.accentInk, fontSynthesis: 'none', lineHeight: 1.1}}>{d.term}</div>
    <div style={{position: 'absolute', right: 24, bottom: 20, display: 'flex', gap: 16, flexDirection: 'row-reverse'}}>
      {d.glyphs.map((g, i) => <div key={i} style={{transform: `scale(${pop(stage, card.startFrame + sec(stage, 0.05 + 0.12 * i)).toFixed(3)})`}}><Shp shape={g} size={36} color={ink.accent} /></div>)}
    </div>
  </CardBox>;
};

const Windows: React.FC<{stage: Stage; card: CardOf<'windows'>}> = ({stage, card}) => {
  const L = CARD_LAYOUT.windows, ink = stage.ink, d = card.data;
  const rightAt = beatFrame(stage, d.rightAt, card.startFrame), leftAt = beatFrame(stage, d.leftAt, card.startFrame + sec(stage, 0.9)), linkAt = beatFrame(stage, d.linkAt, leftAt + sec(stage, 0.9));
  const win = (x: number, w: {name: string; tag?: string}, p: number) => <Tile stage={stage} x={x} y={0} w={300} h={250} p={p} radius={22}>
    <div style={{padding: 14}}><TrafficLights /></div>
    <Label color={ink.ink} size={34} style={{textAlign: 'center', marginTop: 30}}>{w.name}</Label>
    {w.tag ? <Mono color={ink.dim} size={18} style={{textAlign: 'center', marginTop: 10}}>{w.tag}</Mono> : null}
  </Tile>;
  const linkP = pop(stage, linkAt);
  return <CardGroup stage={stage} card={card} {...L}>
    {win(480, d.right, pop(stage, rightAt))}
    {win(0, d.left, pop(stage, leftAt))}
    {linkP > 0 ? <svg width={L.w} height={L.h} style={{position: 'absolute', left: 0, top: 0}}><path d="M 478 125 L 302 125" stroke={ink.accent} strokeWidth={6} strokeDasharray="14 12" fill="none" opacity={Math.min(1, linkP).toFixed(3)} /></svg> : null}
    {d.linkLabel ? <Pill ink={ink} x={390} y={76} p={pop(stage, linkAt + sec(stage, 0.15))} accent>{d.linkLabel}</Pill> : null}
  </CardGroup>;
};

const Fan: React.FC<{stage: Stage; card: CardOf<'fan'>}> = ({stage, card}) => {
  const L = CARD_LAYOUT.fan, ink = stage.ink, d = card.data, n = d.items.length;
  const rots = n === 2 ? [5, -5] : n === 3 ? [7, 0, -7] : [9, 3, -3, -9];
  const hits = d.items.map((_, i) => beatFrame(stage, d.hitAt?.[i], -1e9));
  return <CardGroup stage={stage} card={card} {...L}>
    {d.items.map((item, i) => {
      const p = pop(stage, card.startFrame + sec(stage, 0.1 * i)), x = L.w - 240 - i * ((L.w - 240) / Math.max(1, n - 1));
      const grow = 0.6 + 0.4 * pop(stage, hits[i]);
      return <Tile key={i} stage={stage} x={x} y={10} w={240} h={330} p={p} rot={rots[i]} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 34}}>
        <Icon name={item.icon} size={56} color={ink.ink} />
        <Label color={ink.ink} size={32}>{item.name}</Label>
        {item.shape ? <div style={{transform: `scale(${grow.toFixed(3)})`}}><Shp shape={item.shape} size={40} color={ink.accent} /></div> : null}
      </Tile>;
    })}
    {d.caption ? <Pill ink={ink} x={L.w / 2} y={-16} p={pop(stage, Math.max(card.startFrame + sec(stage, 0.1 * n + 0.2), ...hits.filter((h) => h > 0)))}>{d.caption}</Pill> : null}
  </CardGroup>;
};

const Code: React.FC<{stage: Stage; card: CardOf<'code'>}> = ({stage, card}) => {
  const L = CARD_LAYOUT.code, d = card.data;
  const lines = d.lines.map((line) => ({...line, from: beatFrame(stage, line.at, card.startFrame)}));
  const done = lines.filter((l) => stage.frame >= l.from + sec(stage, 0.45)).length;
  return <CardBox stage={stage} card={card} {...L} dark>
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px'}}>
      <Mono color="#9A9A9A">{d.filename}</Mono><Mono color="#9A9A9A">{`${done}/${lines.length}`}</Mono>
    </div>
    <div style={{padding: '8px 28px'}}>
      {lines.map((line, i) => {
        const text = typedChars(line.text, stage, line.from), pre = Math.min(d.prefixLen ?? 7, text.length);
        return <div key={i} style={{fontFamily: FAMILY.plexMono, fontWeight: 600, fontSize: 36, lineHeight: 1.55, direction: 'ltr', whiteSpace: 'pre', fontSynthesis: 'none', minHeight: 56}}>
          <span style={{color: stage.ink.accent}}>{text.slice(0, pre)}</span><span style={{color: '#F4F3EE'}}>{text.slice(pre)}</span>
        </div>;
      })}
    </div>
  </CardBox>;
};

const Link: React.FC<{stage: Stage; card: CardOf<'link'>}> = ({stage, card}) => {
  const L = CARD_LAYOUT.link, ink = stage.ink, d = card.data;
  const rightAt = beatFrame(stage, d.rightAt, card.startFrame + sec(stage, 0.25)), stampAt = beatFrame(stage, d.stampAt, card.startFrame + sec(stage, 0.55));
  const leftAt = beatFrame(stage, d.leftAt, card.startFrame + sec(stage, 1.5)), cableAt = beatFrame(stage, d.cableAt, leftAt + sec(stage, 0.15));
  const cable = Math.min(1, pop(stage, cableAt)), pulse = stage.frame > cableAt + sec(stage, 0.4) ? ((stage.frame - cableAt) / stage.fps) % 1 : -1;
  const node = (x: number, w: number, p: number, children: React.ReactNode) => <Tile stage={stage} x={x} y={20} w={w} h={220} p={p} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14}}>{children}</Tile>;
  return <CardGroup stage={stage} card={card} {...L}>
    {node(450, 330, pop(stage, rightAt), <>{d.right.tag ? <Mono color={ink.dim} size={18}>{d.right.tag}</Mono> : null}<Label color={ink.ink}>{d.right.label}</Label>{d.right.shape ? <Shp shape={d.right.shape} size={40} color={ink.accent} /> : null}</>)}
    {node(0, 300, pop(stage, leftAt), <><Icon name={d.left.icon} size={52} color={ink.ink} /><Label color={ink.ink} size={32}>{d.left.label}</Label></>)}
    {cable > 0 ? <svg width={L.w} height={L.h} style={{position: 'absolute', left: 0, top: 0}}>
      <path d="M 300 130 C 360 130 390 130 450 130" stroke={ink.accent} strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray="150" strokeDashoffset={(150 * (1 - cable)).toFixed(1)} />
      {pulse >= 0 ? <circle cx={(300 + 150 * pulse).toFixed(1)} cy={130} r={10} fill={ink.accent} /> : null}
    </svg> : null}
    {d.stamp && stage.frame >= stampAt ? <Stamp ink={ink} x={610} y={-28} p={pop(stage, stampAt)} rot={-5}>{d.stamp}</Stamp> : null}
  </CardGroup>;
};

/** A check colour that reads on the dark editor surface in every act. */
const editorCheck = (stage: Stage): string => (stage.ink.accent === '#D5F53B' ? stage.ink.accent : '#7BD88F');

const Grid: React.FC<{stage: Stage; card: CardOf<'grid'>}> = ({stage, card}) => {
  const L = CARD_LAYOUT.grid, ink = stage.ink, d = card.data;
  const pickAt = beatFrame(stage, d.pickAt, card.startFrame + sec(stage, 1.2)), runAt = beatFrame(stage, d.runAt, pickAt + sec(stage, 1));
  const lit = stage.frame >= pickAt, ran = stage.frame >= runAt;
  const check = stage.frame >= runAt + sec(stage, 0.51);
  return <CardGroup stage={stage} card={card} {...L}>
    {d.items.map((item, i) => {
      const on = lit && i === d.picked;
      return <Tile key={i} stage={stage} x={L.w - 220 - (i % 3) * 240} y={Math.floor(i / 3) * 170} w={220} h={156} p={pop(stage, card.startFrame + sec(stage, 0.06 * i))} radius={22}
        fill={on ? ink.accent : ink.card} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10}}>
        <Icon name={item.icon} size={40} color={on ? ink.onAccent : ink.ink} /><Label color={on ? ink.onAccent : ink.ink} size={26}>{item.name}</Label>
      </Tile>;
    })}
    {d.command && ran ? <div style={{position: 'absolute', left: 140, top: 340, width: 580, height: 66, borderRadius: 16, background: EDITOR_FILL, display: 'flex', alignItems: 'center', padding: '0 18px', gap: 12,
      transform: `scale(${pop(stage, runAt).toFixed(3)})`, boxSizing: 'border-box'}}>
      <Mono color="#F4F3EE" size={26}>{typedChars(`> ${d.command}`, stage, runAt, 0.43)}</Mono>
      {check ? <Check size={30} strokeWidth={3} color={editorCheck(stage)} aria-hidden /> : null}
    </div> : null}
  </CardGroup>;
};

const Crossed: React.FC<{stage: Stage; card: CardOf<'crossed'>}> = ({stage, card}) => {
  const L = CARD_LAYOUT.crossed, ink = stage.ink, d = card.data;
  const crossAt = beatFrame(stage, d.crossAt, card.startFrame + sec(stage, 0.6));
  const grey = stage.frame >= crossAt ? pop(stage, crossAt) : 0;
  return <CardBox stage={stage} card={card} {...L}>
    <Mono color={ink.dim} style={{position: 'absolute', left: 24, top: 16}}>{d.title}</Mono>
    <div style={{position: 'absolute', left: 24, right: 24, top: 64, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, direction: 'rtl'}}>
      {Array.from({length: d.tiles}, (_, i) => <div key={i} style={{height: 96, borderRadius: 16, background: i === d.lit ? ink.accent : ink.ink, opacity: i === d.lit ? 1 : Number((1 - 0.65 * Math.min(1, grey)).toFixed(3))}} />)}
    </div>
    {grey > 0 ? <div style={{position: 'absolute', left: '50%', top: '50%', width: 140, height: 140, borderRadius: 70, background: '#E5484D', transform: `translate(-50%, -50%) scale(${grey.toFixed(3)})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center'}}><X size={86} strokeWidth={3.2} color="#FFFFFF" aria-hidden /></div> : null}
  </CardBox>;
};

type Layer = {text: string; shapes?: readonly string[]; tone: 'light' | 'ink'};
const Stack: React.FC<{stage: Stage; card: CardOf<'stack'>}> = ({stage, card}) => {
  const L = CARD_LAYOUT.stack, ink = stage.ink, d = card.data;
  const dropAt = beatFrame(stage, d.dropAt, card.startFrame + sec(stage, 1)), stampAt = beatFrame(stage, d.stampAt, dropAt + sec(stage, 0.25)), arrowAt = beatFrame(stage, d.arrowAt, stampAt + sec(stage, 1));
  const base = pop(stage, card.startFrame + sec(stage, 0.1)), drop = stage.frame >= dropAt ? pop(stage, dropAt) : 0, arrow = stage.frame >= arrowAt ? Math.min(1, pop(stage, arrowAt)) : 0;
  const layer = (y: number, l: Layer, p: number, dy: number) => {
    const dark = l.tone === 'ink', latin = isLatin(l.text);
    return <div style={{position: 'absolute', left: 0, top: y, width: 620, height: 150, borderRadius: 24, background: dark ? '#111111' : ink.card, border: dark ? 'none' : '3px solid #111111',
      transform: `perspective(900px) rotateX(30deg) translateY(${Math.round(dy)}px)`, opacity: p > 0 ? 1 : 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 36px', boxSizing: 'border-box'}}>
      <div dir={latin ? 'ltr' : 'rtl'} style={{fontFamily: latin ? FAMILY.latinSerif : FAMILY.plexDisplay, fontStyle: latin ? 'italic' : 'normal', fontWeight: latin ? 400 : 700, fontSize: latin ? 70 : 58,
        color: dark ? editorCheck(stage) === '#D5F53B' ? '#D5F53B' : '#F4F3EE' : ink.accentInk, fontSynthesis: 'none', whiteSpace: 'nowrap'}}>{l.text}</div>
      <div style={{display: 'flex', gap: 14}}>{(l.shapes ?? []).map((s, i) => <Shp key={i} shape={s as never} size={34} color={dark ? '#F4F3EE' : '#111111'} />)}</div>
    </div>;
  };
  return <CardGroup stage={stage} card={card} {...L}>
    {layer(180, d.layers[0], base, 16 * (1 - base))}
    {layer(0, d.layers[1], drop, -160 * (1 - Math.min(1, drop)))}
    {arrow > 0 ? <svg width={L.w + 120} height={L.h} style={{position: 'absolute', left: 0, top: 0}}>
      <path d="M 700 320 L 700 40" stroke={ink.accent} strokeWidth={10} strokeLinecap="round" fill="none" strokeDasharray="280" strokeDashoffset={(280 * (1 - arrow)).toFixed(1)} />
      <path d="M 670 80 L 700 40 L 730 80" stroke={ink.accent} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={arrow.toFixed(3)} />
    </svg> : null}
    {d.arrowLabel && arrow > 0 ? <Pill ink={ink} x={700} y={380} p={pop(stage, arrowAt + sec(stage, 0.1))}>{d.arrowLabel}</Pill> : null}
    {d.stamp && stage.frame >= stampAt ? <Stamp ink={ink} x={150} y={390} p={pop(stage, stampAt)}>{d.stamp}</Stamp> : null}
  </CardGroup>;
};

const Nodes: React.FC<{stage: Stage; card: CardOf<'nodes'>}> = ({stage, card}) => {
  const L = CARD_LAYOUT.nodes, ink = stage.ink, d = card.data, n = d.nodes.length;
  const ats = d.nodes.map((_, i) => beatFrame(stage, d.at?.[i], card.startFrame + sec(stage, 0.05 + 0.1 * i)));
  const ringsAt = d.rings ? beatFrame(stage, d.ringsAt, card.startFrame + sec(stage, 1)) : Infinity;
  const q = Math.min(1, Math.max(0, (stage.frame - ringsAt) / (1.2 * stage.fps)));
  return <CardGroup stage={stage} card={card} {...L}>
    {stage.frame >= ringsAt ? <svg data-cartoon-rings="true" width={1080} height={1920} style={{position: 'absolute', left: -L.x, top: -L.y, overflow: 'visible'}}>
      {[0, 1, 2].map((i) => <circle key={i} cx={540} cy={880} r={(150 + EASE.expoOut(q) * 260 * (1 - i * 0.25)).toFixed(1)} fill="none" stroke={ink.accent} strokeWidth={4} opacity={(0.5 - i * 0.12).toFixed(2)} />)}
    </svg> : null}
    {d.nodes.map((node, i) => {
      const x = L.w - 250 - i * ((L.w - 250) / Math.max(1, n - 1)), y = n === 3 && i === 1 ? 170 : 0;
      const latin = node.text !== undefined && isLatin(node.text);
      return <Tile key={i} stage={stage} x={x} y={y} w={250} h={130} p={pop(stage, ats[i])} radius={22} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6}}>
        {node.icon ? <Icon name={node.icon} size={40} color={ink.ink} /> : <div dir={latin ? 'ltr' : 'rtl'} style={{fontFamily: latin ? FAMILY.latinSerif : FAMILY.plexDisplay, fontStyle: latin ? 'italic' : 'normal', fontWeight: latin ? 400 : 700,
          fontSize: 46, color: ink.accentInk, fontSynthesis: 'none', lineHeight: 1}}>{node.text}</div>}
        <Label color={ink.ink} size={24}>{node.label}</Label>
      </Tile>;
    })}
  </CardGroup>;
};

const Morph: React.FC<{stage: Stage; card: CardOf<'morph'>}> = ({stage, card}) => {
  const L = CARD_LAYOUT.morph, ink = stage.ink, d = card.data, n = d.items.length;
  const morphAt = beatFrame(stage, d.morphAt, card.startFrame + sec(stage, 2)), oneAt = beatFrame(stage, d.oneAt, morphAt + sec(stage, 1.4));
  const m = Math.min(1, Math.max(0, (stage.frame - morphAt) / (0.5 * stage.fps)));
  const after = m >= 0.5;
  return <CardGroup stage={stage} card={card} {...L}>
    {d.items.map((item, i) => {
      const x = L.w - 210 - i * ((L.w - 210) / Math.max(1, n - 1));
      return <Tile key={i} stage={stage} x={x} y={0} w={210} h={310} p={pop(stage, card.startFrame - sec(stage, 0.3) + sec(stage, 0.12 * i))} style={{display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 24}}>
        <Shp shape={item.shape} size={44} color={ink.accent} morph={EASE.morph(m)} />
      </Tile>;
    })}
    <Pill ink={ink} x={L.w - 120} y={344} p={pop(stage, card.startFrame + sec(stage, 0.6))}>{after ? d.afterLabel : d.beforeLabel}</Pill>
    {d.equalsBefore && !after ? <Pill ink={ink} x={300} y={344} p={pop(stage, card.startFrame + sec(stage, 1))} accent>{d.equalsBefore}</Pill> : null}
    {d.equalsAfter && stage.frame >= oneAt ? <Pill ink={ink} x={300} y={344} p={pop(stage, oneAt)} accent>{d.equalsAfter}</Pill> : null}
  </CardGroup>;
};

const Timer: React.FC<{stage: Stage; card: CardOf<'timer'>}> = ({stage, card}) => {
  const L = CARD_LAYOUT.timer, ink = stage.ink, c = stage.tl.counter;
  const total = c?.kind === 'seconds' ? c.total : 0, stop = c?.kind === 'seconds' ? c.stopFrame : Infinity;
  const elapsed = Math.min(total, Math.min(stage.frame, stop) / stage.fps), left = Math.max(0, total - elapsed);
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(Math.floor(left % 60)).padStart(2, '0'), cc = String(Math.floor((left % 1) * 100)).padStart(2, '0');
  return <CardBox stage={stage} card={card} {...L}>
    <Mono color={ink.dim} style={{position: 'absolute', left: 24, top: 18}}>{card.data.label}</Mono>
    <Mono color={ink.accentInk} size={116} style={{position: 'absolute', left: 0, right: 0, top: 54, textAlign: 'center'}}>{`${mm}:${ss}.${cc}`}</Mono>
    <div style={{position: 'absolute', left: 24, right: 24, bottom: 22, height: 10, borderRadius: 5, background: ink.line}}>
      <div style={{width: `${((100 * elapsed) / Math.max(1, total)).toFixed(2)}%`, height: '100%', borderRadius: 5, background: ink.accent}} />
    </div>
  </CardBox>;
};

/** The creator's real screen inside a drawn monitor: a fixed 22:9 window (880 x 360) onto the crop, drifting 1.00 to 1.03 over the window. */
const MonitorCard: React.FC<{stage: Stage; card: CardOf<'monitor'>}> = ({stage, card}) => {
  const L = CARD_LAYOUT.monitor, d = card.data, probe = useProbe();
  const k = 880 / d.crop.w, drift = 1 + 0.03 * Math.min(1, Math.max(0, (stage.frame - card.startFrame) / Math.max(1, card.endFrame - card.startFrame)));
  const cropH = (d.crop.w * 9) / 22;
  const inner: React.CSSProperties = {position: 'absolute', width: d.clip.width * k, height: d.clip.height * k, left: -d.crop.x * k, top: -d.crop.y * k,
    transform: `scale(${drift.toFixed(4)})`, transformOrigin: `${((d.crop.x + d.crop.w / 2) * k).toFixed(1)}px ${((d.crop.y + cropH / 2) * k).toFixed(1)}px`};
  return <CardBox stage={stage} card={card} x={L.x} y={L.y} w={L.w} h={L.h} dark>
    <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', height: 54, boxSizing: 'border-box'}}>
      <TrafficLights /><Mono color="#9A9A9A" size={20}>{d.label}</Mono>
    </div>
    <div style={{position: 'absolute', left: 0, top: 54, width: 880, height: 360, overflow: 'hidden', background: probe ?? '#000000'}}>
      {probe ? null : <div style={inner}>
        {d.clip.kind === 'video'
          ? <Sequence from={card.startFrame} layout="none"><OffthreadVideo src={staticFile(d.clip.src)} muted trimBefore={d.trimBeforeFrame ?? 0} style={{width: '100%', height: '100%', display: 'block'}} /></Sequence>
          : <Img src={staticFile(d.clip.src)} style={{width: '100%', height: '100%', display: 'block'}} />}
      </div>}
    </div>
  </CardBox>;
};

const CardView: React.FC<{stage: Stage; card: CardT}> = ({stage, card}) => {
  switch (card.kind) {
    case 'term': return <Term stage={stage} card={card as CardOf<'term'>} />;
    case 'windows': return <Windows stage={stage} card={card as CardOf<'windows'>} />;
    case 'fan': return <Fan stage={stage} card={card as CardOf<'fan'>} />;
    case 'code': return <Code stage={stage} card={card as CardOf<'code'>} />;
    case 'link': return <Link stage={stage} card={card as CardOf<'link'>} />;
    case 'grid': return <Grid stage={stage} card={card as CardOf<'grid'>} />;
    case 'crossed': return <Crossed stage={stage} card={card as CardOf<'crossed'>} />;
    case 'stack': return <Stack stage={stage} card={card as CardOf<'stack'>} />;
    case 'nodes': return <Nodes stage={stage} card={card as CardOf<'nodes'>} />;
    case 'morph': return <Morph stage={stage} card={card as CardOf<'morph'>} />;
    case 'timer': return <Timer stage={stage} card={card as CardOf<'timer'>} />;
    case 'monitor': return <MonitorCard stage={stage} card={card as CardOf<'monitor'>} />;
    default: {
      const unhandled: never = card.kind;
      throw new Error(`cartoon: no card renderer for ${String(unhandled)}`);
    }
  }
};

/** Every card alive at this frame: its window plus the exit. */
export const Cards: React.FC<{stage: Stage}> = ({stage}) => <>
  {stage.tl.cards.filter((card) => stage.frame >= card.startFrame && stage.frame < card.endFrame + Math.ceil(CARD.exitSeconds * stage.fps)).map((card) => <CardView key={card.id} stage={stage} card={card} />)}
</>;
export {EDITOR_FILL};
