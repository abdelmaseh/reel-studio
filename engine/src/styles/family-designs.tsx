import {SECTION_DECK_DESIGNS} from './section-deck/designs';
import {KINETIC_PAPER_DESIGNS} from './kinetic-paper/designs';
import {MAGAZINE_INTERVIEW_DESIGNS} from './magazine-interview/designs';
import {LIQUID_GLASS_DESIGNS} from './liquid-glass/designs';
import {CALLIGRAPHIC_RECEIPTS_DESIGNS} from './calligraphic-receipts/designs';
import {PAPER_COLLAGE_DESIGNS} from './paper-collage/designs';
import type React from 'react';
import type {StyleId} from './registry.ts';
import type {EditScene} from '../prepared-edit/schema.ts';
import type {WindowGeo} from '../core/plate';
import type {HeadBoxPx} from '../creative-kit/head-clear.ts';
import type {MappedWord} from '../prepared-edit/timeline.ts';

export type FamilyDesignProps = {
  scene: EditScene;
  sectionIndex?: number;
  style: StyleId;
  geometry: WindowGeo;
  aspect: number;
  seam: number;
  headBox?: HeadBoxPx | null;
  words?: MappedWord[];
};

export const FAMILY_DESIGNS: Partial<Record<StyleId, Partial<Record<string, React.FC<FamilyDesignProps>>>>> = {'section-deck': SECTION_DECK_DESIGNS, 'kinetic-paper': KINETIC_PAPER_DESIGNS, 'magazine-interview': MAGAZINE_INTERVIEW_DESIGNS, 'liquid-glass': LIQUID_GLASS_DESIGNS, 'calligraphic-receipts': CALLIGRAPHIC_RECEIPTS_DESIGNS, 'paper-collage': PAPER_COLLAGE_DESIGNS};

export function familyDesign(style: StyleId, family: string): React.FC<FamilyDesignProps> | null {
  if (!Object.hasOwn(FAMILY_DESIGNS, style)) return null;
  const designs = FAMILY_DESIGNS[style];
  return designs && Object.hasOwn(designs, family) ? designs[family] ?? null : null;
}
