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

type TaskAssignedEmailOptions = {
  email: string;
  taskTitle: string;
  assignedBy: string;
  dueDate?: string;
  taskUrl?: string;
};

/**
 * Templates.
 */
export function TaskAssignedEmail({
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
export function renderTaskAssignedEmail(args: TaskAssignedEmailOptions) {
  return render(<TaskAssignedEmail {...args} />);
}

/**
 * Senders.
 */
export async function sendTaskAssignedEmail(args: TaskAssignedEmailOptions) {
  const html = await renderTaskAssignedEmail(args);

  await sendEmail({
    to: args.email,
    subject: "New Task Assigned",
    html,
  });
}
