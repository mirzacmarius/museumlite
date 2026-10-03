import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@v1/ui/select";
import { cn } from "@v1/ui/utils";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useScopedI18n } from "@/locales/client";

export function ThemeSwitcher({ triggerClass }: { triggerClass?: string }) {
  const { theme: currentTheme, setTheme, themes } = useTheme();
  const t = useScopedI18n("untranslatedDashboard.themeSwitcher");
  const themeLabel = (theme: string) =>
    theme === "light" || theme === "dark" || theme === "system"
      ? t(theme)
      : theme;
  return (
    <Select
      value={currentTheme}
      onValueChange={(theme) => setTheme(theme as (typeof themes)[number])}
    >
      <SelectTrigger
        className={cn(
          "h-6 rounded border-primary/20 bg-secondary !px-2 hover:border-primary/40",
          triggerClass,
        )}
      >
        <div className="flex items-start gap-2">
          {currentTheme === "light" ? (
            <Sun className="size-[14px]" />
          ) : currentTheme === "dark" ? (
            <Moon className="size-[14px]" />
          ) : (
            <Monitor className="size-[14px]" />
          )}
          {currentTheme && (
            <span className="text-xs font-medium">
              {themeLabel(currentTheme)}
            </span>
          )}
        </div>
      </SelectTrigger>
      <SelectContent>
        {themes.map((theme) => (
          <SelectItem
            key={theme}
            value={theme}
            className={`text-sm font-medium text-primary/60 ${theme === currentTheme && "text-primary"}`}
          >
            {theme && themeLabel(theme)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ThemeSwitcherHome() {
  const { setTheme, themes } = useTheme();
  const t = useScopedI18n("untranslatedDashboard.themeSwitcher");
  return (
    <div className="flex gap-3">
      {themes.map((theme) => (
        <button
          key={theme}
          name="theme"
          aria-label={theme ? t(theme) : undefined}
          title={theme ? t(theme) : undefined}
          onClick={() => setTheme(theme)}
          type="button"
        >
          {theme === "light" ? (
            <Sun className="size-4 text-primary/80 hover:text-primary" />
          ) : theme === "dark" ? (
            <Moon className="size-4 text-primary/80 hover:text-primary" />
          ) : (
            <Monitor className="size-4 text-primary/80 hover:text-primary" />
          )}
        </button>
      ))}
    </div>
  );
}
