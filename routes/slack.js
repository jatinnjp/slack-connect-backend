const express = require('express');
const axios = require('axios');
const router = express.Router();
const dotenv = require('dotenv');
const Message = require('../models/Message');
const cron = require('node-cron');
const mongoose = require('mongoose');

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

    const { access_token, refresh_token, authed_user } = response.data;
    const userId = authed_user.id;

    // Save tokens in DB
    await Message.findOneAndUpdate(
      { userId },
      { accessToken: access_token, refreshToken: refresh_token },
      { upsert: true }
    );

    res.send('Slack connected successfully!');
  } catch (error) {
    console.error(error);
    res.status(500).send('OAuth failed');
  }
});

// 👉 STEP 3: Send immediate message
router.post('/send', async (req, res) => {
  const { userId, channel, text } = req.body;
  const user = await Message.findOne({ userId });

  if (!user) return res.status(404).send('User not found');

  try {
    await axios.post('https://slack.com/api/chat.postMessage', {
      channel,
      text
    }, {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    res.send('Message sent!');
  } catch (error) {
    console.error(error.response.data);
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
    refreshToken: user.refreshToken,
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
