# gmail-agent

An AI-powered cron job that helps me manage my Gmail inbox

## Set up environment variables

```bash
# Create .env file (by copying from .env.example)
cp .env.example .env
```

## Create OAuth2 Credentials

- In Google Cloud Console, go to APIs & Services > Credentials
- Click "Create Credentials" > "OAuth client ID"
- If prompted, configure the OAuth consent screen first:

  1. Choose "External" for personal use
  2. Fill in required fields (app name, user support email, etc.)
  3. Add your email to test users

- Select "Web application" as application type
- Add authorized redirect URIs:

  1. `http://localhost:3000/auth/callback`
  2. `https://your-vercel-app.vercel.app/api/auth/callback` // Change this URL after vercel deployment below

- Click "Create"
- Place the Client ID and Client Secret in your .env file

## Get Refresh Token

```bash
# Place the refresh token printed in the terminal in your .env file
make auth
```

## Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (Initial deployment)
vercel --prod

# Set environment variables
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add GOOGLE_REFRESH_TOKEN
vercel env add GEMINI_API_KEY # You can get this from https://aistudio.google.com/apikey

# Redeploy with environment variables
vercel --prod
```

## Manually test whether deployment is successful

```bash
curl -X GET -H "x-vercel-cron: true" https://your-vercel-app.vercel.app/api/cron/gmail/monitor
```

## Style Enforcement

```bash
make lint
```
