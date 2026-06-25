import type { ReactNode } from "react";

export function Table({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-neutral-50 border-b border-neutral-200">
      {children}
    </thead>
  );
}

export function TH({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2.5 text-left text-caption font-medium text-neutral-500 uppercase tracking-wider ${className}`}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

interface TRProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function TR({ children, className = "", onClick }: TRProps) {
  return (
    <tr
      className={`border-b border-neutral-100 last:border-b-0 ${
        onClick
          ? "cursor-pointer hover:bg-neutral-50 active:bg-neutral-100 transition-colors duration-150"
          : ""
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-body text-neutral-700 ${className}`}>
      {children}
    </td>
  );
}
