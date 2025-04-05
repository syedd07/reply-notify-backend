import {
	Client,
	Databases
} from "node-appwrite";
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

export default async ({
	req,
	res,
	log
}) => {
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

		function getTimeAgo(timestamp) {
			const now = new Date();
			const commentTime = new Date(timestamp);
			const diffMs = now - commentTime;

			const seconds = Math.floor(diffMs / 1000);
			const minutes = Math.floor(diffMs / (1000 * 60));
			const hours = Math.floor(diffMs / (1000 * 60 * 60));
			const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

			if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
			if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
			if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
			return `${seconds} second${seconds > 1 ? "s" : ""} ago`;
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

		log("Sending from email:", FROM_EMAIL);

		// Compose and send the email
		try {
			const timeAgo = getTimeAgo(payload.timestamp);
			const articleLink = `https://beyondsciencemagazine.studio/articles/${articleId}`;
			await transporter.sendMail({
				from: `${FROM_NAME} <${FROM_EMAIL}>`,
				to: recipientEmail,
				subject: "Someone replied to your comment!",

				html: `
        <body style="background:#f9f9f9;padding:20px;">
        <div style="background:#fff;padding:20px;border-radius:8px;">
           <div style="max-width:600px;margin:0 auto;padding:20px;font-family:sans-serif;background:#ffffff;color:#333;border:1px solid #ddd;border-radius:8px;">
    <p style="font-size:16px;">Hi <strong>${parent.name}</strong>,</p>

    <p style="font-size:16px;">
      <strong>${commenterName}</strong> has replied to your comment made on <strong>BEYOND SC!ENCE MAGAZINE</strong> ${timeAgo}.
    </p>

    <blockquote style="margin:20px 0;padding:15px;background:#f9f9f9;border-left:4px solid #ccc;font-style:italic;">
      "${payload.text}"
    </blockquote>

    <p style="font-size:16px;">
      Visit the article to see the full conversation 
      <a href="${articleLink}" style="text-decoration:underline;font-weight:bold;color:#000;">here</a>.
    </p>

    <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">

    <p style="font-size:14px;">
      — <strong>BEYOND SC!ENCE MAGAZINE</strong>
    </p>
    <p style="font-size:12px;color:#888;margin-top:20px;">
      You are receiving this notification because someone replied to your comment on BEYOND SC!ENCE MAGAZINE.
    </p>
    </div>
    <p style="font-size: 12px;">
    <a href="https://beyondsciencemagazine.studio/report-abuse" style="color: #999; text-decoration: underline;">Report abuse</a>
    </p>
    </div>
    </body>

        `,
			});

			log("Email sent successfully to:", recipientEmail);
			return res.send("Email sent to parent commenter");
		} catch (emailError) {
			log("Failed to send email:", emailError.message);
			return res.send("Failed to send email: " + emailError.message);
		}
	} catch (error) {
		log("Error:", error.message);
		return res.send("An error occurred: " + error.message);
	} finally {
		log("Event processing completed.");
	}
};