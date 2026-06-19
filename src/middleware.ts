import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  // Prevent Vercel edge from caching SSR pages so CMS updates reflect immediately
  response.headers.set(
    "Cache-Control",
    "no-cache, no-store, must-revalidate"
  );
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Vercel-CDN-Cache-Control", "no-store");

  return response;
});
