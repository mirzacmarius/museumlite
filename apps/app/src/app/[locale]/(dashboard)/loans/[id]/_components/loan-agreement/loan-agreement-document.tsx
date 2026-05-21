"use client";

import type { RefObject } from "react";
import { type FormatLocale, formatCurrency } from "@/lib/format-number";
import { LoanAgreementParties } from "./loan-agreement-parties";
import type { LoanAgreementItem, LoanAgreementLoan } from "./types";

interface LoanAgreementDocumentProps {
  printRef: RefObject<HTMLDivElement | null>;
  loan: LoanAgreementLoan;
  items: LoanAgreementItem[];
  organizationName: string;
  locale: FormatLocale;
  formatLoanDate: (timestamp: number) => string;
}

export function LoanAgreementDocument({
  printRef,
  loan,
  items,
  organizationName,
  locale,
  formatLoanDate,
}: LoanAgreementDocumentProps) {
  return (
    <div
      ref={printRef}
      className="bg-white text-black p-8 rounded border"
      style={{ fontFamily: "serif" }}
    >
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold mb-2">LOAN AGREEMENT</h1>
        <p className="text-lg">Agreement Number: {loan.loanNumber}</p>
      </div>

      <LoanAgreementParties loan={loan} organizationName={organizationName} />

      <div className="mb-6">
        <h2 className="text-lg font-semibold border-b border-black pb-1 mb-3">
          2. LOAN PERIOD
        </h2>
        <p>
          <span className="font-bold">Start Date:</span>{" "}
          {formatLoanDate(loan.startDate)}
        </p>
        {loan.endDate && (
          <p>
            <span className="font-bold">End Date:</span>{" "}
            {formatLoanDate(loan.endDate)}
          </p>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold border-b border-black pb-1 mb-3">
          3. OBJECTS ON LOAN
        </h2>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-black p-2 bg-zinc-100 text-left">
                Accession No.
              </th>
              <th className="border border-black p-2 bg-zinc-100 text-left">
                Title/Description
              </th>
              <th className="border border-black p-2 bg-zinc-100 text-left">
                Condition
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.accessionNumber}>
                <td className="border border-black p-2">
                  {item.accessionNumber}
                </td>
                <td className="border border-black p-2">{item.title}</td>
                <td className="border border-black p-2">
                  {item.conditionOut || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loan.insuranceValue && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold border-b border-black pb-1 mb-3">
            4. INSURANCE
          </h2>
          <p>
            <span className="font-bold">Total Insurance Value:</span>{" "}
            {formatCurrency(loan.insuranceValue, locale, "USD")}
          </p>
        </div>
      )}

      {loan.terms && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold border-b border-black pb-1 mb-3">
            5. TERMS AND CONDITIONS
          </h2>
          <p className="whitespace-pre-wrap">{loan.terms}</p>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-lg font-semibold border-b border-black pb-1 mb-3">
          {loan.terms ? "6" : "5"}. STANDARD CONDITIONS
        </h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            The Borrower agrees to exercise the same care with respect to the
            loaned objects as it does in the safekeeping of comparable property
            of its own.
          </li>
          <li>
            The Borrower shall not clean, repair, or restore any object without
            prior written permission from the Lender.
          </li>
          <li>
            The objects shall be kept in a secure environment with appropriate
            climate control and security measures.
          </li>
          <li>
            The Borrower shall not photograph, reproduce, or publish images of
            the objects without prior written consent.
          </li>
          <li>
            Upon request, the Lender or its authorized representative shall have
            access to examine the loaned objects.
          </li>
          <li>
            Any damage to or loss of the loaned objects must be reported
            immediately to the Lender.
          </li>
          <li>
            At the end of the loan period, objects shall be returned in the same
            condition as received.
          </li>
        </ol>
      </div>

      <div className="mt-16">
        <h2 className="text-lg font-semibold border-b border-black pb-1 mb-8">
          SIGNATURES
        </h2>
        <div className="grid grid-cols-2 gap-16">
          <div>
            <p className="font-bold mb-16">For the Lender:</p>
            <div className="border-t border-black pt-2">
              <p>Signature</p>
            </div>
            <div className="mt-8 border-t border-black pt-2">
              <p>Name and Title</p>
            </div>
            <div className="mt-8 border-t border-black pt-2">
              <p>Date</p>
            </div>
          </div>
          <div>
            <p className="font-bold mb-16">For the Borrower:</p>
            <div className="border-t border-black pt-2">
              <p>Signature</p>
            </div>
            <div className="mt-8 border-t border-black pt-2">
              <p>Name and Title</p>
            </div>
            <div className="mt-8 border-t border-black pt-2">
              <p>Date</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
