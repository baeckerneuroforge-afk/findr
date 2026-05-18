const logos: { name: string; style: string }[] = [
  { name: "SaaSCo", style: "font-bold" },
  { name: "Helven", style: "font-light italic" },
  { name: "Lattix", style: "font-mono font-semibold" },
  { name: "RootSignal", style: "font-medium" },
];

export default function SocialProof() {
  return (
    <div className="mx-auto mt-20 max-w-2xl text-center">
      <p className="text-xs uppercase tracking-wider text-mist/60">
        Loved by revenue teams at
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-6 md:gap-10">
        {logos.map((logo) => (
          <span
            key={logo.name}
            className={`text-sm tracking-wide text-mist/55 ${logo.style}`}
          >
            {logo.name}
          </span>
        ))}
      </div>
    </div>
  );
}
