import { SubscribeForm } from "./subscribe-form";

// Mid-feed newsletter prompt. Placed after the first day group on the home
// feed so a reader who is actively scrolling — the moment of highest intent —
// can subscribe without leaving the page.
export function InlineSubscribe() {
  return (
    <div className="my-14 overflow-hidden rounded-2xl bg-[#25252a] px-6 py-11 text-center sm:px-12 sm:py-12">
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand">
        The DesAIgn newsletter
      </p>
      <h3 className="mx-auto mt-3 max-w-md text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
        Get the next signal in your inbox.
      </h3>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/60">
        A short dispatch of curated design + AI work — videos, launches,
        essays. No filler, unsubscribe anytime.
      </p>
      <div className="mt-7">
        <SubscribeForm />
      </div>
    </div>
  );
}
