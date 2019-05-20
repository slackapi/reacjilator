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
  *         "*:read" (Access channels info)
  *         "*:history" (Access channels history)
  */

 /* Google Cloud setup
  * API Key https://cloud.google.com/translate/docs/getting-started
  * Node Lib https://www.npmjs.com/package/@google-cloud/translate
  */

 const express = require('express');
 const bodyParser = require('body-parser');
 const signature = require('./verifySignature');
 const langcode = require('./langcode');
 const axios = require('axios'); 
 const qs = require('qs');
 
 const apiUrl = 'https://slack.com/api';
 
 const app = express();

/*
 * Parse application/x-www-form-urlencoded && application/json
 * Use body-parser's `verify` callback to export a parsed raw body
 * that you need to use to verify the signature
 */

const rawBodyBuffer = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};

app.use(bodyParser.urlencoded({verify: rawBodyBuffer, extended: true }));
app.use(bodyParser.json({ verify: rawBodyBuffer }));


const googleCredentials = {
  projectId: process.env.GOOGLE_PROJECT_ID,
  key: process.env.GOOGLE_KEY
};

app.post('/events', (req, res) => {
  switch (req.body.type) {
    case 'url_verification': {
      // verify Events API endpoint by returning challenge if present
      res.send({ challenge: req.body.challenge });
      break;
    }
    case 'event_callback': {
      // Verify the signing secret
      if (!signature.isVerified(req)) {
        res.sendStatus(404);
        return;
      } else {
        res.sendStatus(200);
        return events(req, res);
      }
      break;
    }
    default: { res.sendStatus(404); }
  }
});

// Require Google Cloud Translation API 
const translate = require('@google-cloud/translate')(googleCredentials);

/* Events */

const events = async(req, res) => {
  const {type, user, reaction, item} = req.body.event;

  if (type === 'reaction_added') {
    // If reacji was triggered && it is a correct emoji, translate the message into a specified language

    if(item.type !== 'message') {
      return;
    }

    let country = '';

    // Check emoji if it is a country flag
    if(reaction.match(/flag-/)) { // when an emoji has flag- prefix
      country = reaction.match(/(?!flag-\b)\b\w+/)[0];
    } else { // jp, fr, etc.
      const flags = Object.keys(langcode); // array
      if(flags.includes(reaction)) {
        country = reaction;
      } else {
        return;
      }
    }

    // Finding a lang based on a country is not the best way but oh well
    // Matching ISO 639-1 language code
    let lang = langcode[country];
    if(!lang) return;

    let messages = await getMessage(item.channel, item.ts); 
    postTranslatedMessage(messages, lang, item.channel, reaction);
    
  }
};

const getMessage = async(channel, ts) => { 
  const args = {
    token: process.env.SLACK_ACCESS_TOKEN,
    channel: channel,
    ts: ts,
    limit: 1,
    inclusive: true
  };
  
  const result = await axios.post(`${apiUrl}/conversations.replies`, qs.stringify(args));
  
  try {
    return result.data.messages; 
  } catch(e) {
    console.log(e);
  }
};

const postTranslatedMessage = (messages, lang, channel, emoji) => {
  
  // Google Translate API
  
  let message = messages[0];
  translate.translate(message.text, lang, (err, translation) => {
    if (err) {
      console.log(err);
    } else {
      if(isAlreadyPosted(messages, translation)) return;
      postMessage(message, translation, lang, channel, emoji);
    }
  });
};

const isAlreadyPosted = (messages, translation) => {
  // To avoid posting same messages several times, make sure if a same message in the thread doesn't exist
  let alreadyPosted = false;
  messages.forEach(messageInTheThread => {
    if (!alreadyPosted && messageInTheThread.subtype && messageInTheThread.attachments[0].text === translation) {
      alreadyPosted = true;
    }
  });
  if (alreadyPosted) {
    return true;
  }
};


// Bot posts a message 
const postMessage = async(message, translation, lang, channel, emoji) => { 
  
  let ts = (message.thread_ts) ? message.thread_ts : message.ts;

  // TODO - Once Block Kit supports the "attachment" bar, switch this part to Block Kit!
  
  let attachments = [];
  if(message.text) {
    attachments = [
      {
        pretext: `_The message is translated in_ :${emoji}: _(${lang})_`,
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
  
  const args = {
    token: process.env.SLACK_ACCESS_TOKEN,
    channel: channel,
    attachments: JSON.stringify(attachments),
    as_user: false,
    username: 'Reacjilator Bot',
    thread_ts: ts
  };
  
  const result = await axios.post(`${apiUrl}/chat.postMessage`, qs.stringify(args));
  
  try {
    console.log(result.data);
  } catch(e) {
    console.log(e);
  }
};



const server = app.listen(process.env.PORT || 5000, () => {
  console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env);
});