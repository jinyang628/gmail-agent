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
  2. `https://your-vercel-app.vercel.app/api/auth/callback`

- Click "Create"
- Place the Client ID and Client Secret in your .env file

## Get Refresh Token

```bash
# Place the refresh token printed in the terminal in your .env file
make auth
```

## Style Enforcement

```bash
make lint
```
