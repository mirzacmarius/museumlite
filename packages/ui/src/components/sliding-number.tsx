import type * as React from "react";
import { cn } from "../utils";

const DIGITS = "0123456789";
// A 9 above the 0 and a 0 below the 9, so the spring's overshoot past either
// end shows the neighbouring digit, as on an odometer, rather than a gap.
const DIGIT_STRIP = ["9", ...DIGITS, "0"].join("\n");

/**
 * A number whose digits roll on the spring from the old digit to the new
 * one when the value changes, Animate UI style. It appears at its value,
 * without rolling, so a page's stats stay still as it loads. The value
 * itself stays in the DOM as transparent
 * text, so it sets the layout and is what tests, selection and screen readers
 * read. The rolling digits over it are drawn by CSS from `data-strip` and
 * hidden from assistive technology. Separators and other characters stand
 * still, so a formatted value such as "1,234" or "—" works as is.
 */
function SlidingNumber({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  const text = String(value);
  const characters = [...text];
  return (
    <span className={cn("tabular-nums", className)}>
      {/* Hugs the text, so the digits line up with it however it is aligned. */}
      <span className="relative inline-block whitespace-nowrap">
        <span className="text-transparent forced-colors:text-[CanvasText]">
          {text}
        </span>
        <span
          aria-hidden
          className="absolute inset-0 flex forced-colors:hidden"
        >
          {characters.map((character, index) => {
            const digit = DIGITS.indexOf(character);
            // Keyed from the right, so the ones column stays the ones column as
            // the number grows a digit.
            const place = characters.length - index;
            return (
              <span
                key={digit < 0 ? `${place}${character}` : place}
                className="h-full overflow-hidden"
              >
                <span
                  data-strip={digit < 0 ? character : DIGIT_STRIP}
                  style={
                    {
                      "--line": digit < 0 ? 0 : digit + 1,
                    } as React.CSSProperties
                  }
                  className="block whitespace-pre transition-[translate] duration-spring ease-spring [translate:0_calc(var(--line)*-100%/12)] before:content-[attr(data-strip)] motion-reduce:transition-none"
                />
              </span>
            );
          })}
        </span>
      </span>
    </span>
  );
}

export { SlidingNumber };
