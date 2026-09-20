"use client";

import { useEffect } from "react";

/**
 * Reveal-on-scroll for a long page.
 *
 * Everything marked `.reveal` starts hidden and slides up the first time it
 * crosses into view, then stops being watched — an entrance, not an effect
 * that replays every time you scroll back past it.
 *
 * The hiding lives behind `.reveals-armed`, added here rather than written
 * into the markup. A browser that never runs this (no script, an error before
 * hydration, a crawler) sees the page fully drawn instead of a column of blank
 * sections, which is the failure mode this pattern usually ships with.
 */
export function useReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (nodes.length === 0) return;

    // No observer, no staging: show everything and leave.
    if (typeof IntersectionObserver === "undefined") {
      nodes.forEach((n) => n.classList.add("is-in"));
      return;
    }

    document.body.classList.add("reveals-armed");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      // Fire a little before the block is fully on screen, so the motion has
      // finished by the time the reader's eye gets there.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    nodes.forEach((n) => observer.observe(n));

    /**
     * Safety net. Arming the hiding and then never firing leaves a blank page,
     * and an observer does not fire at all while the document is hidden — a tab
     * opened in the background is the ordinary case. That one heals itself when
     * the tab is looked at, but nothing else here should be able to strand the
     * content, so anything sitting in the viewport gets shown outright.
     *
     * When the observer is working these are already revealed and this is a
     * no-op, which is the point: it cannot fight the animation, only rescue it.
     */
    const sweep = () => {
      for (const node of nodes) {
        if (node.classList.contains("is-in")) continue;
        const box = node.getBoundingClientRect();
        if (box.top < window.innerHeight && box.bottom > 0) {
          node.classList.add("is-in");
          observer.unobserve(node);
        }
      }
    };

    let timer = window.setTimeout(sweep, 2500);
    const rearm = () => {
      if (document.hidden) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(sweep, 2500);
    };
    document.addEventListener("visibilitychange", rearm);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", rearm);
    };
  }, []);
}
