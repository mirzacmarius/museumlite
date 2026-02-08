import { AuthRoot } from "@/auth/auth-root";
import { getI18n } from "@/locales/server";
import { Logo } from "@v1/ui/logo";
import Link from "next/link";

export async function generateMetadata() {
  const t = await getI18n();
  return {
    title: t("loginPage.title"),
  };
}

interface PageProps {
  searchParams: Promise<{
    returnTo?: string | string[];
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { returnTo } = await searchParams;
  const requestedReturnTo =
    typeof returnTo === "string" ? returnTo : returnTo?.[0];
  const redirectTo = requestedReturnTo?.startsWith("/")
    ? requestedReturnTo
    : undefined;

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="w-full max-w-[26rem]">
        <div className="mb-6 flex justify-center">
          <Logo height={120} width={120} />
        </div>
        <AuthRoot initialMode="signIn" redirectTo={redirectTo} />
        <p className="pt-5 text-center text-sm text-white/70">
          No account yet?{" "}
          <Link
            className="font-medium text-white underline underline-offset-4"
            href={
              redirectTo
                ? `/register?returnTo=${encodeURIComponent(redirectTo)}`
                : "/register"
            }
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
