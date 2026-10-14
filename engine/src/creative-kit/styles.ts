// Compatibility facade over engine/src/styles/registry.ts. The ordered list, labels and grammar
// now live in engine/src/styles/<id>/meta.ts; every export below keeps its old name and value.
// Node-safe: setup imports this file before `npm ci`, so keep explicit `.ts` imports and no packages.
import {STYLE_IDS as REGISTRY_STYLE_IDS, STYLE_METAS, getStyleMeta} from '../styles/registry.ts';
import type {StyleId} from '../styles/registry.ts';
import type {StyleGrammar, StyleUseCase} from '../styles/types.ts';

export const STYLE_IDS = REGISTRY_STYLE_IDS;
export type {StyleId, StyleGrammar, StyleUseCase};

export const EDITION_STYLE_IDS:readonly StyleId[]=STYLE_IDS;

export const EDITION_DEFAULT_STYLE_IDS:readonly StyleId[]=STYLE_IDS;
export type StyleProfile={id:StyleId;label:string;description:string;useCases:readonly StyleUseCase[];source:{document:string;confidence:'high'|'medium'|'low';references:readonly {file:string;timecodes:readonly string[];observed:string}[];limitations:readonly string[]};approval:{status:'approved-style'|'approved-edit'|'not-style-approved';scope:string;evidence:string};implementation:'implemented';grammar:StyleGrammar};

const source={document:'instructions/TECHNIQUES.md',confidence:'medium' as const,references:[],limitations:['Adapt every style to the customer source and obtain creative approval from the customer.']};
const approval={status:'not-style-approved' as const,scope:'Executable product style direction; each customer edit still needs explicit creative review.',evidence:'instructions/EDITING.md'};
const profiles={} as Record<StyleId,StyleProfile>;
for(const meta of STYLE_METAS)profiles[meta.id]={id:meta.id,label:meta.label.en,description:meta.description.en,useCases:[...meta.useCases],source,approval,implementation:'implemented',grammar:{...meta.grammar}};

export const getStyleProfile=(id:string):StyleProfile=>profiles[getStyleMeta(id).id];
