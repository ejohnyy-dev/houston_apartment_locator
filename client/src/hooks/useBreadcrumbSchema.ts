import { useEffect } from 'react';

interface BreadcrumbItem {
  label: string;
  href: string;
}

export function useBreadcrumbSchema(items: BreadcrumbItem[]) {
  useEffect(() => {
    // Build breadcrumb list with Home as first item
    const breadcrumbList = [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: window.location.origin,
      },
      ...items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 2,
        name: item.label,
        item: `${window.location.origin}${item.href}`,
      })),
    ];

    // Create JSON-LD schema
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbList,
    };

    // Create or update script tag
    let scriptElement = document.getElementById('breadcrumb-schema');
    if (!scriptElement) {
      scriptElement = document.createElement('script');
      scriptElement.id = 'breadcrumb-schema';
      scriptElement.type = 'application/ld+json';
      document.head.appendChild(scriptElement);
    }
    scriptElement.textContent = JSON.stringify(schema);

    return () => {
      // Clean up on unmount
      if (scriptElement && scriptElement.parentNode) {
        scriptElement.parentNode.removeChild(scriptElement);
      }
    };
  }, [items]);
}
