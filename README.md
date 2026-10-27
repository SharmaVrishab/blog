# Blog

Personal site. The layout comes from [Astro Paper](https://github.com/satnaing/astro-paper).

## Local

```bash
pnpm install
pnpm dev
```

## Cloudflare

The GitHub repo can deploy on every push to `main`. In the Cloudflare Worker build settings, use:

- Production branch: `main`
- Build command: `pnpm run build`
- Deploy command: `npx wrangler deploy`

`wrangler.jsonc` publishes the static `dist` folder. Leave the Astro Cloudflare adapter off. Wrangler’s automatic Astro setup adds that adapter and the build fails.

Set the `SITE` environment variable to the production URL. Canonical links and the sitemap use that host. If `SITE` is unset, the build uses `https://blog.pages.dev`.

Posts go in `src/content/posts/`. Site name, description, and social links are in `astro-paper.config.ts`.
