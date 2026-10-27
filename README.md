# Blog

Personal site. The layout comes from [Astro Paper](https://github.com/satnaing/astro-paper).

## Local

```bash
pnpm install
pnpm dev
```

## Cloudflare Pages

Connect this repo and use:

- Production branch: `main`
- Build command: `pnpm build`
- Build output directory: `dist`
- Node.js: `22`

Set the `SITE` environment variable to the production URL, for example `https://blog.pages.dev`. Canonical links and the sitemap use that host. If `SITE` is unset, the build uses `https://blog.pages.dev`.

Posts go in `src/content/posts/`. Site name, description, and social links are in `astro-paper.config.ts`.
