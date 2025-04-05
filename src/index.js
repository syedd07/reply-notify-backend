import { Client, Databases } from "node-appwrite";
import nodemailer from "nodemailer";

// Environment Variables
const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  DATABASE_ID,
  COLLECTION_ID,
  SMTP_USER,
  SMTP_PASS,
  SMTP_HOST,
  SMTP_PORT,
  FROM_EMAIL,
  FROM_NAME,
} = process.env;

export default async ({ req, res, log }) => {
  try {
    log("Received event");
    log("Raw body:", req.body);

    if (!req.body) {
      return res.send("No body received.");
    }

    let payload;
    try {
      payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch (err) {
      log("Failed to parse body:", req.body);
      return res.send("Invalid JSON body: " + err.message);
    }

    // If no parentId, it's not a reply → no email needed
    if (!payload.parentId) {
      return res.send("Not a reply. No email needed.");
    }

    const client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID)
      .setKey(APPWRITE_API_KEY);

    const databases = new Databases(client);

    // Fetch parent comment
    let parent;
    try {
      parent = await databases.getDocument(
        DATABASE_ID,
        COLLECTION_ID,
        payload.parentId
      );
    } catch (err) {
      log("Failed to fetch parent comment:", err.message);
      return res.send("Parent comment not found or error occurred.");
    }
    const recipientEmail = parent.email;
    const commenterName = payload.name;
    const articleId = payload.articleId;

    // Setup transporter
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT),
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    // Compose and send the email
    await transporter.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: recipientEmail,
      subject: "Someone replied to your comment!",
      html: `
        <p>Hi ${parent.name},</p>
        <p><strong>${commenterName}</strong> has replied to your comment on the article: <strong>${articleId}</strong>.</p>
        <p><em>"${payload.text}"</em></p>
        <p>Visit the article to see the full conversation.</p>
        <p>— Beyond Science Magazine</p>
      `,
    });

    return res.send("Email sent to parent commenter");
  } catch (error) {
    log(error);
    return res.send("Error sending email: " + error.message);
  }
};
