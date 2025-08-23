import { sesClient } from "./aws";

export async function sendPasswordResetMail(
  sendMail: string,
  mailCode: string
) {
  const params = {
    Destination: {
      ToAddresses: [sendMail],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: "HTML_FORMAT_BODY",
        },
        Text: {
          Charset: "UTF-8",
          Data: "TEXT_FORMAT_BODY",
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: "Test email",
      },
    },
    Source: "abhradipserampore@gmail.com",
  };

  return sesClient.sendEmail(params).promise();
}
