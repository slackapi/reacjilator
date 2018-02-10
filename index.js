/* ***************************************************
 * Reacilator for Slack
 * Translate message when a user reacted with an emoji
 * Tomomi Imura (@girlie_mac)
 * ****************************************************/

 /* Slack App setup
  * Enable events: "reaction_added"
  * Enable Bot user
  * Scopes: "chat:write:bot" (Send messages with chat.postMessage by a bot),
  *         "reactions:read" (Access the workspace’s emoji reaction history)
  *         "channels:read" (Access public channels info)
  *         "*:history" (Access user's  channels)
  */

 /* Google Cloud setup
  * API Key https://cloud.google.com/translate/docs/getting-started
  * Node Lib https://www.npmjs.com/package/@google-cloud/translate
  */

'use strict';

const langcode = require('./langcode');
const request = require('request');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const server = app.listen(process.env.PORT || 5000, () => {
  console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env);
});

const oauthToken = process.env.SLACK_AUTH_TOKEN;
const apiUrl = 'https://slack.com/api';

const translate = require('@google-cloud/translate')({
  projectId: process.env.GOOGLE_PROJECT_ID,
  key: process.env.GOOGLE_KEY
});

/* Events */

app.post('/events', (req, res) => {
  let q = req.body;

  if (q.type === 'url_verification') {
    // App setting validation
    res.send(q.challenge);
  } else if (q.token !== process.env.SLACK_VERIFICATION_TOKEN) {
    // To see if the request is not coming from Slack
    res.sendStatus(400);
    return;
  } else {
    res.sendStatus(200);
  }

  // Events
  if (q.event.type === 'reaction_added') {
    // If reacji was triggered && it is a correct emoji, translate the message into a specified language

    //console.log(q);
    /*
    { token: '...',
      team_id: '...',
      api_app_id: '...',
      event:
      { type: 'reaction_added',
        user: 'U5R3PALPN',
        item:
        { type: 'message',
        channel: 'C5TS6D8CC',
        ts: '1508284331.000239' },
        reaction: 'flag-jp',
        item_user: '...',
        event_ts: '1508284554.000254' },
        type: 'event_callback',
        event_id: '...',
        event_time: 1508284554,
        authed_users: [ '...' ] }
    */

    let emoji = q.event.reaction;

    if(isFlagEmoji(emoji) && q.event.item.type === 'message') {
      // Matching ISO 639-1 language code
      let lang = langcode[emoji];
      let channel = q.event.item.channel;

      if(!lang) return;

      getMessage(channel, q.event.item.ts)
      .then((result) => {
        if(!result.text) return;
        postTranslatedMessage(result, lang, channel, emoji);
      })
      .catch(console.error);
    }
  }
});

function isFlagEmoji(emoji) {
  const flags = Object.keys(langcode); // array
  return flags.includes(emoji);
}

/* conversations.replies Output
The diff bet .history and .replies are that the history only retrieves the parent message. If the message to be translated was in a thread, the history cannot get the message in the thread, instead, it picks up the parent message!

[ { type: 'message',
  user: '...',
  text: 'it is raining',
  thread_ts: '1508538072.000022',
  parent_user_id: '...',
  reply_count: 0,
  replies: [],
  subscribed: false,
  ts: '1508539599.000251',
  reactions: [ [Object], [Object], [Object] ] } ]
*/
const getMessage = (ch, ts) => new Promise((resolve, reject) => {
  request.post(apiUrl + '/conversations.replies', {form: {token: oauthToken, channel: ch, ts: ts, limit: 1, inclusive: true}}, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      resolve(JSON.parse(body).messages[0]);
    } else {
      reject;
    }
  });
});

function postTranslatedMessage(message, lang, channel, emoji) {
  // Google Translate
  translate.translate(message.text, lang, (err, translation) => {
    if (err) {
      console.log(err);
    } else {
      postMessage(message, translation, channel, emoji);
    }
  });
}

// Bot posts a message - Need "chat:write:bot" scope
function postMessage(message, translation, channel, emoji) {
  let attachments = [];
  if(message.text) {
    attachments = [
      {
        pretext: '_The message is translated in_ :' +emoji+ ': ',
        text: translation,
        footer: message.text,
        mrkdwn_in: ["text", "pretext"]
      }
    ];
  } else {
    attachments = [
      {
        pretext: '_Sorry, the language is not supported!_ :persevere:',
        mrkdwn_in: ["text", "pretext"]
      }
    ];
  }

  let ts = (message.thread_ts) ? message.thread_ts : message.ts;

  let options = {
    method: 'POST',
    uri: 'https://slack.com/api/chat.postMessage',
    form: {
      token: oauthToken,
      channel: channel,
      attachments: JSON.stringify(attachments),
      as_user: false,
      username: 'Reacjilator Bot',
      thread_ts: ts
    }
  };

  request(options, (error, response, body) => {
    if (error) {
      console.log(error)
    }
  });
}
