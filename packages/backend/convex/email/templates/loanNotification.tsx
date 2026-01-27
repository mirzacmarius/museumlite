import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from "@react-email/components";
/* eslint-disable react-refresh/only-export-components */
import { render } from "@react-email/render";
import { env } from "../../env";
import { sendEmail } from "../index";

type LoanNotificationEmailOptions = {
  email: string;
  loanId: string;
  itemName: string;
  borrowerName: string;
  startDate: string;
  endDate: string;
  loanUrl?: string;
};

/**
 * Templates.
 */
export function LoanApprovedEmail({
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
            The <Link href={`${env.SITE_URL}`}>domain-name.com</Link> team.
          </Text>
          <Hr style={{ borderColor: "#cccccc", margin: "20px 0" }} />
          <Text style={{ color: "#8898aa", fontSize: "12px" }}>
            200 domain-name.com
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function LoanRejectedEmail({
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
            The <Link href={`${env.SITE_URL}`}>domain-name.com</Link> team.
          </Text>
          <Hr style={{ borderColor: "#cccccc", margin: "20px 0" }} />
          <Text style={{ color: "#8898aa", fontSize: "12px" }}>
            200 domain-name.com
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function LoanPendingEmail({
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
            The <Link href={`${env.SITE_URL}`}>domain-name.com</Link> team.
          </Text>
          <Hr style={{ borderColor: "#cccccc", margin: "20px 0" }} />
          <Text style={{ color: "#8898aa", fontSize: "12px" }}>
            200 domain-name.com
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * Renders.
 */
export function renderLoanApprovedEmail(args: LoanNotificationEmailOptions) {
  return render(<LoanApprovedEmail {...args} />);
}

export function renderLoanRejectedEmail(args: LoanNotificationEmailOptions) {
  return render(<LoanRejectedEmail {...args} />);
}

export function renderLoanPendingEmail(args: LoanNotificationEmailOptions) {
  return render(<LoanPendingEmail {...args} />);
}

/**
 * Senders.
 */
export async function sendLoanApprovedEmail(
  args: LoanNotificationEmailOptions,
) {
  const html = await renderLoanApprovedEmail(args);

  await sendEmail({
    to: args.email,
    subject: "Loan Request Approved",
    html,
  });
}

export async function sendLoanRejectedEmail(
  args: LoanNotificationEmailOptions,
) {
  const html = await renderLoanRejectedEmail(args);

  await sendEmail({
    to: args.email,
    subject: "Loan Request Rejected",
    html,
  });
}

export async function sendLoanPendingEmail(
  args: LoanNotificationEmailOptions,
) {
  const html = await renderLoanPendingEmail(args);

  await sendEmail({
    to: args.email,
    subject: "New Loan Request Pending Review",
    html,
  });
}
