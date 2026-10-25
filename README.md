# Interspecies Dialogue · Showcase (English)

The English edition of the showcase website for *Interspecies Dialogue* (三界共語): live shaders, images that react to sound, and scroll-driven storytelling. It carries the same content as the Chinese showcase, translated into English.

## Structure

```
index.html          the single page
css/style.css       styles (shared with the Chinese showcase; the English typography overrides are at the end)
js/main.js          boot, loader, the stomata field on the first screen, scroll story, torn chapter gates, cursor, player dock
js/field.js         full-screen WebGL stomata field (hand-written shader: Voronoi epidermis + guard cells)
js/audio.js         one audio element + a Web Audio AnalyserNode; the track list in English
js/sections.js      microscope scrub, filmstrip, dual-projection wall, the uncanny zone, the dial of hours, the letter that is read once
js/sculpture.js     3D data sculpture of the 200 curated records (three.js, instanced)
js/ridge.js         breathing ridgeline of the 55 annotated aperture curves (three.js)
js/deck.js          sound visualiser (spectral terrain + spectral stoma) and track list
js/carousel.js      draggable WebGL carousel of the AIGC animations
js/thefilm.js       "The Film": a YouTube player that loads only on click (youtube-nocookie.com); one sound at a time on the page
js/const.js         English names for the outcome classes, plants, methods and AIGC styles
data/               open data (experiments / annotations, CSV and JSON), site.json for the page, notes-en.json (see below)
assets/             images, video and sound (all metadata removed); og.jpg is the English share image
```

External libraries load only from pinned CDN versions: three@0.160.0 (jsdelivr), gsap 3.12.5 + ScrollTrigger (cdnjs), lenis 1.1.13 (jsdelivr), and Google Fonts (Noto Sans and Noto Serif for Latin text, Noto Sans TC and Noto Serif TC for the Chinese names and title, JetBrains Mono).

## English edition

- **Translation.** Every visitor-facing string is in English: text, headings, alt text, ARIA labels, captions, tooltips, track names and the player dock. Chinese appears only as proper names: people and organisations in the credits, the Chinese title 三界共語, the Chinese plant names beside the English ones in the species cards (and the spreadsheet's spelling 鴨拓草), the street addresses of the venues, and the 中文 language switch. Each Chinese run is marked `lang="zh-Hant"`. Where the two editions differ, the Chinese site prevails.
- **Lab notes.** The spreadsheet notes in `data/site.json` and the downloadable files stay word for word in Chinese. The data sculpture's tooltips show English renderings from `data/notes-en.json` (keyed by record id) and label them "note, translated".
- **Explainer video.** The one-minute video has its title cards burned in, in Chinese. An English subtitle track (`assets/works/explainer/explainer-01-how-it-was-made.en.vtt`) is on by default, and the Chinese track is still available.
- **Media.** A few of the moving-image loops carry small labels burned into the frame, some of them in Chinese. They are part of the rendered video and are left as they are.
- **Credits.** Role names are the English names given in the official credit list. Names are reproduced exactly as listed, Chinese names included. Some English wording is a gloss and not official, and needs confirming with the team: the production titles "Sprouting" (出芽) and "Pulsing Forest" (脈動森林), the group headings, and the roles "Director" (導演) and "Script" (腳本撰寫), which have no English name in the list. "Stoma Whisperer" is the official English title of Part III. A comment in `index.html` marks the glosses.

## Publishing on GitHub Pages

1. Push the whole folder to the root of a repository.
2. Under Settings → Pages → Source, choose the `main` branch and `/ (root)`.
3. All paths are relative, so the site works under `https://<account>.github.io/<repository>/`. `.nojekyll` is included.

## Addresses and share image

- **Addresses:** this site is https://handcollab.github.io/interspecies-dialogue-showcase-en/. The Chinese showcase is https://handcollab.github.io/interspecies-dialogue-showcase/, linked from the "EN | 中文" switch in the top bar, the About section and the footer. The minimal version (Chinese) is https://handcollab.github.io/interspecies-dialogue/.
- **The film:** the Image chapter opens with the *Interspecies Dialogue* film (YouTube `H9dKvSVsPyA`, the production team's official channel). The poster is this site's own microscope image, `assets/works/loops/f3-loop-01-poster.webp`, and nothing is requested from YouTube before play is pressed.
- **Share image:** `og:image`, `og:url` and `twitter:image` use the full address of this site, and `og:locale` is `en_GB` (the copy uses British spelling). Update them if the repository is renamed or moves to another domain.

## Accessibility and performance

- `prefers-reduced-motion`: smooth scrolling, pinned scrolling and animation are off; the stomata field becomes one still frame per chapter; videos play on click.
- Without WebGL, the first screen falls back to a still micrograph; the 3D charts show a short note, and the data can still be downloaded.
- The stomata field adjusts its resolution to the measured frame time, and stops drawing while an opaque section covers it.
- Videos load lazily, play when they enter the viewport and pause when they leave.
- The film poster is a `<button>` (mouse, or Tab then Enter or Space). Once the player loads, focus moves into it. Only one sound plays at a time: starting the film pauses the player dock and any video with sound, and the other way round.
- Posters, the 3D scenes (data sculpture, annotation ridgeline, sound visualiser, AIGC carousel) and three.js itself load only as they come near the viewport; fonts load without blocking the first paint.

## Privacy

Experiment footage, sound and records show no participant's face, body or voice; the credits name people as listed in the official credit list and in the list supplied by the team. Personal names appear only in the CREDITS section of the page, never in the captions or alt text of the experiment footage, in the data files under `data/`, or in `data/README.md`. Experiment videos with human voices are muted, and what was said is only summarised as facts. Metadata has been removed from all images and videos. "The Film" loads from youtube-nocookie.com only after play is pressed. The site as a whole sends no Referer; only this player sends the site's origin, because YouTube embeds require it.

## Credits

The CREDITS section of `index.html` lists, in order, Part I 出芽 (exhibition), Part II 脈動森林 (performance) and Part III 氣孔低語 Stoma Whisperer (exhibition). Parts II and III follow the official credit list in the same order, with each role given by the English name in that list; Part I was supplied by the team and formatted to match. Each "role: names" line is still one line of text on the page, so it copies out whole. When the list changes, replace the whole section rather than editing only how it looks.
