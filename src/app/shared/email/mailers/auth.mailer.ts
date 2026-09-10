import { sendEmail } from "../email.service.js";
import { VerificationEmail } from "../templates/VerificationEmail.js";

// Input parameters for account verification OTP email
export interface SendVerificationOtpParams {
  email: string;
  name: string;
  otp: string;
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
};

export { AuthMailer };
