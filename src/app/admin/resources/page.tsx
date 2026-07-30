"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, ShieldAlert, X, Check, Trash2, RotateCcw, Pencil, BookOpen, Upload } from "lucide-react";
import { format } from "date-fns";
import { GradientBackground } from "@/components/GradientBackground";
import type { ResourceStatus } from "@/utils/resources";

type Category = { id: string; name: string; is_active: boolean };

type AdminBorrow = {
  id: string;
  borrower_name: string;
  borrower_email: string | null;
  borrowed_at: string;
  expected_return_date: string;
  overdue: boolean;
};

type AdminResource = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  condition: string | null;
  cover_image_url: string | null;
  status: ResourceStatus;
  created_at: string;
  category: { id: string; name: string } | null;
  donor: { id: string; name: string; pnr_number: string } | null;
  borrow: AdminBorrow | null;
};

type ResourceForm = {
  title: string;
  category_id: string;
  author: string;
  condition: string;
  description: string;
  cover_image_url: string;
};

const EMPTY_FORM: ResourceForm = { title: "", category_id: "", author: "", condition: "", description: "", cover_image_url: "" };

export default function AdminResourcesPage() {
  const router = useRouter();
  const [resources, setResources] = useState<AdminResource[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminResource | null>(null);
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [resourcesRes, optionsRes] = await Promise.all([
        fetch("/api/admin/resources"),
        fetch("/api/admin/options"),
      ]);
      if (resourcesRes.status === 403) throw new Error("Unauthorized access. Admin privileges required.");
      const data = await resourcesRes.json();
      const options = await optionsRes.json();
      if (!data.success) throw new Error(data.error || "Failed to load resources");
      setResources(data.resources);
      if (options.success) setCategories((options.resource_categories as Category[]).filter((c) => c.is_active));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resources");
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await loadData();
      setLoading(false);
    };
    load();
  }, [loadData]);

  const patch = async (resource_id: string, action: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch("/api/admin/resources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource_id, action, ...extra }),
    });
    if (res.ok) {
      await loadData();
    } else {
      const data = await res.json();
      alert(data.error || "Action failed.");
    }
  };

  const markReturned = async (borrowId: string) => {
    const res = await fetch("/api/resources/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ borrow_id: borrowId }),
    });
    if (res.ok) {
      await loadData();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to mark returned.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-white/70 animate-spin" />
          <p className="text-muted font-light">Loading resources...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-background">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-muted">{error}</p>
        <button onClick={() => router.push("/dashboard")} className="btn-secondary mt-4 px-6 py-2 rounded-lg">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const pending = resources.filter((r) => r.status === "pending");
  const active = resources.filter((r) => r.status === "active");
  const inactive = resources.filter((r) => r.status === "inactive");

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col relative overflow-hidden text-white bg-background">
      <GradientBackground />

      <header className="flex flex-wrap gap-4 justify-between items-center mb-6 glass-card rounded-2xl p-4 px-6">
        <div>
          <h1 className="font-extrabold text-2xl text-white">Manage Resources</h1>
          <p className="text-sm text-muted">Donations, catalog &amp; borrows</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg">
            <Plus className="w-4 h-4" />
            Add
          </button>
          <button onClick={() => router.push("/admin")} className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </header>

      <main className="flex flex-col gap-8">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted mb-3">
            Pending Donations {pending.length > 0 && <span className="text-amber-400">({pending.length})</span>}
          </h2>
          {pending.length === 0 ? (
            <p className="text-faint text-sm">No donations awaiting review.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pending.map((r) => (
                <div key={r.id} className="glass-card rounded-xl p-4 flex flex-col gap-2">
                  <ResourceSummary resource={r} />
                  {r.donor && <p className="text-xs text-faint">Donated by {r.donor.name} ({r.donor.pnr_number})</p>}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => patch(r.id, "approve")} className="btn-primary flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-1">
                      <Check className="w-4 h-4" /> Approve
                    </button>
                    <button onClick={() => confirm("Reject and delete this donation?") && patch(r.id, "reject")} className="btn-secondary py-2 px-3 rounded-lg text-sm flex items-center gap-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted mb-3">Catalog ({active.length})</h2>
          {active.length === 0 ? (
            <p className="text-faint text-sm">No active resources. Use “Add” or approve a donation.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {active.map((r) => (
                <div key={r.id} className="glass-card rounded-xl p-4 flex flex-col gap-2">
                  <ResourceSummary resource={r} />
                  {r.borrow ? (
                    <div className={`text-xs rounded-lg p-2 ${r.borrow.overdue ? "bg-red-500/10 text-red-300" : "bg-amber-500/10 text-amber-200"}`}>
                      <p className="font-medium">{r.borrow.overdue ? "Overdue" : "Borrowed"}</p>
                      <p>{r.borrow.borrower_name}{r.borrow.borrower_email ? ` · ${r.borrow.borrower_email}` : ""}</p>
                      <p>Due {format(new Date(r.borrow.expected_return_date), "d MMM yyyy")}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-emerald-400">Available</span>
                  )}
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {r.borrow && (
                      <button onClick={() => markReturned(r.borrow!.id)} className="btn-secondary py-1.5 px-3 rounded-lg text-xs flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" /> Mark returned
                      </button>
                    )}
                    <button onClick={() => setEditing(r)} className="btn-secondary py-1.5 px-3 rounded-lg text-xs flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    {!r.borrow && (
                      <button onClick={() => confirm("Retire this resource from the catalog?") && patch(r.id, "retire")} className="btn-secondary py-1.5 px-3 rounded-lg text-xs flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Retire
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {inactive.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted mb-3">Retired ({inactive.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inactive.map((r) => (
                <div key={r.id} className="glass-card rounded-xl p-4 flex flex-col gap-2 opacity-70">
                  <ResourceSummary resource={r} />
                  <button onClick={() => patch(r.id, "reactivate")} className="btn-secondary py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 self-start">
                    <RotateCcw className="w-3 h-3" /> Reactivate
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <AnimatePresence>
        {adding && (
          <ResourceFormModal
            title="Add resource"
            categories={categories}
            initial={EMPTY_FORM}
            submitLabel="Add to catalog"
            onClose={() => setAdding(false)}
            onSubmit={async (form) => {
              const res = await fetch("/api/admin/resources", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
              });
              if (res.ok) {
                setAdding(false);
                await loadData();
              } else {
                const data = await res.json();
                alert(data.error || "Failed to add resource.");
              }
            }}
          />
        )}
        {editing && (
          <ResourceFormModal
            title="Edit resource"
            categories={categories}
            initial={{
              title: editing.title,
              category_id: editing.category?.id ?? "",
              author: editing.author ?? "",
              condition: editing.condition ?? "",
              description: editing.description ?? "",
              cover_image_url: editing.cover_image_url ?? "",
            }}
            submitLabel="Save changes"
            onClose={() => setEditing(null)}
            onSubmit={async (form) => {
              await patch(editing.id, "update", form);
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ResourceSummary({ resource }: { resource: AdminResource }) {
  return (
    <div className="flex gap-3">
      <div className="w-14 h-20 rounded-md bg-surface-2 shrink-0 flex items-center justify-center overflow-hidden">
        {resource.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resource.cover_image_url} alt={resource.title} className="w-full h-full object-cover" />
        ) : (
          <BookOpen className="w-5 h-5 text-faint" />
        )}
      </div>
      <div className="min-w-0">
        {resource.category && <p className="text-[10px] uppercase tracking-wider text-faint">{resource.category.name}</p>}
        <h3 className="font-semibold leading-tight truncate">{resource.title}</h3>
        {resource.author && <p className="text-xs text-muted truncate">{resource.author}</p>}
        {resource.condition && <p className="text-xs text-faint">{resource.condition}</p>}
      </div>
    </div>
  );
}

function ResourceFormModal({
  title,
  categories,
  initial,
  submitLabel,
  onClose,
  onSubmit,
}: {
  title: string;
  categories: Category[];
  initial: ResourceForm;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (form: ResourceForm) => Promise<void>;
}) {
  const [form, setForm] = useState<ResourceForm>(initial);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const set = (key: keyof ResourceForm, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const uploadCover = async (file: File) => {
    setErr("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resources/upload-cover", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) set("cover_image_url", data.url);
      else setErr(data.error || "Failed to upload cover.");
    } catch {
      setErr("Network error uploading cover.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!form.title.trim()) {
      setErr("Title is required.");
      return;
    }
    setErr("");
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
        className="glass-card rounded-2xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">Title *</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} className="field w-full rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Category</label>
            <select value={form.category_id} onChange={(e) => set("category_id", e.target.value)} className="field w-full rounded-lg px-3 py-2 text-sm">
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Author / Maker</label>
            <input value={form.author} onChange={(e) => set("author", e.target.value)} className="field w-full rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Condition</label>
            <input value={form.condition} onChange={(e) => set("condition", e.target.value)} placeholder="New / Good / Worn" className="field w-full rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className="field w-full rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Cover image</label>
            <label className="btn-secondary flex items-center justify-center gap-2 py-2 rounded-lg text-sm cursor-pointer">
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading..." : form.cover_image_url ? "Replace image" : "Upload image"}
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
            {form.cover_image_url && <p className="text-xs text-emerald-400 mt-1">Image attached.</p>}
          </div>
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button onClick={submit} disabled={submitting || uploading} className="btn-primary py-2.5 rounded-lg">
            {submitting ? "Saving..." : submitLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
