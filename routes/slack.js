const express = require('express');
const axios = require('axios');
const router = express.Router();
const dotenv = require('dotenv');
const Message = require('../models/Message');

dotenv.config();

const CLIENT_ID = process.env.SLACK_CLIENT_ID;
const CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const REDIRECT_URI = process.env.SLACK_REDIRECT_URI;

// 👉 STEP 1: Redirect to Slack OAuth
router.get('/auth', (req, res) => {
  const url = `https://slack.com/oauth/v2/authorize?client_id=${CLIENT_ID}&scope=chat:write,channels:read,channels:join,users:read,groups:read&redirect_uri=${REDIRECT_URI}`;
  res.redirect(url);
});

// 👉 STEP 2: Handle Slack OAuth callback
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI
      }
    });

    console.log("🔍 Slack OAuth Full Response:", JSON.stringify(response.data, null, 2));

    if (!response.data.ok) {
      console.error("❌ Slack OAuth Error:", response.data.error);
      return res.status(400).send('OAuth failed: ' + response.data.error);
    }

    // Extract bot access token & user info
    const botToken = response.data.access_token; // xoxb-...
    const botUserId = response.data.bot_user_id; // Bot ID
    const userId = response.data.authed_user?.id || botUserId || `bot-${Date.now()}`;

    if (!botToken || !userId) {
      console.error('❌ Missing botToken or userId in Slack response');
      return res.status(400).send('Invalid Slack response');
    }

    // Save in DB (so /send can use it later)
    const result = await Message.findOneAndUpdate(
      { userId },
      { accessToken: botToken },
      { upsert: true, new: true }
    );

    console.log('✅ Saved to MongoDB:', result);

    res.send('✅ Slack connected successfully! You can close this tab and go back to the app.');
  } catch (error) {
    console.error('❌ OAuth error:', error.response?.data || error.message);
    res.status(500).send('OAuth failed');
  }
});

// 👉 STEP 3: Send immediate message
router.post('/send', async (req, res) => {
  const { userId, channel, text } = req.body;
  const user = await Message.findOne({ userId });

  if (!user) return res.status(404).send('User not found');

  try {
    const result = await axios.post('https://slack.com/api/chat.postMessage', {
      channel,
      text
    }, {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!result.data.ok) {
      console.error('Slack API error:', result.data);
      return res.status(500).send('Slack API error: ' + result.data.error);
    }

    res.send('Message sent!');
  } catch (error) {
    console.error('Send error:', error.response?.data || error.message);
    res.status(500).send('Failed to send message');
  }
});

// 👉 STEP 4: Schedule a message
router.post('/schedule', async (req, res) => {
  const { userId, channel, text, sendAt } = req.body;
  const user = await Message.findOne({ userId });

  if (!user) return res.status(404).send('User not found');

  const message = await Message.create({
    userId,
    accessToken: user.accessToken,
    channel,
    text,
    sendAt: new Date(sendAt),
    status: 'scheduled'
  });

  res.send({ message: 'Message scheduled', id: message._id });
});

// 👉 STEP 5: List all scheduled messages
router.get('/list/:userId', async (req, res) => {
  const { userId } = req.params;
  const messages = await Message.find({ userId, status: 'scheduled' });
  res.send(messages);
});

// 👉 STEP 6: Cancel a scheduled message
router.delete('/cancel/:id', async (req, res) => {
  const { id } = req.params;
  await Message.findByIdAndDelete(id);
  res.send('Message cancelled');
});

module.exports = router;
