import { redirect } from "next/navigation";

export default function LegacyNewOrganizationPage() {
  redirect("/settings/organization/new");
}
