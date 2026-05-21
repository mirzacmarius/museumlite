import type { LoanAgreementLoan } from "./types";

interface LoanAgreementPartiesProps {
  loan: LoanAgreementLoan;
  organizationName: string;
}

export function LoanAgreementParties({
  loan,
  organizationName,
}: LoanAgreementPartiesProps) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold border-b border-black pb-1 mb-3">
        1. PARTIES
      </h2>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <p className="font-bold">
            {loan.type === "incoming" ? "LENDER:" : "MUSEUM/INSTITUTION:"}
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
                    <p>Contact: {loan.account.contactPerson}</p>
                  )}
                  {loan.account.email && <p>Email: {loan.account.email}</p>}
                  {loan.account.phone && <p>Phone: {loan.account.phone}</p>}
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
          <p className="font-bold">BORROWER:</p>
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
                    <p>Contact: {loan.account.contactPerson}</p>
                  )}
                  {loan.account.email && <p>Email: {loan.account.email}</p>}
                  {loan.account.phone && <p>Phone: {loan.account.phone}</p>}
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
