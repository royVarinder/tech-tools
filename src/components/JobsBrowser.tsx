"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { formatISTDate, isTodayIST } from "@/lib/formatDate";

interface JobItem {
  id: string;
  title: string;
  posts: number;
  board: string;
  qualification: string;
  advtNo: string;
  state: string;
  postDate: string;
  lastDate: string;
  applyLink: string | null;
}

export default function JobsBrowser({
  initialJobs,
  initialTotal,
  initialStates,
  pageSize,
}: {
  initialJobs: JobItem[];
  initialTotal: number;
  initialStates: string[];
  pageSize: number;
}) {
  const t = useTranslations("jobs");
  const [jobs, setJobs] = useState(initialJobs);
  const [total, setTotal] = useState(initialTotal);
  const [states, setStates] = useState(initialStates);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (state !== "all") params.set("state", state);
      if (date) params.set("date", date);
      params.set("page", String(targetPage));
      params.set("limit", String(pageSize));

      const res = await fetch(`/api/jobs?${params.toString()}`);
      const data = await res.json();
      setJobs(data.jobs);
      setTotal(data.total);
      setStates(data.states);
      setPage(data.page);
      setLoading(false);
    },
    [query, state, date, pageSize]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(1);
  }

  function handleReset() {
    setQuery("");
    setState("all");
    setDate("");
    setLoading(true);
    fetch(`/api/jobs?page=1&limit=${pageSize}`)
      .then((res) => res.json())
      .then((data) => {
        setJobs(data.jobs);
        setTotal(data.total);
        setStates(data.states);
        setPage(data.page);
      })
      .finally(() => setLoading(false));
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mt-6">
      <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap items-end gap-2">
        <div className="min-w-60 flex-1">
          <label className="mb-1 block text-xs font-medium text-muted">{t("searchPlaceholder")}</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="brand-input w-full px-4 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">{t("stateLabel")}</label>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="brand-input px-3 py-2 text-sm"
          >
            <option value="all">{t("allStates")}</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">{t("dateLabel")}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="brand-input px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="brand-pill-btn px-4 py-2 text-sm">
          {loading ? "..." : t("search")}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-soft"
        >
          {t("resetFilters")}
        </button>
      </form>

      <div className="space-y-3">
        {jobs.map((job) => {
          const closingToday = isTodayIST(job.lastDate);
          return (
            <div
              key={job.id}
              className={`brand-card p-4 ${closingToday ? "glow-danger border-2" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-heading text-base font-semibold text-foreground">
                  {job.title} — {job.posts} {t("postsLabel")}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {closingToday && (
                    <span className="flex items-center gap-1 rounded-lg bg-danger px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      {t("closingToday")}
                    </span>
                  )}
                  <span className="rounded-lg bg-surface-soft px-2.5 py-1 text-xs font-medium text-muted">
                    {job.state}
                  </span>
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-muted sm:grid-cols-2">
                <div>
                  <dt className="inline font-medium text-foreground">{t("boardLabel")}: </dt>
                  <dd className="inline">{job.board}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-foreground">{t("qualificationLabel")}: </dt>
                  <dd className="inline">{job.qualification}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-foreground">{t("advtNoLabel")}: </dt>
                  <dd className="inline">{job.advtNo}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-foreground">{t("postDateLabel")}: </dt>
                  <dd className="inline">{formatISTDate(job.postDate)}</dd>
                </div>
                <div>
                  <dt className={`inline font-medium ${closingToday ? "text-danger" : "text-brand-bright"}`}>
                    {t("lastDateLabel")}:{" "}
                  </dt>
                  <dd className={`inline font-medium ${closingToday ? "text-danger" : "text-brand-bright"}`}>
                    {formatISTDate(job.lastDate)}
                  </dd>
                </div>
              </dl>
              {job.applyLink && (
                <a
                  href={job.applyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="brand-pill-btn mt-3 inline-flex px-4 py-2 text-sm"
                >
                  {t("applyNow")}
                </a>
              )}
            </div>
          );
        })}
        {jobs.length === 0 && <p className="py-8 text-center text-sm text-muted">{t("noJobs")}</p>}
      </div>

      {total > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>
            {t("showing", {
              from: (page - 1) * pageSize + 1,
              to: Math.min(page * pageSize, total),
              total,
            })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => runSearch(page - 1)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("previous")}
            </button>
            <span>{t("pageOf", { page, total: totalPages })}</span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => runSearch(page + 1)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
