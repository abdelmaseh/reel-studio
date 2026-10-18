import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {LibraryItemPreview, calculateLibraryPreviewMetadata} from './Preview';
import {previewDefinitions} from './fixtures.ts';

const defaults = previewDefinitions()[0].props;
const LibraryPreviewRoot: React.FC = () => React.createElement(Composition<any, typeof defaults>, {
  id: 'LibraryItemPreview', component: LibraryItemPreview, width: 1080, height: 1920,
  fps: 30, durationInFrames: 240, defaultProps: defaults,
  calculateMetadata: calculateLibraryPreviewMetadata,
});
registerRoot(LibraryPreviewRoot);
