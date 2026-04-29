"use client";

import { Fragment, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

type Props = {
  phrases: string[];
  className?: string;
  intervalMs?: number;
};

export function AnimatedHeadline({ phrases, className, intervalMs = 4200 }: Props) {
  const containerRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    if (phrases.length < 2) return;

    let cancel: (() => void) | null = null;

    const ctx = gsap.context(() => {
      const phraseEls = gsap.utils.toArray<HTMLElement>(".phrase", containerRef.current!);
      const charsPerPhrase = phraseEls.map((p) =>
        gsap.utils.toArray<HTMLElement>(".char-inner", p),
      );

      // Initial state: phrase 0 fully visible at rest. Others stay below the
      // mask line — both phrases share the same grid cell, so the heading
      // is sized to the longest phrase and never reflows.
      phraseEls.forEach((_, i) => {
        gsap.set(charsPerPhrase[i], { yPercent: i === 0 ? 0 : 100 });
      });

      let current = 0;
      let active: gsap.core.Timeline | null = null;

      const swapTo = (next: number) => {
        if (active) active.kill();
        const tl = gsap.timeline();
        // Out and in happen simultaneously — old chars rise out of view at
        // the same time new ones rise in from below. Different easings give
        // each side its own feel: the exiting text accelerates away,
        // the entering text decelerates as it lands.
        tl.to(
          charsPerPhrase[current],
          {
            yPercent: -100,
            duration: 0.65,
            stagger: 0.018,
            ease: "power2.in",
          },
          0,
        )
          .to(
            charsPerPhrase[next],
            {
              yPercent: 0,
              duration: 0.75,
              stagger: 0.018,
              ease: "power3.out",
            },
            0.04,
          )
          // Park the just-exited chars below the mask, ready for their next
          // turn to enter from the bottom.
          .set(charsPerPhrase[current], { yPercent: 100 });
        active = tl;
      };

      const id = setInterval(() => {
        const next = (current + 1) % phrases.length;
        swapTo(next);
        current = next;
      }, intervalMs);

      cancel = () => clearInterval(id);
    }, containerRef);

    return () => {
      if (cancel) cancel();
      ctx.revert();
    };
  }, [phrases, intervalMs]);

  return (
    <h1
      ref={containerRef}
      className={`relative grid ${className ?? ""}`}
      aria-label={phrases[0]}
    >
      {phrases.map((phrase, pi) => {
        const words = phrase.split(" ");
        return (
          <span
            key={pi}
            className="phrase col-start-1 row-start-1"
            aria-hidden={pi === 0 ? undefined : true}
          >
            {words.map((word, wi) => (
              <Fragment key={wi}>
                <span className="inline-block whitespace-nowrap">
                  {Array.from(word).map((char, ci) => (
                    <span
                      key={ci}
                      className="char-mask inline-block overflow-hidden align-bottom"
                    >
                      <span
                        className="char-inner inline-block"
                        // Pre-position non-active phrases below the mask so
                        // there is no flash of stacked text before GSAP
                        // takes over on hydration.
                        style={pi === 0 ? undefined : { transform: "translateY(100%)" }}
                      >
                        {char}
                      </span>
                    </span>
                  ))}
                </span>
                {wi < words.length - 1 ? <span className="inline-block">&nbsp;</span> : null}
              </Fragment>
            ))}
          </span>
        );
      })}
    </h1>
  );
}
