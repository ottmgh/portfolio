# Ottavia Farchi Portfolio

Static Astro portfolio site managed with Bun and structured for PagesCMS editing.

This repo intentionally preserves the original visual output of the source files while moving the content and media into a maintainable Astro + PagesCMS setup.

## Commands

- `bun install`
- `bun run dev`
- `bun run build`
- `bun run preview`
- `bun run check`
- `bun run astro ...`

## Content

- Homepage settings: `src/content/site/home.yml`
- Project entries: `src/content/projects/*.md`
- PagesCMS config: `.pages.yml`
- Public media: `public/media`

## Notes

- Homepage route: `/`
- Project page route: `/project.html?id=1`
- Media paths in content should use PagesCMS-managed `/media/...` URLs
