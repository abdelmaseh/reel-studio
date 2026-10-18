import {widthTemplate} from '../core/numbers.ts';
import {displayDigits} from '../core/digits.ts';
import type {DigitChoice} from '../styles/types.ts';

export const VALUE_FITS=['rolling','final'] as const;
export type ValueFit=(typeof VALUE_FITS)[number];



// The widest glyph of the chosen digit set, so the box is sized for what is shown. The template goes through the same
// line rule as the text it stands for (a Latin suffix such as K keeps the line in Latin digits), and with no choice it is
// returned exactly as it always was.
export const finalValueTemplate=(value:number,suffix:string,digits?:DigitChoice|null):string=>
  displayDigits(widthTemplate(value,{grouping:true,decimals:0,suffix}),digits);
