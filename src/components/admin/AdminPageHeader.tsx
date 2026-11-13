import Link from "next/link";

export function AdminPageHeader({
  title,
  backHref,
  action,
}: {
  title: string;
  backHref?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex items-center gap-4">
      {backHref && (
        <Link href={backHref} className="text-sm text-zinc-400 hover:text-white">
          ← Back
        </Link>
      )}
      <h1 className="text-xl font-bold text-zinc-50">{title}</h1>
      {action && (
        <Link
          href={action.href}
          className="ml-auto rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export const tableClass = "w-full text-left text-sm";
export const thClass = "border-b border-white/10 px-2 py-2 font-medium text-zinc-400";
export const tdClass = "border-b border-white/5 px-2 py-2 text-zinc-200";
