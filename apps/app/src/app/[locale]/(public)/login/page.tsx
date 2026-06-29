import { Logo } from "@v1/ui/logo";
import { AuthRoot } from "@/auth/auth-root";
import { getInitialAuthEmail, getSafeReturnTo } from "@/auth/search-params";
import { getI18n } from "@/locales/server";

export async function generateMetadata() {
  const t = await getI18n();
  return {
    title: t("loginPage.title"),
  };
}

interface PageProps {
  searchParams: Promise<{
    email?: string | string[];
    returnTo?: string | string[];
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { email, returnTo } = await searchParams;
  const initialEmail = getInitialAuthEmail(email);
  const redirectTo = getSafeReturnTo(returnTo);

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="w-full max-w-[26rem]">
        <div className="mb-6 flex justify-center">
          <Logo height={120} width={120} />
        </div>
        <AuthRoot
          initialEmail={initialEmail}
          initialMode="signIn"
          redirectTo={redirectTo}
        />
      </div>
    </div>
  );
}
