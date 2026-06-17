"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CtaLink } from "../CtaLink";
import { Rv } from "./Rv";
import { HeroConstellation } from "./HeroConstellation";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";
import {
  localizedContent,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";

// German copy + EN mirror (same ReactNode structure, only text translated).
type StudioHeroContent = {
  recChip: ReactNode;
  headline: ReactNode;
  lead: ReactNode;
  ctaPrimary: ReactNode;
  ctaSecondary: ReactNode;
};

const CONTENT_DE: StudioHeroContent = {
  recChip: (
    <>
      <b aria-hidden />
      Session läuft
    </>
  ),
  headline: (
    <>
      <span className="st-ln">
        <i>Hör zu, was dein</i>
      </span>
      <span className="st-ln">
        <i>
          Markt <span className="st-serif">wirklich</span> sagt.
        </i>
      </span>
    </>
  ),
  lead: (
    <>
      Klymeo führt{" "}
      <b className="font-medium text-neutral-900">
        hunderte qualitative Tiefeninterviews
      </b>{" "}
      mit deiner Zielgruppe — auf Deutsch, DSGVO-nativ, gehostet in
      Frankfurt. Eine KI, die nachbohrt wie ein erfahrener Researcher,
      und jede Erkenntnis{" "}
      <b className="font-medium text-neutral-900">am Transkript belegt</b>
      .
    </>
  ),
  ctaPrimary: (
    <>
      <span className="st-dot" aria-hidden />
      Demo buchen
    </>
  ),
  ctaSecondary: <>Session abspielen ↓</>,
};

const CONTENT_EN: StudioHeroContent = {
  recChip: (
    <>
      <b aria-hidden />
      Session live
    </>
  ),
  headline: (
    <>
      <span className="st-ln">
        <i>Listen to what your</i>
      </span>
      <span className="st-ln">
        <i>
          market <span className="st-serif">really</span> says.
        </i>
      </span>
    </>
  ),
  lead: (
    <>
      Klymeo runs{" "}
      <b className="font-medium text-neutral-900">
        hundreds of qualitative in-depth interviews
      </b>{" "}
      with your target audience — in German and English, GDPR-native,
      hosted in Frankfurt. An AI that probes like a seasoned researcher,
      and every finding{" "}
      <b className="font-medium text-neutral-900">evidenced in the transcript</b>
      .
    </>
  ),
  ctaPrimary: (
    <>
      <span className="st-dot" aria-hidden />
      Book a demo
    </>
  ),
  ctaSecondary: <>Play the session ↓</>,
};

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
export function StudioHero({
  lang = MARKETING_DEFAULT_LOCALE,
}: {
  lang?: Locale;
}) {
  const c = localizedContent(lang, { de: CONTENT_DE, en: CONTENT_EN });
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

    // Waveform-Füllfarbe aus dem Token --st-wave (im Dark-Mode heller). Einmal
    // lesen + bei Theme-Wechsel neu — kein getComputedStyle pro Frame.
    let waveColor = "rgba(74,81,168,.34)";
    const readWaveColor = () => {
      if (!wave) return;
      const v = getComputedStyle(wave).getPropertyValue("--st-wave").trim();
      if (v) waveColor = v;
    };

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
      wctx.fillStyle = waveColor;
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
    readWaveColor();
    window.addEventListener("resize", sizeWave);

    const schemeMq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      readWaveColor();
      if (reduce) drawWave(4200); // statisches Standbild neu einfärben
    };
    schemeMq.addEventListener("change", onScheme);

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
      schemeMq.removeEventListener("change", onScheme);
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, []);

  return (
    <section className="st-sky relative flex min-h-[clamp(640px,92svh,880px)] flex-col justify-end overflow-hidden pt-28">
      <HeroConstellation className="pointer-events-none absolute right-[-70px] top-[24px] z-0 w-[clamp(240px,30vw,500px)] opacity-[0.55]" />
      <canvas
        ref={waveRef}
        className="pointer-events-none absolute inset-x-0 bottom-3 h-[110px] w-full opacity-55"
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-[1280px] px-[clamp(20px,4vw,56px)]">
        <Rv className="st-fade mb-[clamp(24px,4vh,48px)] flex items-center justify-between">
          <span className="st-rec-chip">{c.recChip}</span>
          <span ref={tcRef} className="st-tc">
            00:00:00
          </span>
        </Rv>

        <Rv as="h1" className="st-rv st-display text-[clamp(40px,8.2vw,124px)]">
          {c.headline}
        </Rv>

        <div className="mt-[clamp(28px,4vh,52px)] grid gap-7 pb-[clamp(120px,18vh,200px)] md:grid-cols-[minmax(0,560px)_auto] md:items-end md:justify-between">
          <Rv as="p" className="st-fade max-w-[54ch] text-[clamp(16px,1.4vw,19px)] leading-[1.7] text-neutral-500" d={150}>
            {c.lead}
          </Rv>
          <Rv className="st-fade flex flex-wrap gap-3.5" d={250}>
            <CtaLink href={DEMO_BOOKING_URL} variant="primary" size="lg" className="magnetic">
              {c.ctaPrimary}
            </CtaLink>
            <CtaLink href="#session" variant="secondary" size="lg" className="magnetic">
              {c.ctaSecondary}
            </CtaLink>
          </Rv>
        </div>
      </div>
    </section>
  );
}
