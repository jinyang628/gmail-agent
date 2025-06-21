import 'dotenv/config';
import type { Credentials } from 'google-auth-library';
import { google } from 'googleapis';
import http from 'http';
import open from 'open';
import destroyer from 'server-destroy';
import { URL } from 'url';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/auth/callback',
);

const scopes = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent',
});

async function getAuthenticated(): Promise<Credentials> {
  return new Promise((resolve, reject) => {
    const server = http
      .createServer(async (req, res) => {
        if (!req.url) {
          res.end('No URL found');
          return;
        }

        try {
          if (req.url.indexOf('/auth/callback') > -1) {
            const qs = new URL(req.url, 'http://localhost:3000').searchParams;
            const code = qs.get('code');

            res.end('Authentication successful! You can now close this tab.');
            if (!code) {
              throw new Error('No authorization code received');
            }
            const tokenResponse = await oauth2Client.getToken(code);
            const tokens: Credentials = tokenResponse.tokens;

            server.close();
            destroyer(server);
            resolve(tokens);
          }
        } catch (e) {
          reject(e);
        }
      })
      .listen(3000, () => {
        console.log('\n\nOpening browser for authentication...\n\n');
        open(authUrl, { wait: false }).then((cp) => cp.unref());
      });

    destroyer(server);
  });
}

async function main() {
  try {
    const tokens: Credentials = await getAuthenticated();
    console.log('-------------------------------------------');
    if (tokens.refresh_token) {
      console.log('✅ YOUR REFRESH TOKEN IS:');
      console.log(tokens.refresh_token);
      console.log('-------------------------------------------');
      console.log('Place this refresh token in your .env file');
      process.exit(0);
    } else {
      console.log(
        '❌ FAILED TO GET A REFRESH TOKEN. This might happen if you have already authorized this app.',
      );
      console.log(
        'To fix this, go to https://myaccount.google.com/permissions and remove access for your app, then try again.',
      );
      process.exit(1);
    }
  } catch (e) {
    console.error('Authentication failed:', e);
    process.exit(1);
  }
}

main();
