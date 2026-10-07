"use client";

import type { RefObject } from "react";
import { type FormatLocale, formatCurrency } from "@/lib/format-number";
import { useI18n } from "@/locales/client";
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
  const tRoot = useI18n();
  return (
    <div
      ref={printRef}
      className="bg-white text-black p-8 rounded border"
      style={{ fontFamily: "serif" }}
    >
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold mb-2">
          {tRoot("untranslatedRecords.loans.agreement.title")}
        </h1>
        <p className="text-lg">
          {tRoot("untranslatedRecords.loans.agreement.number")}{" "}
          {loan.loanNumber}
        </p>
      </div>

      <LoanAgreementParties loan={loan} organizationName={organizationName} />

      <div className="mb-6">
        <h2 className="text-lg font-semibold border-b border-black pb-1 mb-3">
          {tRoot("untranslatedRecords.loans.agreement.period")}
        </h2>
        <p>
          <span className="font-bold">
            {tRoot("untranslatedRecords.loans.agreement.startDate")}
          </span>{" "}
          {formatLoanDate(loan.startDate)}
        </p>
        {loan.endDate && (
          <p>
            <span className="font-bold">
              {tRoot("untranslatedRecords.loans.agreement.endDate")}
            </span>{" "}
            {formatLoanDate(loan.endDate)}
          </p>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold border-b border-black pb-1 mb-3">
          {tRoot("untranslatedRecords.loans.agreement.objectsOnLoan")}
        </h2>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-black p-2 bg-zinc-100 text-left">
                {tRoot("untranslatedRecords.loans.agreement.accessionNumber")}
              </th>
              <th className="border border-black p-2 bg-zinc-100 text-left">
                {tRoot("untranslatedRecords.loans.agreement.titleDescription")}
              </th>
              <th className="border border-black p-2 bg-zinc-100 text-left">
                {tRoot("loans.actions.condition")}
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
            {tRoot("untranslatedRecords.loans.agreement.insurance")}
          </h2>
          <p>
            <span className="font-bold">
              {tRoot("untranslatedRecords.loans.agreement.totalInsuranceValue")}
            </span>{" "}
            {formatCurrency(loan.insuranceValue, locale, "USD")}
          </p>
        </div>
      )}

      {loan.terms && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold border-b border-black pb-1 mb-3">
            {tRoot("untranslatedRecords.loans.agreement.termsConditions")}
          </h2>
          <p className="whitespace-pre-wrap">{loan.terms}</p>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-lg font-semibold border-b border-black pb-1 mb-3">
          {loan.terms ? "6" : "5"}
          {tRoot("untranslatedRecords.loans.agreement.standardConditions")}
        </h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>{tRoot("untranslatedRecords.loans.agreement.borrowerCare")}</li>
          <li>{tRoot("untranslatedRecords.loans.agreement.noTreatment")}</li>
          <li>
            {tRoot("untranslatedRecords.loans.agreement.safeEnvironment")}
          </li>
          <li>{tRoot("untranslatedRecords.loans.agreement.noReproduction")}</li>
          <li>{tRoot("untranslatedRecords.loans.agreement.inspection")}</li>
          <li>{tRoot("untranslatedRecords.loans.agreement.reportDamage")}</li>
          <li>
            {tRoot("untranslatedRecords.loans.agreement.returnCondition")}
          </li>
        </ol>
      </div>

      <div className="mt-16">
        <h2 className="text-lg font-semibold border-b border-black pb-1 mb-8">
          {tRoot("untranslatedRecords.loans.agreement.signatures")}
        </h2>
        <div className="grid grid-cols-2 gap-16">
          <div>
            <p className="font-bold mb-16">
              {tRoot("untranslatedRecords.loans.agreement.forLender")}
            </p>
            <div className="border-t border-black pt-2">
              <p>{tRoot("untranslatedRecords.loans.agreement.signature")}</p>
            </div>
            <div className="mt-8 border-t border-black pt-2">
              <p>{tRoot("untranslatedRecords.loans.agreement.nameTitle")}</p>
            </div>
            <div className="mt-8 border-t border-black pt-2">
              <p>{tRoot("deaccessions.report.date")}</p>
            </div>
          </div>
          <div>
            <p className="font-bold mb-16">
              {tRoot("untranslatedRecords.loans.agreement.forBorrower")}
            </p>
            <div className="border-t border-black pt-2">
              <p>{tRoot("untranslatedRecords.loans.agreement.signature")}</p>
            </div>
            <div className="mt-8 border-t border-black pt-2">
              <p>{tRoot("untranslatedRecords.loans.agreement.nameTitle")}</p>
            </div>
            <div className="mt-8 border-t border-black pt-2">
              <p>{tRoot("deaccessions.report.date")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
