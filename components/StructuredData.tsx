const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://travelmarkets.ca";

export default function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Travel Markets",
        url: siteUrl,
        logo: `${siteUrl}/favicon.ico`,
        sameAs: [],
      },
      {
        "@type": "WebSite",
        name: "Travel Markets",
        url: siteUrl,
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}