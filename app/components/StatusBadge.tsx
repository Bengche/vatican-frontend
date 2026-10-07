const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  cancelled: "bg-slate-100 text-slate-600",
  sent: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  processing: "bg-amber-50 text-amber-700",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-bold capitalize ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}