"use client";

import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Logo } from "@v1/ui/logo";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { useMutation } from "convex/react";
import { AlertCircle, CheckCircle, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, use, useState } from "react";

interface PageProps {
  params: Promise<{
    token: string;
    locale: string;
  }>;
}

function InviteShell({ children }: { children: ReactNode }) {
  return (
    <div className="size-screen flex flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-md flex-col items-center justify-center gap-y-8">
        <Logo width={200} height={200} />
        {children}
      </div>
    </div>
  );
}

function InviteStatusView({
  action,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  description?: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <InviteShell>
      <div className="space-y-4 text-center">
        <div className="flex items-center justify-center">{icon}</div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground">{description}</p>
        ) : null}
        {action}
      </div>
    </InviteShell>
  );
}

function InviteLoadingView({ label }: { label: string }) {
  return (
    <InviteShell>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <p>{label}</p>
      </div>
    </InviteShell>
  );
}

function InviteDetailsCard({
  details,
}: {
  details: Array<{
    label: string;
    value: string;
    valueClassName?: string;
  }>;
}) {
  return (
    <div className="w-full space-y-4 rounded-lg border border-border bg-card p-6">
      {details.map((detail) => (
        <div key={detail.label}>
          <p className="text-sm text-muted-foreground">{detail.label}</p>
          <p className={detail.valueClassName ?? "text-base"}>{detail.value}</p>
        </div>
      ))}
    </div>
  );
}

function InviteErrorMessage({ error }: { error: string | null }) {
  if (!error) {
    return null;
  }

  return (
    <div className="flex w-full items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="size-4" />
      {error}
    </div>
  );
}

function InviteActions({
  acceptingLabel,
  acceptLabel,
  declineLabel,
  decliningLabel,
  isAccepting,
  isDeclining,
  onAccept,
  onDecline,
  onSignIn,
  signInLabel,
}: {
  acceptingLabel: string;
  acceptLabel: string;
  declineLabel: string;
  decliningLabel: string;
  isAccepting: boolean;
  isDeclining: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onSignIn: () => void;
  signInLabel: string;
}) {
  return (
    <div className="w-full space-y-3">
      <Unauthenticated>
        <Button className="w-full" size="lg" onClick={onSignIn}>
          {signInLabel}
        </Button>
      </Unauthenticated>

      <Authenticated>
        <Button
          className="w-full"
          size="lg"
          onClick={onAccept}
          disabled={isAccepting}
        >
          {isAccepting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {acceptingLabel}
            </>
          ) : (
            acceptLabel
          )}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          size="lg"
          onClick={onDecline}
          disabled={isDeclining}
        >
          {isDeclining ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {decliningLabel}
            </>
          ) : (
            declineLabel
          )}
        </Button>
      </Authenticated>
    </div>
  );
}

