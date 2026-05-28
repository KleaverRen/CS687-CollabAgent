import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import clsx from "clsx";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Filter,
  Loader2,
  Search,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import api from "../utils/api";

const fieldClass =
  "w-full rounded-lg border border-[#b9c0d4] bg-white px-3 py-2.5 text-sm text-[#191c1d] outline-none transition-all placeholder:text-[#6b7280] focus:border-[#0b47c2] focus:ring-2 focus:ring-[#0b47c2]/20";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#0b47c2] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1353d8] disabled:cursor-not-allowed disabled:opacity-60";

const statusStyles = {
  extracting: "bg-[#fff3c4] text-[#6b4d00]",
  extracted: "bg-[#dbeafe] text-[#003fb1]",
  chunking: "bg-[#dbeafe] text-[#003fb1]",
  embedding: "bg-[#e8ddff] text-[#4f2ca1]",
  indexing: "bg-[#e8ddff] text-[#4f2ca1]",
  indexed: "bg-[#84efbd] text-[#005438]",
  failed: "bg-[#ffdad6] text-[#a40000]",
  pending: "bg-[#dfe3e8] text-[#434654]",
};

const statusLabels = {
  extracting: "Extracting",
  extracted: "Extracted",
  chunking: "Chunking",
  embedding: "Embedding",
  indexing: "Indexing",
  indexed: "Indexed",
  failed: "Failed",
  pending: "Pending",
};

const activeStatuses = new Set(["extracting", "extracted", "chunking", "embedding", "indexing"]);

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getApiError(err, fallback) {
  const data = err.response?.data;
  if (data?.error) return data.error;
  if (Array.isArray(data?.errors) && data.errors[0]?.msg) return data.errors[0].msg;
  return fallback;
}

export default function DocumentManager() {
  const { id: projectId } = useParams();
  const inputRef = useRef(null);
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const hasActiveIndexing = useMemo(
    () => documents.some((doc) => activeStatuses.has(doc.embeddingStatus)),
    [documents],
  );

  const fetchDocuments = useCallback(
    async ({ quiet = false } = {}) => {
      if (!projectId) return;
      if (!quiet) setLoading(true);
      try {
        const { data } = await api.get(`/projects/${projectId}/documents`, {
          params: {
            search: search || undefined,
            status: statusFilter || undefined,
            fileType: typeFilter || undefined,
          },
        });
        setDocuments(data.documents || []);
      } catch (err) {
        toast.error(getApiError(err, "Failed to load documents."));
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [projectId, search, statusFilter, typeFilter],
  );

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (!hasActiveIndexing) return undefined;
    const interval = window.setInterval(() => {
      fetchDocuments({ quiet: true });
    }, 2500);
    return () => window.clearInterval(interval);
  }, [fetchDocuments, hasActiveIndexing]);

  const uploadFile = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);

    setUploading(true);
    try {
      await api.post(`/projects/${projectId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Document queued for indexing.");
      await fetchDocuments({ quiet: true });
    } catch (err) {
      toast.error(getApiError(err, "Upload failed."));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    uploadFile(event.dataTransfer.files?.[0]);
  };

  const statusOptions = ["extracting", "chunking", "embedding", "indexing", "indexed", "failed"];
  const typeOptions = ["pdf", "docx", "txt"];

  return (
    <Layout activePath={`/projects/${projectId}/documents`} projectId={projectId}>
      <div className="min-h-full bg-[#f8f9fb]">
        <header className="border-b border-[#dfe3e8] bg-white px-5 py-5 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#4b5563]">
                <FileText className="h-4 w-4 text-[#0b47c2]" />
                Knowledge Base
              </div>
              <h1 className="mt-1 text-2xl font-bold text-[#191c1d]">
                Documents
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasActiveIndexing && (
                <span className="inline-flex items-center gap-2 rounded-lg bg-[#eef3ff] px-3 py-2 text-sm font-semibold text-[#003fb1]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Indexing in progress
                </span>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={(event) => uploadFile(event.target.files?.[0])}
              />
              <button
                type="button"
                className={buttonClass}
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload
              </button>
            </div>
          </div>
        </header>

        <section className="space-y-5 px-5 py-6 sm:px-8">
          <div
            className={clsx(
              "rounded-lg border border-dashed bg-white p-5 transition-colors",
              dragActive
                ? "border-[#0b47c2] bg-[#eef3ff]"
                : "border-[#b9c0d4]",
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef3ff] text-[#0b47c2]">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#191c1d]">
                    Drop PDF, DOCX, or TXT files here
                  </div>
                  <div className="mt-1 text-sm text-[#5f6b7a]">
                    Files are extracted, chunked, embedded, and made available to the Knowledge Agent.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#b9c0d4] bg-white px-4 text-sm font-semibold text-[#191c1d] hover:bg-[#f3f6ff]"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Select file
              </button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_190px_160px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#6b7280]" />
              <input
                className={clsx(fieldClass, "pl-9")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by filename"
              />
            </label>
            <label className="relative block">
              <Filter className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#6b7280]" />
              <select
                className={clsx(fieldClass, "pl-9")}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <select
              className={fieldClass}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="">All types</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#dfe3e8] bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#dfe3e8]">
                <thead className="bg-[#f3f4f5]">
                  <tr>
                    {["Filename", "Upload date", "Type", "Size", "Indexing status"].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-[#4b5563]"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0f3]">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-10 text-center text-sm text-[#5f6b7a]">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[#0b47c2]" />
                        Loading documents...
                      </td>
                    </tr>
                  ) : documents.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-10 text-center text-sm text-[#5f6b7a]">
                        No documents match the current filters.
                      </td>
                    </tr>
                  ) : (
                    documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-[#f8f9fb]">
                        <td className="max-w-[360px] px-4 py-4">
                          <div className="flex items-start gap-3">
                            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#0b47c2]" />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-[#191c1d]">
                                {doc.fileName || doc.title}
                              </div>
                              {doc.error && (
                                <div className="mt-1 flex items-center gap-1 text-xs text-[#a40000]">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{doc.error}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-[#434654]">
                          {new Date(doc.uploadDate).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold uppercase text-[#434654]">
                          {doc.fileType || "TXT"}
                        </td>
                        <td className="px-4 py-4 text-sm text-[#434654]">
                          {formatBytes(doc.fileSizeBytes)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex min-w-[220px] items-center gap-3">
                            <span
                              className={clsx(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                                statusStyles[doc.embeddingStatus] || statusStyles.pending,
                              )}
                            >
                              {doc.embeddingStatus === "indexed" && <CheckCircle2 className="h-3.5 w-3.5" />}
                              {activeStatuses.has(doc.embeddingStatus) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              {statusLabels[doc.embeddingStatus] || doc.embeddingStatus || "Pending"}
                            </span>
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-[#dfe3e8]">
                              <div
                                className={clsx(
                                  "h-full rounded-full",
                                  doc.embeddingStatus === "failed" ? "bg-[#ba1a1a]" : "bg-[#0b47c2]",
                                )}
                                style={{ width: `${doc.progress || 0}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-xs font-semibold text-[#5f6b7a]">
                              {doc.progress || 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
