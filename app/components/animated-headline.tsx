"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

type Props = {
  phrases: string[];
  className?: string;
  intervalMs?: number;
};

export function AnimatedHeadline({ phrases, className, intervalMs = 3800 }: Props) {
  const containerRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    if (phrases.length < 2) return;

    const ctx = gsap.context(() => {
      const phraseEls = gsap.utils.toArray<HTMLElement>(".phrase", containerRef.current!);
      // Each phrase contains word-masks; the inner .word is what we translate.
      const wordsPerPhrase = phraseEls.map((p) =>
        gsap.utils.toArray<HTMLElement>(".word", p),
      );

      // Initial state: phrase 0 visible at rest, others below the mask.
      phraseEls.forEach((p, i) => {
        gsap.set(p, { autoAlpha: i === 0 ? 1 : 0 });
        gsap.set(wordsPerPhrase[i], { yPercent: i === 0 ? 0 : 110 });
      });

      let current = 0;
      const tl = gsap.timeline({ repeat: -1, defaults: { ease: "power3.inOut" } });

      const advance = () => {
        const next = (current + 1) % phraseEls.length;

        tl.to(
          wordsPerPhrase[current],
          {
            yPercent: -110,
            duration: 0.55,
            stagger: 0.04,
          },
          ">",
        )
          .set(phraseEls[current], { autoAlpha: 0 })
          .set(phraseEls[next], { autoAlpha: 1 })
          .fromTo(
            wordsPerPhrase[next],
            { yPercent: 110 },
            { yPercent: 0, duration: 0.6, stagger: 0.04 },
            "<",
          )
          .to({}, { duration: intervalMs / 1000 });

        current = next;
      };

      // Hold the first phrase, then start cycling.
      tl.to({}, { duration: intervalMs / 1000 });
      // Pre-queue enough cycles; timeline repeats indefinitely so the cycle
      // count just needs to exceed the visible phrases once.
      for (let i = 0; i < phrases.length; i++) advance();
    }, containerRef);

    return () => ctx.revert();
  }, [phrases, intervalMs]);

  return (
    <h1
      ref={containerRef}
      className={`relative grid ${className ?? ""}`}
      aria-label={phrases[0]}
    >
      {phrases.map((phrase, i) => (
        <span
          key={i}
          // Stack every phrase in the same grid cell so the heading sizes
          // to the longest phrase and never reflows during animation.
          className="phrase col-start-1 row-start-1"
          aria-hidden={i === 0 ? undefined : true}
        >
          {phrase.split(" ").map((word, wi) => (
            <span
              key={wi}
              className="inline-block overflow-hidden align-bottom pb-[0.05em]"
            >
              <span className="word inline-block">
                {word}
                {wi < phrase.split(" ").length - 1 ? " " : ""}
              </span>
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}
