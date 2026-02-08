export function SignInMethodDivider() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-white/10" />
      </div>
      <div className="relative flex justify-center text-[11px] font-medium uppercase tracking-[0.06em]">
        <span className="bg-background px-2 text-white/55">
          Or continue with email
        </span>
      </div>
    </div>
  );
}
