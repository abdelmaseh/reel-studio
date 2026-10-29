import React from 'react';
import {displayDigits, localizeSuffix} from '../core/digits.ts';
import {useDigits} from '../creative-kit/digits';
import type {DigitChoice} from '../styles/types.ts';

// Only display data participates. Asset paths, stable IDs, choices, handles and the
// comment keyword retain their authored values, including when reused in a promise.
const protectedKeys = new Set(['id', 'src', 'image', 'path', 'url', 'font', 'fontFamily', 'kind', 'fit', 'variant', 'display', 'handle', 'keyword', 'valueFit', 'lang', 'enter', 'dir']);
const KeepContext = React.createContext<readonly string[]>([]);
export const DesignDigitsScope: React.FC<{data: unknown; children?: React.ReactNode}> = ({data, children}) => {
  const keyword = (data as {keyword?: string}).keyword;
  return <KeepContext.Provider value={keyword ? [keyword] : []}>{children}</KeepContext.Provider>;
};
export function localizeDesignData<T>(data: T, digits: DigitChoice | null, keep: readonly string[] = []): T {
  if (digits === null) return data;
  const visit = (value: unknown, key = ''): unknown => {
    if (protectedKeys.has(key)) return value;
    if (typeof value === 'string') return key === 'suffix' ? localizeSuffix(value, digits) : displayDigits(value, digits, {keep});
    if (Array.isArray(value)) return value.map(item => visit(item, key));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, visit(item, name)]));
    return value;
  };
  return visit(data) as T;
}

export function useDesignData<T extends object>(data: T): T {
  const digits = useDigits();
  const keyword = (data as {keyword?: string}).keyword;
  return React.useMemo(() => localizeDesignData(data, digits, keyword ? [keyword] : []), [data, digits, keyword]);
}

/** The same display-time path for ordinals, animated values and labels built by a design. */
export function useDesignText() {
  const digits = useDigits();
  const keep = React.useContext(KeepContext);
  return (text: string | number) => {
    const value = String(text);
    return value === '%' || value === '٪' ? localizeSuffix(value, digits) : displayDigits(value, digits, {keep});
  };
}
export const DesignText: React.FC<{children?: React.ReactNode}> = ({children}) => {
  const shown = useDesignText();
  return <>{typeof children === 'string' || typeof children === 'number' ? shown(children) : children}</>;
};
