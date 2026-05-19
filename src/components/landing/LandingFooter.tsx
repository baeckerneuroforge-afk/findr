import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-violet-500/10 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
                <span className="text-white font-bold text-xs">f</span>
              </div>
              <span className="text-white font-semibold">findr</span>
            </div>
            <p className="text-xs text-mist/50">Conversation Intelligence Platform for European B2B SaaS.</p>
          </div>
          <div>
            <div className="text-xs text-white font-semibold mb-3 tracking-wide">PRODUKT</div>
            <div className="space-y-2">
              <Link href="#modules" className="block text-sm text-mist/60 hover:text-white">Module</Link>
              <Link href="#platform" className="block text-sm text-mist/60 hover:text-white">Plattform</Link>
              <Link href="/pricing" className="block text-sm text-mist/60 hover:text-white">Pricing</Link>
            </div>
          </div>
          <div>
            <div className="text-xs text-white font-semibold mb-3 tracking-wide">COMPANY</div>
            <div className="space-y-2">
              <Link href="#" className="block text-sm text-mist/60 hover:text-white">Über uns</Link>
              <Link href="#" className="block text-sm text-mist/60 hover:text-white">Blog</Link>
              <Link href="#" className="block text-sm text-mist/60 hover:text-white">Kontakt</Link>
            </div>
          </div>
          <div>
            <div className="text-xs text-white font-semibold mb-3 tracking-wide">LEGAL</div>
            <div className="space-y-2">
              <Link href="#" className="block text-sm text-mist/60 hover:text-white">Impressum</Link>
              <Link href="#" className="block text-sm text-mist/60 hover:text-white">Datenschutz</Link>
              <Link href="#" className="block text-sm text-mist/60 hover:text-white">AGB</Link>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-violet-500/10 text-xs text-mist/40 text-center">
          © 2026 Findr · Built by Hephaistos Systems · Made with care in Germany
        </div>
      </div>
    </footer>
  );
}
