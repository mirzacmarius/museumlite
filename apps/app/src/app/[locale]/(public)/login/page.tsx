import { GoogleSignin } from "@/components/google-signin";
import { getI18n } from "@/locales/server";
import { Logo } from "@v1/ui/logo";

export async function generateMetadata() {
  const t = await getI18n();
  return {
    title: t("loginPage.title"),
  };
}

export default async function Page() {
  const t = await getI18n();

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
          <GoogleSignin />
        </div>
      </div>
    </div>
  );
}
