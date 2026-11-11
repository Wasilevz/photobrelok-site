"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { legalCopy } from "@/lib/legal-copy";
import type { LegalDoc, LegalSection } from "@/lib/legal-copy";

function Section({ section }: { section: LegalSection }) {
  return (
    <section className="mt-8">
      <h2 className="text-[#141413] text-xl font-bold leading-snug">{section.heading}</h2>

      {section.paragraphs?.map((p, i) => (
        <p key={i} className="mt-3 text-[#3D3929] text-[15px] leading-relaxed">
          {p}
        </p>
      ))}

      {section.list && (
        <ul className="mt-3 space-y-2">
          {section.list.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-[#3D3929] text-[15px] leading-relaxed">
              <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#C96442]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {section.table && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[#DAD9D4]">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-[#F6E9E2]">
                {section.table.head.map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border-b border-[#DAD9D4] px-3 py-2.5 font-semibold text-[#141413] whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 ? "bg-[#FFFFFF]" : "bg-white"}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`border-b border-[#F0E9DA] px-3 py-2.5 align-top text-[#3D3929] leading-relaxed ${
                        ci === 0 ? "font-medium text-[#141413]" : ""
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section.after?.map((p, i) => (
        <p key={i} className="mt-3 text-[#3D3929] text-[15px] leading-relaxed">
          {p}
        </p>
      ))}
    </section>
  );
}

export default function LegalDocView({ doc }: { doc: LegalDoc }) {
  const { lang } = useLanguage();
  const { nav, contactLine } = legalCopy[lang];

  return (
    <div className="min-h-screen bg-[#FAF9F5] px-4 py-10 text-[#141413] sm:py-14">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-[#535146] hover:text-[#141413] transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {nav.backToSite}
        </Link>

        <header className="mt-4 rounded-[28px] border-2 border-[#141413] bg-[#FFFFFF] p-7 shadow-xl sm:p-9">
          <h1 className="text-3xl font-black leading-[1.1] sm:text-4xl">{doc.title}</h1>
          <p className="mt-3 text-sm text-[#64635C]">
            {nav.updatedPrefix} {doc.updated}
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-[#3D3929]">{doc.intro}</p>
        </header>

        <nav
          aria-label={doc.title}
          className="mt-6 flex flex-wrap gap-x-5 gap-y-2 rounded-2xl border border-[#DAD9D4] bg-[#FFFFFF] px-5 py-4"
        >
          <a href="/privacy" className="text-sm font-semibold text-[#141413] underline underline-offset-2 hover:text-[#B05730]">
            {nav.privacy}
          </a>
          <a href="/cookies" className="text-sm font-semibold text-[#141413] underline underline-offset-2 hover:text-[#B05730]">
            {nav.cookies}
          </a>
        </nav>

        <main className="mt-2">
          {doc.sections.map((section, i) => (
            <Section key={i} section={section} />
          ))}
        </main>

        <footer className="mt-12 rounded-2xl border border-[#DAD9D4] bg-[#FFFFFF] px-5 py-5 text-sm text-[#535146]">
          {contactLine}
        </footer>
      </div>
    </div>
  );
}
