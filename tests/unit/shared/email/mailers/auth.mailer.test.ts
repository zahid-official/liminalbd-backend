import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSendEmail, mockVerificationEmail, mockResetPasswordEmail } =
  vi.hoisted(() => ({
    mockSendEmail: vi.fn(),
    mockVerificationEmail: vi.fn((props: unknown) => ({
      type: "mock-verification-email",
      props,
    })),
    mockResetPasswordEmail: vi.fn((props: unknown) => ({
      type: "mock-reset-password-email",
      props,
    })),
  }));

vi.mock("../../../../../src/app/shared/email/email.service.js", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock(
  "../../../../../src/app/shared/email/templates/VerificationEmail.js",
  () => ({
    VerificationEmail: mockVerificationEmail,
  }),
);

vi.mock(
  "../../../../../src/app/shared/email/templates/ResetPasswordEmail.js",
  () => ({
    ResetPasswordEmail: mockResetPasswordEmail,
  }),
);

import {
  AuthMailer,
  type SendPasswordResetLinkParams,
  type SendVerificationOtpParams,
} from "../../../../../src/app/shared/email/mailers/auth.mailer.js";

describe("AuthMailer Unit Tests", () => {
  beforeEach(() => {
    mockSendEmail.mockReset();
    mockVerificationEmail.mockClear();
    mockResetPasswordEmail.mockClear();
    mockSendEmail.mockResolvedValue(undefined);
  });

  describe("sendVerificationOtp", () => {
    it("should render VerificationEmail template and dispatch OTP email with correct subject and plain-text", async () => {
      const params: SendVerificationOtpParams = {
        email: "customer@example.com",
        name: "Zahid Hasan",
        otp: "123456",
      };

      await AuthMailer.sendVerificationOtp(params);

      expect(mockVerificationEmail).toHaveBeenCalledTimes(1);
      expect(mockVerificationEmail).toHaveBeenCalledWith({
        name: "Zahid Hasan",
        otp: "123456",
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: "customer@example.com",
        subject: "Your verification code | Liminal Interior Design",
        template: {
          type: "mock-verification-email",
          props: { name: "Zahid Hasan", otp: "123456" },
        },
        text: `Hello Zahid Hasan,\n\nYour Liminal Studio verification code is: 123456\n\nThis code is valid for 5 minutes. Do not share this code with anyone.`,
      });
    });

    it("should propagate errors when sendEmail fails during OTP dispatch", async () => {
      const dispatchError = new Error("Mail dispatch error");
      mockSendEmail.mockRejectedValueOnce(dispatchError);

      await expect(
        AuthMailer.sendVerificationOtp({
          email: "customer@example.com",
          name: "Zahid Hasan",
          otp: "123456",
        }),
      ).rejects.toThrow(dispatchError);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe("sendPasswordResetLink", () => {
    it("should render ResetPasswordEmail template and dispatch reset email with correct subject and plain-text", async () => {
      const params: SendPasswordResetLinkParams = {
        email: "client@example.com",
        name: "Amina Rahman",
        resetUrl: "https://liminalbd.com/reset-password?token=secure-token-xyz",
      };

      await AuthMailer.sendPasswordResetLink(params);

      expect(mockResetPasswordEmail).toHaveBeenCalledTimes(1);
      expect(mockResetPasswordEmail).toHaveBeenCalledWith({
        name: "Amina Rahman",
        resetUrl: "https://liminalbd.com/reset-password?token=secure-token-xyz",
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: "client@example.com",
        subject: "Reset your password | Liminal Interior Design",
        template: {
          type: "mock-reset-password-email",
          props: {
            name: "Amina Rahman",
            resetUrl:
              "https://liminalbd.com/reset-password?token=secure-token-xyz",
          },
        },
        text: `Hello Amina Rahman,\n\nWe received a request to reset your password for your Liminal Studio account.\n\nPlease use the following link to set a new password:\nhttps://liminalbd.com/reset-password?token=secure-token-xyz\n\nThis link is valid for 15 minutes and can only be used once.\n\nIf you did not request a password reset, please ignore this email.`,
      });
    });

    it("should propagate errors when sendEmail fails during password reset dispatch", async () => {
      const dispatchError = new Error("Network timeout during reset dispatch");
      mockSendEmail.mockRejectedValueOnce(dispatchError);

      await expect(
        AuthMailer.sendPasswordResetLink({
          email: "client@example.com",
          name: "Amina Rahman",
          resetUrl: "https://liminalbd.com/reset-password?token=secure-token-xyz",
        }),
      ).rejects.toThrow(dispatchError);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });
  });
});
