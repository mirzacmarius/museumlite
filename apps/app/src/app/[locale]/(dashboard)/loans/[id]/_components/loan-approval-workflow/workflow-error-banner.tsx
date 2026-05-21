interface WorkflowErrorBannerProps {
  error: string;
}

export function WorkflowErrorBanner({ error }: WorkflowErrorBannerProps) {
  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
      {error}
    </div>
  );
}
