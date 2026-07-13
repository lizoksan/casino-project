# Casino Project

A learning project — a landing page for an online casino. The goal was to practice semantic HTML markup, responsive SCSS layout (mobile-first with desktop breakpoints), SVG icon sprites, and image optimization tied into a Vite build pipeline.

Not a real product and has no backend — a static page with no payment, registration, or gameplay functionality.

## Page sections

- **Hero** — landing screen with logo and call to action
- **Quests** — quest carousel (Swiper)
- **Bonuses** — bonus cards
- **Tournament** — tournament section
- **Drawing** — giveaway/raffle section

## Stack

- [Vite](https://vitejs.dev/) — build and dev server
- SCSS, split into per-section partials (`@use`/`@forward`)
- [Swiper](https://swiperjs.com/) — carousel for the quests section
- Custom Vite plugins (see below)

## Techniques and highlights

- **BEM-style class naming** (`block__element--modifier`) kept consistent across every section for predictable, collision-free styles.
- **Mobile-first responsive layout** via a `mq()` SCSS mixin wrapping breakpoint media queries, so each component's mobile and desktop rules sit side by side instead of being scattered across separate stylesheets.
- **Automatic WebP generation** — a `bg()` SCSS mixin emits `background-image` as an `image-set()` with a WebP source and a JPEG/PNG fallback. A dev-mode plugin generates the missing WebP files on the fly (with mtime-based cache checks) so the same markup works identically in development and in the production build.
- **Build-time image optimization** — a `closeBundle` plugin re-compresses every JPEG/PNG in the output directory with `sharp`, generates WebP versions, rewrites `<picture>` markup with `<source type="image/webp">`, and prints a size report (bytes saved, per-asset breakdown) at the end of the build.
- **Angular, clip-path–based UI** — buttons and decorative panels use `clip-path: polygon(...)` for the cut-corner look instead of images, keeping them crisp at any resolution and easy to restyle.
- **Modern hover effects with `:has()`** — button hover glow is triggered via `.button__wrapper:has(.button:hover)`, avoiding extra JS or wrapper-level hover classes.
- **Fluid typography** — root font-size scales with `calc(100vw / <viewport> * 10)` across defined viewport ranges, giving proportional scaling between breakpoints instead of hard jumps.
- **CSS-only decorative animation** — floating/levitating and shine effects on illustrations are done purely with `@keyframes`, no animation library.

## Getting started

```bash
npm install
npm run dev       # dev server with hot reload
npm run build      # production build into dist/
npm run preview    # preview the production build locally
```
