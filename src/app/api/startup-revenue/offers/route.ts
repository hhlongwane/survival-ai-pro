export const dynamic = "force-dynamic";

/**
 * Exact South African `R5,000 ZAR` Startup Revenue Offers from `hhlongwane/survival-ai` (`survival-ai-gmd5.onrender.com`)
 */
export async function GET() {
  return Response.json({
    target_zar: 5000,
    entries: [
      {
        id: "short-video-pack",
        name: "Short-form content pack",
        buyer: "local small businesses",
        deliverable: "3 vertical promotional videos with captions and hooks",
        starter_price_zar: 750,
        delivery_days: 2,
        proof_needed: "one sample video",
        pitch:
          "I noticed your business could turn more of its existing offers into short videos. I can create 3 ready-to-post videos as a small starter pack.",
      },
      {
        id: "social-content-pack",
        name: "Social content starter pack",
        buyer: "local service businesses",
        deliverable: "7 posts + captions + 7 story concepts",
        starter_price_zar: 650,
        delivery_days: 2,
        proof_needed: "three sample posts",
        pitch:
          "I can turn your existing services into a week of ready-to-post content so you do not have to create it yourself.",
      },
      {
        id: "landing-page",
        name: "Simple conversion landing page",
        buyer: "small businesses without a focused landing page",
        deliverable: "one mobile-friendly landing page and copy",
        starter_price_zar: 1200,
        delivery_days: 3,
        proof_needed: "one-page mockup",
        pitch:
          "I can build a focused landing page around one offer so visitors have a clear next step instead of searching through your whole business.",
      },
      {
        id: "business-graphics",
        name: "Promotional graphics pack",
        buyer: "shops, salons, restaurants and local services",
        deliverable: "5 promotional graphics sized for social media",
        starter_price_zar: 450,
        delivery_days: 1,
        proof_needed: "two sample graphics",
        pitch:
          "I can create a small set of promotional graphics using your real offers, prices and branding.",
      },
      {
        id: "cv-pack",
        name: "CV and application pack",
        buyer: "job seekers",
        deliverable: "ATS-friendly CV + tailored cover letter",
        starter_price_zar: 250,
        delivery_days: 1,
        proof_needed: "an anonymized sample",
        pitch:
          "I can turn your existing experience into a clean, job-focused CV and tailored cover letter.",
      },
    ],
  });
}
