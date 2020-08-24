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

require('dotenv').config();

const oauthToken = process.env.SLACK_AUTH_TOKEN;
const google_api_key = process.env.GOOGLE_KEY;
const project_id = process.env.PROJECT_ID;
const apiUrl = 'https://slack.com/api';

let credentials = {
  projectId: project_id,
  key: google_api_key
};
// Require Google Cloud Translation API (no credentials required for GCF).
const {Translate} = require('@google-cloud/translate').v2;
const translate = new Translate(credentials);


/* Events */

exports.events = async (req, res) => {
  let q = req.body;

  if (q.type === 'url_verification') {
    console.log('Slack URL verification request.');
    // App setting validation
    return res.send(q.challenge);
  } else if (q.token !== process.env.SLACK_VERIFICATION_TOKEN) {
    // To see if the request is not coming from Slack.
    console.warn('Invalid verification token.');
    return res.status(401);
  }

  res.status(200);

  // Events
  if (q.event.type === 'reaction_added') {
    // If reacji was triggered && it is a correct emoji, translate the message into a specified language

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
        reaction: 'jp',
        item_user: '...',
        event_ts: '1508284554.000254' },
        type: 'event_callback',
        event_id: '...',
        event_time: 1508284554,
        authed_users: [ '...' ] }
    */

    if(q.event.item.type != 'message') {
      return noOpResponse(res);
    }

    let emoji = q.event.reaction;
    let country = '';

    console.log('Reaction: ', emoji);

    // Check emoji if it is a country flag
    if(emoji.match(/flag-/)) { // when an emoji has flag- prefix
      country = emoji.match(/(?!flag-\b)\b\w+/)[0];
    } else { // jp, fr, etc.
      const flags = Object.keys(langcode); // array
      if(flags.includes(emoji)) {
        country = emoji;
      } else {
        return noOpResponse(res);
      }
    }

    // Finding a lang based on a country is not the best way but oh well
    // Matching ISO 639-1 language code
    let lang = langcode[country];
    let channel = q.event.item.channel;

    if(!lang) return noOpResponse(res);

    console.log('Flag emoji reaction; translating to ', lang);

    return getMessage(channel, q.event.item.ts)
    .then((result) => {
      if(!result.text) return noOpResponse(res);
      postTranslatedMessage(result, lang, channel, emoji);
      return res.send('Reacjilator reacjilated!');
    })
    .catch(e => {
      res.status(500).send('An error has occured.');
      console.error(e);
    });
  }
};

function noOpResponse(response) {
  response.status(200).send('No flag emoji reaction detected.');
  return;
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
  request.post(apiUrl + '/conversations.replies', {form: {token: oauthToken, channel: ch, ts: ts, limit: 1, inclusive: true}}, (error, response, sbody) => {
    let body = JSON.parse(sbody);
    if (error || body.error || response.statusCode != 200) {
      let e = error || body.error || 'Could not retrieve Slack message.';
      console.error('Error getting Slack message: ', e);
      reject;
    }
    resolve(body.messages[0]);
  });
});

function postTranslatedMessage(message, lang, channel, emoji) {
  // Google Translate
  translate.translate(message.text, lang).then(([translation]) => {
    postMessage(message, translation, channel, emoji);
  }).catch(e => {
    console.error(e);
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
