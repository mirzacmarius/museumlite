"use client";

import Image from "next/image";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { ObjectIdCategoryValue } from "./object-id-sheet-data";

/** Photographs the sheet has room for: the primary one and three more. */
export const SHEET_IMAGES_SHOWN = 4;

export interface ObjectIdSheetImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
}

interface ObjectIdSheetProps {
  title: string;
  accessionNumber: string;
  /** How many things the record describes, formatted; absent when not recorded. */
  numberOfObjects?: string;
  organizationName?: string;
  printedOn: string;
  values: ObjectIdCategoryValue[];
  /** The accepted condition assessment supplied the distinguishing features. */
  featuresFromAssessment: boolean;
  description: string | undefined;
  images: ObjectIdSheetImage[];
}

const headingClass =
  "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";

/**
 * One printed page describing an object by the Object ID checklist, for a
 * police report, an insurer or a stolen-art register. Every category is
 * printed, so a reader sees what the record lacks.
 */
export function ObjectIdSheet({
  title,
  accessionNumber,
  numberOfObjects,
  organizationName,
  printedOn,
  values,
  featuresFromAssessment,
  description,
  images,
}: ObjectIdSheetProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("objects.objectIdSheet");
  const [primary, ...others] = images.slice(0, SHEET_IMAGES_SHOWN);

  return (
    <article className="space-y-4 bg-white p-6 text-[13px] leading-snug text-black print:space-y-3 print:p-[12mm] print:break-inside-avoid-page">
      <header className="flex items-start justify-between gap-4 border-b border-zinc-300 pb-3">
        <div className="min-w-0">
          {organizationName ? (
            <p className={headingClass}>{organizationName}</p>
          ) : null}
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="mt-0.5 text-sm text-zinc-700">{title}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={headingClass}>{t("accessionNumber")}</p>
          <p className="font-mono text-base">{accessionNumber}</p>
          {numberOfObjects ? (
            <>
              <p className={`${headingClass} mt-1`}>
                {tRoot("recordForm.objectFields.numberOfObjects")}
              </p>
              <p className="text-base">{numberOfObjects}</p>
            </>
          ) : null}
          <p className="mt-1 text-[10px] text-zinc-500">
            {t("printedOn", { date: printedOn })}
          </p>
        </div>
      </header>

      <section
        aria-label={t("photographs")}
        className="print:break-inside-avoid"
      >
        <h2 className={`${headingClass} mb-1.5`}>{t("photographs")}</h2>
        {primary ? (
          <div className="flex items-start gap-3">
            <Image
              src={primary.url}
              alt={title}
              width={320}
              height={240}
              className="h-60 w-80 max-w-[60%] rounded border border-zinc-300 object-contain print:h-52"
            />
            {others.length > 0 ? (
              <ul className="grid grid-cols-1 gap-2">
                {others.map((image, index) => (
                  <li key={image.id}>
                    <Image
                      src={image.thumbnailUrl || image.url}
                      alt={`${title} (${index + 2})`}
                      width={72}
                      height={72}
                      className="size-[72px] rounded border border-zinc-300 object-cover"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="rounded border border-dashed border-zinc-400 px-3 py-6 text-center text-xs italic text-zinc-500">
            {t("noPhotograph")}
          </p>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
        {values.map(({ category, lines, omitted }) => (
          <div key={category} className="print:break-inside-avoid">
            <dt className={headingClass}>{t(`categories.${category}`)}</dt>
            <dd>
              {lines.length === 0 ? (
                <p className="italic text-zinc-500">{t("notRecorded")}</p>
              ) : (
                <p className="whitespace-pre-wrap break-words">
                  {lines.join("\n")}
                </p>
              )}
              {omitted > 0 ? (
                <p className="text-[10px] text-zinc-500">
                  {t("moreLines", { count: omitted })}
                </p>
              ) : null}
              {category === "distinguishing_features" &&
              featuresFromAssessment &&
              lines.length > 0 ? (
                <p className="text-[10px] text-zinc-500">
                  {t("fromConditionAssessment")}
                </p>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>

      <section className="print:break-inside-avoid">
        <h2 className={`${headingClass} mb-1`}>{t("shortDescription")}</h2>
        {description ? (
          <p className="whitespace-pre-wrap break-words">{description}</p>
        ) : (
          <p className="italic text-zinc-500">{t("notRecorded")}</p>
        )}
      </section>

      <footer className="border-t border-zinc-300 pt-2 text-[10px] text-zinc-500">
        {t("standardNote")}
      </footer>
    </article>
  );
}
