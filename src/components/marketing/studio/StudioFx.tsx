"use client";

import { useEffect, useRef } from "react";

/**
 * Globale Konsolen-Effekte für die gesamte Marketing-Oberfläche:
 *
 *   1. Custom-Cursor (Indigo-Punkt + nachziehender Ring) — nur auf Geräten
 *      mit feinem Pointer und ohne prefers-reduced-motion. Der System-Cursor
 *      bleibt sichtbar (kein cursor:none — Akzent, nicht Ersatz).
 *   2. Magnetische Buttons — jedes Element mit der Klasse `magnetic` folgt
 *      dem Pointer ein paar Pixel (Event-Delegation, ein einziger Listener).
 *   3. Scroll-Fortschritt — die 2px-Indigo-Hairline ganz oben skaliert mit
 *      der Lesposition. Läuft AUCH unter Reduced-Motion: sie ist eine
 *      Positionsanzeige (folgt 1:1 dem Scroll), keine Animation.
 *
 * Reines Client-Theater: kein State nach außen, alles wird beim Unmount
 * sauber abgeräumt.
 */
export function StudioFx() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Scroll-Fortschritt (motion-unabhängig, rAF-gedrosselt).
  useEffect(() => {
    const bar = progressRef.current;
    if (!bar) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;

    document.documentElement.classList.add("st-cursor-on");
    const dot = dotRef.current;
    const ring = ringRef.current;

    let mx = -100;
    let my = -100;
    let rx = -100;
    let ry = -100;
    let raf = 0;
    let magnetic: HTMLElement | null = null;

    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;

      // Magnet: Element unter dem Pointer mit .magnetic leicht mitziehen.
      const target = e.target instanceof Element ? e.target : null;
      const m = target?.closest<HTMLElement>(".magnetic") ?? null;
      if (m !== magnetic && magnetic) magnetic.style.transform = "";
      magnetic = m;
      if (m) {
        const r = m.getBoundingClientRect();
        const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
        const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        m.style.transform = `translate(${dx * 7}px, ${dy * 6}px)`;
      }

      // Ring „heiß“ über Links/Buttons.
      ring?.classList.toggle("hot", !!target?.closest("a,button"));

      // rAF wieder anwerfen, falls er im Leerlauf pausiert wurde.
      kick();
    };

    const tick = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      if (dot) dot.style.transform = `translate(${mx - 3}px, ${my - 3}px)`;
      if (ring) ring.style.transform = `translate(${rx - 17}px, ${ry - 17}px)`;
      // Selbst-suspendieren, sobald der Ring den Cursor eingeholt hat: kein
      // Dauer-rAF mit Style-Writes mehr, während die Maus still steht.
      if (Math.abs(mx - rx) < 0.25 && Math.abs(my - ry) < 0.25) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    kick();

    return () => {
      document.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      if (magnetic) magnetic.style.transform = "";
      document.documentElement.classList.remove("st-cursor-on");
    };
  }, []);

  return (
    <>
      <div ref={progressRef} className="st-progress" aria-hidden />
      <div ref={dotRef} className="st-cursor-dot" aria-hidden />
      <div ref={ringRef} className="st-cursor-ring" aria-hidden />
    </>
  );
}
