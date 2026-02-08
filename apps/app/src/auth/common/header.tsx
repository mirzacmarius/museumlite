interface AuthFormHeaderProps {
  title: string;
  description: string;
}

export function AuthFormHeader({ title, description }: AuthFormHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[20px] font-semibold text-white">{title}</span>
      <span className="text-[20px] font-semibold text-white/55">
        {description}
      </span>
    </div>
  );
}
