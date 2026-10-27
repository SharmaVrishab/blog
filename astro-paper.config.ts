import { defineAstroPaperConfig } from "./src/types/config";

const siteUrl = process.env.SITE ?? "https://blog.pages.dev";

export default defineAstroPaperConfig({
  site: {
    url: siteUrl,
    title: "Vrishab",
    description:
      "Notes on data engineering, pipelines, and projects I'm building.",
    author: "Vrishab",
    profile: "https://github.com/SharmaVrishab",
    ogImage: "default-og.jpg",
    lang: "en",
    timezone: "Asia/Kolkata",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: { enabled: false },
    search: "pagefind",
  },
  socials: [
    { name: "github", url: "https://github.com/SharmaVrishab" },
    { name: "mail", url: "mailto:vrishabsharma1111@gmail.com" },
  ],
  shareLinks: [
    { name: "whatsapp", url: "https://wa.me/?text=" },
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x", url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "pinterest", url: "https://pinterest.com/pin/create/button/?url=" },
    { name: "mail", url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
