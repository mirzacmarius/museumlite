"use client";

import { formatDate } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale } from "@/locales/client";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { FileText, Mail, Printer } from "lucide-react";
import { useRef, useState } from "react";

interface LoanItem {
  accessionNumber: string;
  title: string;
  conditionOut?: string;
}

interface Account {
  _id: string;
  accountNumber: string;
  businessName: string;
  phone?: string;
  email?: string;
  address?: string;
  address2?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
}

interface LoanAgreementProps {
  loan: {
    loanNumber: string;
    type: "incoming" | "outgoing";
    lenderBorrowerName: string;
    lenderBorrowerContact?: string;
    startDate: number;
    endDate?: number;
    terms?: string;
    insuranceValue?: number;
    notes?: string;
    approvedBy?: string;
    approvedAt?: number;
    account?: Account;
  };
  items: LoanItem[];
  organizationName: string;
}

export function LoanAgreement({
  loan,
  items,
  organizationName,
}: LoanAgreementProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
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

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          Loan Agreement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Loan Agreement</DialogTitle>
          <DialogDescription>
            Preview, print, or email the loan agreement document.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={printRef}
          className="bg-white text-black p-8 rounded border"
          style={{ fontFamily: "serif" }}
        >
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">LOAN AGREEMENT</h1>
            <p className="text-lg">Agreement Number: {loan.loanNumber}</p>
          </div>

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
                        {loan.account.address2 && (
                          <p>{loan.account.address2}</p>
                        )}
                        {(loan.account.zipCode || loan.account.city) && (
                          <p>
                            {loan.account.zipCode} {loan.account.city}
                          </p>
                        )}
                        {loan.account.country && <p>{loan.account.country}</p>}
                        {loan.account.contactPerson && (
                          <p>Contact: {loan.account.contactPerson}</p>
                        )}
                        {loan.account.email && (
                          <p>Email: {loan.account.email}</p>
                        )}
                        {loan.account.phone && (
                          <p>Phone: {loan.account.phone}</p>
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
                  {loan.type === "incoming" ? "BORROWER:" : "BORROWER:"}
                </p>
                {loan.type === "incoming" ? (
                  <p>{organizationName}</p>
                ) : (
                  <>
                    <p>{loan.lenderBorrowerName}</p>
                    {loan.account && (
                      <>
                        {loan.account.address && <p>{loan.account.address}</p>}
                        {loan.account.address2 && (
                          <p>{loan.account.address2}</p>
                        )}
                        {(loan.account.zipCode || loan.account.city) && (
                          <p>
                            {loan.account.zipCode} {loan.account.city}
                          </p>
                        )}
                        {loan.account.country && <p>{loan.account.country}</p>}
                        {loan.account.contactPerson && (
                          <p>Contact: {loan.account.contactPerson}</p>
                        )}
                        {loan.account.email && (
                          <p>Email: {loan.account.email}</p>
                        )}
                        {loan.account.phone && (
                          <p>Phone: {loan.account.phone}</p>
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

          <div className="mb-6">
            <h2 className="text-lg font-bold border-b border-black pb-1 mb-3">
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
            <h2 className="text-lg font-bold border-b border-black pb-1 mb-3">
              3. OBJECTS ON LOAN
            </h2>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-black p-2 bg-gray-100 text-left">
                    Accession No.
                  </th>
                  <th className="border border-black p-2 bg-gray-100 text-left">
                    Title/Description
                  </th>
                  <th className="border border-black p-2 bg-gray-100 text-left">
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
              <h2 className="text-lg font-bold border-b border-black pb-1 mb-3">
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
              <h2 className="text-lg font-bold border-b border-black pb-1 mb-3">
                5. TERMS AND CONDITIONS
              </h2>
              <p className="whitespace-pre-wrap">{loan.terms}</p>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-lg font-bold border-b border-black pb-1 mb-3">
              {loan.terms ? "6" : "5"}. STANDARD CONDITIONS
            </h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                The Borrower agrees to exercise the same care with respect to
                the loaned objects as it does in the safekeeping of comparable
                property of its own.
              </li>
              <li>
                The Borrower shall not clean, repair, or restore any object
                without prior written permission from the Lender.
              </li>
              <li>
                The objects shall be kept in a secure environment with
                appropriate climate control and security measures.
              </li>
              <li>
                The Borrower shall not photograph, reproduce, or publish images
                of the objects without prior written consent.
              </li>
              <li>
                Upon request, the Lender or its authorized representative shall
                have access to examine the loaned objects.
              </li>
              <li>
                Any damage to or loss of the loaned objects must be reported
                immediately to the Lender.
              </li>
              <li>
                At the end of the loan period, objects shall be returned in the
                same condition as received.
              </li>
            </ol>
          </div>

          <div className="mt-16">
            <h2 className="text-lg font-bold border-b border-black pb-1 mb-8">
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={handleEmail}>
            <Mail className="mr-2 h-4 w-4" />
            Send via Email
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print Agreement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
