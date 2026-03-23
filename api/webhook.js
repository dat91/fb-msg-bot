const https = require("https");

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return handleVerification(req, res);
  }
  if (req.method === "POST") {
    return handleMessage(req, res);
  }
  res.status(405).end("Method Not Allowed");
};

// Facebook webhook verification
function handleVerification(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    res.status(200).send(challenge);
  } else {
    res.status(403).end("Forbidden");
  }
}

// Incoming message handler
async function handleMessage(req, res) {
  const body = req.body;

  if (body.object !== "page") {
    res.status(404).end("Not Found");
    return;
  }

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      if (event.message?.text) {
        await sendMessage(event.sender.id, event.message.text);
      }
    }
  }

  // Respond quickly — Facebook expects 200 within 20s
  res.status(200).send("EVENT_RECEIVED");
}

// Send a text reply via the Messenger Send API
function sendMessage(recipientId, text) {
  const payload = JSON.stringify({
    recipient: { id: recipientId },
    message: { text },
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "graph.facebook.com",
      path: `/v19.0/me/messages?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN)}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const request = https.request(options, (response) => {
      let data = "";
      response.on("data", (chunk) => (data += chunk));
      response.on("end", () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          console.error("Send API error:", data);
          reject(new Error(`Send API returned ${response.statusCode}`));
        }
      });
    });

    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}
