import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  localizedContent,
  localizePath,
  resolveLocale,
  toBcp47,
  type Locale,
} from "@/i18n/marketing-locale";
import { ModuleHero } from "@/components/marketing/module-template";
import { UseCaseGrid } from "@/components/marketing/use-case-template";
import { CTASection } from "@/components/marketing/CTASection";
import { SITE_URL, ogDefaultsFor, buildAlternates } from "@/lib/marketing/seo";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";

const PATH = "/loesungen";
const META = {
  title: {
    de: "Anwendungsfälle — dafür nutzt du Klymeo",
    en: "Use cases — what you use Klymeo for",
  },
  ogTitle: {
    de: "Anwendungsfälle — Klymeo",
    en: "Use cases — Klymeo",
  },
  description: {
    de: "Eine KI-Engine, mehrere Anwendungsfälle: qualitative Marktforschung und User Research mit echten Tiefeninterviews — auf Deutsch, belegt am Gespräch, DSGVO-nativ in Frankfurt.",
    en: "One AI engine, several use cases: qualitative market research and user research with real in-depth interviews — in German and English, evidenced in the conversation, GDPR-native in Frankfurt.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const locale = resolveLocale((await params).lang);
  return {
    title: localizedContent(locale, META.title),
    description: localizedContent(locale, META.description),
    alternates: buildAlternates(locale, PATH),
    openGraph: {
      ...ogDefaultsFor(locale),
      title: localizedContent(locale, META.ogTitle),
      url: localizePath(locale, PATH),
    },
  };
}

function buildJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Klymeo",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}${localizePath(locale, PATH)}`,
    inLanguage: toBcp47(locale),
    description: localizedContent(locale, META.description),
  };
}

export default async function LoesungenPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  const platformLabel = localizedContent(locale, {
    de: "Plattform ansehen",
    en: "See the platform",
  });
  return (
    <>
      <JsonLd data={buildJsonLd(locale)} />
      <ModuleHero
        locale={locale}
        eyebrow={localizedContent(locale, {
          de: "Lösungen · Anwendungsfälle",
          en: "Solutions · Use cases",
        })}
        title={localizedContent(locale, {
          de: <>Dafür nutzt du Klymeo.</>,
          en: <>What you use Klymeo for.</>,
        })}
        subhead={localizedContent(locale, {
          de: "Eine Engine, mehrere Anwendungsfälle: qualitative KI-Tiefeninterviews mit deiner Zielgruppe, belegt am Gespräch — auf Deutsch, DSGVO-nativ in Frankfurt. Wähl deinen Anwendungsfall.",
          en: "One engine, several use cases: qualitative AI in-depth interviews with your audience, evidenced in the conversation — in German and English, GDPR-native in Frankfurt. Pick your use case.",
        })}
        primary={{
          label: localizedContent(locale, {
            de: "Demo buchen →",
            en: "Book a demo →",
          }),
          href: DEMO_BOOKING_URL,
        }}
        secondary={{
          label: platformLabel,
          href: localizePath(locale, "/produkt"),
        }}
      />

      <UseCaseGrid
        locale={locale}
        tone="default"
        eyebrow={localizedContent(locale, {
          de: "Dafür nutzt du Klymeo",
          en: "What you use Klymeo for",
        })}
      />

      <CTASection
        lang={locale}
        secondary={{ label: platformLabel, href: localizePath(locale, "/produkt") }}
      />
    </>
  );
}
