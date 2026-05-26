import { useEffect } from "react";

interface PageMetaOptions {
  title: string;
  description: string;
  url?: string;
  image?: string;
  jsonLd?: Record<string, unknown>;
}

export function usePageMeta({
  title,
  description,
  url = "https://txaptfinder.com",
  image = "https://txaptfinder.com/og-image.png",
  jsonLd,
}: PageMetaOptions) {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Update meta description
    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) {
      descriptionMeta.setAttribute("content", description);
    }

    // Update OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", title);

    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.setAttribute("content", description);

    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", url);

    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.setAttribute("content", image);

    // Update Twitter tags
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.setAttribute("content", title);

    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    if (twitterDescription) twitterDescription.setAttribute("content", description);

    const twitterImage = document.querySelector('meta[name="twitter:image"]');
    if (twitterImage) twitterImage.setAttribute("content", image);

    // Update canonical URL
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute("href", url);
    }

    // Update JSON-LD if provided
    if (jsonLd) {
      let jsonLdScript = document.querySelector('script[type="application/ld+json"][data-page-jsonld]') as HTMLScriptElement | null;
      if (!jsonLdScript) {
        jsonLdScript = document.createElement("script") as HTMLScriptElement;
        jsonLdScript.type = "application/ld+json";
        jsonLdScript.setAttribute("data-page-jsonld", "true");
        document.head.appendChild(jsonLdScript);
      }
      if (jsonLdScript) {
        jsonLdScript.textContent = JSON.stringify(jsonLd);
      }
    }
  }, [title, description, url, image, jsonLd]);
}
