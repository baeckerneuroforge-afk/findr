import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-ink text-paper py-[38px] text-center">
      <div className="max-w-[1180px] mx-auto px-7">
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-[3px] font-display font-extrabold text-[26px] tracking-[-0.04em] text-paper"
        >
          findr
          <span className="w-[9px] h-[9px] rounded-full bg-comic-red border-2 border-ink mb-[14px]" />
        </Link>
        <div className="text-[13px] font-medium text-[#b8b3a3] mt-[14px] tracking-[0.03em]">
          Built in Germany · Hosted in Frankfurt · EU AI Act compliant
        </div>
      </div>
    </footer>
  );
}
