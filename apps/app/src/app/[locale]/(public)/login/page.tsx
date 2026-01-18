import { GoogleSignin } from "@/components/google-signin";
import { getI18n } from "@/locales/server";
import { Logo } from "@v1/ui/logo";

export async function generateMetadata() {
  const t = await getI18n();
  return {
    title: t("loginPage.title"),
  };
}

export default function Page() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center">
      <div className="flex flex-col items-center justify-center size-96">
        <Logo width={350} height={350} />
        <GoogleSignin />
      </div>
    </div>
  );
}
