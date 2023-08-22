import * as Ably from "ably/promises";

export async function handler(event, context) {
  if (!process.env.ABLY_API_KEY) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify("Missing API Key"),
    };
  }

  const clientId = event.queryStringParameters["clientId"] || "NO_CLIENT_ID";
  const client = new Ably.Rest(process.env.ABLY_API_KEY);
  const tokenRequestData = await client.auth.createTokenRequest({
    clientId: clientId,
  });

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(tokenRequestData),
  };
}
