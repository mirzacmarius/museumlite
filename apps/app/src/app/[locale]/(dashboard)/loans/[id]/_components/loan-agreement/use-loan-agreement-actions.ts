"use client";

import { useRef } from "react";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import type { LoanAgreementItem, LoanAgreementLoan } from "./types";

interface UseLoanAgreementActionsOptions {
  loan: LoanAgreementLoan;
  items: LoanAgreementItem[];
  organizationName: string;
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function useLoanAgreementActions({
  loan,
  items,
  organizationName,
}: UseLoanAgreementActionsOptions) {
  const printRef = useRef<HTMLDivElement>(null);
  const locale = useCurrentLocale();
  const t = useScopedI18n("loanAgreementTemplates.agreement");

  const formatLoanDate = (timestamp: number) =>
    formatDate(new Date(timestamp), locale, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const title = escapeHtml(t("printTitle", { loanNumber: loan.loanNumber }));
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="${printContent.lang || locale}">
        <head>
          <title>${title}</title>
          <style>
            body {
              font-family: 'Times New Roman', Times, serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
              line-height: 1.6;
            }
            h1 { text-align: center; margin-bottom: 30px; }
            h2 { margin-top: 30px; border-bottom: 1px solid #000; padding-bottom: 5px; }
            .header { text-align: center; margin-bottom: 40px; }
            .section { margin-bottom: 20px; }
            .label { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #f0f0f0; }
            .signature-section { margin-top: 60px; display: flex; justify-content: space-between; }
            .signature-box { width: 45%; }
            .signature-line { border-top: 1px solid #000; margin-top: 60px; padding-top: 5px; }
            .terms { white-space: pre-wrap; }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleEmail = () => {
    const lines = [
      t("email.greeting", { name: loan.lenderBorrowerName }),
      "",
      t("email.intro", { loanNumber: loan.loanNumber }),
      "",
      t("email.details"),
      `- ${t("email.loanNumber", { loanNumber: loan.loanNumber })}`,
      `- ${loan.type === "incoming" ? t("email.incoming") : t("email.outgoing")}`,
      `- ${t("email.startDate", { date: formatLoanDate(loan.startDate) })}`,
      ...(loan.endDate
        ? [`- ${t("email.endDate", { date: formatLoanDate(loan.endDate) })}`]
        : []),
      "",
      t("email.objects"),
      ...items.map((item) => `- ${item.accessionNumber}: ${item.title}`),
      "",
      t("email.review"),
      "",
      t("email.signOff"),
      organizationName,
    ];
    const subject = encodeURIComponent(
      t("email.subject", { loanNumber: loan.loanNumber }),
    );
    const body = encodeURIComponent(lines.join("\n"));
    const recipient = loan.account?.contactEmail || loan.account?.email || "";
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  };

  return { printRef, handlePrint, handleEmail };
}
