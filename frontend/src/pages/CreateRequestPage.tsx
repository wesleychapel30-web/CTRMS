import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { InlineBanner } from "../components/FeedbackStates";
import { SectionCard } from "../components/SectionCard";
import { useSession } from "../context/SessionContext";
import { useToast } from "../context/ToastContext";
import { createRequest, suggestRequestCategory, uploadRequestDocument } from "../lib/api";

export function CreateRequestPage() {
  const navigate = useNavigate();
  const { hasPermission } = useSession();
  const toast = useToast();
  const [form, setForm] = useState({
    applicant_name: "",
    applicant_email: "",
    applicant_phone: "",
    applicant_id: "",
    applicant_organization: "",
    applicant_role: "",
    applicant_region: "",
    address: "",
    title: "",
    category: "medical",
    description: "",
    number_of_beneficiaries: "1",
    amount_requested: ""
  });
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryHint, setCategoryHint] = useState<string | null>(null);

  const updateField = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submitRequest = async (workflowStatus: "draft" | "pending") => {
    if (!hasPermission("request:create")) {
      const message = "You do not have permission to create requests.";
      setError(message);
      toast.warning(message, "Permission restricted");
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const created = await createRequest({
        ...form,
        number_of_beneficiaries: Number(form.number_of_beneficiaries),
        amount_requested: Number(form.amount_requested),
        status: workflowStatus
      });

      if (files?.length) {
        await Promise.all(
          Array.from(files).map((file) => uploadRequestDocument(created.id, file, file.name.replace(/\.[^.]+$/, "")))
        );
      }

      toast.success(
        workflowStatus === "draft" ? "Request saved as draft." : "Request submitted successfully.",
        workflowStatus === "draft" ? "Draft saved" : "Request submitted"
      );
      navigate(`/requests/${created.id}`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to create request";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SectionCard title="Create Request" subtitle="Capture applicant, category, amount, and supporting files.">
      {!hasPermission("request:create") ? (
        <p className="rounded-md bg-[var(--surface-low)] px-4 py-4 text-sm text-[var(--muted)]">
          You do not have permission to create requests.
        </p>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitRequest("pending");
        }}
        className="grid gap-5 lg:grid-cols-2"
      >
        <label className="grid gap-2 text-sm text-[var(--ink)]">
          <span>Applicant name</span>
          <input
            value={form.applicant_name}
            onChange={(event) => updateField("applicant_name", event.target.value)}
            className="institutional-input rounded-md px-4 py-3 outline-none placeholder:text-[var(--muted)]"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--ink)]">
          <span>Email</span>
          <input
            value={form.applicant_email}
            onChange={(event) => updateField("applicant_email", event.target.value)}
            type="email"
            className="institutional-input rounded-md px-4 py-3 outline-none placeholder:text-[var(--muted)]"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--ink)]">
          <span>Phone</span>
          <input
            value={form.applicant_phone}
            onChange={(event) => updateField("applicant_phone", event.target.value)}
            className="institutional-input rounded-md px-4 py-3 outline-none placeholder:text-[var(--muted)]"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--ink)]">
          <span>Applicant ID</span>
          <input
            value={form.applicant_id}
            onChange={(event) => updateField("applicant_id", event.target.value)}
            className="institutional-input rounded-md px-4 py-3 outline-none placeholder:text-[var(--muted)]"
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--ink)]">
          <span>Organization</span>
          <input
            value={form.applicant_organization}
            onChange={(event) => updateField("applicant_organization", event.target.value)}
            className="institutional-input rounded-md px-4 py-3 outline-none placeholder:text-[var(--muted)]"
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--ink)]">
          <span>Role</span>
          <input
            value={form.applicant_role}
            onChange={(event) => updateField("applicant_role", event.target.value)}
            className="institutional-input rounded-md px-4 py-3 outline-none placeholder:text-[var(--muted)]"
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--ink)]">
          <span>Region</span>
          <input
            value={form.applicant_region}
            onChange={(event) => updateField("applicant_region", event.target.value)}
            className="institutional-input rounded-md px-4 py-3 outline-none placeholder:text-[var(--muted)]"
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--ink)]">
          <span className="flex items-center justify-between gap-3">
            <span>Category</span>
            <button
              type="button"
              onClick={() => {
                const text = `${form.title} ${form.description}`.trim();
                suggestRequestCategory(text)
                  .then((res) => {
                    updateField("category", res.category);
                    setCategoryHint(`Suggested: ${res.category_display}`);
                    toast.info(`Suggested category: ${res.category_display}`, "Category suggestion");
                  })
                  .catch(() => {
                    setCategoryHint("Unable to suggest category");
                    toast.warning("Unable to suggest category at the moment.", "Suggestion unavailable");
                  });
              }}
              className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-dim)]"
            >
              Suggest
            </button>
          </span>
          <select
            value={form.category}
            onChange={(event) => updateField("category", event.target.value)}
            className="institutional-input rounded-md px-4 py-3 outline-none"
          >
            <option value="tuition" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
              Tuition
            </option>
            <option value="medical" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
              Medical Support
            </option>
            <option value="construction" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
              Construction Aid
            </option>
            <option value="event_sponsorship" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
              Event Sponsorship
            </option>
            <option value="other" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
              Other
            </option>
          </select>
          {categoryHint ? <span className="text-xs font-medium text-[var(--muted)]">{categoryHint}</span> : null}
        </label>
        <label className="grid gap-2 text-sm text-[var(--ink)] lg:col-span-2">
          <span>Request title</span>
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            className="institutional-input rounded-md px-4 py-3 outline-none placeholder:text-[var(--muted)]"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--ink)] lg:col-span-2">
          <span>Description</span>
          <textarea
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            rows={5}
            className="institutional-input rounded-md px-4 py-3 outline-none placeholder:text-[var(--muted)]"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--ink)]">
          <span>Beneficiaries</span>
          <input
            value={form.number_of_beneficiaries}
            onChange={(event) => updateField("number_of_beneficiaries", event.target.value)}
            type="number"
            min="1"
            className="institutional-input rounded-md px-4 py-3 outline-none"
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--ink)]">
          <span>Amount requested</span>
          <input
            value={form.amount_requested}
            onChange={(event) => updateField("amount_requested", event.target.value)}
            type="number"
            min="1"
            step="0.01"
            className="institutional-input rounded-md px-4 py-3 outline-none"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--ink)] lg:col-span-2">
          <span>Address / location</span>
          <input
            value={form.address}
            onChange={(event) => updateField("address", event.target.value)}
            className="institutional-input rounded-md px-4 py-3 outline-none placeholder:text-[var(--muted)]"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--ink)] lg:col-span-2">
          <span>Supporting documents</span>
          <input
            onChange={(event) => setFiles(event.target.files)}
            type="file"
            multiple
            className="rounded-md border border-dashed border-[var(--line)] bg-[var(--surface-low)] px-4 py-6 text-[var(--muted)] outline-none file:mr-3 file:rounded-sm file:border-0 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white file:[background:linear-gradient(135deg,var(--accent)_0%,var(--accent-dim)_100%)]"
          />
        </label>
        {error ? <InlineBanner variant="error" title="Request could not be saved" message={error} className="lg:col-span-2" /> : null}
        <div className="lg:col-span-2 flex justify-end gap-2">
          <button
            type="button"
            disabled={isSubmitting || !hasPermission("request:create")}
            onClick={() => void submitRequest("draft")}
            className="rounded-sm bg-[var(--surface-low)] px-5 py-3 text-sm font-semibold text-[var(--ink)] disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Save Draft"}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !hasPermission("request:create")}
            className="primary-button rounded-sm px-5 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}
