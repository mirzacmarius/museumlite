"use client";

import { Suspense } from "react";
import { ObjectRequestFormPage } from "./object-request-form-page";

function ObjectRequestFormFallback() {
  return (
    <div className="flex size-full items-center justify-center">
      <p className="text-muted-foreground">Loading form…</p>
    </div>
  );
}

export default function CollectionFormPage() {
  return (
    <Suspense fallback={<ObjectRequestFormFallback />}>
      <ObjectRequestFormPage mode="create" />
    </Suspense>
  );
}
