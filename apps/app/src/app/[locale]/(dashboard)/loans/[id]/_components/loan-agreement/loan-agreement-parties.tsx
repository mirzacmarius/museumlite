import type { LoanAgreementLabels } from "@/lib/loan-agreement-labels";
import type { LoanAgreementAccount, LoanAgreementLoan } from "./types";

interface LoanAgreementPartiesProps {
  loan: LoanAgreementLoan;
  organizationName: string;
  labels: LoanAgreementLabels;
}

function PartnerDetails({
  loan,
  account,
  labels,
}: {
  loan: LoanAgreementLoan;
  account: LoanAgreementAccount | undefined;
  labels: LoanAgreementLabels;
}) {
  return (
    <>
      <p>{loan.lenderBorrowerName}</p>
      {account && (
        <>
          {account.address && <p>{account.address}</p>}
          {account.address2 && <p>{account.address2}</p>}
          {(account.zipCode || account.city) && (
            <p>
              {account.zipCode} {account.city}
            </p>
          )}
          {account.country && <p>{account.country}</p>}
          {account.contactPerson && (
            <p>
              {labels.contact} {account.contactPerson}
            </p>
          )}
          {account.email && (
            <p>
              {labels.email} {account.email}
            </p>
          )}
          {account.phone && (
            <p>
              {labels.phone} {account.phone}
            </p>
          )}
        </>
      )}
      {!account && loan.lenderBorrowerContact && (
        <p>{loan.lenderBorrowerContact}</p>
      )}
    </>
  );
}

export function LoanAgreementParties({
  loan,
  organizationName,
  labels,
}: LoanAgreementPartiesProps) {
  const incoming = loan.type === "incoming";
  const partner = (
    <PartnerDetails loan={loan} account={loan.account} labels={labels} />
  );
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold border-b border-black pb-1 mb-3">
        {labels.parties}
      </h2>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <p className="font-bold">
            {incoming ? labels.lender : labels.museum}
          </p>
          {incoming ? partner : <p>{organizationName}</p>}
        </div>
        <div>
          <p className="font-bold">{labels.borrower}</p>
          {incoming ? <p>{organizationName}</p> : partner}
        </div>
      </div>
    </div>
  );
}
