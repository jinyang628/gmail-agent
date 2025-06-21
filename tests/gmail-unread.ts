import { config } from 'dotenv';
import { google } from 'googleapis';

config();

const gmail = google.gmail('v1');

const oauth2Client = new google.auth.OAuth2({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
});

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

async function testGmailDirect() {
  console.log('🔍 Direct Gmail Test - Checking for unread messages in last 24 hours...\n');

  try {
    google.options({
      auth: oauth2Client,
    });

    console.log('📧 Checking Gmail profile...');
    const profile = await gmail.users.getProfile({
      userId: 'me',
    });
    console.log(`✅ Connected as: ${profile.data.emailAddress}\n`);

    const date = new Date();
    date.setDate(date.getDate() - 1);
    const queryDate = Math.floor(date.getTime() / 1000);
    const query = `is:unread after:${queryDate} (in:inbox OR is:important)`;

    console.log(`🔍 Searching with query: "${query}"`);
    console.log(`📅 Time range: ${date.toISOString()} to now\n`);

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 20,
    });

    const messages = res.data.messages || [];
    console.log(`📊 Found ${messages.length} unread messages in the last 24 hours\n`);

    if (messages.length > 0) {
      console.log('📋 Message IDs:');
      messages.forEach((msg, index) => {
        console.log(`  ${index + 1}. ${msg.id}`);
      });
      console.log();

      console.log('📄 Getting details of first 3 messages...\n');
      const messageDetails = await Promise.all(
        messages.slice(0, 3).map(async (msg) => {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'Date'],
          });
          return detail.data;
        }),
      );

      messageDetails.forEach((msg, index) => {
        const headers = msg.payload?.headers || [];
        const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((h) => h.name === 'From')?.value || 'Unknown';
        const date = headers.find((h) => h.name === 'Date')?.value || 'Unknown';

        console.log(`📧 Message ${index + 1}:`);
        console.log(`   Subject: ${subject}`);
        console.log(`   From: ${from}`);
        console.log(`   Date: ${date}`);
        console.log(`   ID: ${msg.id}`);
        console.log();
      });
    } else {
      console.log('ℹ️  No unread messages found in the last 24 hours.');
    }

    console.log('🔍 Checking total unread messages (all time)...');
    const totalUnread = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 1,
    });
    console.log(`📊 Total unread messages: ${totalUnread.data.resultSizeEstimate || 0}\n`);

    console.log('✅ Direct Gmail test completed successfully!');
  } catch (error) {
    console.error('❌ Error testing Gmail:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
  }
}

// Run the test
testGmailDirect();
