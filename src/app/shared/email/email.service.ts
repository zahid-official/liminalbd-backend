/* eslint-disable no-console */
import type { ReactElement } from "react";
import nodemailer from "nodemailer";
import { render } from "react-email";
import { env } from "../../config/env.js";

// Initialize Nodemailer SMTP Transporter
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || "smtp.gmail.com",
  port: env.SMTP_PORT || 465,
  secure: (env.SMTP_PORT || 465) === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

// Attachment contract for invoices or documents
export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

// Universal dispatch options accepting any React Email template
export interface SendEmailOptions {
  to: string;
  subject: string;
  template: ReactElement;
  text?: string;
  attachments?: EmailAttachment[];
}

// Universal email dispatcher with React Email rendering
const sendEmail = async ({
  to,
  subject,
  template,
  text,
  attachments,
}: SendEmailOptions): Promise<void> => {
  try {
    const emailHtml = await render(template);
    const plainText = text || (await render(template, { plainText: true }));
    const senderEmail = env.SMTP_FROM || env.SMTP_USER || "noreply@liminalstudio.com";

    const mailOptions = {
      from: `Liminal Studio <${senderEmail}>`,
      to,
      replyTo: senderEmail,
      subject,
      html: emailHtml,
      text: plainText,
      headers: {
        "X-Priority": "1", // High priority transactional OTP
        "X-MSMail-Priority": "High",
        Importance: "High",
      },
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    // Gracefully log SMTP transport errors without breaking the client request flow
    console.error(`Failed to dispatch email [${subject}]:`, error);
  }
};

export { sendEmail };
