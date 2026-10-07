import { useI18n } from "@/locales/client";
import type { LoanAgreementLoan } from "./types";

interface LoanAgreementPartiesProps {
  loan: LoanAgreementLoan;
  organizationName: string;
}

export function LoanAgreementParties({
  loan,
  organizationName,
}: LoanAgreementPartiesProps) {
  const tRoot = useI18n();
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold border-b border-black pb-1 mb-3">
        {tRoot("untranslatedRecords.loans.agreement.parties")}
      </h2>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <p className="font-bold">
            {loan.type === "incoming"
              ? tRoot("untranslatedRecords.loans.items.lenderUpper")
              : tRoot("untranslatedRecords.loans.items.museumUpper")}
          </p>
          {loan.type === "incoming" ? (
            <>
              <p>{loan.lenderBorrowerName}</p>
              {loan.account && (
                <>
                  {loan.account.address && <p>{loan.account.address}</p>}
                  {loan.account.address2 && <p>{loan.account.address2}</p>}
                  {(loan.account.zipCode || loan.account.city) && (
                    <p>
                      {loan.account.zipCode} {loan.account.city}
                    </p>
                  )}
                  {loan.account.country && <p>{loan.account.country}</p>}
                  {loan.account.contactPerson && (
                    <p>
                      {tRoot("accounts.list.contact")}{" "}
                      {loan.account.contactPerson}
                    </p>
                  )}
                  {loan.account.email && (
                    <p>
                      {tRoot("untranslatedRecords.loans.agreement.email")}{" "}
                      {loan.account.email}
                    </p>
                  )}
                  {loan.account.phone && (
                    <p>
                      {tRoot("untranslatedRecords.loans.agreement.phone")}{" "}
                      {loan.account.phone}
                    </p>
                  )}
                </>
              )}
              {!loan.account && loan.lenderBorrowerContact && (
                <p>{loan.lenderBorrowerContact}</p>
              )}
            </>
          ) : (
            <p>{organizationName}</p>
          )}
        </div>
        <div>
          <p className="font-bold">
            {tRoot("untranslatedRecords.loans.agreement.borrower")}
          </p>
          {loan.type === "incoming" ? (
            <p>{organizationName}</p>
          ) : (
            <>
              <p>{loan.lenderBorrowerName}</p>
              {loan.account && (
                <>
                  {loan.account.address && <p>{loan.account.address}</p>}
                  {loan.account.address2 && <p>{loan.account.address2}</p>}
                  {(loan.account.zipCode || loan.account.city) && (
                    <p>
                      {loan.account.zipCode} {loan.account.city}
                    </p>
                  )}
                  {loan.account.country && <p>{loan.account.country}</p>}
                  {loan.account.contactPerson && (
                    <p>
                      {tRoot("accounts.list.contact")}{" "}
                      {loan.account.contactPerson}
                    </p>
                  )}
                  {loan.account.email && (
                    <p>
                      {tRoot("untranslatedRecords.loans.agreement.email")}{" "}
                      {loan.account.email}
                    </p>
                  )}
                  {loan.account.phone && (
                    <p>
                      {tRoot("untranslatedRecords.loans.agreement.phone")}{" "}
                      {loan.account.phone}
                    </p>
                  )}
                </>
              )}
              {!loan.account && loan.lenderBorrowerContact && (
                <p>{loan.lenderBorrowerContact}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
