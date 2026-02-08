import { Input } from "@v1/ui/input";

interface CodeInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}

export function CodeInput({ id = "code", value, onChange }: CodeInputProps) {
  return (
    <Input
      className="h-10 border-white/10 bg-background tracking-[0.25em]"
      id={id}
      inputMode="numeric"
      maxLength={8}
      minLength={6}
      onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, ""))}
      pattern="[0-9]{6,8}"
      placeholder="Enter code"
      required
      type="text"
      value={value}
    />
  );
}
