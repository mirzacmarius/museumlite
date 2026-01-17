"use client";

import { useOrganization } from "@/components/organization-provider";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useAction } from "convex/react";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";

export interface IsbnLookupData {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publicationYear?: number;
  publicationPlace?: string;
  pages?: number;
  description?: string;
  coverImageUrl?: string;
  isbn10?: string;
  isbn13?: string;
  subjects?: string[];
  language?: string;
  edition?: string;
  series?: string;
  deweyDecimal?: string;
  lcClassification?: string;
}

interface IsbnLookupProps {
  onDataFound: (data: IsbnLookupData) => void;
  onIsbnChange?: (isbn: string) => void;
}

export function IsbnLookup({ onDataFound, onIsbnChange }: IsbnLookupProps) {
  const [isbn, setIsbn] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentOrganizationId } = useOrganization();

  const lookupIsbn = useAction(api.library.isbnLookup.lookupIsbn);

  const handleLookup = async () => {
    if (!isbn.trim()) {
      setError("Please enter an ISBN");
      return;
    }

    if (!currentOrganizationId) {
      setError("Organization ID is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await lookupIsbn({
        isbn: isbn.trim(),
        organizationId: currentOrganizationId as Id<"organizations">,
      });

      if (result.found) {
        onDataFound({
          title: result.title,
          subtitle: result.subtitle,
          authors: result.authors,
          publisher: result.publisher,
          publicationYear: result.publicationYear,
          publicationPlace: result.publicationPlace,
          pages: result.pages,
          description: result.description,
          coverImageUrl: result.coverImageUrl,
          isbn10: result.isbn10,
          isbn13: result.isbn13,
          subjects: result.subjects,
          language: result.language,
          edition: result.edition,
          series: result.series,
          deweyDecimal: result.deweyDecimal,
          lcClassification: result.lcClassification,
        });
        setError(null);
      } else {
        setError(
          "No book found with this ISBN. Please enter details manually.",
        );
      }
    } catch (err) {
      setError(
        "Failed to look up ISBN. Please try again or enter details manually.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLookup();
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <Label htmlFor="isbn-lookup">ISBN Lookup</Label>
        <p className="text-sm text-muted-foreground">
          Enter an ISBN to automatically fill in book details from Open Library
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          id="isbn-lookup"
          placeholder="Enter ISBN-10 or ISBN-13..."
          value={isbn}
          onChange={(e) => {
            setIsbn(e.target.value);
            onIsbnChange?.(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button
          type="button"
          onClick={handleLookup}
          disabled={isLoading || !isbn.trim()}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Lookup
            </>
          )}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground">
        Powered by Open Library. Data may not always be available or accurate.
      </p>
    </div>
  );
}
