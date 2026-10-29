// The GL backend of every browser that renders pixels for the studio, pinned in one place.
//
// With no value Chrome picks whatever it finds: software WebGL on a machine without a usable GPU, a hardware driver on one with it. Plain
// CSS and SVG draw the same on both, but the layers built on @remotion/effects (looks film and paper, overlay pixel-curtain, backdrops
// sunburst and paper) are shader code, and the paper, noise, burlap, roughen-edges and starburst shaders draw different pixels on a GPU, on
// WARP and in software. "swangle" is the software path ANGLE ships with Chrome: it needs no driver, so the same project renders to the
// same pixels on every machine. On the machine this was measured on it is bit-identical to the unset default, so existing output is unchanged.
//
// Every script that launches the render browser (openBrowser, renderMedia, renderStill, renderFrames, selectComposition) passes
// `chromiumOptions: renderChromiumOptions(...)`. tests/effects-looks.test.mjs fails when one forgets. Browsers that only run a CPU model
// (the person matte and the face crop analysis) draw nothing that is kept and stay outside this pin.
export const RENDER_GL = 'swangle';

/** Chromium options for a render browser: whatever the caller already needs, with the GL backend pinned. The caller's object is not changed. */
export const renderChromiumOptions = (options = {}) => ({ ...options, gl: RENDER_GL });
