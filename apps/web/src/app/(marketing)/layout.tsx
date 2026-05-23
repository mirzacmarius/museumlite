import "@/marketing-styles.css";
import { MarketingSiteShell } from "@/components/site/marketing-site-shell";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <MarketingSiteShell>{children}</MarketingSiteShell>;
}
