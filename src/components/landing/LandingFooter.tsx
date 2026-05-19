import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-violet-500/10 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <Link href="/" className="inline-flex items-center mb-4 group">
              <div className="relative">
                <span className="text-white font-bold text-lg tracking-tight">
                  findr
                </span>
                <div className="absolute -top-0.5 -right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse-glow" />
              </div>
            </Link>
            <p className="text-xs text-mist/50">Conversation Intelligence Platform for European B2B SaaS.</p>
          </div>
          <div>
            <div className="text-xs text-white font-semibold mb-3 tracking-wide">PRODUCT</div>
            <div className="space-y-2">
              <Link href="#modules" className="block text-sm text-mist/60 hover:text-white">Modules</Link>
              <Link href="#platform" className="block text-sm text-mist/60 hover:text-white">Platform</Link>
              <Link href="/pricing" className="block text-sm text-mist/60 hover:text-white">Pricing</Link>
            </div>
          </div>
          <div>
            <div className="text-xs text-white font-semibold mb-3 tracking-wide">COMPANY</div>
            <div className="space-y-2">
              <Link href="#" className="block text-sm text-mist/60 hover:text-white">About</Link>
              <Link href="#" className="block text-sm text-mist/60 hover:text-white">Blog</Link>
              <Link href="#" className="block text-sm text-mist/60 hover:text-white">Contact</Link>
            </div>
          </div>
          <div>
            <div className="text-xs text-white font-semibold mb-3 tracking-wide">LEGAL</div>
            <div className="space-y-2">
              <Link href="#" className="block text-sm text-mist/60 hover:text-white">Impressum</Link>
              <Link href="#" className="block text-sm text-mist/60 hover:text-white">Privacy</Link>
              <Link href="#" className="block text-sm text-mist/60 hover:text-white">Terms</Link>
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
