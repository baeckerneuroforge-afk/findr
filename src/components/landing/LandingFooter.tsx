import Link from "next/link";

const PRODUCT_LINKS = [
  { label: "Features", href: "/product" },
  { label: "Pricing", href: "/pricing" },
  { label: "Customers", href: "/customers" },
];

const COMPANY_LINKS = [
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
  { label: "Blog", href: "#blog" },
];

const LEGAL_LINKS = [
  { label: "Privacy", href: "#privacy" },
  { label: "Terms", href: "#terms" },
  { label: "Security", href: "#security" },
];

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-white">{heading}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm text-mist transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LandingFooter() {
  return (
    <footer className="mt-32 border-t border-mist/10">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" aria-label="Findr home" className="inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Findr" className="h-[26px] w-auto" />
            </Link>
            <p className="mt-3 max-w-xs text-sm text-mist">
              Revenue Intelligence OS for B2B SaaS sales teams.
            </p>
          </div>

          <FooterColumn heading="Product" links={PRODUCT_LINKS} />
          <FooterColumn heading="Company" links={COMPANY_LINKS} />
          <FooterColumn heading="Legal" links={LEGAL_LINKS} />
        </div>

        <div className="mt-10 flex flex-col justify-between gap-3 border-t border-mist/10 pt-6 text-xs text-mist sm:flex-row">
          <p>&copy; 2026 Findr. All rights reserved.</p>
          <p>Private beta &middot; Built for revenue teams</p>
        </div>
      </div>
    </footer>
  );
}
