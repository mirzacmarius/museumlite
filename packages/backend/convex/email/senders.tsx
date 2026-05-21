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
import { env } from "../env";
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

// ============================================
// Invitation Email
// ============================================

type InvitationEmailOptions = {
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
}: InvitationEmailOptions) {
  const acceptUrl = `${env.SITE_URL}/invite/${token}`;
  const declineUrl = `${env.SITE_URL}/invite/${token}?action=decline`;

  return (
    <Html>
      <Head />
      <Preview>You've been invited to join {organizationName}</Preview>
      <Body style={emailBodyStyle}>
        <Container style={emailContainerStyle}>
          <Img
            src={`${env.SITE_URL}/images/convex-logo-email.jpg`}
            width="40"
            height="37"
            alt=""
          />
          <Text style={emailTextStyle}>Hello {email}!</Text>
          <Text style={emailTextStyle}>
            <strong>{inviterName}</strong> has invited you to join{" "}
            <strong>{organizationName}</strong> as a <strong>{role}</strong>.
          </Text>
          <Text style={emailTextStyle}>
            Click the button below to accept the invitation and get started.
          </Text>
          <Section style={emailButtonSectionStyle}>
            <Button href={acceptUrl} style={emailInvitationButtonStyle}>
              Accept Invitation
            </Button>
          </Section>
          <Text style={emailMutedTextStyle}>
            Or copy and paste this URL into your browser:
            <br />
            <Link href={acceptUrl} style={emailLinkStyle}>
              {acceptUrl}
            </Link>
          </Text>
          <Text style={emailMutedTextWithMarginStyle}>
            <strong>Important:</strong> This invitation will expire in 7 days.
          </Text>
          <Text style={emailMutedTextStyle}>
            If you don't want to join this organization, you can{" "}
            <Link href={declineUrl} style={emailLinkStyle}>
              decline this invitation
            </Link>
            .
          </Text>
          <Hr style={emailHrStyle} />
          <Text style={emailFooterTextStyle}>
            This invitation was sent to {email}. If you weren't expecting this
            invitation, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function sendInvitationEmail(args: InvitationEmailOptions) {
  const html = await render(<InvitationEmail {...args} />);
  await sendEmail({
    to: args.email,
    subject: `You've been invited to join ${args.organizationName}`,
    html,
  });
}

// ============================================
// Loan Notification Emails
// ============================================

type LoanNotificationEmailOptions = {
  email: string;
  loanId: string;
  itemName: string;
  borrowerName: string;
  startDate: string;
  endDate: string;
  loanUrl?: string;
};

function LoanApprovedEmail({
  email,
  itemName,
  borrowerName,
  startDate,
  endDate,
  loanUrl,
}: LoanNotificationEmailOptions) {
  const viewUrl = loanUrl || `${env.SITE_URL}/loans`;

  return (
    <Html>
      <Head />
      <Preview>Loan Request Approved</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
        }}
      >
        <Container style={{ margin: "0 auto", padding: "20px 0 48px" }}>
          <Img
            src={`${env.SITE_URL}/images/convex-logo-email.jpg`}
            width="40"
            height="37"
            alt=""
          />
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Hello {email}!
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Your loan request has been approved.
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            <strong>Item:</strong> {itemName}
            <br />
            <strong>Borrower:</strong> {borrowerName}
            <br />
            <strong>Loan Period:</strong> {startDate} to {endDate}
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            <Link href={viewUrl}>View loan details</Link>
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            The <Link href={`${env.SITE_URL}`}>MuseumLite</Link> team.
          </Text>
          <Hr style={{ borderColor: "#cccccc", margin: "20px 0" }} />
          <Text style={{ color: "#8898aa", fontSize: "12px" }}>MuseumLite</Text>
        </Container>
      </Body>
    </Html>
  );
}

function LoanRejectedEmail({
  email,
  itemName,
  borrowerName,
  startDate,
  endDate,
  loanUrl,
}: LoanNotificationEmailOptions) {
  const viewUrl = loanUrl || `${env.SITE_URL}/loans`;

  return (
    <Html>
      <Head />
      <Preview>Loan Request Rejected</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
        }}
      >
        <Container style={{ margin: "0 auto", padding: "20px 0 48px" }}>
          <Img
            src={`${env.SITE_URL}/images/convex-logo-email.jpg`}
            width="40"
            height="37"
            alt=""
          />
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Hello {email}.
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            We regret to inform you that your loan request has been rejected.
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            <strong>Item:</strong> {itemName}
            <br />
            <strong>Borrower:</strong> {borrowerName}
            <br />
            <strong>Requested Period:</strong> {startDate} to {endDate}
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            <Link href={viewUrl}>View loan details</Link>
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            The <Link href={`${env.SITE_URL}`}>MuseumLite</Link> team.
          </Text>
          <Hr style={{ borderColor: "#cccccc", margin: "20px 0" }} />
          <Text style={{ color: "#8898aa", fontSize: "12px" }}>MuseumLite</Text>
        </Container>
      </Body>
    </Html>
  );
}

