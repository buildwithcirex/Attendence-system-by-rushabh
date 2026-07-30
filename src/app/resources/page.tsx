"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BookOpen, Plus, X, RotateCcw, Clock, Upload } from "lucide-react";
import { format } from "date-fns";
import { GradientBackground } from "@/components/GradientBackground";
import type { SessionPayload } from "@/utils/session";
import type { ResourceListItem, ResourceCategory } from "@/utils/resources";

type MyBorrow = {
  id: string;
  borrowed_at: string;
  expected_return_date: string;
  overdue: boolean;
  resource_title: string;
};

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function ResourcesPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<ResourceListItem[]>([]);
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [myBorrows, setMyBorrows] = useState<MyBorrow[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [error, setError] = useState("");

  const [borrowTarget, setBorrowTarget] = useState<ResourceListItem | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [catalogRes, mineRes] = await Promise.all([
        fetch("/api/resources"),
        fetch("/api/resources/mine"),
      ]);
      if (catalogRes.status === 401) {
        router.push("/login");
        return;
      }
      const catalog = await catalogRes.json();
      const mine = await mineRes.json();
      if (!catalog.success) throw new Error(catalog.error || "Failed to load resources");
      setResources(catalog.resources);
      setCategories(catalog.categories);
      if (mine.success) setMyBorrows(mine.borrows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resources");
    }
  }, [router]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch("/api/session/status");
        const data = res.ok ? await res.json() : null;
        if (!data?.authenticated) {
          router.push("/login");
          return;
        }
        setSession(data.session);
        await loadData();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router, loadData]);

  const returnBorrow = async (borrowId: string) => {
    try {
      const res = await fetch("/api/resources/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ borrow_id: borrowId }),
      });
      if (res.ok) {
        await loadData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to return resource.");
      }
    } catch {
      alert("Network error.");
    }
  };

  const filtered =
    activeCategory === "all"
      ? resources
      : resources.filter((r) => r.category?.id === activeCategory);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-9 h-9 rounded-full border-2 border-white/10 border-t-accent animate-spin" />
          <p className="text-muted font-light">Loading resources...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col relative overflow-hidden text-white bg-background">
      <GradientBackground />

      <header className="flex flex-wrap gap-4 justify-between items-center mb-6 glass-card rounded-2xl p-4 px-6">
        <div>
          <h1 className="font-extrabold text-2xl text-white">Resources</h1>
          <p className="text-sm text-muted">Borrow or donate books &amp; equipment</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDonateOpen(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg">
            <Plus className="w-4 h-4" />
            Donate
          </button>
          <button onClick={() => router.push("/dashboard")} className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
      )}

      {myBorrows.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted mb-3">Your Borrows</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myBorrows.map((b) => (
              <div key={b.id} className="glass-card rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{b.resource_title}</p>
                  <p className={`text-xs flex items-center gap-1 ${b.overdue ? "text-red-400" : "text-muted"}`}>
                    <Clock className="w-3 h-3" />
                    {b.overdue ? "Overdue — due " : "Due "}
                    {format(new Date(b.expected_return_date), "d MMM yyyy")}
                  </p>
                </div>
                <button onClick={() => returnBorrow(b.id)} className="btn-secondary text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shrink-0">
                  <RotateCcw className="w-3 h-3" />
                  Return
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        <CategoryChip label="All" active={activeCategory === "all"} onClick={() => setActiveCategory("all")} />
        {categories.map((c) => (
          <CategoryChip key={c.id} label={c.name} active={activeCategory === c.id} onClick={() => setActiveCategory(c.id)} />
        ))}
      </div>

      <main className="flex-1">
        {filtered.length === 0 ? (
          <div className="glass-card rounded-xl p-12 flex flex-col items-center gap-3 text-center">
            <BookOpen className="w-10 h-10 text-faint" />
            <p className="text-muted">No resources here yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((r, i) => (
              <ResourceCard key={r.id} resource={r} index={i} onBorrow={() => setBorrowTarget(r)} />
            ))}
          </div>
        )}
      </main>

      <AnimatePresence>
        {borrowTarget && (
          <BorrowModal
            resource={borrowTarget}
            session={session}
            onClose={() => setBorrowTarget(null)}
            onSuccess={async () => {
              setBorrowTarget(null);
              await loadData();
            }}
          />
        )}
        {donateOpen && (
          <DonateModal
            categories={categories}
            onClose={() => setDonateOpen(false)}
            onSuccess={async () => {
              setDonateOpen(false);
              await loadData();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-accent text-[color:var(--color-on-accent)] border-accent"
          : "bg-white/5 text-muted border-white/10 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

function ResourceCard({ resource, index, onBorrow }: { resource: ResourceListItem; index: number; onBorrow: () => void }) {
  const borrowed = resource.borrow !== null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1], delay: Math.min(index, 8) * 0.04 }}
      className="glass-card rounded-xl overflow-hidden flex flex-col"
    >
      <div className="aspect-[3/4] bg-surface-2 relative flex items-center justify-center">
        {resource.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resource.cover_image_url} alt={resource.title} className="w-full h-full object-cover" />
        ) : (
          <BookOpen className="w-10 h-10 text-faint" />
        )}
        <span
          className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-1 rounded-full border ${
            resource.borrow?.overdue
              ? "bg-red-500/15 text-red-300 border-red-500/30"
              : borrowed
                ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
          }`}
        >
          {resource.borrow?.overdue ? "Overdue" : borrowed ? "Borrowed" : "Available"}
        </span>
      </div>

      <div className="p-4 flex flex-col flex-1 gap-1">
        {resource.category && <p className="text-[10px] uppercase tracking-wider text-faint">{resource.category.name}</p>}
        <h3 className="font-semibold leading-tight">{resource.title}</h3>
        {resource.author && <p className="text-xs text-muted">{resource.author}</p>}
        {resource.description && <p className="text-xs text-faint line-clamp-2 mt-1">{resource.description}</p>}

        <div className="mt-auto pt-3">
          {borrowed && resource.borrow ? (
            <p className="text-xs text-muted">
              With <span className="text-white">{resource.borrow.borrower_name}</span> · due{" "}
              {format(new Date(resource.borrow.expected_return_date), "d MMM")}
            </p>
          ) : (
            <button onClick={onBorrow} className="btn-primary w-full py-2 rounded-lg text-sm">
              Borrow
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        className="glass-card rounded-2xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="text-faint hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function BorrowModal({
  resource,
  session,
  onClose,
  onSuccess,
}: {
  resource: ResourceListItem;
  session: SessionPayload;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(session.name);
  const [email, setEmail] = useState(session.email ?? "");
  const [returnDate, setReturnDate] = useState("");
  const [conditionOut, setConditionOut] = useState("Good");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/resources/borrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_id: resource.id,
          borrower_name: name,
          borrower_email: email,
          expected_return_date: returnDate,
          condition_out: conditionOut,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setErr(data.error || "Failed to borrow.");
      }
    } catch {
      setErr("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title={`Borrow "${resource.title}"`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Your name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="field w-full rounded-lg px-3 py-2 text-sm" />
        </Field>
        <Field label="Contact email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="field w-full rounded-lg px-3 py-2 text-sm" />
        </Field>
        <Field label="Expected return date">
          <input value={returnDate} onChange={(e) => setReturnDate(e.target.value)} type="date" min={todayIso()} className="field w-full rounded-lg px-3 py-2 text-sm" />
        </Field>
        <Field label="Condition when taken">
          <select value={conditionOut} onChange={(e) => setConditionOut(e.target.value)} className="field w-full rounded-lg px-3 py-2 text-sm">
            <option value="New">New</option>
            <option value="Good">Good</option>
            <option value="Fair">Fair</option>
            <option value="Worn">Worn</option>
            <option value="Damaged">Damaged</option>
          </select>
        </Field>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button onClick={submit} disabled={submitting} className="btn-primary py-2.5 rounded-lg">
          {submitting ? "Borrowing..." : "Confirm Borrow"}
        </button>
      </div>
    </ModalShell>
  );
}

function DonateModal({
  categories,
  onClose,
  onSuccess,
}: {
  categories: ResourceCategory[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [author, setAuthor] = useState("");
  const [condition, setCondition] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const uploadCover = async (file: File) => {
    setErr("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resources/upload-cover", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setCoverUrl(data.url);
      } else {
        setErr(data.error || "Failed to upload cover.");
      }
    } catch {
      setErr("Network error uploading cover.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setErr("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/resources/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category_id: categoryId || undefined,
          author,
          condition,
          description,
          cover_image_url: coverUrl || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setErr(data.error || "Failed to submit donation.");
      }
    } catch {
      setErr("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Donate a resource" onClose={onClose}>
      <p className="text-xs text-muted mb-4">Your donation is reviewed by an admin before it appears in the catalog.</p>
      <div className="flex flex-col gap-4">
        <Field label="Title *">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="field w-full rounded-lg px-3 py-2 text-sm" />
        </Field>
        <Field label="Category">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="field w-full rounded-lg px-3 py-2 text-sm">
            <option value="">Suggest a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Author / Maker">
          <input value={author} onChange={(e) => setAuthor(e.target.value)} className="field w-full rounded-lg px-3 py-2 text-sm" />
        </Field>
        <Field label="Condition">
          <input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="New / Good / Worn" className="field w-full rounded-lg px-3 py-2 text-sm" />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="field w-full rounded-lg px-3 py-2 text-sm resize-none" />
        </Field>
        <Field label="Cover image">
          <label className="btn-secondary flex items-center justify-center gap-2 py-2 rounded-lg text-sm cursor-pointer">
            <Upload className="w-4 h-4" />
            {uploading ? "Uploading..." : coverUrl ? "Replace image" : "Upload image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadCover(file);
              }}
            />
          </label>
          {coverUrl && <p className="text-xs text-emerald-400 mt-1">Image attached.</p>}
        </Field>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button onClick={submit} disabled={submitting || uploading} className="btn-primary py-2.5 rounded-lg">
          {submitting ? "Submitting..." : "Submit Donation"}
        </button>
      </div>
    </ModalShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}
