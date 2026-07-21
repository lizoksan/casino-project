# Casino Landing Page

An educational project — a landing page for an online casino. It's a static
page only: no backend, no real payments, no registration or gameplay.

🔗 Live demo: https://lizoksan.github.io/casino-project/

![Project screenshot](src/assets/preview.jpg)

## What it does

- Quests section with a Swiper carousel
- Angled buttons and panels made with CSS `clip-path` (no images needed)
- Images automatically converted to WebP during the build for faster loading
- Fully responsive: mobile and desktop layouts

## Built with

- [Vite](https://vitejs.dev/) — dev server and build
- SCSS, split into files per section (BEM methodology)
- [Swiper](https://swiperjs.com/) — carousel

## What was new for me

- First time setting up automatic image optimization (WebP generation) as part of the build
- Used AI tools (Claude Code) to help configure the Vite build pipeline and review the code

## Run it locally

```bash
git clone https://github.com/lizoksan/casino-project.git
cd casino-project
npm install

npm run dev       # dev server
npm run build      # production build
npm run preview    # preview the production build
```
