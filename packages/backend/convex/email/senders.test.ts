import { render } from "@react-email/render";
import { expect, test, vi } from "vitest";
import WelcomeEmail from "../../../email/emails/welcome";
import { ResendOTP } from "../otp/ResendOTP";
import { ResendOTPPasswordReset } from "../passwordReset/ResendOTPPasswordReset";
import { sendLocalizedMagicLinkEmail } from "./authCopy";
import { sendEmail } from "./index";
import {
  sendInvitationEmail,
  sendLoanApprovedEmail,
  sendLoanPendingEmail,
  sendLoanRejectedEmail,
  sendOrganizationDeletionFinalNoticeEmail,
  sendOrganizationDeletionGraceEmail,
  sendSubscriptionErrorEmail,
  sendSubscriptionSuccessEmail,
  sendTaskAssignedEmail,
} from "./senders";
import {
  buildAuthCodeEmail,
  getEmailLocaleFromAuthUrl,
  getEmailTranslations,
} from "./translations";

vi.mock("./index", () => ({ sendEmail: vi.fn() }));

const locales = ["en", "fr", "es", "no", "ro"] as const;
const dateFormatters = {
  en: new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
  fr: new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
  es: new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
  no: new Intl.DateTimeFormat("nb-NO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
  ro: new Intl.DateTimeFormat("ro-RO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
};

const samples = {
  invitation: (locale: (typeof locales)[number]) =>
    sendInvitationEmail({
      email: "member@example.test",
      organizationName: "Museum <North>",
      inviterName: "Alex Example",
      role: "Curator",
      token: "invite-token",
      locale,
    }),
  loanApproved: (locale: (typeof locales)[number]) =>
    sendLoanApprovedEmail({
      email: "member@example.test",
      loanId: "loan-1",
      itemName: "Painting <A>",
      borrowerName: "Gallery & Co.",
      startDate: "15 May 2026",
      endDate: "22 May 2026",
      locale,
    }),
  loanRejected: (locale: (typeof locales)[number]) =>
    sendLoanRejectedEmail({
      email: "member@example.test",
      loanId: "loan-1",
      itemName: "Painting <A>",
      borrowerName: "Gallery & Co.",
      startDate: "15 May 2026",
      endDate: "22 May 2026",
      locale,
    }),
  loanPending: (locale: (typeof locales)[number]) =>
    sendLoanPendingEmail({
      email: "member@example.test",
      loanId: "loan-1",
      itemName: "Painting <A>",
      borrowerName: "Gallery & Co.",
      startDate: "15 May 2026",
      endDate: "22 May 2026",
      locale,
    }),
  taskAssigned: (locale: (typeof locales)[number]) =>
    sendTaskAssignedEmail({
      email: "member@example.test",
      taskTitle: "Review sculpture",
      assignedBy: "Sam Curator",
      dueDate: "20 May 2026",
      locale,
    }),
  subscriptionSuccess: (locale: (typeof locales)[number]) =>
    sendSubscriptionSuccessEmail({
      email: "member@example.test",
      subscriptionId: "sub-1",
      locale,
    }),
  subscriptionError: (locale: (typeof locales)[number]) =>
    sendSubscriptionErrorEmail({
      email: "member@example.test",
      subscriptionId: "sub-1",
      locale,
    }),
  deletionGrace: (locale: (typeof locales)[number]) =>
    sendOrganizationDeletionGraceEmail({
      email: "member@example.test",
      organizationName: "Museum <North>",
      token: "cancel-token",
      graceEndsAt: Date.UTC(2026, 5, 15),
      locale,
    }),
  deletionFinal: (locale: (typeof locales)[number]) =>
    sendOrganizationDeletionFinalNoticeEmail({
      email: "member@example.test",
      organizationName: "Museum <North>",
      token: "cancel-token",
      scheduledDeletionDate: Date.UTC(2026, 5, 15),
      scheduledPurgeAt: Date.UTC(2026, 5, 16),
      locale,
    }),
};

const templateLocaleCases = Object.entries(samples).flatMap(
  ([templateName, sendTemplate]) =>
    locales.map((locale) => [templateName, locale, sendTemplate] as const),
);

test.each(
  templateLocaleCases,
)("%s email renders in %s without sending real mail", async (_templateName, locale, sendTemplate) => {
  const sendEmailMock = vi.mocked(sendEmail);
  sendEmailMock.mockClear();

  await sendTemplate(locale);
  const sentEmail = sendEmailMock.mock.calls[0]?.[0];
  expect(sentEmail).toBeDefined();
  expect(sentEmail?.subject.length).toBeGreaterThan(0);
  expect(sentEmail?.html).toContain(`lang="${locale}"`);
  expect(sentEmail?.html.toLowerCase()).not.toContain("lorem ipsum");
  expect(sendEmailMock).toHaveBeenCalledTimes(1);
});

test.each(locales)("welcome email renders in %s", async (locale) => {
  const welcome = await render(WelcomeEmail({ locale }));
  expect(welcome).toContain(`lang="${locale}"`);
  expect(welcome).toContain("MuseumLite");
  expect(welcome.toLowerCase()).not.toContain("lorem ipsum");
});

test.each(
  locales,
)("loan and task notification dates, item counts, and app links use %s", async (locale) => {
  const sendEmailMock = vi.mocked(sendEmail);
  const timestamp = Date.UTC(2026, 4, 15);
  const localizedDate = dateFormatters[locale].format(new Date(timestamp));

  sendEmailMock.mockClear();
  await sendLoanApprovedEmail({
    email: "member@example.test",
    loanId: "loan-1",
    itemName: "Painting <A>",
    itemCount: 3,
    borrowerName: "Gallery & Co.",
    startDate: timestamp,
    locale,
  });

  const loanHtml = sendEmailMock.mock.calls[0]?.[0].html;
  const suffix = getEmailTranslations(locale).loanAdditionalItems.other.replace(
    "{count}",
    "2",
  );
  expect(loanHtml).toContain(localizedDate);
  expect(loanHtml).toContain(getEmailTranslations(locale).loanDateUnavailable);
  expect(loanHtml).toContain(suffix);
  expect(loanHtml).toContain("Painting &lt;A&gt;");
  expect(loanHtml).toContain(`/${locale}/loans/loan-1`);

  sendEmailMock.mockClear();
  await sendTaskAssignedEmail({
    email: "member@example.test",
    taskTitle: "Review sculpture",
    assignedBy: "Sam Curator",
    dueDate: timestamp,
    taskUrl: "https://app.museumlite.com/exhibitions/exhibition-1/tasks/task-1",
    locale,
  });

  const taskHtml = sendEmailMock.mock.calls[0]?.[0].html;
  expect(taskHtml).toContain(localizedDate);
  expect(taskHtml).toContain(
    `/${locale}/exhibitions/exhibition-1/tasks/task-1`,
  );
});

test("React email rendering escapes custom names and retains locale specific subjects", async () => {
  const sendEmailMock = vi.mocked(sendEmail);
  sendEmailMock.mockClear();
  await samples.invitation("fr");
  const sentEmail = sendEmailMock.mock.calls[0]?.[0];

  expect(sentEmail?.subject).toContain("Museum <North>");
  expect(sentEmail?.html).toContain("Museum &lt;North&gt;");
  expect(sentEmail?.subject).toBe(
    getEmailTranslations("fr").invitation.subject.replace(
      "{organizationName}",
      "Museum <North>",
    ),
  );
});

test("auth callback locale comes from the first URL path segment with English fallback", () => {
  expect(
    getEmailLocaleFromAuthUrl("https://app.museumlite.com/fr?code=one"),
  ).toBe("fr");
  expect(
    getEmailLocaleFromAuthUrl("https://app.museumlite.com/no/login?code=one"),
  ).toBe("no");
  expect(
    getEmailLocaleFromAuthUrl("https://app.museumlite.com/login?code=one"),
  ).toBe("en");
});

test("localized magic link email keeps the verification URL and escapes HTML values", async () => {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response("{}", { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const url = "https://app.museumlite.com/fr?code=one&callbackUrl=%2Ffr";
  await sendLocalizedMagicLinkEmail({
    identifier: "member+<north>@example.test",
    url,
    expires: new Date("2026-05-15T12:00:00Z"),
    provider: {
      id: "resend",
      type: "email",
      name: "Resend",
      from: "MuseumLite <auth@example.test>",
      apiKey: "test-key",
      sendVerificationRequest: async () => undefined,
      options: {},
    },
    token: "opaque-token",
    theme: {
      colorScheme: "light",
      logo: "",
      brandColor: "#000000",
      buttonText: "#ffffff",
    },
    request: new Request(url),
  });

  const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
    subject: string;
    html: string;
    text: string;
  };
  expect(body.subject).toBe(getEmailTranslations("fr").auth.magicLinkSubject);
  expect(body.html).toContain('lang="fr"');
  expect(body.html).toContain(
    'href="https://app.museumlite.com/fr?code=one&amp;callbackUrl=%2Ffr"',
  );
  expect(body.html).toContain("member+&lt;north&gt;@example.test");
  expect(body.text).toContain(url);
  vi.unstubAllGlobals();
});

test("OTP and password reset callbacks localize by URL and send only mocked requests", async () => {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response("{}", { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  for (const locale of locales) {
    const url = `https://app.museumlite.com/${locale}/login?code=one`;
    const requestParams = {
      identifier: "member@example.test",
      url,
      expires: new Date("2026-05-15T12:00:00Z"),
      provider: {
        id: "resend-otp",
        type: "email" as const,
        name: "Email",
        from: "MuseumLite <auth@example.test>",
        apiKey: "test-key",
        sendVerificationRequest: async () => undefined,
        options: {},
      },
      token: "<code>",
      theme: {
        colorScheme: "light" as const,
        logo: "",
        brandColor: "#000000",
        buttonText: "#ffffff",
      },
      request: new Request(url),
    };
    await ResendOTP.sendVerificationRequest(requestParams);
    await ResendOTPPasswordReset.sendVerificationRequest(requestParams);

    const otpRequest = JSON.parse(
      String(fetchMock.mock.calls.at(-2)?.[1]?.body),
    ) as { subject: string; html: string };
    const passwordRequest = JSON.parse(
      String(fetchMock.mock.calls.at(-1)?.[1]?.body),
    ) as { subject: string; html: string };
    expect(otpRequest.subject).toBe(
      getEmailTranslations(locale).auth.verificationSubject,
    );
    expect(otpRequest.html).toContain(`lang="${locale}"`);
    expect(otpRequest.html).toContain("&lt;code&gt;");
    expect(passwordRequest.subject).toBe(
      getEmailTranslations(locale).auth.passwordSubject,
    );
    expect(passwordRequest.html).toContain(`lang="${locale}"`);
    expect(passwordRequest.html).toContain("&lt;code&gt;");
  }

  expect(fetchMock).toHaveBeenCalledTimes(locales.length * 2);
  vi.unstubAllGlobals();
});

test("email-change code copy is localized and safely escapes inserted codes", () => {
  for (const locale of locales) {
    const copy = getEmailTranslations(locale).auth;
    const email = buildAuthCodeEmail({
      locale,
      subject: copy.emailChangeSubject,
      body: copy.emailChangeBody,
      token: "<123456>",
      additionalMessage: copy.expires,
    });
    expect(email.subject).toBe(copy.emailChangeSubject);
    expect(email.html).toContain(`lang="${locale}"`);
    expect(email.html).toContain("&lt;123456&gt;");
    expect(email.text).toContain("<123456>");
    expect(email.html).toContain(copy.expires);
  }
});
