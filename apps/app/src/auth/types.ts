export type AuthMode = "signIn" | "signUp";

export type AuthStep = "email" | "password" | "uniqueCode";

export interface AuthErrorInfo {
  message: string;
}

export type UniqueCodeFlow = "otp" | "reset";
