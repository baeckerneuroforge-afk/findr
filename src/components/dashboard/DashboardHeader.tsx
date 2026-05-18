import { UserButton } from "@clerk/nextjs";

interface DashboardHeaderProps {
  title: string;
}

export default function DashboardHeader({ title }: DashboardHeaderProps) {
  return (
    <header className="fixed left-60 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-mist/10 bg-obsidian/80 px-6 backdrop-blur-md">
      <h1 className="text-base font-medium text-white">{title}</h1>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-700"
        >
          Connect Hubspot
        </button>
        <UserButton />
      </div>
    </header>
  );
}
