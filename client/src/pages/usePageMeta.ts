import { useEffect } from "react";

export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]'
    );
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }

    const previousDescription = meta.getAttribute("content");
    meta.setAttribute("content", description);

    return () => {
      document.title = previousTitle;
      if (created) {
        meta?.remove();
      } else if (previousDescription !== null) {
        meta?.setAttribute("content", previousDescription);
      }
    };
  }, [title, description]);
}
