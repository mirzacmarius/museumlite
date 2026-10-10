import { notFound } from "next/navigation";

/** Unknown dashboard URLs get the dashboard's not-found page. */
export default function MissingDashboardPage() {
  notFound();
}
