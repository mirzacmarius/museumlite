import { GoogleSignin } from "@/components/google-signin";
import { Logo } from "@v1/ui/logo";

export const metadata = {
  title: "Login",
};

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
