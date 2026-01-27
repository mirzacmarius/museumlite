"use client";

import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Logo } from "@v1/ui/logo";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { AlertCircle, CheckCircle, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "convex/react";

interface PageProps {
  params: {
    token: string;
    locale: string;
  };
}

export default function InvitePage({ params }: PageProps) {
  const { token } = params;
  const t = useScopedI18n("invitePage");
  const locale = useCurrentLocale();
  const router = useRouter();
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
          router.push(`/${locale}/`);
        }, 1500);
      } else if (!result.success && "error" in result) {
        setError(result.error);
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
          router.push(`/${locale}/login`);
        }, 1500);
      } else if (!result.success && "error" in result) {
        setError(result.error);
      }
    } catch (err) {
      setError(t("declineFailed"));
    } finally {
      setIsDeclining(false);
    }
  };

  // Loading state
  if (invitation === undefined) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center justify-center max-w-md w-full space-y-8">
          <Logo width={200} height={200} />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p>{t("loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  // Invitation not found
  if (invitation === null) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center justify-center max-w-md w-full space-y-8">
          <Logo width={200} height={200} />
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-destructive/10 p-3">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("notFound")}
            </h1>
            <p className="text-muted-foreground">{t("notFoundDescription")}</p>
            <Button onClick={() => router.push(`/${locale}/login`)}>
              {t("goToLogin")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center justify-center max-w-md w-full space-y-8">
          <Logo width={200} height={200} />
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-green-500/10 p-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{success}</h1>
            <p className="text-muted-foreground">{t("redirecting")}</p>
          </div>
        </div>
      </div>
    );
  }

  // Expired invitation
  if (invitation.isExpired || invitation.status === "expired") {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center justify-center max-w-md w-full space-y-8">
          <Logo width={200} height={200} />
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-orange-500/10 p-3">
                <AlertCircle className="h-8 w-8 text-orange-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t("expired")}</h1>
            <p className="text-muted-foreground">{t("expiredDescription")}</p>
            <Button onClick={() => router.push(`/${locale}/login`)}>
              {t("goToLogin")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Already accepted
  if (invitation.status === "accepted") {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center justify-center max-w-md w-full space-y-8">
          <Logo width={200} height={200} />
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-blue-500/10 p-3">
                <CheckCircle className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("alreadyAccepted")}
            </h1>
            <p className="text-muted-foreground">
              {t("alreadyAcceptedDescription")}
            </p>
            <Button onClick={() => router.push(`/${locale}/login`)}>
              {t("goToLogin")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Already declined
  if (invitation.status === "declined") {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center justify-center max-w-md w-full space-y-8">
          <Logo width={200} height={200} />
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-destructive/10 p-3">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("alreadyDeclined")}
            </h1>
            <p className="text-muted-foreground">
              {t("alreadyDeclinedDescription")}
            </p>
            <Button onClick={() => router.push(`/${locale}/login`)}>
              {t("goToLogin")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const expiresDate = new Date(invitation.expiresAt);
  const formattedDate = expiresDate.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Main invitation view
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center justify-center max-w-md w-full space-y-8">
        <Logo width={200} height={200} />
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {t("heading")}
          </h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>

        <div className="w-full rounded-lg border border-border bg-card p-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">{t("organization")}</p>
            <p className="text-lg font-semibold">{invitation.organizationName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("role")}</p>
            <p className="text-lg font-semibold">{invitation.roleName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("invitedBy")}</p>
            <p className="text-base">
              {invitation.inviterName || t("unknownInviter")}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("expiresOn")}</p>
            <p className="text-base">{formattedDate}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("email")}</p>
            <p className="text-base font-mono text-sm">{invitation.email}</p>
          </div>
        </div>

        {error && (
          <div className="w-full rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="w-full space-y-3">
          <Unauthenticated>
            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                // Redirect to login with return URL
                router.push(`/${locale}/login?returnTo=${encodeURIComponent(`/${locale}/invite/${token}`)}`);
              }}
            >
              {t("signInToAccept")}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={handleDecline}
              disabled={isDeclining}
            >
              {isDeclining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("declining")}
                </>
              ) : (
                t("decline")
              )}
            </Button>
          </Unauthenticated>

          <Authenticated>
            <Button
              className="w-full"
              size="lg"
              onClick={handleAccept}
              disabled={isAccepting}
            >
              {isAccepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("accepting")}
                </>
              ) : (
                t("accept")
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={handleDecline}
              disabled={isDeclining}
            >
              {isDeclining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("declining")}
                </>
              ) : (
                t("decline")
              )}
            </Button>
          </Authenticated>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {t("helpText")}
        </p>
      </div>
    </div>
  );
}
