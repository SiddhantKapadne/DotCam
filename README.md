# DotCam

Live camera halftone dot grid — each cell renders concentric flat-color orbs sampled from the feed, with brightness-based sizing and upward scroll animation.

## Controls

- **Upload** — load an image as source
- **Yellow button** — save current canvas as PNG
- **Flip** — switch front/back camera (mobile only)

## Structure

- `index.html` — Apple-style overlay UI
- `js/app.js` — camera, upload, save
- `js/render.js` — dot grid renderer
- `js/analyze.js` — grid layout
- `js/config.js` — size + animation settings

## Tune

Edit `js/config.js` for grid size, dot size range, and scroll speed.
# DotCam
