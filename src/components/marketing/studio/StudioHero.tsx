"use client";

import { useEffect, useRef } from "react";
import { CtaLink } from "../CtaLink";
import { Rv } from "./Rv";

/**
 * Homepage-Hero der Studio-Bühne: „Aufnahme läuft“-Chip mit live laufendem
 * Timecode, Poster-Headline mit Zeilen-Maskenreveal, Lead + CTAs — und die
 * pulsierende Waveform als Boden des Viewports (Canvas, Tinte auf Papier).
 *
 * Client-Komponente wegen Timecode-rAF + Canvas; der Text wird trotzdem
 * server-seitig vorgerendert (SEO unverändert). prefers-reduced-motion:
 * Timecode steht auf 00:00:00, die Waveform ist ein statisches Standbild,
 * die Reveals erscheinen sofort (Rv-Hard-Off).
 */
export function StudioHero() {
  const tcRef = useRef<HTMLSpanElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tcEl = tcRef.current;
    const wave = waveRef.current;
    const wctx = wave?.getContext("2d") ?? null;
    let raf = 0;
    let waveVisible = true;
    let io: IntersectionObserver | null = null;

    // ── Timecode (mm:ss:ff, ~24fps-Frames) ───────────────────────────
    const t0 = performance.now();
    const pad = (n: number) => (n < 10 ? "0" : "") + n;
    const fmt = (ms: number) => {
      const s = Math.floor(ms / 1000);
      const f = Math.floor((ms % 1000) / 41.7);
      return `${pad(Math.floor(s / 60))}:${pad(s % 60)}:${pad(f)}`;
    };

    // ── Waveform ─────────────────────────────────────────────────────
    const sizeWave = () => {
      if (!wave || !wctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      wave.width = wave.offsetWidth * dpr;
      wave.height = wave.offsetHeight * dpr;
      wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const drawWave = (t: number) => {
      if (!wave || !wctx) return;
      const w = wave.offsetWidth;
      const h = wave.offsetHeight;
      const mid = h / 2;
      wctx.clearRect(0, 0, w, h);
      wctx.fillStyle = "rgba(74,81,168,.34)";
      const bw = 3;
      const gap = 6;
      const n = Math.ceil(w / (bw + gap));
      for (let i = 0; i < n; i++) {
        const a =
          Math.sin(i * 0.32 + t * 0.0021) * Math.sin(i * 0.07 - t * 0.0009);
        const bh = 4 + Math.abs(a) * (h * 0.42);
        wctx.fillRect(i * (bw + gap), mid - bh / 2, bw, bh);
      }
    };

    sizeWave();
    window.addEventListener("resize", sizeWave);

    if (reduce) {
      drawWave(4200); // statisches Standbild
      if (tcEl) tcEl.textContent = "00:00:00";
    } else {
      const tick = (now: number) => {
        if (tcEl) tcEl.textContent = fmt(now - t0);
        if (waveVisible) drawWave(now);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      if (wave && "IntersectionObserver" in window) {
        io = new IntersectionObserver((e) => {
          waveVisible = !!e[0]?.isIntersecting;
        });
        io.observe(wave);
      }
    }

    return () => {
      window.removeEventListener("resize", sizeWave);
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, []);

  return (
    <section className="st-sky relative flex min-h-[92svh] flex-col justify-end overflow-hidden pt-28">
      <canvas
        ref={waveRef}
        className="pointer-events-none absolute inset-x-0 bottom-16 h-[110px] w-full opacity-55"
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-[1280px] px-[clamp(20px,4vw,56px)]">
        <Rv className="st-fade mb-[clamp(24px,4vh,48px)] flex items-center justify-between">
          <span className="st-rec-chip">
            <b aria-hidden />
            Session läuft
          </span>
          <span ref={tcRef} className="st-tc">
            00:00:00
          </span>
        </Rv>

        <Rv as="h1" className="st-rv st-display text-[clamp(40px,8.2vw,124px)]">
          <span className="st-ln">
            <i>Hör zu, was dein</i>
          </span>
          <span className="st-ln">
            <i>
              Markt <span className="st-serif">wirklich</span> sagt.
            </i>
          </span>
        </Rv>

        <div className="mt-[clamp(28px,4vh,52px)] grid gap-7 pb-[clamp(120px,18vh,200px)] md:grid-cols-[minmax(0,560px)_auto] md:items-end md:justify-between">
          <Rv as="p" className="st-fade max-w-[54ch] text-[clamp(16px,1.4vw,19px)] leading-[1.7] text-neutral-500" d={150}>
            findr. führt{" "}
            <b className="font-medium text-neutral-900">
              hunderte qualitative Tiefeninterviews
            </b>{" "}
            mit deiner Zielgruppe — auf Deutsch, DSGVO-nativ, gehostet in
            Frankfurt. Eine KI, die nachbohrt wie ein erfahrener Researcher,
            und jede Erkenntnis{" "}
            <b className="font-medium text-neutral-900">am Transkript belegt</b>
            .
          </Rv>
          <Rv className="st-fade flex flex-wrap gap-3.5" d={250}>
            <CtaLink href="/demo" variant="primary" size="lg" className="magnetic">
              <span className="st-dot" aria-hidden />
              Demo buchen
            </CtaLink>
            <CtaLink href="#session" variant="secondary" size="lg" className="magnetic">
              Session abspielen ↓
            </CtaLink>
          </Rv>
        </div>
      </div>
    </section>
  );
}
