import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import type { ReactNode } from "react";
import { env } from "../env";
import type { NotificationCategory } from "../utils/notificationTypes";
import type { NotificationEmailDetails } from "../utils/notificationValidators";
import { sendEmail } from "./index";
import {
  emailBodyStyle,
  emailButtonSectionStyle,
  emailContainerStyle,
  emailFooterTextStyle,
  emailHrStyle,
  emailInvitationButtonStyle,
  emailLinkStyle,
  emailMutedTextStyle,
  emailMutedTextWithMarginStyle,
  emailTextStyle,
} from "./styles";
import {
  type EmailLocale,
  getEmailTranslations,
  interpolateEmailText,
} from "./translations";

type LocalizedEmail = { locale?: EmailLocale };

const emailDateLocales: Record<EmailLocale, string> = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  no: "nb-NO",
  ro: "ro-RO",
};

const notificationDateFormatters: Record<EmailLocale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat(emailDateLocales.en, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
  fr: new Intl.DateTimeFormat(emailDateLocales.fr, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
  es: new Intl.DateTimeFormat(emailDateLocales.es, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
  no: new Intl.DateTimeFormat(emailDateLocales.no, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
  ro: new Intl.DateTimeFormat(emailDateLocales.ro, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
};

const emailDateFormatters: Record<EmailLocale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat(emailDateLocales.en, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
  fr: new Intl.DateTimeFormat(emailDateLocales.fr, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
  es: new Intl.DateTimeFormat(emailDateLocales.es, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
  no: new Intl.DateTimeFormat(emailDateLocales.no, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
  ro: new Intl.DateTimeFormat(emailDateLocales.ro, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
};

const emailPluralRules: Record<EmailLocale, Intl.PluralRules> = {
  en: new Intl.PluralRules("en"),
  fr: new Intl.PluralRules("fr"),
  es: new Intl.PluralRules("es"),
  no: new Intl.PluralRules("no"),
  ro: new Intl.PluralRules("ro"),
};

function formatNotificationDate(
  value: number | string | undefined,
  locale: EmailLocale,
): string {
  if (
    value === undefined ||
    value === "" ||
    (typeof value === "string" && value.trim().toLowerCase() === "tbd")
  ) {
    return getEmailTranslations(locale).loanDateUnavailable;
  }

  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return notificationDateFormatters[locale].format(date);
}

function formatLoanItemName(
  itemName: string,
  itemCount: number | undefined,
  locale: EmailLocale,
): string {
  const messages = getEmailTranslations(locale);
  const name = itemName || messages.loanItemsFallback;
  const additionalCount = Math.max((itemCount ?? 1) - 1, 0);
  if (additionalCount === 0) {
    return name;
  }

  const plural = emailPluralRules[locale].select(additionalCount);
  const suffix =
    plural === "one"
      ? messages.loanAdditionalItems.one
      : messages.loanAdditionalItems.other;
  return `${name}${text(suffix, { count: additionalCount })}`;
}

function localizedSiteUrl(path: string, locale: EmailLocale): string {
  const siteUrl = (env.SITE_URL || "https://app.museumlite.com").replace(
    /\/+$/,
    "",
  );
  return `${siteUrl}/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

function localizeInternalAppUrl(url: string, locale: EmailLocale): string {
  try {
    const parsedUrl = new URL(url);
    const siteUrl = new URL(env.SITE_URL || "https://app.museumlite.com");
    if (parsedUrl.origin !== siteUrl.origin) {
      return url;
    }

    const [firstSegment] = parsedUrl.pathname.split("/").filter(Boolean);
    if (
      firstSegment === "en" ||
      firstSegment === "fr" ||
      firstSegment === "es" ||
      firstSegment === "no" ||
      firstSegment === "ro"
    ) {
      return url;
    }

    parsedUrl.pathname = `/${locale}${parsedUrl.pathname.startsWith("/") ? parsedUrl.pathname : `/${parsedUrl.pathname}`}`;
    return parsedUrl.toString();
  } catch {
    return url;
  }
}

function EmailShell({
  locale,
  preview,
  children,
  footer,
}: {
  locale: EmailLocale;
  preview: string;
  children: ReactNode;
  footer?: string;
}) {
  const t = getEmailTranslations(locale);
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={emailBodyStyle}>
        <Container style={emailContainerStyle}>
          <Img
            src={`${env.SITE_URL}/images/convex-logo-email.jpg`}
            width="40"
            height="37"
            alt=""
          />
          {children}
          <Hr style={emailHrStyle} />
          <Text style={footer ? emailFooterTextStyle : emailMutedTextStyle}>
            {footer ?? t.footerBrand}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function Greeting({ email, locale }: { email: string; locale: EmailLocale }) {
  return (
    <Text style={emailTextStyle}>
      {interpolateEmailText(getEmailTranslations(locale).greeting, { email })}
    </Text>
  );
}

function TeamSignature({ locale }: { locale: EmailLocale }) {
  const t = getEmailTranslations(locale);
  return (
    <Text style={emailTextStyle}>
      <Link href={env.SITE_URL} style={emailLinkStyle}>
        {t.footerBrand}
      </Link>
      {" — "}
      {t.team}
    </Text>
  );
}

function text(template: string, values: Record<string, string | number> = {}) {
  return interpolateEmailText(template, values);
}

type InvitationEmailOptions = LocalizedEmail & {
  email: string;
  organizationName: string;
  inviterName: string;
  role: string;
  token: string;
};

function InvitationEmail({
  email,
  organizationName,
  inviterName,
  role,
  token,
  locale,
}: InvitationEmailOptions & { locale: EmailLocale }) {
  const t = getEmailTranslations(locale).invitation;
  const acceptUrl = localizedSiteUrl(`/invite/${token}`, locale);
  const declineUrl = localizedSiteUrl(
    `/invite/${token}?action=decline`,
    locale,
  );
  return (
    <EmailShell
      locale={locale}
      preview={text(t.preview, { organizationName })}
      footer={text(t.footer, { email })}
    >
      <Greeting email={email} locale={locale} />
      <Text style={emailTextStyle}>
        {text(t.invited, { inviterName, organizationName, role })}
      </Text>
      <Text style={emailTextStyle}>{t.instructions}</Text>
      <Section style={emailButtonSectionStyle}>
        <Button href={acceptUrl} style={emailInvitationButtonStyle}>
          {t.accept}
        </Button>
      </Section>
      <Text style={emailMutedTextStyle}>
        {t.copyLink}
        <br />
        <Link href={acceptUrl} style={emailLinkStyle}>
          {acceptUrl}
        </Link>
      </Text>
      <Text style={emailMutedTextWithMarginStyle}>
        <strong>{t.important}</strong> {t.expires}
      </Text>
      <Text style={emailMutedTextStyle}>
        {t.decline}{" "}
        <Link href={declineUrl} style={emailLinkStyle}>
          {t.declineLink}
        </Link>
        .
      </Text>
    </EmailShell>
  );
}

export async function sendInvitationEmail(args: InvitationEmailOptions) {
  const locale = args.locale ?? "en";
  const t = getEmailTranslations(locale).invitation;
  const html = await render(<InvitationEmail {...args} locale={locale} />);
  await sendEmail({
    to: args.email,
    subject: text(t.subject, { organizationName: args.organizationName }),
    html,
  });
}

type LoanNotificationEmailOptions = LocalizedEmail & {
  email: string;
  loanId: string;
  itemName: string;
  itemCount?: number;
  borrowerName: string;
  startDate: number | string;
  endDate?: number | string;
  loanUrl?: string;
};
type LoanKind = "loanApproved" | "loanRejected" | "loanPending";

function LoanNotificationEmail({
  email,
  loanId,
  itemName,
  itemCount,
  borrowerName,
  startDate,
  endDate,
  loanUrl,
  locale,
  kind,
  footer,
}: LoanNotificationEmailOptions & {
  locale: EmailLocale;
  kind: LoanKind;
  footer?: string;
}) {
  const t = getEmailTranslations(locale)[kind];
  const viewUrl = loanUrl
    ? localizeInternalAppUrl(loanUrl, locale)
    : localizedSiteUrl(`/loans/${loanId}`, locale);
  return (
    <EmailShell locale={locale} preview={t.preview} footer={footer}>
      <Greeting email={email} locale={locale} />
      <Text style={emailTextStyle}>{t.body}</Text>
      <Text style={emailTextStyle}>
        <strong>{t.item}</strong>{" "}
        {formatLoanItemName(itemName, itemCount, locale)}
        <br />
        <strong>{t.borrower}</strong> {borrowerName}
        <br />
        <strong>{t.period}</strong>{" "}
        {text(t.dateRange, {
          startDate: formatNotificationDate(startDate, locale),
          endDate: formatNotificationDate(endDate, locale),
        })}
      </Text>
      <Text style={emailTextStyle}>
        <Link href={viewUrl} style={emailLinkStyle}>
          {t.view}
        </Link>
      </Text>
      <TeamSignature locale={locale} />
    </EmailShell>
  );
}

async function sendLoanNotification(
  args: LoanNotificationEmailOptions,
  kind: LoanKind,
) {
  const locale = args.locale ?? "en";
  const html = await render(
    <LoanNotificationEmail {...args} locale={locale} kind={kind} />,
  );
  await sendEmail({
    to: args.email,
    subject: getEmailTranslations(locale)[kind].subject,
    html,
  });
}

export async function sendLoanApprovedEmail(
  args: LoanNotificationEmailOptions,
) {
  await sendLoanNotification(args, "loanApproved");
}

export async function sendLoanRejectedEmail(
  args: LoanNotificationEmailOptions,
) {
  await sendLoanNotification(args, "loanRejected");
}

export async function sendLoanPendingEmail(args: LoanNotificationEmailOptions) {
  await sendLoanNotification(args, "loanPending");
}

type TaskAssignedEmailOptions = LocalizedEmail & {
  email: string;
  taskTitle: string;
  assignedBy: string;
  dueDate?: number | string;
  taskUrl?: string;
};

function TaskAssignedEmail({
  email,
  taskTitle,
  assignedBy,
  dueDate,
  taskUrl,
  locale,
  footer,
}: TaskAssignedEmailOptions & { locale: EmailLocale; footer?: string }) {
  const t = getEmailTranslations(locale).taskAssigned;
  return (
    <EmailShell locale={locale} preview={t.preview} footer={footer}>
      <Greeting email={email} locale={locale} />
      <Text style={emailTextStyle}>{t.body}</Text>
      <Text style={emailTextStyle}>
        <strong>{t.task}</strong> {taskTitle}
        <br />
        <strong>{t.assignedBy}</strong> {assignedBy}
        {dueDate !== undefined ? (
          <>
            <br />
            <strong>{t.dueDate}</strong>{" "}
            {formatNotificationDate(dueDate, locale)}
          </>
        ) : null}
      </Text>
      <Text style={emailTextStyle}>
        <Link
          href={
            taskUrl
              ? localizeInternalAppUrl(taskUrl, locale)
              : localizedSiteUrl("/tasks", locale)
          }
          style={emailLinkStyle}
        >
          {t.view}
        </Link>
      </Text>
      <TeamSignature locale={locale} />
    </EmailShell>
  );
}

export async function sendTaskAssignedEmail(args: TaskAssignedEmailOptions) {
  const locale = args.locale ?? "en";
  const t = getEmailTranslations(locale).taskAssigned;
  const html = await render(<TaskAssignedEmail {...args} locale={locale} />);
  await sendEmail({ to: args.email, subject: t.subject, html });
}

type SubscriptionEmailOptions = LocalizedEmail & {
  email: string;
  subscriptionId: string;
};
type SubscriptionKind = "subscriptionSuccess" | "subscriptionError";

function SubscriptionEmail({
  email,
  locale,
  kind,
}: SubscriptionEmailOptions & { locale: EmailLocale; kind: SubscriptionKind }) {
  const t = getEmailTranslations(locale)[kind];
  return (
    <EmailShell locale={locale} preview={t.preview}>
      <Greeting email={email} locale={locale} />
      <Text style={emailTextStyle}>
        {t.body}
        <br />
        {"delight" in t ? t.delight : t.reassurance}
      </Text>
      <TeamSignature locale={locale} />
    </EmailShell>
  );
}

async function sendSubscriptionEmail(
  args: SubscriptionEmailOptions,
  kind: SubscriptionKind,
) {
  const locale = args.locale ?? "en";
  const t = getEmailTranslations(locale)[kind];
  const html = await render(
    <SubscriptionEmail {...args} locale={locale} kind={kind} />,
  );
  await sendEmail({ to: args.email, subject: t.subject, html });
}

export async function sendSubscriptionSuccessEmail(
  args: SubscriptionEmailOptions,
) {
  await sendSubscriptionEmail(args, "subscriptionSuccess");
}

export async function sendSubscriptionErrorEmail(
  args: SubscriptionEmailOptions,
) {
  await sendSubscriptionEmail(args, "subscriptionError");
}

function formatEmailDate(timestamp: number, locale: EmailLocale): string {
  return emailDateFormatters[locale].format(new Date(timestamp));
}

type OrganizationDeletionGraceEmailOptions = LocalizedEmail & {
  email: string;
  organizationName: string;
  token: string;
  graceEndsAt: number;
};

function OrganizationDeletionGraceEmail({
  email,
  organizationName,
  token,
  graceEndsAt,
  locale,
}: OrganizationDeletionGraceEmailOptions & { locale: EmailLocale }) {
  const t = getEmailTranslations(locale).deletionGrace;
  const cancelUrl = localizedSiteUrl(
    `/organization-deletion/cancel/${token}`,
    locale,
  );
  return (
    <EmailShell
      locale={locale}
      preview={text(t.preview, { organizationName })}
      footer={text(t.footer, { email, organizationName })}
    >
      <Greeting email={email} locale={locale} />
      <Text style={emailTextStyle}>
        {text(t.requested, { organizationName })}
      </Text>
      <Text style={emailTextStyle}>
        {text(t.continues, {
          date: formatEmailDate(graceEndsAt, locale),
        })}
      </Text>
      <Section style={emailButtonSectionStyle}>
        <Button href={cancelUrl} style={emailInvitationButtonStyle}>
          {t.stop}
        </Button>
      </Section>
      <Text style={emailMutedTextStyle}>{t.transfer}</Text>
    </EmailShell>
  );
}

export async function sendOrganizationDeletionGraceEmail(
  args: OrganizationDeletionGraceEmailOptions,
) {
  const locale = args.locale ?? "en";
  const t = getEmailTranslations(locale).deletionGrace;
  const html = await render(
    <OrganizationDeletionGraceEmail {...args} locale={locale} />,
  );
  await sendEmail({
    to: args.email,
    subject: text(t.subject, { organizationName: args.organizationName }),
    html,
  });
}

type OrganizationDeletionFinalNoticeEmailOptions = LocalizedEmail & {
  email: string;
  organizationName: string;
  token: string;
  scheduledDeletionDate: number;
  scheduledPurgeAt: number;
};

function OrganizationDeletionFinalNoticeEmail({
  email,
  organizationName,
  token,
  scheduledDeletionDate,
  locale,
}: OrganizationDeletionFinalNoticeEmailOptions & { locale: EmailLocale }) {
  const t = getEmailTranslations(locale).deletionFinal;
  const cancelUrl = localizedSiteUrl(
    `/organization-deletion/cancel/${token}`,
    locale,
  );
  return (
    <EmailShell
      locale={locale}
      preview={text(t.preview, { organizationName })}
      footer={text(t.footer, { email, organizationName })}
    >
      <Greeting email={email} locale={locale} />
      <Text style={emailTextStyle}>
        {text(t.scheduled, {
          organizationName,
          date: formatEmailDate(scheduledDeletionDate, locale),
        })}
      </Text>
      <Text style={emailTextStyle}>{t.keep}</Text>
      <Section style={emailButtonSectionStyle}>
        <Button href={cancelUrl} style={emailInvitationButtonStyle}>
          {t.stop}
        </Button>
      </Section>
    </EmailShell>
  );
}

export async function sendOrganizationDeletionFinalNoticeEmail(
  args: OrganizationDeletionFinalNoticeEmailOptions,
) {
  const locale = args.locale ?? "en";
  const t = getEmailTranslations(locale).deletionFinal;
  const html = await render(
    <OrganizationDeletionFinalNoticeEmail {...args} locale={locale} />,
  );
  await sendEmail({
    to: args.email,
    subject: text(t.subject, { organizationName: args.organizationName }),
    html,
  });
}

export interface NotificationEmailContent {
  /** Recipient address, used in the greeting. */
  email: string;
  organizationName: string;
  category: NotificationCategory;
  title: string;
  message: string;
  /** App path of the notification's entity, without a locale. */
  actionPath: string;
  details?: NotificationEmailDetails;
}

function NotificationEmail({
  email,
  organizationName,
  title,
  message,
  actionUrl,
  settingsUrl,
  footer,
  locale,
}: {
  email: string;
  organizationName: string;
  title: string;
  message: string;
  actionUrl: string;
  settingsUrl: string;
  footer: string;
  locale: EmailLocale;
}) {
  const t = getEmailTranslations(locale).notification;
  return (
    <EmailShell locale={locale} preview={title} footer={footer}>
      <Greeting email={email} locale={locale} />
      <Text style={emailTextStyle}>{text(t.intro, { organizationName })}</Text>
      <Text style={emailTextStyle}>
        <strong>{title}</strong>
        <br />
        {message}
      </Text>
      <Section style={emailButtonSectionStyle}>
        <Button href={actionUrl} style={emailInvitationButtonStyle}>
          {t.open}
        </Button>
      </Section>
      <Text style={emailMutedTextStyle}>
        <Link href={settingsUrl} style={emailLinkStyle}>
          {t.manage}
        </Link>
      </Text>
    </EmailShell>
  );
}

function notificationEmailElement(
  content: NotificationEmailContent,
  locale: EmailLocale,
) {
  const t = getEmailTranslations(locale).notification;
  const actionUrl = localizedSiteUrl(content.actionPath, locale);
  const footer = text(t.footer, {
    category: t.categories[content.category],
    organizationName: content.organizationName,
  });
  const { details } = content;
  if (details?.kind === "taskAssigned") {
    return {
      subject: getEmailTranslations(locale).taskAssigned.subject,
      element: (
        <TaskAssignedEmail
          {...details}
          email={content.email}
          taskUrl={actionUrl}
          locale={locale}
          footer={footer}
        />
      ),
    };
  }
  if (details) {
    return {
      subject: getEmailTranslations(locale)[details.kind].subject,
      element: (
        <LoanNotificationEmail
          {...details}
          email={content.email}
          loanUrl={actionUrl}
          locale={locale}
          footer={footer}
        />
      ),
    };
  }
  return {
    subject: content.title,
    element: (
      <NotificationEmail
        email={content.email}
        organizationName={content.organizationName}
        title={content.title}
        message={content.message}
        actionUrl={actionUrl}
        settingsUrl={localizedSiteUrl("/settings/notifications", locale)}
        footer={footer}
        locale={locale}
      />
    ),
  };
}

/** Subject, HTML and plain text of one notification email. */
export async function renderNotificationEmail(
  content: NotificationEmailContent,
  locale: EmailLocale,
) {
  const { subject, element } = notificationEmailElement(content, locale);
  const [html, plainText] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { subject, html, text: plainText };
}
