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

The default site URL is `defaultSiteUrl` in `astro-paper.config.ts`, currently `https://blog.pages.dev`. Change that constant when the custom domain is ready. Canonical links, the sitemap, and RSS use it. Set the `SITE` environment variable to override the constant for one build. An unset or empty `SITE` keeps the default.

Posts go in `src/content/posts/`. Site name, description, and social links are in `astro-paper.config.ts`.

## Rollback

In the Cloudflare dashboard, open Workers, then `blog`, then Deployments. Choose the last known-good deployment and roll back to it.
