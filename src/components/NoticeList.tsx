"use client";

import { useState } from "react";
import { BackIcon } from "@/app/(app)/tarot/icons";

type Notice = { title: string; date: string; body: string };

export default function NoticeList({ notices }: { notices: Notice[] }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="divide-y divide-border border-y border-border">
      {notices.map((notice, index) => {
        const open = openIndex === index;
        return (
          <section key={`${notice.title}-${index}`} className="py-4">
            <button type="button" onClick={() => setOpenIndex(open ? -1 : index)} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block break-keep text-sm font-semibold leading-5 text-bold-text">{notice.title}</span>
                <span className="mt-1 block text-sm text-icon-muted">{notice.date}</span>
              </span>
              <BackIcon className={`mt-1 h-4 w-2 shrink-0 text-bold-text transition-transform ${open ? "rotate-90" : "-rotate-90"}`} />
            </button>
            {open && <div className="mt-4 whitespace-pre-line rounded-[28px] border border-border bg-surface p-4 text-sm leading-5 text-text">{notice.body}</div>}
          </section>
        );
      })}
    </div>
  );
}
