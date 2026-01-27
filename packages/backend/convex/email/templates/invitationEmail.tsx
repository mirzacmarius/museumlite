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
/* eslint-disable react-refresh/only-export-components */
import { render } from "@react-email/render";
import { env } from "../../env";
import { sendEmail } from "../index";

type InvitationEmailOptions = {
  email: string;
  organizationName: string;
  inviterName: string;
  role: string;
  token: string;
};

/**
 * Template.
 */
export function InvitationEmail({
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
            <strong>{inviterName}</strong> has invited you to join{" "}
            <strong>{organizationName}</strong> as a <strong>{role}</strong>.
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Click the button below to accept the invitation and get started.
          </Text>
          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Button
              href={acceptUrl}
              style={{
                backgroundColor: "#000000",
                borderRadius: "5px",
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: "bold",
                textDecoration: "none",
                textAlign: "center",
                display: "inline-block",
                padding: "12px 24px",
              }}
            >
              Accept Invitation
            </Button>
          </Section>
          <Text style={{ fontSize: "14px", lineHeight: "24px", color: "#666666" }}>
            Or copy and paste this URL into your browser:
            <br />
            <Link href={acceptUrl} style={{ color: "#067df7" }}>
              {acceptUrl}
            </Link>
          </Text>
          <Text
            style={{
              fontSize: "14px",
              lineHeight: "24px",
              color: "#666666",
              marginTop: "20px",
            }}
          >
            <strong>Important:</strong> This invitation will expire in 7 days.
          </Text>
          <Text style={{ fontSize: "14px", lineHeight: "24px", color: "#666666" }}>
            If you don't want to join this organization, you can{" "}
            <Link href={declineUrl} style={{ color: "#067df7" }}>
              decline this invitation
            </Link>
            .
          </Text>
          <Hr style={{ borderColor: "#cccccc", margin: "20px 0" }} />
          <Text style={{ color: "#8898aa", fontSize: "12px" }}>
            This invitation was sent to {email}. If you weren't expecting this
            invitation, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * Render.
 */
export function renderInvitationEmail(args: InvitationEmailOptions) {
  return render(<InvitationEmail {...args} />);
}

/**
 * Sender.
 */
export async function sendInvitationEmail({
  email,
  organizationName,
  inviterName,
  role,
  token,
}: InvitationEmailOptions) {
  const html = await renderInvitationEmail({
    email,
    organizationName,
    inviterName,
    role,
    token,
  });

  await sendEmail({
    to: email,
    subject: `You've been invited to join ${organizationName}`,
    html,
  });
}
