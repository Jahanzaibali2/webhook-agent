import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer } from "ws";

// ============================================
// VERBAL-ONLY MODE - IVR/DTMF COMMENTED OUT
// ============================================

// Demo values for verbal verification (in production, these would come from a database)
const VALID_TPIN = "1122";
const VALID_CARD_LAST4 = "1155";
const VALID_CARD_EXPIRY = "0626"; // June 2026 in MMYY format
const VALID_CNIC_LAST4 = "8387";

// UBL API Configuration
const UBL_API_URL = "https://soatest.ubl.com.pk:7857/debitcardmanagementservice/v1/activation";

// Helper to generate unique reference ID
function generateReferenceId(): string {
  return `REF${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to generate STAN (6 digits)
function generateStan(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper to get current date/time in required formats
function getTransactionDateTime() {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(' ')[0]; // HH:MM:SS
  const transmission = `${date}T${time.substring(0, 8)}`; // YYYY-MM-DDTHH:MM:SS
  return { date, time, transmission };
}

// Function to call UBL Debit Card Activation API
async function callUBLActivationAPI(params: {
  cardLast4: string;
  expiry: string; // MMYY format
  cnic?: string;
}): Promise<{ success: boolean; message: string; responseCode?: string; details?: any }> {
  const { date, time, transmission } = getTransactionDateTime();
  
  // Build masked PAN (assuming 16-digit card with last 4 known)
  const maskedPan = `540375******${params.cardLast4}`;
  
  // Convert expiry from MMYY to YYMM format for API
  const expiryYYMM = params.expiry.substring(2, 4) + params.expiry.substring(0, 2);
  
  const requestBody = {
    serviceHeader: {
      channel: "IVR",
      processingType: "SYNCHRONOUS",
      authInfo: {
        username: "voicebot",
        password: "dm9pY2Vib3QxMjM=", // base64 encoded
        authenticationType: "password",
        authKey: "dm9pY2Vib3RrZXk=" // base64 encoded
      },
      fromRegionInfo: {
        bicCode: "UNILPKKA",
        countryCode: "PAKISTAN"
      }
    },
    transactionInfo: {
      transactionType: "DEBIT_CARD",
      transactionSubType: "ACTIVATION",
      referenceId: generateReferenceId(),
      transactionDate: date,
      transactionTime: time,
      transmissionDateTime: transmission,
      stan: generateStan()
    },
    activationRequest: {
      pan: maskedPan,
      expiry: expiryYYMM,
      isMaskCard: "Y",
      ...(params.cnic && { cnic: params.cnic })
    }
  };

  console.log("[UBL API] Calling activation API:", JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(UBL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const responseData = await response.json();
    console.log("[UBL API] Response:", JSON.stringify(responseData, null, 2));

    if (responseData.responseHeader?.responseCode === "00") {
      return {
        success: true,
        message: "Card activated successfully",
        responseCode: responseData.responseHeader.responseCode,
        details: responseData
      };
    } else {
      return {
        success: false,
        message: responseData.responseHeader?.responseDetails?.[0] || "Activation failed",
        responseCode: responseData.responseHeader?.responseCode,
        details: responseData
      };
    }
  } catch (error) {
    console.error("[UBL API] Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "API call failed",
      details: { error: String(error) }
    };
  }
}

// Tool definitions for OpenAI Realtime - VERBAL ONLY (no keypad/DTMF)
const TOOLS = [
  {
    type: "function",
    name: "activate_debit_card",
    description: "Activate the customer's debit card by calling the UBL activation API. Call this AFTER the customer has verbally provided and you have verified: (1) their card's last 4 digits, and (2) the expiry date. This will activate the card in the UBL system.",
    parameters: {
      type: "object",
      properties: {
        card_last4: {
          type: "string",
          description: "The last 4 digits of the customer's card (e.g., '1155')"
        },
        expiry_mmyy: {
          type: "string",
          description: "The card expiry date in MMYY format (e.g., '0626' for June 2026)"
        },
        cnic: {
          type: "string",
          description: "Optional: Customer's CNIC number (13 digits) for additional verification"
        }
      },
      required: ["card_last4", "expiry_mmyy"]
    }
  }
];

/* ============================================
   COMMENTED OUT: IVR/DTMF TOOLS AND HELPERS
   ============================================
   
// Store DTMF presses with timestamps (in-memory)
interface DtmfPress {
  digit: string;
  callSid: string;
  timestamp: number;
}
const dtmfHistory: DtmfPress[] = [];
const MAX_DTMF_HISTORY = 100;

// Track when we last collected digits for each call
const lastCollectionTime: Map<string, number> = new Map();

// IVR Tools that were available:
// - verify_tpin: Verify T PIN from keypad
// - verify_otp: Verify OTP from keypad  
// - get_dtmf_digits: Collect digits from keypad
// - verify_pin_match: Compare two PINs

============================================ */

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/session", async (_req, res) => {
    const url = "https://api.openai.com/v1/realtime/sessions";
    const headers = {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "realtime=v1"
    };

    // EXACTLY match Playground agent config
    const baseBody = {
      model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime",
      modalities: ["audio", "text"],
      turn_detection: { type: "server_vad" }
      // DO NOT set 'voice' or add 'instructions' here.
      // The Playground prompt controls voice & policy.
    };

    const withPrompt = {
      ...baseBody,
      prompt: {
        id: "pmpt_68da7434aefc8195aec2c1e07cfc24a7053b8ea30d848663",
        version: "18"
      }
    };

    // If the account/build doesn't accept prompt yet, we'll fail loud.
    try {
      const r = await fetch(url, {
        method: "POST", headers, body: JSON.stringify(withPrompt)
      });

      const text = await r.text();
      if (!r.ok) {
        console.error("[Realtime] session failed:", r.status, text);
        return res.status(r.status).json({ error: "session_create_failed", detail: text });
      }

      const json = JSON.parse(text);
      console.log("[Realtime] OK",
        "model=", json?.model,
        "prompt_id_applied=", "pmpt_68da7434aefc8195aec2c1e07cfc24a7053b8ea30d848663",
        "version=", "18");
      return res.json({ client_secret: json.client_secret });
    } catch (e) {
      console.error("Session error:", e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // Generate call summary endpoint
  app.post("/api/generate-summary", async (req, res) => {
    try {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "No messages provided" });
      }

      const transcript = messages.map((m: any) => 
        `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.text}`
      ).join('\n');

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a professional call summarizer for UBL (United Bank Limited) customer support. Generate a comprehensive, narrative summary of the call in English, regardless of what language(s) were spoken. 

Your summary should be a flowing paragraph that includes:
- What the customer contacted UBL for
- Any language switches that occurred (e.g., "initially in Urdu, then switched to English")
- Key details provided by the customer (account numbers, dates, amounts, etc.)
- Actions taken by the support agent
- Final outcome or next steps
- Any confirmations or follow-ups mentioned

Write in past tense, third person, as a clear narrative. Keep it concise but comprehensive, similar to this example:

"The user contacted Anadolu Isuzu for a service appointment, initially in Turkish, then switched to English. The user provided their license plate number (TB133), requested regular maintenance in Umraniyeh, Istanbul. The agent offered appointment times, and the user selected October 5th at 2 PM. The vehicle is a 2016 Isuzu D-Max. The appointment was booked, and a confirmation message will be sent."

Do NOT use bullet points or lists. Write as one or two cohesive paragraphs.`
            },
            {
              role: "user",
              content: `Generate a call summary for this UBL customer support conversation:\n\n${transcript}`
            }
          ],
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error:", errorText);
        return res.status(500).json({ error: "Failed to generate summary" });
      }

      const data = await response.json();
      const summary = data.choices[0]?.message?.content || "Unable to generate summary.";

      res.json({ summary });
    } catch (error) {
      console.error("Error generating summary:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Health check endpoint
  app.get("/healthz", (_req, res) => {
    res.send("ok");
  });

  /* COMMENTED OUT: DTMF/IVR mode disabled - all input is verbal now
  // Get recent DTMF keypresses
  app.get("/api/dtmf-history", (_req, res) => {
    res.json({ message: "DTMF disabled - verbal mode active", presses: [], count: 0, digits: "" });
  });
  */

  // Twilio voice webhook endpoint
  app.post("/twilio/voice", async (req, res) => {
    console.log("[Twilio] Incoming call from:", req.body.From);
    console.log("[Twilio] To:", req.body.To);
    console.log("[Twilio] CallSid:", req.body.CallSid);

    // Get the public URL (from Cloudflare tunnel or ngrok)
    // Cloudflare tunnel uses X-Forwarded-Proto header
    const host = req.get("host");
    const forwardedProto = req.get("x-forwarded-proto");
    const protocol = forwardedProto || req.protocol;
    const wsProtocol = protocol === "https" ? "wss" : "ws";
    const streamUrl = `${wsProtocol}://${host}/twilio/media-stream`;

    console.log("[Twilio] Stream URL:", streamUrl);
    console.log("[Twilio] Protocol detected:", protocol, "Host:", host);

    // Return TwiML to connect the call to our WebSocket
    // dtmfDetection="true" enables receiving keypad presses via WebSocket
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${streamUrl}" dtmfDetection="true">
            <Parameter name="callSid" value="${req.body.CallSid}" />
            <Parameter name="from" value="${req.body.From}" />
        </Stream>
    </Connect>
</Response>`;

    console.log("[Twilio] Sending TwiML:", twiml);
    res.type("text/xml");
    res.send(twiml);
  });

  // AGI endpoint for Asterisk integration
  // Must be registered BEFORE createServer
  app.all("/agi", async (req, res) => {
    console.log("[AGI] Asterisk connected", req.method, req.url);
    
    // AGI protocol requires specific headers
    res.setHeader('Content-Type', 'text/plain');
    
    // Read AGI environment variables (Asterisk sends these)
    const agiEnv: Record<string, string> = {};
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      // Parse AGI environment variables
      body.split('\n').forEach(line => {
        const match = line.match(/^agi_(\w+):\s*(.+)$/);
        if (match) {
          agiEnv[match[1]] = match[2];
        }
      });
      
      console.log("[AGI] Call from:", agiEnv.callerid || 'unknown');
      
      // Simple AGI response - you can expand this
      // AGI commands must end with newline
      const commands = [
        "ANSWER",
        "VERBOSE \"Call received from Asterisk\" 1",
        "STREAM FILE welcome \"\"",
        "HANGUP"
      ];
      
      for (const cmd of commands) {
        res.write(cmd + "\n");
      }
      
      res.end();
    });
  });

// Webhook endpoint for OpenAI Realtime SIP integration
app.post("/webhook", async (req, res) => {
  try {
    const event = req.body;
    console.log(`[Webhook] Received event: ${event.type}`);

    // Only handle incoming call events
    if (event.type !== "realtime.call.incoming") {
      console.log(`[Webhook] Ignoring event type: ${event.type}`);
      return res.status(200).json({ status: "ignored" });
    }

    const callId = event.data?.call_id;
    const fromHeader = event.data?.sip_headers?.find((h: any) => h.name === "From")?.value || "unknown";
    
    if (!callId) {
      console.error("[Webhook] Missing call_id in webhook event");
      return res.status(400).json({ error: "missing_call_id" });
    }

    console.log(`[Webhook] Incoming call: ${callId}`);
    console.log(`[Webhook] From: ${fromHeader}`);

    // Accept the call directly with session configuration
    const acceptUrl = `https://api.openai.com/v1/realtime/calls/${callId}/accept`;
    const headers = {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    };

    const acceptBody = {
      type: "realtime",
      model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime",
      modalities: ["audio", "text"],
      turn_detection: { type: "server_vad" },
      prompt: {
        id: "pmpt_68da7434aefc8195aec2c1e07cfc24a7053b8ea30d848663",
        version: "18"
      }
    };

    const response = await fetch(acceptUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(acceptBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Webhook] Failed to accept call: ${response.status}`, errorText);
      return res.status(500).json({ 
        error: "call_accept_failed", 
        detail: errorText 
      });
    }

    console.log(`[Webhook] Call accepted: ${callId}`);
    return res.status(200).json({ 
      status: "accepted",
      call_id: callId
    });

  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    return res.status(500).json({ 
      error: "internal_server_error",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

  const httpServer = createServer(app);

  // Setup WebSocket server for Twilio Media Streams
  const wss = new WebSocketServer({ server: httpServer, path: "/twilio/media-stream" });

  wss.on("connection", (ws, req) => {
    console.log("[Twilio WS] ✅ New connection established!");
    console.log("[Twilio WS] From IP:", req.socket.remoteAddress);
    console.log("[Twilio WS] URL:", req.url);
    console.log("[Twilio WS] Headers:", req.headers);
    
    let streamSid: string | null = null;
    let callSid: string | null = null;
    let openaiWs: WebSocket | null = null;
    let sessionCreated = false;

    ws.on("message", async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.event) {
          case "start":
            streamSid = data.start.streamSid;
            callSid = data.start.callSid;
            console.log(`[Twilio WS] Stream started: ${streamSid}, Call: ${callSid}`);
            
            // Create OpenAI Realtime session
            const sessionUrl = "https://api.openai.com/v1/realtime/sessions";
            const sessionResponse = await fetch(sessionUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
                "OpenAI-Beta": "realtime=v1"
              },
              body: JSON.stringify({
                model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime",
                modalities: ["audio", "text"],
                turn_detection: { type: "server_vad" },
                tools: TOOLS,
                prompt: {
                  id: "pmpt_68da7434aefc8195aec2c1e07cfc24a7053b8ea30d848663",
                  version: "18"
                }
              })
            });

            if (!sessionResponse.ok) {
              const errorText = await sessionResponse.text();
              console.error("[Twilio WS] Failed to create OpenAI session:", errorText);
              ws.close();
              return;
            }

            const sessionData = await sessionResponse.json();
            // Extract the actual secret value - it's an object with .value property
            const clientSecret = sessionData.client_secret?.value || sessionData.client_secret;
            
            console.log("[Twilio WS] Got client secret, connecting to OpenAI...");
            
            // Connect to OpenAI Realtime API via WebSocket
            const realtimeUrl = `wss://api.openai.com/v1/realtime?model=${sessionData.model}`;
            const { WebSocket } = await import("ws");
            openaiWs = new WebSocket(realtimeUrl, {
              headers: {
                "Authorization": `Bearer ${clientSecret}`,
                "OpenAI-Beta": "realtime=v1"
              }
            });

            openaiWs.on("open", () => {
              console.log("[OpenAI WS] Connected to Realtime API");
              
              // Send session configuration for Twilio phone calls
              // Use server VAD for turn detection - it will handle interruptions automatically
              openaiWs!.send(JSON.stringify({
                type: "session.update",
                session: {
                  input_audio_format: "g711_ulaw",
                  output_audio_format: "g711_ulaw",
                  input_audio_transcription: {
                    model: "whisper-1"
                  },
                  turn_detection: {
                    type: "server_vad",
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 200  // Shorter for faster interruption
                  },
                  tools: TOOLS
                }
              }));

              sessionCreated = true;
            });

            openaiWs.on("message", async (openaiMessage: Buffer) => {
              try {
                const event = JSON.parse(openaiMessage.toString());
                
                // Handle different OpenAI Realtime events
                switch (event.type) {
                  case "session.created":
                  case "session.updated":
                    console.log("[OpenAI WS] Session ready:", event.type);
                    break;
                    
                  case "response.audio.delta":
                    // Send audio back to Twilio
                    if (event.delta && streamSid) {
                      const audioMessage = {
                        event: "media",
                        streamSid: streamSid,
                        media: {
                          payload: event.delta
                        }
                      };
                      ws.send(JSON.stringify(audioMessage));
                    }
                    break;
                    
                  case "response.audio_transcript.delta":
                  case "response.text.delta":
                    console.log("[OpenAI WS] Transcript:", event.delta);
                    break;
                    
                  case "conversation.item.input_audio_transcription.completed":
                    console.log("[OpenAI WS] User said:", event.transcript);
                    break;

                  case "response.function_call_arguments.done":
                    // AI wants to call a function/tool
                    const functionName = event.name;
                    const functionCallId = event.call_id;
                    
                    console.log(`[OpenAI WS] 🔧 Function call: ${functionName}, call_id: ${functionCallId}`);
                    
                    let functionResult: any;
                    
                    if (functionName === "activate_debit_card") {
                      // Call UBL Debit Card Activation API
                      let cardLast4 = "";
                      let expiryMmyy = "";
                      let cnic = "";
                      
                      try {
                        const args = JSON.parse(event.arguments || "{}");
                        cardLast4 = args.card_last4 || "";
                        expiryMmyy = args.expiry_mmyy || "";
                        cnic = args.cnic || "";
                      } catch (e) {
                        console.error("[OpenAI WS] Error parsing arguments:", e);
                      }
                      
                      console.log(`[OpenAI WS] 💳 Card activation request: last4="${cardLast4}", expiry="${expiryMmyy}", cnic="${cnic || 'not provided'}"`);
                      
                      if (!cardLast4 || cardLast4.length !== 4) {
                        functionResult = {
                          success: false,
                          error: "invalid_card_last4",
                          message: "Card last 4 digits are required and must be exactly 4 digits."
                        };
                      } else if (!expiryMmyy || expiryMmyy.length !== 4) {
                        functionResult = {
                          success: false,
                          error: "invalid_expiry",
                          message: "Card expiry is required in MMYY format (e.g., '0626' for June 2026)."
                        };
                      } else {
                        // Call the UBL API
                        try {
                          functionResult = await callUBLActivationAPI({
                            cardLast4,
                            expiry: expiryMmyy,
                            cnic: cnic || undefined
                          });
                        } catch (apiError) {
                          console.error("[OpenAI WS] API call error:", apiError);
                          functionResult = {
                            success: false,
                            error: "api_error",
                            message: "Failed to connect to the card activation service. Please try again."
                          };
                        }
                      }
                    } else {
                      functionResult = {
                        success: false,
                        error: "unknown_function",
                        message: `Unknown function: ${functionName}. Only 'activate_debit_card' is available.`
                      };
                    }
                    
                    console.log(`[OpenAI WS] 📤 Function result:`, functionResult);
                    
                    // Send the function result back to OpenAI
                    openaiWs!.send(JSON.stringify({
                      type: "conversation.item.create",
                      item: {
                        type: "function_call_output",
                        call_id: functionCallId,
                        output: JSON.stringify(functionResult)
                      }
                    }));
                    
                    // Tell OpenAI to continue responding based on the function result
                    openaiWs!.send(JSON.stringify({
                      type: "response.create"
                    }));
                    break;
                    
                  case "error":
                    console.error("[OpenAI WS] Error:", event.error);
                    break;
                }
              } catch (err) {
                console.error("[OpenAI WS] Error parsing message:", err);
              }
            });

            openaiWs.on("error", (error) => {
              console.error("[OpenAI WS] WebSocket error:", error);
            });

            openaiWs.on("close", () => {
              console.log("[OpenAI WS] Connection closed");
              ws.close();
            });
            break;

          case "media":
            // Forward audio from Twilio to OpenAI
            if (openaiWs && openaiWs.readyState === 1 && sessionCreated) {
              const audioPayload = data.media.payload;
              
              // Just append - server VAD will handle everything automatically
              // No manual commits needed!
              openaiWs.send(JSON.stringify({
                type: "input_audio_buffer.append",
                audio: audioPayload
              }));
            }
            break;

          /* COMMENTED OUT: DTMF/IVR mode disabled - all input is verbal now
          case "dtmf":
            // User pressed a key on their phone keypad
            const digit = data.dtmf?.digit;
            console.log(`[Twilio WS] 🔢 DTMF digit pressed: ${digit} (IGNORED - verbal mode)`);
            break;
          */

          case "stop":
            console.log(`[Twilio WS] Stream stopped: ${streamSid}`);
            if (openaiWs) {
              openaiWs.close();
            }
            break;
        }
      } catch (err) {
        console.error("[Twilio WS] Error processing message:", err);
      }
    });

    ws.on("close", () => {
      console.log(`[Twilio WS] Connection closed for stream: ${streamSid}`);
      if (openaiWs) {
        openaiWs.close();
      }
    });

    ws.on("error", (error) => {
      console.error("[Twilio WS] WebSocket error:", error);
      if (openaiWs) {
        openaiWs.close();
      }
    });
  });

  wss.on("error", (error) => {
    console.error("[Twilio WS] Server error:", error);
  });

  wss.on("listening", () => {
    console.log("[Twilio WS] ✅ WebSocket server ready on /twilio/media-stream");
  });

  console.log("[Twilio WS] WebSocket server initialized");

  return httpServer;
}
