import { ConvexClientProvider } from "../../convex-client-provider";

export default function ContactLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
