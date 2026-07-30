"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";

type BudgetStatus = "draft" | "submitted" | "approved" | "rejected";

type BudgetItem = {
  id: string;
  name: string;
  quantity: number;
  unit_cost: number;
  resource_id: string | null;
};

type PrintData = {
  projectName: string;
  ownerName: string;
  dueDate: string | null;
  status: BudgetStatus;
  currency: string;
  reviewNote: string | null;
  items: BudgetItem[];
};

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

export default function BudgetPrintPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<PrintData | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [projectRes, budgetRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`),
          fetch(`/api/projects/${projectId}/budget`),
        ]);
        if (projectRes.status === 401 || budgetRes.status === 401) {
          router.push("/login");
          return;
        }
        if (!projectRes.ok || !budgetRes.ok) {
          setError("This project doesn't exist or you don't have access to it.");
          return;
        }
        const pd = await projectRes.json();
        const bd = await budgetRes.json();
        if (pd.success && bd.success) {
          setData({
            projectName: pd.project.name,
            ownerName: pd.project.owner?.name ?? "—",
            dueDate: pd.project.due_date,
            status: bd.budget.status,
            currency: bd.budget.currency,
            reviewNote: bd.budget.review_note,
            items: bd.budget.items,
          });
        } else {
          setError("Failed to load budget.");
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [projectId, router]);

  const total = useMemo(
    () => (data?.items ?? []).reduce((sum, it) => sum + it.quantity * it.unit_cost, 0),
    [data],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-200">
        <div className="w-10 h-10 rounded-full border-2 border-black/10 border-t-black/50 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-neutral-200 text-neutral-700">
        <p>{error || "Budget not available."}</p>
        <button onClick={() => router.push(`/projects/${projectId}/budget`)} className="px-4 py-2 rounded bg-neutral-800 text-white">
          Back
        </button>
      </div>
    );
  }

  const isDraftWatermark = data.status !== "approved";

  return (
    <div className="min-h-screen bg-neutral-300 py-8 print:bg-white print:py-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 18mm 16mm; }
          html, body { background: #fff !important; }
        }
      `}</style>

      {/* Screen-only toolbar */}
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex items-center justify-between px-4">
        <button
          onClick={() => router.push(`/projects/${projectId}/budget`)}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-neutral-800 text-white text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded bg-emerald-600 text-white text-sm font-medium"
        >
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      {/* Paper sheet */}
      <div className="relative max-w-[210mm] mx-auto bg-white text-neutral-900 shadow-xl print:shadow-none p-[16mm] print:p-0">
        {isDraftWatermark && (
          <div
            className="pointer-events-none fixed inset-0 flex items-center justify-center"
            aria-hidden
          >
            <span className="text-[140px] font-black uppercase tracking-widest text-neutral-900/[0.06] -rotate-[30deg] select-none">
              Draft
            </span>
          </div>
        )}

        {/* --- Letterhead (swap this block for the official template) --- */}
        <header className="border-b-2 border-neutral-900 pb-4 mb-6">
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">E-Cell</h1>
              <p className="text-sm text-neutral-600">Entrepreneurship Cell</p>
            </div>
            <div className="text-right text-sm text-neutral-600">
              <p className="font-semibold text-neutral-900">Project Budget</p>
              <p>{new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
          </div>
        </header>

        {/* Meta */}
        <section className="mb-6 text-sm">
          <div className="grid grid-cols-2 gap-y-1">
            <div><span className="text-neutral-500">Project:</span> <span className="font-medium">{data.projectName}</span></div>
            <div><span className="text-neutral-500">Owner:</span> <span className="font-medium">{data.ownerName}</span></div>
            <div>
              <span className="text-neutral-500">Status:</span>{" "}
              <span className="font-medium uppercase">{data.status}</span>
            </div>
            {data.dueDate && <div><span className="text-neutral-500">Target date:</span> <span className="font-medium">{data.dueDate}</span></div>}
          </div>
        </section>

        {/* Line items */}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-y border-neutral-300 text-left">
              <th className="py-2 pr-3 font-semibold">#</th>
              <th className="py-2 pr-3 font-semibold">Item</th>
              <th className="py-2 px-3 font-semibold text-right w-16">Qty</th>
              <th className="py-2 px-3 font-semibold text-right w-32">Unit cost</th>
              <th className="py-2 pl-3 font-semibold text-right w-32">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it, i) => (
              <tr key={it.id} className="border-b border-neutral-200">
                <td className="py-2 pr-3 text-neutral-500">{i + 1}</td>
                <td className="py-2 pr-3">
                  {it.name}
                  {it.resource_id && <span className="ml-2 text-[11px] text-neutral-500">(library)</span>}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">{it.quantity}</td>
                <td className="py-2 px-3 text-right tabular-nums">{formatMoney(it.unit_cost, data.currency)}</td>
                <td className="py-2 pl-3 text-right tabular-nums">{formatMoney(it.quantity * it.unit_cost, data.currency)}</td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-neutral-400">No line items.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-900">
              <td colSpan={4} className="py-3 pr-3 text-right font-semibold">Grand Total</td>
              <td className="py-3 pl-3 text-right text-lg font-bold tabular-nums">{formatMoney(total, data.currency)}</td>
            </tr>
          </tfoot>
        </table>

        {data.status === "approved" && data.reviewNote && (
          <p className="mt-4 text-sm text-neutral-600">Note: {data.reviewNote}</p>
        )}

        {/* Sign-off */}
        <footer className="mt-16 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="border-t border-neutral-400 pt-2">Prepared by</div>
          </div>
          <div>
            <div className="border-t border-neutral-400 pt-2">
              Approved by {data.status === "approved" ? "" : "(pending)"}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
