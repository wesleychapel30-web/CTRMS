import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { useSession } from "../context/SessionContext";
import { createRequest, suggestRequestCategory, uploadRequestDocument } from "../lib/api";

export function CreateRequestPage() {
  const navigate = useNavigate();
  const { hasPermission } = useSession();
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
      setError("You do not have permission to create requests.");
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

      navigate(`/requests/${created.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SectionCard title="Create Request" subtitle="Submit a new request.">
      {!hasPermission("request:create") ? (
        <p className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          You do not have permission to create requests.
        </p>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitRequest("pending");
        }}
        className="grid gap-4 lg:grid-cols-2"
      >
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
          <span>Applicant name</span>
          <input
            value={form.applicant_name}
            onChange={(event) => updateField("applicant_name", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-400"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
          <span>Email</span>
          <input
            value={form.applicant_email}
            onChange={(event) => updateField("applicant_email", event.target.value)}
            type="email"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-400"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
          <span>Phone</span>
          <input
            value={form.applicant_phone}
            onChange={(event) => updateField("applicant_phone", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-400"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
          <span>Applicant ID</span>
          <input
            value={form.applicant_id}
            onChange={(event) => updateField("applicant_id", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-400"
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
          <span>Organization</span>
          <input
            value={form.applicant_organization}
            onChange={(event) => updateField("applicant_organization", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-400"
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
          <span>Role</span>
          <input
            value={form.applicant_role}
            onChange={(event) => updateField("applicant_role", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-400"
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
          <span>Region</span>
          <input
            value={form.applicant_region}
            onChange={(event) => updateField("applicant_region", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-400"
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
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
                  })
                  .catch(() => setCategoryHint("Unable to suggest category"));
              }}
              className="text-xs font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
            >
              Suggest
            </button>
          </span>
          <select
            value={form.category}
            onChange={(event) => updateField("category", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
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
            <option value="other" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
              Other
            </option>
          </select>
          {categoryHint ? <span className="text-xs text-slate-500 dark:text-slate-400">{categoryHint}</span> : null}
        </label>
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200 lg:col-span-2">
          <span>Request title</span>
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-400"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200 lg:col-span-2">
          <span>Description</span>
          <textarea
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            rows={5}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-400"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
          <span>Beneficiaries</span>
          <input
            value={form.number_of_beneficiaries}
            onChange={(event) => updateField("number_of_beneficiaries", event.target.value)}
            type="number"
            min="1"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
          <span>Amount requested</span>
          <input
            value={form.amount_requested}
            onChange={(event) => updateField("amount_requested", event.target.value)}
            type="number"
            min="1"
            step="0.01"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200 lg:col-span-2">
          <span>Address / location</span>
          <input
            value={form.address}
            onChange={(event) => updateField("address", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-400"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200 lg:col-span-2">
          <span>Supporting documents</span>
          <input
            onChange={(event) => setFiles(event.target.files)}
            type="file"
            multiple
            className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-slate-700 outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:file:bg-cyan-500 dark:file:text-slate-950"
          />
        </label>
        {error ? <p className="text-sm text-rose-600 lg:col-span-2">{error}</p> : null}
        <div className="lg:col-span-2 flex justify-end gap-2">
          <button
            type="button"
            disabled={isSubmitting || !hasPermission("request:create")}
            onClick={() => void submitRequest("draft")}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold disabled:opacity-60 dark:border-white/10"
          >
            {isSubmitting ? "Saving..." : "Save Draft"}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !hasPermission("request:create")}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-blue-500"
          >
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}
