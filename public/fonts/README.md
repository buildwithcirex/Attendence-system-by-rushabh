# Gilroy fonts

The UI uses **Gilroy** as its primary typeface (declared via `@font-face` in
`src/app/globals.css`). Gilroy is a commercial font and is not committed to this
repo — drop the `.woff2` files here for them to load.

Expected files (weights actually referenced by the CSS):

- `Gilroy-Light.woff2` (300)
- `Gilroy-Regular.woff2` (400)
- `Gilroy-Medium.woff2` (500)
- `Gilroy-SemiBold.woff2` (600)
- `Gilroy-Bold.woff2` (700)
- `Gilroy-ExtraBold.woff2` (800)

Until these are present the UI falls back to the system sans-serif
(`font-display: swap`), so nothing breaks — it just isn't Gilroy yet.

If you only have `.ttf`/`.otf`, convert them to `.woff2` (e.g. with
`fonttools` or an online converter) for smaller, faster-loading files.
