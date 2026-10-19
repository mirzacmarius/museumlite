// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { useStaggeredEntry } from "./use-staggered-entry";

function List({ items }: { items: string[] }) {
  const entry = useStaggeredEntry();
  return (
    <ul>
      {items.map((item, index) => (
        <li key={item} {...entry(item, index)}>
          {item}
        </li>
      ))}
    </ul>
  );
}

const delayOf = (name: string) => screen.getByText(name).style.animationDelay;

test("the first items enter one after another, up to a cap", () => {
  const items = Array.from({ length: 14 }, (_, index) => `Item ${index}`);
  render(<List items={items} />);

  expect(delayOf("Item 0")).toBe("0ms");
  expect(delayOf("Item 1")).toBe("35ms");
  expect(delayOf("Item 9")).toBe("315ms");
  expect(delayOf("Item 13")).toBe("315ms");
});

test("later items enter at once and shown items keep their delay", () => {
  const { rerender } = render(<List items={["Bowl", "Vase"]} />);

  rerender(<List items={["Lamp", "Bowl", "Vase", "Comb"]} />);

  expect(delayOf("Lamp")).toBe("0ms");
  expect(delayOf("Comb")).toBe("0ms");
  expect(delayOf("Vase")).toBe("35ms");
});

test("a list that renders empty first staggers its first items", () => {
  const { rerender } = render(<List items={[]} />);

  rerender(<List items={["Bowl", "Vase"]} />);

  expect(delayOf("Vase")).toBe("35ms");
});
