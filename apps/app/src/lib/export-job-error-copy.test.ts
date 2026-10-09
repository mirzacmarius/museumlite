import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import {
  ExportDownloadError,
  exportJobErrorKey,
} from "./export-job-error-copy";

describe("exportJobErrorKey", () => {
  it("maps known backend export failures to localized copy keys", () => {
    expect(
      exportJobErrorKey(new ConvexError("Export permission revoked")),
    ).toBe("errorAccess");
    expect(
      exportJobErrorKey(new Error("Feature requires enterprise tier")),
    ).toBe("errorAccess");
    expect(exportJobErrorKey("Export limit reached for current tier")).toBe(
      "errorQuota",
    );
    expect(exportJobErrorKey("Export expired; create a new request")).toBe(
      "errorExpired",
    );
    expect(exportJobErrorKey("Export is still running")).toBe(
      "errorNotResumable",
    );
    expect(
      exportJobErrorKey(
        "Selected object missing or outside authorized scope; create a new selection",
      ),
    ).toBe("errorSelection");
    expect(
      exportJobErrorKey(
        "Export exceeds 16 MiB. Reduce selection and create a new export.",
      ),
    ).toBe("errorTooLarge");
    expect(
      exportJobErrorKey(
        "Inventory-scope views support at most 32 loan associations per object. Export explicit selected objects instead.",
      ),
    ).toBe("errorInventoryLinks");
    expect(exportJobErrorKey("Filter outside organization")).toBe(
      "errorInvalidRequest",
    );
    expect(exportJobErrorKey("Export chunk checksum mismatch")).toBe(
      "errorInterrupted",
    );
  });

  it("maps the stable register criteria code whether data arrives parsed or serialized", () => {
    const data = {
      code: "REGISTER_CRITERIA_INVALID",
      message: "Invalid register criteria",
    };
    expect(exportJobErrorKey(new ConvexError(data))).toBe(
      "errorRegisterCriteria",
    );
    expect(exportJobErrorKey(new ConvexError(JSON.stringify(data)))).toBe(
      "errorRegisterCriteria",
    );
    expect(
      exportJobErrorKey(
        "Register record history exceeds processing limits (200 approval steps)",
      ),
    ).toBe("errorTooLarge");
  });

  it("maps download HTTP statuses without echoing server text", () => {
    expect(exportJobErrorKey(new ExportDownloadError(403))).toBe("errorAccess");
    expect(exportJobErrorKey(new ExportDownloadError(404))).toBe(
      "errorUnavailable",
    );
    expect(exportJobErrorKey(new ExportDownloadError(409))).toBe(
      "errorUnavailable",
    );
  });

  it("falls back to the generic failure for unknown messages", () => {
    expect(exportJobErrorKey(new Error("Something odd"))).toBe("failed");
    expect(exportJobErrorKey(undefined)).toBe("failed");
  });
});
