import { EmailChangeForm } from "./email-change-form";
import { PasswordForm } from "./password-form";
import { PhoneForm } from "./phone-form";

export function AccountCredentials() {
  return (
    <>
      <EmailChangeForm />
      <PhoneForm />
      <PasswordForm />
    </>
  );
}
