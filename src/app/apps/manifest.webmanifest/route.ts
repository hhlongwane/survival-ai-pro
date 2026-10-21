export const dynamic = "force-static";

export async function GET() {
  const manifest = {
    id: "/apps?app=alpha-gap-ai",
    name: "Alpha Gap AI — Crypto Profit & ML Lab",
    short_name: "Alpha Gap AI",
    description:
      "App #2: High-Velocity Crypto Market Gap Detector, Post-Only Maker Profit Compounder & Online Gradient Descent Machine Learning App",
    start_url: "/apps?source=android_pwa_alpha",
    scope: "/apps",
    display: "standalone",
    background_color: "#070B14",
    theme_color: "#06B6D4",
    orientation: "portrait-primary",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icons/alpha-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/alpha-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/alpha-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
    },
  });
}
