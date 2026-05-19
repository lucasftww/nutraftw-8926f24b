// Runs before `vite dev` and `vite build` (predev/prebuild hooks).
// Writes public/sitemap.xml with static routes + one entry per active product.
import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Aceita override via env (útil em previews Vercel) — default = produção.
const BASE_URL = (process.env.VITE_PUBLIC_BASE_URL || "https://royalvitta.com.br").replace(/\/$/, "");
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://idutmqfqnoozqbjeqtui.supabase.co";
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkdXRtcWZxbm9venFiamVxdHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMzk4MTEsImV4cCI6MjA5MjgxNTgxMX0.6HUDT6J4D9Z3euHNNpJW0cHuLfXi-nTegm1lG7CTj-I";

interface Entry {
  path: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

const staticEntries: Entry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/sobre", changefreq: "monthly", priority: "0.5" },
  { path: "/login", changefreq: "yearly", priority: "0.3" },
  { path: "/instalar", changefreq: "monthly", priority: "0.4" },
];

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data, error } = await sb
    .from("products")
    .select("slug, updated_at")
    .eq("is_active", true);

  if (error) {
    console.warn("[sitemap] failed to fetch products:", error.message);
  }

  const productEntries: Entry[] = (data || []).map((p: any) => ({
    path: `/produto/${p.slug}`,
    lastmod: p.updated_at ? new Date(p.updated_at).toISOString().slice(0, 10) : undefined,
    changefreq: "weekly",
    priority: "0.8",
  }));

  const entries = [...staticEntries, ...productEntries];

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...entries.map((e) =>
      [
        `  <url>`,
        `    <loc>${BASE_URL}${e.path}</loc>`,
        e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
        e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
        e.priority ? `    <priority>${e.priority}</priority>` : null,
        `  </url>`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    `</urlset>`,
  ].join("\n");

  writeFileSync(resolve("public/sitemap.xml"), xml);
  console.log(`sitemap.xml written (${entries.length} entries)`);
}

main().catch((e) => {
  console.error("[sitemap] error:", e);
  process.exit(0); // never block dev/build
});
