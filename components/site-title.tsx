import { siteNameHtml, siteSocialTitleHtml } from "@/lib/site";

/**
 * The metadata API escapes ' to &#x27;. These tags are raw HTML so the
 * source contains the apostrophe. The style element closes at once, which
 * leaves the meta tags in the head.
 */
export function SiteTitle() {
  return (
    <>
      <title dangerouslySetInnerHTML={{ __html: siteNameHtml() }} />
      <style
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: `</style>${siteSocialTitleHtml()}<style>` }}
      />
    </>
  );
}

export function SiteName({ tag: Tag = "span" }: { tag?: "span" | "strong" }) {
  return <Tag dangerouslySetInnerHTML={{ __html: siteNameHtml() }} />;
}