export default function InvitePage({ params }: PageProps) {
  const { token } = use(params);
  const t = useScopedI18n("invitePage");
  const locale = useCurrentLocale();
  const { push } = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch invitation details (public query, no auth required)
  const invitation = useQuery(api.invitations.getInvitationByToken, { token });
  const acceptInvitation = useMutation(api.invitations.acceptInvitation);
  const declineInvitation = useMutation(api.invitations.declineInvitation);

  const handleAccept = async () => {
    setIsAccepting(true);
    setError(null);
    try {
      const result = await acceptInvitation({ token });
      if (result.success && "organizationId" in result) {
        setSuccess(t("acceptSuccess"));
        // Redirect to the organization after a brief delay
        setTimeout(() => {
          push(`/${locale}/`);
        }, 1500);
      } else if (!result.success && "error" in result) {
        setError(result.error ?? null);
      }
    } catch (err) {
      setError(t("acceptFailed"));
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    setError(null);
    try {
      const result = await declineInvitation({ token });
      if (result.success) {
        setSuccess(t("declineSuccess"));
        // Redirect after a brief delay
        setTimeout(() => {
          push(`/${locale}/login`);
        }, 1500);
      } else if (!result.success && "error" in result) {
        setError(result.error ?? null);
      }
    } catch (err) {
      setError(t("declineFailed"));
    } finally {
      setIsDeclining(false);
    }
  };

  if (invitation === undefined) {
    return <InviteLoadingView label={t("loading")} />;
  }

  if (invitation === null) {
    return (
      <InviteStatusView
        title={t("notFound")}
        description={t("notFoundDescription")}
        icon={
          <div className="rounded-full bg-destructive/10 p-3">
            <XCircle className="size-8 text-destructive" />
          </div>
        }
        action={
          <Button onClick={() => push(`/${locale}/login`)}>
            {t("goToLogin")}
          </Button>
        }
      />
    );
  }

  if (success) {
    return (
      <InviteStatusView
        title={success}
        description={t("redirecting")}
        icon={
          <div className="rounded-full bg-green-500/10 p-3">
            <CheckCircle className="size-8 text-green-500" />
          </div>
        }
      />
    );
  }

  if (invitation.isExpired || invitation.status === "expired") {
    return (
      <InviteStatusView
        title={t("expired")}
        description={t("expiredDescription")}
        icon={
          <div className="rounded-full bg-orange-500/10 p-3">
            <AlertCircle className="size-8 text-orange-500" />
          </div>
        }
        action={
          <Button onClick={() => push(`/${locale}/login`)}>
            {t("goToLogin")}
          </Button>
        }
      />
    );
  }

  if (invitation.status === "accepted") {
    return (
      <InviteStatusView
        title={t("alreadyAccepted")}
        description={t("alreadyAcceptedDescription")}
        icon={
          <div className="rounded-full bg-blue-500/10 p-3">
            <CheckCircle className="size-8 text-blue-500" />
          </div>
        }
        action={
          <Button onClick={() => push(`/${locale}/login`)}>
            {t("goToLogin")}
          </Button>
        }
      />
    );
  }

  if (invitation.status === "declined") {
    return (
      <InviteStatusView
        title={t("alreadyDeclined")}
        description={t("alreadyDeclinedDescription")}
        icon={
          <div className="rounded-full bg-destructive/10 p-3">
            <XCircle className="size-8 text-destructive" />
          </div>
        }
        action={
          <Button onClick={() => push(`/${locale}/login`)}>
            {t("goToLogin")}
          </Button>
        }
      />
    );
  }

  const expiresDate = new Date(invitation.expiresAt);
  const formattedDate = expiresDate.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <InviteShell>
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("heading")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <InviteDetailsCard
        details={[
          {
            label: t("organization"),
            value: invitation.organizationName,
            valueClassName: "text-lg font-semibold",
          },
          {
            label: t("role"),
            value: invitation.roleName,
            valueClassName: "text-lg font-semibold",
          },
          {
            label: t("invitedBy"),
            value: invitation.inviterName || t("unknownInviter"),
          },
          { label: t("expiresOn"), value: formattedDate },
          {
            label: t("email"),
            value: invitation.email,
            valueClassName: "font-mono text-sm",
          },
        ]}
      />

      <InviteErrorMessage error={error} />

      <InviteActions
        acceptingLabel={t("accepting")}
        acceptLabel={t("accept")}
        declineLabel={t("decline")}
        decliningLabel={t("declining")}
        isAccepting={isAccepting}
        isDeclining={isDeclining}
        onAccept={handleAccept}
        onDecline={handleDecline}
        onSignIn={() =>
          push(
            `/${locale}/login?returnTo=${encodeURIComponent(`/${locale}/invite/${token}`)}`,
          )
        }
        signInLabel={t("signInToAccept")}
      />

      <p className="text-xs text-muted-foreground text-center">
        {t("helpText")}
      </p>
    </InviteShell>
  );
}
