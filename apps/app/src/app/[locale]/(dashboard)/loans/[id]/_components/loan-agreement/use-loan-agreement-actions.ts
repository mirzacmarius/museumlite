"use client";

import { useRef } from "react";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale } from "@/locales/client";
import type { LoanAgreementItem, LoanAgreementLoan } from "./types";

interface UseLoanAgreementActionsOptions {
  loan: LoanAgreementLoan;
  items: LoanAgreementItem[];
  organizationName: string;
}

export function useLoanAgreementActions({
  loan,
  items,
  organizationName,
}: UseLoanAgreementActionsOptions) {
  const printRef = useRef<HTMLDivElement>(null);
  const locale = useCurrentLocale();

  const formatLoanDate = (timestamp: number) => {
    return formatDate(new Date(timestamp), locale, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Loan Agreement - ${loan.loanNumber}</title>
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
    const subject = encodeURIComponent(`Loan Agreement - ${loan.loanNumber}`);
    const startDateFormatted = formatLoanDate(loan.startDate);
    const endDateFormatted = loan.endDate ? formatLoanDate(loan.endDate) : "";
    const body = encodeURIComponent(
      `Dear ${loan.lenderBorrowerName},

Please find attached the loan agreement for ${loan.loanNumber}.

Loan Details:
- Loan Number: ${loan.loanNumber}
- Type: ${loan.type === "incoming" ? "Incoming Loan" : "Outgoing Loan"}
- Start Date: ${startDateFormatted}
${loan.endDate ? `- End Date: ${endDateFormatted}` : ""}

Objects:
${items.map((item) => `- ${item.accessionNumber}: ${item.title}`).join("\n")}

Please review and sign the agreement.

Best regards,
${organizationName}`,
    );

    const email = loan.account?.contactEmail || loan.account?.email || "";
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return { printRef, locale, formatLoanDate, handlePrint, handleEmail };
}
