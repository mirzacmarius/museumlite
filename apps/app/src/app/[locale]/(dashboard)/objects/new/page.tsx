import {
  ObjectRequestFormPage,
  type ObjectRequestFormPageProps,
} from "../_components/object-request-form/object-request-form-page";

export { ObjectRequestFormPage, type ObjectRequestFormPageProps };

interface NewObjectPageProps {
  searchParams: Promise<{ collectionGroupId?: string | string[] }>;
}

function parseCollectionGroupId(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return undefined;
}

export default async function NewObjectPage({
  searchParams,
}: NewObjectPageProps) {
  const params = await searchParams;

  return (
    <ObjectRequestFormPage
      mode="create"
      prefilledCollectionGroupId={parseCollectionGroupId(
        params.collectionGroupId,
      )}
    />
  );
}
