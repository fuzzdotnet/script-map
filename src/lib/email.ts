"use server";

import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(key);
}

export async function sendInviteEmail(params: {
  to: string;
  projectTitle: string;
  role: string;
  shareUrl: string;
  inviterEmail: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: "Script Liner <noreply@scriptliner.com>",
    to: params.to,
    subject: `You've been invited to "${params.projectTitle}"`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="margin: 0 0 16px;">You've been invited</h2>
        <p style="color: #666; line-height: 1.6;">
          <strong>${params.inviterEmail}</strong> invited you as a <strong>${params.role}</strong> on
          <strong>${params.projectTitle}</strong>.
        </p>
        <a href="${params.shareUrl}" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #fff; color: #000; text-decoration: none; border-radius: 9999px; font-weight: 600; font-size: 14px;">
          Open Project
        </a>
        <p style="margin-top: 32px; font-size: 12px; color: #999;">
          Script Liner — Media annotations for documentary scripts
        </p>
      </div>
    `,
  });
}
