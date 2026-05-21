export async function writeTextToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy copy path when clipboard permissions are denied.
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  Object.assign(textarea.style, {
    position: "fixed",
    opacity: "0",
    pointerEvents: "none",
  });

  document.body.append(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  return copied;
}
