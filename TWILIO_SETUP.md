# Twilio Voice Bot Setup Guide

## ✅ Integration Complete!

Your voice bot is now running with Twilio integration via Cloudflare tunnel.

## 🌐 Current Setup

- **Backend Server**: Running on port 3000 (mapped to internal 5000)
- **Cloudflare Tunnel URL**: `https://wanna-constitute-min-treasury.trycloudflare.com`
- **Health Check**: http://localhost:3000/healthz
- **Twilio Webhook Endpoint**: `https://wanna-constitute-min-treasury.trycloudflare.com/twilio/voice`
- **Twilio Media Stream**: `wss://wanna-constitute-min-treasury.trycloudflare.com/twilio/media-stream`

## 📞 Configure Twilio Phone Number

Follow these steps to connect your Twilio phone number to the voice bot:

### Step 1: Log into Twilio Console

1. Go to https://console.twilio.com/
2. Log in with your account credentials

### Step 2: Configure Your Phone Number

1. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**
2. Click on your phone number: **+13236767459**
3. Scroll down to the **Voice Configuration** section

### Step 3: Set the Webhook URL

Under **A CALL COMES IN**:
- Select: **Webhook**
- URL: `https://wanna-constitute-min-treasury.trycloudflare.com/twilio/voice`
- HTTP Method: **POST**
- Click **Save**

### Step 4: Test Your Voice Bot

1. Call your Twilio number: **+1 (323) 676-7459**
2. The call should connect to your OpenAI Realtime voice bot
3. Start speaking - the bot will respond using your configured UBL Bank agent prompt

## 🔧 How It Works

```
Incoming Call → Twilio → Webhook (/twilio/voice)
                    ↓
              Returns TwiML with WebSocket URL
                    ↓
         Twilio Media Stream connects via WebSocket
                    ↓
         Audio forwarded to OpenAI Realtime API
                    ↓
         AI responses sent back to caller
```

## 📊 Monitoring

### Check Backend Logs
```bash
docker logs balance-inquiry -f
```

### Check Cloudflare Tunnel Logs
```bash
docker logs balance-inquiry-tunnel -f
```

### Test Webhook Endpoint
```bash
curl https://commons-vienna-app-bikini.trycloudflare.com/healthz
```

## 🔄 Important Notes

### Cloudflare Tunnel URL Changes
The free Cloudflare tunnel URL (`commons-vienna-app-bikini.trycloudflare.com`) changes every time you restart the containers. 

**After each restart:**
1. Get the new URL: `docker logs balance-inquiry-tunnel 2>&1 | grep "trycloudflare.com"`
2. Update your Twilio webhook URL in the console

### Persistent URL Options

If you want a permanent URL, you have two options:

#### Option 1: Cloudflare Tunnel (Recommended)
1. Create a free Cloudflare account
2. Install cloudflared CLI
3. Run: `cloudflared tunnel login`
4. Create a tunnel: `cloudflared tunnel create ubl-voice-bot`
5. Update docker-compose.yml with your tunnel token
6. You'll get a permanent URL like: `ubl-voice-bot.yourdomain.com`

#### Option 2: ngrok (Alternative)
1. Sign up at https://ngrok.com (free tier)
2. Get your auth token
3. Update docker-compose.yml to use ngrok instead:
```yaml
  ngrok:
    image: ngrok/ngrok:latest
    container_name: ngrok-tunnel
    command: http backend:5000 --authtoken YOUR_NGROK_TOKEN
    ports:
      - "4040:4040"  # ngrok dashboard
    depends_on:
      - backend
    networks:
      - ubl-network
```

## 🎯 Current Configuration

### Environment Variables (.env)
Create a `.env` file (see `.env.example`) with your own values. Example structure:
```
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_REALTIME_MODEL=gpt-realtime
PORT=5000
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```
**Never commit real keys.** Use `.env` locally and keep it in `.gitignore`.

### OpenAI Prompt
Your bot uses the UBL Bank customer service prompt:
- **Prompt ID**: `pmpt_69948eeec39481959a7cc4250542590f01fd5d101c307675`
- **Version**: 2

## 🐛 Troubleshooting

### Call not connecting?
1. Check backend logs: `docker logs balance-inquiry -f`
2. Verify webhook URL is correct in Twilio console
3. Test webhook: `curl https://YOUR-TUNNEL-URL/twilio/voice`

### No audio?
1. Check WebSocket connection in logs
2. Verify OpenAI API key is valid
3. Check OpenAI Realtime API quota

### Tunnel not working?
1. Restart containers: `docker-compose restart`
2. Get new URL: `docker logs balance-inquiry-tunnel 2>&1 | grep "trycloudflare.com"`
3. Update Twilio webhook URL

## 📝 Quick Commands

```bash
# Restart everything
docker-compose down --volumes --remove-orphans
docker system prune -f
docker-compose up -d --build --force-recreate

# Get tunnel URL
docker logs balance-inquiry-tunnel 2>&1 | grep "trycloudflare.com"

# Check health
curl http://localhost:3000/healthz

# View logs
docker logs balance-inquiry -f
docker logs balance-inquiry-tunnel -f
```

## 🎉 Success!

Your Twilio voice bot is now ready! Just configure the webhook URL in Twilio console and start making calls.

**Current Webhook URL**: `https://wanna-constitute-min-treasury.trycloudflare.com/twilio/voice`

---

*Note: Remember to update the webhook URL in Twilio console whenever you restart the containers, as the Cloudflare tunnel URL will change.*

