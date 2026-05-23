import { PortalAppShell } from "@/components/portal/portal-app-shell";

export default function CollectionsRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <PortalAppShell>{children}</PortalAppShell>;
}
