import type { CSSProperties } from "react";

export const emailBodyStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

export const emailContainerStyle: CSSProperties = {
  margin: "0 auto",
  padding: "20px 0 48px",
};

export const emailTextStyle: CSSProperties = {
  fontSize: "16px",
  lineHeight: "26px",
};

export const emailMutedTextStyle: CSSProperties = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#666666",
};

export const emailMutedTextWithMarginStyle: CSSProperties = {
  ...emailMutedTextStyle,
  marginTop: "20px",
};

export const emailButtonSectionStyle: CSSProperties = {
  textAlign: "center",
  margin: "32px 0",
};

export const emailInvitationButtonStyle: CSSProperties = {
  backgroundColor: "#0a0a0f",
  borderRadius: "5px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center",
  display: "inline-block",
  padding: "12px 24px",
};

export const emailLinkStyle: CSSProperties = {
  color: "#067df7",
};

export const emailHrStyle: CSSProperties = {
  borderColor: "#cccccc",
  margin: "20px 0",
};

export const emailFooterTextStyle: CSSProperties = {
  color: "#8898aa",
  fontSize: "12px",
};
