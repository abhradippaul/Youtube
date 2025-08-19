import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMail(sendTo: string, subject: string, html: string) {
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: [sendTo],
    subject: subject,
    html: html,
  });

  return error;
}
