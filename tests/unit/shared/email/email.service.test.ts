import { createElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSendMail, mockCreateTransport, getCapturedTransportConfig } =
  vi.hoisted(() => {
    let capturedConfig: unknown;
    const sendMail = vi.fn();
    const createTransport = vi.fn((config: unknown) => {
      capturedConfig = config;
      return { sendMail };
    });

    return {
      mockSendMail: sendMail,
      mockCreateTransport: createTransport,
      getCapturedTransportConfig: () => capturedConfig,
    };
  });

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

const { mockRender } = vi.hoisted(() => ({
  mockRender: vi.fn(),
}));

vi.mock("react-email", () => ({
  render: mockRender,
}));

import { env } from "../../../../src/app/config/env.js";
import { logger } from "../../../../src/app/config/logger.js";
import {
  sendEmail,
  type SendEmailOptions,
} from "../../../../src/app/shared/email/email.service.js";

describe("EmailService Unit Tests", () => {
  const dummyTemplate: ReactElement = createElement("div", null, "Template Content");

  beforeEach(() => {
    mockRender.mockReset();
    mockSendMail.mockReset();
    mockRender.mockResolvedValue("<p>Rendered HTML</p>");
    mockSendMail.mockResolvedValue({ messageId: "msg-123" });
  });

  describe("Transporter Initialization", () => {
    it("should initialize Nodemailer transporter with connection pooling and SMTP config", () => {
      expect(getCapturedTransportConfig()).toEqual({
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    });
  });

  describe("HTML & Plain-Text Rendering and Dispatch", () => {
    it("should render template to HTML and dispatch email using provided plain-text", async () => {
      const emailOptions: SendEmailOptions = {
        to: "recipient@example.com",
        subject: "Welcome to Liminal",
        template: dummyTemplate,
        text: "Custom plain text fallback",
      };

      await sendEmail(emailOptions);

      expect(mockRender).toHaveBeenCalledTimes(1);
      expect(mockRender).toHaveBeenCalledWith(dummyTemplate);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: `Liminal Studio <${env.SMTP_FROM}>`,
        to: "recipient@example.com",
        replyTo: env.SMTP_FROM,
        subject: "Welcome to Liminal",
        html: "<p>Rendered HTML</p>",
        text: "Custom plain text fallback",
      });
    });

    it("should automatically generate plain-text via React Email when text option is omitted", async () => {
      mockRender
        .mockResolvedValueOnce("<h1>Hello</h1>")
        .mockResolvedValueOnce("Hello plain text");

      const emailOptions: SendEmailOptions = {
        to: "client@example.com",
        subject: "Verification Notice",
        template: dummyTemplate,
      };

      await sendEmail(emailOptions);

      expect(mockRender).toHaveBeenCalledTimes(2);
      expect(mockRender).toHaveBeenNthCalledWith(1, dummyTemplate);
      expect(mockRender).toHaveBeenNthCalledWith(2, dummyTemplate, { plainText: true });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "client@example.com",
          html: "<h1>Hello</h1>",
          text: "Hello plain text",
        }),
      );
    });
  });

  describe("Attachments Handling", () => {
    it("should include attachments when a non-empty attachments array is provided", async () => {
      const attachments = [
        {
          filename: "brochure.pdf",
          content: Buffer.from("dummy-pdf-content"),
          contentType: "application/pdf",
        },
      ];

      await sendEmail({
        to: "client@example.com",
        subject: "Your Design Catalog",
        template: dummyTemplate,
        text: "Please find attached catalog.",
        attachments,
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments,
        }),
      );
    });

    it("should not include attachments property when attachments array is empty", async () => {
      await sendEmail({
        to: "client@example.com",
        subject: "Empty Attachments Test",
        template: dummyTemplate,
        attachments: [],
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.not.objectContaining({ attachments: expect.anything() }),
      );
    });
  });

  describe("Resilient Error Handling", () => {
    it("should catch errors thrown by transporter.sendMail and log them via logger without throwing", async () => {
      const loggerSpy = vi.spyOn(logger, "error");
      const networkError = new Error("SMTP connection timed out");
      mockSendMail.mockRejectedValueOnce(networkError);

      await expect(
        sendEmail({
          to: "unreachable@example.com",
          subject: "Urgent Notification",
          template: dummyTemplate,
        }),
      ).resolves.toBeUndefined();

      expect(loggerSpy).toHaveBeenCalledWith(
        { err: networkError, subject: "Urgent Notification" },
        "Failed to dispatch email",
      );
    });

    it("should catch errors thrown during template rendering and log them via logger without throwing", async () => {
      const loggerSpy = vi.spyOn(logger, "error");
      const renderError = new Error("React element rendering failed");
      mockRender.mockRejectedValueOnce(renderError);

      await expect(
        sendEmail({
          to: "error@example.com",
          subject: "Render Failure Subject",
          template: dummyTemplate,
        }),
      ).resolves.toBeUndefined();

      expect(loggerSpy).toHaveBeenCalledWith(
        { err: renderError, subject: "Render Failure Subject" },
        "Failed to dispatch email",
      );
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });
});
