import Link from "next/link";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";

export const metadata = {
  title: "Terms & Takedown",
  description:
    "How DesAIgn Radar curates content, links back to creators, and handles takedown requests.",
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "May 12, 2026";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-zinc-950">
      <SiteHeader />

      <section className="border-b border-zinc-900/10">
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 lg:py-16">
          <span className="inline-flex rounded-full border border-brand-deep/20 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-deep">
            Terms &amp; takedown
          </span>
          <h1 className="mt-7 text-4xl font-black leading-[1] tracking-tight text-zinc-950 sm:text-5xl">
            How DesAIgn Radar works.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600">
            Plain English. Last updated {LAST_UPDATED}.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-10 px-5 py-12 sm:px-8 sm:py-16">
        <Block title="What this site is">
          <p>
            DesAIgn Radar is a curated discovery board for design and AI work.
            We aggregate links from public sources &mdash; YouTube, Instagram,
            Medium, LinkedIn, Awwwards, CSSDA, TheFWA, and other places &mdash;
            and link back to the original creator or curator&apos;s page. We do
            not republish full articles, full videos, or full image works. We
            link out, every time.
          </p>
        </Block>

        <Block title="What we display">
          <p>
            For each item we show the title (factual), the source name, a
            category tag, the publication date, and the thumbnail image used
            by the original platform. The thumbnail loads directly from the
            platform&apos;s CDN; we do not host copies. Apply for the job,
            watch the video, or read the article on the original site &mdash;
            that&apos;s the whole point.
          </p>
        </Block>

        <Block title="Job listings">
          <p>
            The jobs board aggregates designer-focused roles from public
            company career pages. Each listing links to the company&apos;s own
            posting; apply directly with them. We never accept payment for
            placement and never alter listings beyond categorization.
          </p>
        </Block>

        <Block title="Takedown requests">
          <p>
            If you&apos;re the creator or rights holder and want a link,
            thumbnail, or job listing removed, send the URL via{" "}
            <a
              className="font-semibold text-brand-deep underline decoration-brand-deep/30 underline-offset-2 hover:decoration-brand-deep"
              href="https://tally.so/r/Y5pvG5"
              target="_blank"
              rel="noreferrer"
            >
              our contact form
            </a>
            . We respond quickly &mdash; usually within a few days &mdash; and
            do not require a formal DMCA notice for routine takedowns. If
            you&apos;re a company who&apos;d like a job listing pulled
            (filled, withdrawn, etc.), same channel.
          </p>
        </Block>

        <Block title="Use of the site">
          <p>
            You can browse, share, and link to any page on DesAIgn Radar
            freely. Don&apos;t scrape the site at high rates, don&apos;t
            attempt to break things, and don&apos;t republish our curated
            collections as your own. The curation itself &mdash; the
            selection, ordering, categorization, and editorial summaries
            &mdash; is original work.
          </p>
        </Block>

        <Block title="No warranty">
          <p>
            The site is provided as is. We can&apos;t guarantee links stay
            working forever (platforms break URLs, posts get deleted), and we
            can&apos;t vouch for the content on the destination sites. Use
            judgment.
          </p>
        </Block>

        <Block title="Changes">
          <p>
            If these terms change materially, we&apos;ll update the date at
            the top.
          </p>
        </Block>

        <div className="border-t border-zinc-900/10 pt-8 text-sm text-zinc-500">
          See also:{" "}
          <Link
            className="font-semibold text-brand-deep underline decoration-brand-deep/30 underline-offset-2 hover:decoration-brand-deep"
            href="/privacy"
          >
            Privacy policy
          </Link>
          .
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-black tracking-tight text-zinc-950 sm:text-2xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-7 text-zinc-700">
        {children}
      </div>
    </section>
  );
}
