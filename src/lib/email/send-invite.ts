import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendInviteEmailParams {
  to: string;
  inviterName: string;
  shopName: string;
  shopDescription: string | null;
  role: string;
  inviteUrl: string;
}

export async function sendInviteEmail({
  to,
  inviterName,
  shopName,
  shopDescription,
  role,
  inviteUrl,
}: SendInviteEmailParams) {
  const from =
    process.env.RESEND_FROM_EMAIL || "VillageShare <onboarding@resend.dev>";

  const roleBadge = role.charAt(0).toUpperCase() + role.slice(1);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:#18181b;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">VillageShare</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#3f3f46;font-size:16px;line-height:1.5;">
                <strong>${inviterName}</strong> has invited you to join <strong>${shopName}</strong> as a <span style="display:inline-block;background-color:#e4e4e7;color:#18181b;padding:2px 8px;border-radius:4px;font-size:14px;font-weight:500;">${roleBadge}</span>.
              </p>
              ${
                shopDescription
                  ? `<p style="margin:0 0 24px;color:#71717a;font-size:14px;line-height:1.5;">${shopDescription}</p>`
                  : ""
              }
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${inviteUrl}" style="display:inline-block;background-color:#18181b;color:#ffffff;padding:12px 32px;border-radius:8px;font-size:16px;font-weight:600;text-decoration:none;">
                      Accept Invite
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#a1a1aa;font-size:13px;line-height:1.5;">
                This invite expires in 7 days. If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = `${inviterName} has invited you to join ${shopName} as a ${roleBadge}.${shopDescription ? `\n\n${shopDescription}` : ""}\n\nAccept the invite: ${inviteUrl}\n\nThis invite expires in 7 days.`;

  const { error } = await resend.emails.send({
    from,
    to,
    subject: `You're invited to join ${shopName} on VillageShare`,
    html,
    text,
  });

  if (error) {
    throw new Error(`Failed to send invite email: ${error.message}`);
  }
}
