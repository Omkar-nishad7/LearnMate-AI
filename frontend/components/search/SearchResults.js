"use client";

import Link from "next/link";
import {
  ExternalLink,
  PlayCircle,
  Youtube,
  BookOpen,
  FileText,
  Users,
} from "lucide-react";

function ResultCard({ item, action }) {
  const external = item.url?.startsWith("http");
  const href = item.url || "#";

  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
      <div className="h-40 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-20 sm:w-28">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            {item.kind.includes("video") ? (
              <PlayCircle className="h-7 w-7" />
            ) : item.kind === "note" ? (
              <FileText className="h-7 w-7" />
            ) : item.kind === "teacher" ? (
              <Users className="h-7 w-7" />
            ) : (
              <BookOpen className="h-7 w-7" />
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate font-semibold text-slate-900">
            {item.title}
          </h3>
          {item.source ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
              {item.source}
            </span>
          ) : null}
          {item.match ? (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              Match: {item.match}
            </span>
          ) : null}
        </div>

        {item.channel_title ? (
          <p className="mt-1 text-xs font-medium text-slate-500">
            {item.channel_title}
          </p>
        ) : null}

        {item.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">
            {item.description}
          </p>
        ) : null}

        {item.published_at ? (
          <p className="mt-1 text-xs text-slate-400">
            {new Date(item.published_at).toLocaleDateString()}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {action}
          {external ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary inline-flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open YouTube
            </a>
          ) : (
            <Link href={href} className="btn-secondary">
              Open
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export default function SearchResults({ data, onImport }) {
  const groups = [
    ["Courses", data?.courses || [], BookOpen],
    ["LearnMate Videos", data?.videos || [], PlayCircle],
    ["Notes", data?.notes || [], FileText],
    ["Teachers", data?.teachers || [], Users],
    ["YouTube Videos", data?.youtube_videos || [], Youtube],
    ["YouTube Channels", data?.youtube_channels || [], Youtube],
  ];

  return (
    <div className="space-y-8">
      {data?.youtube_error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {data.youtube_error} LearnMate results are still available below.
        </div>
      ) : null}

      {groups.map(([label, items, Icon]) =>
        items.length ? (
          <section key={label}>
            <div className="mb-3 flex items-center gap-2">
              <Icon className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-900">{label}</h2>
              <span className="text-xs text-slate-400">{items.length}</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {items.map((item) => (
                <ResultCard
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  action={
                    item.kind === "youtube_video" && onImport ? (
                      <button
                        type="button"
                        onClick={() => onImport(item)}
                        className="btn-primary"
                      >
                        Import to LearnMate
                      </button>
                    ) : null
                  }
                />
              ))}
            </div>
          </section>
        ) : null
      )}
    </div>
  );
}
