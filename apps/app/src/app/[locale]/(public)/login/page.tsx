import { AuthMethods } from "@/components/auth-methods";
import { getI18n } from "@/locales/server";
import { Logo } from "@v1/ui/logo";

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
  const t = await getI18n();
  const { returnTo } = await searchParams;
  const requestedReturnTo =
    typeof returnTo === "string" ? returnTo : returnTo?.[0];
  const redirectTo = requestedReturnTo?.startsWith("/")
    ? requestedReturnTo
    : undefined;

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center justify-center max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {t("loginPage.heading")}
          </h1>
          <p className="text-muted-foreground">{t("loginPage.description")}</p>
        </div>
        <div className="flex flex-col items-center justify-center">
          <Logo width={350} height={350} />
          <AuthMethods mode="signIn" redirectTo={redirectTo} />
        </div>
      </div>
    </div>
  );
}
