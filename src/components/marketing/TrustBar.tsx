import type { ComponentType, SVGProps } from "react";
import { Container } from "./primitives";
import { Reveal } from "./Reveal";
import {
  MapPinIcon,
  ServerIcon,
  ShieldCheckIcon,
  FileCheckIcon,
} from "./icons";

/**
 * Honest trust anchors — NO invented customer logos (we have none). Instead the
 * DACH-sovereignty story that is actually load-bearing for the product.
 *
 * TODO D3: "DSGVO-konform" / "EU AI Act" are advertising claims (UWG). Carried
 * verbatim from the footer/hero chips — substantiate or soften before go-live
 * (André). No fabricated certifications or seals here.
 */
const ANCHORS: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  sub: string;
}[] = [
  { Icon: MapPinIcon, label: "In Deutschland gebaut", sub: "Team & Entwicklung in der DACH-Region" },
  { Icon: ServerIcon, label: "In der EU gehostet", sub: "Rechenzentrum Frankfurt am Main" },
  { Icon: ShieldCheckIcon, label: "DSGVO-konform", sub: "Datenschutz als Grundlage, nicht Nachgedanke" },
  { Icon: FileCheckIcon, label: "EU AI Act", sub: "Auf den europäischen KI-Rahmen ausgerichtet" },
];

export function TrustBar() {
  return (
    <section className="border-y border-neutral-200 bg-neutral-50">
      <Container className="py-8 sm:py-10">
        <Reveal>
          <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
            Souverän aus Europa — keine Plattform-Lock-ins, keine US-Cloud
          </p>
        </Reveal>
        {/* Staggered anchors: each fades + lifts in on its own ~60ms delay. */}
        <div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-7 lg:grid-cols-4">
          {ANCHORS.map((a, i) => (
            <Reveal
              key={a.label}
              y={10}
              delay={i * 0.06}
              className="flex items-start gap-3"
            >
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-neutral-200 bg-white text-primary-600">
                <a.Icon className="h-[18px] w-[18px]" />
              </span>
              <div>
                <div className="text-[13px] font-semibold text-neutral-900">
                  {a.label}
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-neutral-500">
                  {a.sub}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
