export const CANVAS = {
  bg: '#e4e4e4',
};

export const GRID_STYLE = {
  dotMinRatio: 0.08,
  colorDotMinRatio: 0.38,
  colorDotMaxRatio: 0.72,
  sizeGamma: 0.9,
};

export const ANIM = {
  scrollSpeed: 10,
};

/** Temporal smoothing — higher = snappier, lower = steadier dots */
export const STABILITY = {
  smoothRate: 5,
};

/** Keep only these hues in colour; everything else → greyscale */
export const COLOR_FILTER = {
  enabled: true,
  minSaturation: 0.16,
  hues: [
    { min: 335, max: 22, wrap: true },  // red
    { min: 42, max: 72 },               // yellow
    { min: 200, max: 258 },             // blue
  ],
};
