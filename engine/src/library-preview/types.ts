import type {StyleId} from '../styles/registry.ts';

/** Renderer demonstrations are not production manifests or creator-approved examples. */
export type LibraryPreviewProps = {
  previewKey: string;
};

export type PreviewDefinition = {
  key: string;
  /** An alternate example keeps the native concept identity used for inventory and selection. */
  canonicalKey?: string;
  slug: string;
  labelAr: string;
  labelEn: string;
  layer: string;
  style: StyleId;
  fps: number;
  durationInFrames: number;
  scope: string;
  notes: string[];
  props: LibraryPreviewProps;
  status: 'supported' | 'requires-project-pack';
  reason?: string;
  fixture: Record<string, any>;
};