function LoanPendingEmail({
  email,
  itemName,
  borrowerName,
  startDate,
  endDate,
  loanUrl,
}: LoanNotificationEmailOptions) {
  const viewUrl = loanUrl || `${env.SITE_URL}/loans`;

  return (
    <Html>
      <Head />
      <Preview>New Loan Request Pending</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
        }}
      >
        <Container style={{ margin: "0 auto", padding: "20px 0 48px" }}>
          <Img
            src={`${env.SITE_URL}/images/convex-logo-email.jpg`}
            width="40"
            height="37"
            alt=""
          />
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Hello {email}!
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            A new loan request has been submitted and is awaiting review.
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            <strong>Item:</strong> {itemName}
            <br />
            <strong>Borrower:</strong> {borrowerName}
            <br />
            <strong>Requested Period:</strong> {startDate} to {endDate}
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            <Link href={viewUrl}>Review loan request</Link>
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            The <Link href={`${env.SITE_URL}`}>MuseumLite</Link> team.
          </Text>
          <Hr style={{ borderColor: "#cccccc", margin: "20px 0" }} />
          <Text style={{ color: "#8898aa", fontSize: "12px" }}>MuseumLite</Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function sendLoanApprovedEmail(
  args: LoanNotificationEmailOptions,
) {
  const html = await render(<LoanApprovedEmail {...args} />);
  await sendEmail({
    to: args.email,
    subject: "Loan Request Approved",
    html,
  });
}

export async function sendLoanRejectedEmail(
  args: LoanNotificationEmailOptions,
) {
  const html = await render(<LoanRejectedEmail {...args} />);
  await sendEmail({
    to: args.email,
    subject: "Loan Request Rejected",
    html,
  });
}

export async function sendLoanPendingEmail(args: LoanNotificationEmailOptions) {
  const html = await render(<LoanPendingEmail {...args} />);
  await sendEmail({
    to: args.email,
    subject: "New Loan Request Pending Review",
    html,
  });
}

// ============================================
// Task Assignment Email
// ============================================

type TaskAssignedEmailOptions = {
  email: string;
  taskTitle: string;
  assignedBy: string;
  dueDate?: string;
  taskUrl?: string;
};

function TaskAssignedEmail({
  email,
  taskTitle,
  assignedBy,
  dueDate,
  taskUrl,
}: TaskAssignedEmailOptions) {
  const viewUrl = taskUrl || `${env.SITE_URL}/tasks`;

  return (
    <Html>
      <Head />
      <Preview>New Task Assigned</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
        }}
      >
        <Container style={{ margin: "0 auto", padding: "20px 0 48px" }}>
          <Img
            src={`${env.SITE_URL}/images/convex-logo-email.jpg`}
            width="40"
            height="37"
            alt=""
          />
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Hello {email}!
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            You have been assigned a new task.
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            <strong>Task:</strong> {taskTitle}
            <br />
            <strong>Assigned by:</strong> {assignedBy}
            {dueDate && (
              <>
                <br />
                <strong>Due date:</strong> {dueDate}
              </>
            )}
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            <Link href={viewUrl}>View task details</Link>
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            The <Link href={`${env.SITE_URL}`}>MuseumLite</Link> team.
          </Text>
          <Hr style={{ borderColor: "#cccccc", margin: "20px 0" }} />
          <Text style={{ color: "#8898aa", fontSize: "12px" }}>MuseumLite</Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function sendTaskAssignedEmail(args: TaskAssignedEmailOptions) {
  const html = await render(<TaskAssignedEmail {...args} />);
  await sendEmail({
    to: args.email,
    subject: "New Task Assigned",
    html,
  });
}

// ============================================
// Subscription Emails
// ============================================

type SubscriptionEmailOptions = {
  email: string;
  subscriptionId: string;
};

function SubscriptionSuccessEmail({ email }: SubscriptionEmailOptions) {
  return (
    <Html>
      <Head />
      <Preview>Successfully Subscribed to PRO</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
        }}
      >
        <Container style={{ margin: "0 auto", padding: "20px 0 48px" }}>
          <Img
            src={`${env.SITE_URL}/images/convex-logo-email.jpg`}
            width="40"
            height="37"
            alt=""
          />
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Hello {email}!
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Your subscription to PRO has been successfully processed.
            <br />
            We hope you enjoy the new features!
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            The <Link href={`${env.SITE_URL}`}>MuseumLite</Link> team.
          </Text>
          <Hr style={{ borderColor: "#cccccc", margin: "20px 0" }} />
          <Text style={{ color: "#8898aa", fontSize: "12px" }}>MuseumLite</Text>
        </Container>
      </Body>
    </Html>
  );
}

function SubscriptionErrorEmail({ email }: SubscriptionEmailOptions) {
  return (
    <Html>
      <Head />
      <Preview>Subscription Issue - Customer Support</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
        }}
      >
        <Container style={{ margin: "0 auto", padding: "20px 0 48px" }}>
          <Img
            src={`${env.SITE_URL}/images/convex-logo-email.jpg`}
            width="40"
            height="37"
            alt=""
          />
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Hello {email}.
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            We were unable to process your subscription to PRO tier.
            <br />
            But don't worry, we'll not charge you anything.
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            The <Link href={`${env.SITE_URL}`}>MuseumLite</Link> team.
          </Text>
          <Hr style={{ borderColor: "#cccccc", margin: "20px 0" }} />
          <Text style={{ color: "#8898aa", fontSize: "12px" }}>MuseumLite</Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function sendSubscriptionSuccessEmail(
  args: SubscriptionEmailOptions,
) {
  const html = await render(<SubscriptionSuccessEmail {...args} />);
  await sendEmail({
    to: args.email,
    subject: "Successfully Subscribed to PRO",
    html,
  });
}

export async function sendSubscriptionErrorEmail(
  args: SubscriptionEmailOptions,
) {
  const html = await render(<SubscriptionErrorEmail {...args} />);
  await sendEmail({
    to: args.email,
    subject: "Subscription Issue - Customer Support",
    html,
  });
}
