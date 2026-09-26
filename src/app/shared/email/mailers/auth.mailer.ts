import { sendEmail } from "../email.service.js";
import { ResetPasswordEmail } from "../templates/ResetPasswordEmail.js";
import { VerificationEmail } from "../templates/VerificationEmail.js";

// Input parameters for account verification OTP email
export interface SendVerificationOtpParams {
  email: string;
  name: string;
  otp: string;
}

// Input parameters for password reset link email
export interface SendPasswordResetLinkParams {
  email: string;
  name: string;
  resetUrl: string;
}

// Mailer responsible for authentication and security-related email dispatches
const AuthMailer = {
  // Render and dispatch 6-digit OTP verification email to customer
  async sendVerificationOtp({
    email,
    name,
    otp,
  }: SendVerificationOtpParams): Promise<void> {
    await sendEmail({
      to: email,
      subject: "Your verification code | Liminal Interior Design",
      template: VerificationEmail({ name, otp }),
      text: `Hello ${name},\n\nYour Liminal Studio verification code is: ${otp}\n\nThis code is valid for 5 minutes. Do not share this code with anyone.`,
    });
  },

  // Render and dispatch secure password reset email with action link
  async sendPasswordResetLink({
    email,
    name,
    resetUrl,
  }: SendPasswordResetLinkParams): Promise<void> {
    await sendEmail({
      to: email,
      subject: "Reset your password | Liminal Interior Design",
      template: ResetPasswordEmail({ name, resetUrl }),
      text: `Hello ${name},\n\nWe received a request to reset your password for your Liminal Studio account.\n\nPlease use the following link to set a new password:\n${resetUrl}\n\nThis link is valid for 15 minutes and can only be used once.\n\nIf you did not request a password reset, please ignore this email.`,
    });
  },
};

export { AuthMailer };
