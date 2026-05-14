import Image from "next/image";

export default async function Layout({
  children,
}: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen w-full bg-card">
      <div className="absolute left-1/2 top-8 mx-auto -translate-x-1/2 transform justify-center">
        <Image src="/logo.png" alt="logo" width={100} height={100} />
      </div>
      <div className="z-10 size-screen">{children}</div>
      <div className="base-grid fixed size-screen opacity-40" />
      <div className="fixed bottom-0 size-screen bg-gradient-to-t from-[hsl(var(--card))] to-transparent" />
    </div>
  );
}
