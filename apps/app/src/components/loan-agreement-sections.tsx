import type { LoanAgreementLabels } from "@/lib/loan-agreement-labels";
import type {
  LoanAgreementObject,
  RenderedLoanAgreementSection,
} from "@/lib/loan-agreement-template";

type ObjectTableLabels = Pick<
  LoanAgreementLabels,
  "accessionNumber" | "titleDescription" | "condition"
>;

function LoanAgreementObjectsTable({
  objects,
  labels,
}: {
  objects: LoanAgreementObject[];
  labels: ObjectTableLabels;
}) {
  // Accession numbers can repeat (or be blank for removed objects).
  const rows = objects.map((object, position) => ({
    object,
    key: `${position}-${object.accessionNumber}`,
  }));
  return (
    <table className="mb-3 w-full border-collapse">
      <thead>
        <tr>
          <th className="border border-black bg-zinc-100 p-2 text-left">
            {labels.accessionNumber}
          </th>
          <th className="border border-black bg-zinc-100 p-2 text-left">
            {labels.titleDescription}
          </th>
          <th className="border border-black bg-zinc-100 p-2 text-left">
            {labels.condition}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ object, key }) => (
          <tr key={key}>
            <td className="border border-black p-2">
              {object.accessionNumber}
            </td>
            <td className="border border-black p-2">{object.title}</td>
            <td className="border border-black p-2">
              {object.conditionOut || "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface LoanAgreementSectionsProps {
  sections: RenderedLoanAgreementSection[];
  /** Number given to the first headed section, after the fixed sections. */
  firstNumber: number;
  labels: ObjectTableLabels;
}

/**
 * Rendered template sections of a loan agreement. Headed sections are
 * numbered in order; the markup is also copied into the print window.
 */
export function LoanAgreementSections({
  sections,
  firstNumber,
  labels,
}: LoanAgreementSectionsProps) {
  // The rendered agreement is static output, so position-based keys are stable.
  let nextNumber = firstNumber;
  const numbered = sections.map((section, position) => ({
    key: `section-${position}`,
    heading: section.heading,
    number: section.heading ? nextNumber++ : null,
    blocks: section.blocks.map((block, blockPosition) => ({
      block,
      key: `section-${position}-block-${blockPosition}`,
    })),
  }));

  return (
    <>
      {numbered.map(({ key, heading, number, blocks }) => (
        <div key={key} className="mb-6">
          {number !== null && (
            <h2 className="mb-3 border-b border-black pb-1 text-lg font-semibold">
              {number}. {heading}
            </h2>
          )}
          {blocks.map(({ block, key: blockKey }) =>
            block.kind === "objects" ? (
              <LoanAgreementObjectsTable
                key={blockKey}
                objects={block.objects}
                labels={labels}
              />
            ) : (
              <p key={blockKey} className="terms mb-3 whitespace-pre-wrap">
                {block.text}
              </p>
            ),
          )}
        </div>
      ))}
    </>
  );
}
