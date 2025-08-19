import { S3Client } from "@aws-sdk/client-s3";
// import AWS from "aws-sdk";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!, // Specify the AWS region from environment variables
  credentials: {
    accessKeyId: process.env.AWS_ACCESSKEYID!, // Access key ID from environment variables
    secretAccessKey: process.env.AWS_SECRETACCESSKEY!, // Secret access key from environment variables
  },
});

// AWS.config.update({
//   accessKeyId: process.env.AWS_ACCESSKEYID!,
//   secretAccessKey: process.env.AWS_SECRETACCESSKEY!,
//   region: process.env.AWS_REGION!,
// });

// const ses = new AWS.SES({ apiVersion: "2010-12-01" });
// const params = {
//   Destination: {
//     ToAddresses: ["abhradipserampore@gmail.com"], // Email address/addresses that you want to send your email
//   },
//   // ConfigurationSetName: <<ConfigurationSetName>>,
//   Message: {
//     Body: {
//       Html: {
//         // HTML Format of the email
//         Charset: "UTF-8",
//         Data: "<html><body><h1>Hello  Charith</h1><p style='color:red'>Sample description</p> <p>Time 1517831318946</p></body></html>",
//       },
//       Text: {
//         Charset: "UTF-8",
//         Data: "Hello Charith Sample description time 1517831318946",
//       },
//     },
//     Subject: {
//       Charset: "UTF-8",
//       Data: "Test email",
//     },
//   },
//   Source: "abhradipserampore@gmail.com",
// };

// const sendEmail = ses.sendEmail(params).promise();

// sendEmail
//   .then((data) => {
//     console.log("email submitted to SES", data);
//   })
//   .catch((error) => {
//     console.log(error);
//   });

export { s3Client };
