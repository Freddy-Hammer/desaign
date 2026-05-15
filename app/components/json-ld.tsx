// Renders a JSON-LD structured-data block. Search engines and AI crawlers
// read this to understand what the page is and what it lists.
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
