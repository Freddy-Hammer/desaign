import Link from "next/link";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";

export const metadata = {
  title: "Privacy Policy — DesAIgn Radar",
  description:
    "How DesAIgn Radar handles your data — what we collect, where it goes, and how to remove it.",
};

const LAST_UPDATED = "May 12, 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] text-zinc-950">
      <SiteHeader />

      <section className="border-b border-zinc-900/10">
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 lg:py-16">
          <span className="inline-flex rounded-full border border-brand-deep/20 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-deep">
            Privacy Policy
          </span>
          <h1 className="mt-7 text-4xl font-black leading-[1] tracking-tight text-zinc-950 sm:text-5xl">
            What we collect and why.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600">
            Plain English, no boilerplate. Last updated {LAST_UPDATED}.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-10 px-5 py-12 sm:px-8 sm:py-16">
        <Block title="Who runs DesAIgn Radar">
          <p>
            DesAIgn Radar is an independent project that curates design and AI
            signals. The site links to original creators and never republishes
            full third-party content. For any privacy question or removal
            request, write to{" "}
            <a
              className="font-semibold text-brand-deep underline decoration-brand-deep/30 underline-offset-2 hover:decoration-brand-deep"
              href="https://tally.so/r/Y5pvG5"
              target="_blank"
              rel="noreferrer"
            >
              our contact form
            </a>
            .
          </p>
        </Block>

        <Block title="What we collect from you">
          <p>
            <strong>If you subscribe</strong>, we collect your email address so
            we can send you the newsletter. That&apos;s it &mdash; no name, no
            phone, no payment info. The form is hosted by Beehiiv and the
            email is stored there.
          </p>
          <p>
            <strong>If you just browse</strong>, our analytics tools (see
            below) collect standard web telemetry: page views, approximate
            location from IP, device and browser type, referring URL, and
            interaction events. We do not knowingly collect data from anyone
            under 16.
          </p>
          <p>
            <strong>If you contact us</strong> via the Tally form, we receive
            whatever you choose to submit (name, email, message). We only use
            it to reply.
          </p>
        </Block>

        <Block title="Where your data goes (third parties)">
          <ul className="space-y-3">
            <Item name="Beehiiv">
              Newsletter platform. Stores your email and sends issues. See
              Beehiiv&apos;s own privacy policy at beehiiv.com.
            </Item>
            <Item name="Supabase">
              Our database, hosted in the US. Stores public content (posts,
              jobs, links) &mdash; no subscriber emails.
            </Item>
            <Item name="Vercel">
              Hosts the website. May log standard request metadata (IP,
              user-agent) for security and performance.
            </Item>
            <Item name="Google Analytics 4">
              Aggregated traffic analytics. Sets cookies, processes IP and
              device data in pseudonymized form.
            </Item>
            <Item name="Contentsquare">
              Anonymized experience analytics &mdash; tracks scroll, clicks,
              and page flow to help us improve the site. Sets cookies.
            </Item>
            <Item name="Tally">
              Hosts our contact form. Receives whatever you submit there and
              forwards to our inbox.
            </Item>
          </ul>
        </Block>

        <Block title="Cookies">
          <p>
            The site uses cookies set by Google Analytics and Contentsquare
            (above). These are used to recognize repeat visits and aggregate
            interaction data &mdash; not to build advertising profiles. You
            can block cookies in your browser settings without breaking the
            site. We don&apos;t use third-party advertising trackers.
          </p>
        </Block>

        <Block title="Your rights (GDPR, CCPA, etc.)">
          <p>You can ask us at any time to:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>see what data we hold about you,</li>
            <li>correct it,</li>
            <li>delete it (e.g. unsubscribe and remove from our list),</li>
            <li>export it.</li>
          </ul>
          <p>
            Unsubscribing from the newsletter is one click in any email
            footer. For any other request, write to us via the contact form
            and we&apos;ll act within 30 days.
          </p>
        </Block>

        <Block title="How long we keep things">
          <p>
            Subscriber emails stay until you unsubscribe. Analytics data is
            retained per the providers&apos; default windows (Google Analytics
            14 months, Contentsquare 13 months). Public content on the site
            (posts, jobs) stays unless we receive a removal request.
          </p>
        </Block>

        <Block title="Removal requests">
          <p>
            If you&apos;re a creator or company and you&apos;d like us to
            remove a link, thumbnail, or job listing, send the URL via{" "}
            <a
              className="font-semibold text-brand-deep underline decoration-brand-deep/30 underline-offset-2 hover:decoration-brand-deep"
              href="https://tally.so/r/Y5pvG5"
              target="_blank"
              rel="noreferrer"
            >
              the contact form
            </a>{" "}
            and we&apos;ll take it down promptly &mdash; usually within a few
            days.
          </p>
        </Block>

        <Block title="Changes to this policy">
          <p>
            If the policy changes materially, we&apos;ll update the &ldquo;last
            updated&rdquo; date at the top and, for substantive changes, note
            it in the newsletter.
          </p>
        </Block>

        <div className="border-t border-zinc-900/10 pt-8 text-sm text-zinc-500">
          See also:{" "}
          <Link
            className="font-semibold text-brand-deep underline decoration-brand-deep/30 underline-offset-2 hover:decoration-brand-deep"
            href="/terms"
          >
            Terms &amp; takedown policy
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

function Item({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-deep" />
      <span>
        <strong className="font-semibold text-zinc-950">{name}</strong> &mdash;{" "}
        <span className="text-zinc-700">{children}</span>
      </span>
    </li>
  );
}
