require('dotenv').config();

const langcode = require('./langcode');

const { App } = require('@slack/bolt');
const { Translate } = require('@google-cloud/translate').v2;

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const translate = new Translate({
  projectId: process.env.GOOGLE_PROJECT_ID,
});

app.event('reaction_added', async ({ event, client }) => {
  const { type, reaction, item } = event;

  if (type === 'reaction_added') {
    // If reacji was triggered && it is a correct emoji, translate the message into a specified language

    if (item.type !== 'message') {
      return;
    }

    let country = '';

    // Check emoji if it is a country flag
    if (reaction.match(/flag-/)) { // when an emoji has flag- prefix
      country = reaction.match(/(?!flag-\b)\b\w+/)[0];
    } else { // jp, fr, etc.
      const flags = Object.keys(langcode); // array
      if (flags.includes(reaction)) {
        country = reaction;
      } else {
        return;
      }
    }

    // Finding a lang based on a country is not the best way but oh well
    // Matching ISO 639-1 language code
    let lang = langcode[country];
    if (!lang) return;

    let messages = await getMessage(item.channel, item.ts, client);
    postTranslatedMessage(messages, lang, item.channel, reaction, client);

  }
});

const getMessage = async (channel, ts, client) => {
  try {
    const result = await client.conversations.replies({
      channel: channel,
      ts: ts,
      limit: 1,
      inclusive: true
    });
    return result.messages;
  } catch (e) {
    console.log(e);
  }
};

const postTranslatedMessage = (messages, lang, channel, emoji, client) => {

  // Google Translate API

  let message = messages[0];
  translate.translate(message.text, lang, (err, translation) => {
    if (err) {
      console.log(err);
    } else {
      if (isAlreadyPosted(messages, translation)) return;
      postMessage(message, translation, lang, channel, emoji, client);
    }
  });
};

const isAlreadyPosted = (messages, translation) => {
  // To avoid posting same messages several times, check the thread for an identical translation
  let alreadyPosted = false;
  messages.forEach(messageInTheThread => {
    if (!alreadyPosted && messageInTheThread.subtype && messageInTheThread.blocks[0].text.text === translation) {
      alreadyPosted = true;
    }
  });
  if (alreadyPosted) {
    return true;
  }
};

const postMessage = async (message, translation, lang, channel, emoji, client) => {

  const ts = (message.thread_ts) ? message.thread_ts : message.ts;

  let text = '';
  let blocks = [];

  if (message.text) { // Check if the message has translated
    text = `_Here is a translation to_ :${emoji}: _(${lang})_`;
    blocks.push(
      {
        type: "section", 
        text: {
          type: "mrkdwn", 
          text: `${translation}` 
        }
      },
      {
        type: "context", 
        elements: [
          { type: "mrkdwn", text: `A translation of the original message to :${emoji}: _(${lang})_` }
        ] 
      },
    );
  } else {
    text = '_Sorry, the language is not supported!_ :persevere:';
    blocks.push(
      {
        type: "section", 
        text: {
          type: "mrkdwn", 
          text: `_Sorry, the language is not supported!_ :persevere:` 
        }
      }
    );
  }

  try {
    const result = await client.chat.postMessage({
      text,
      blocks,
      channel,
      thread_ts: ts
    });

    console.log(result);
  } catch (e) {
    console.log(e);
  }
};


(async () => {
  try {
    // Start your app
    await app.start();
    // eslint-disable-next-line no-console
    console.log('⚡️ Bolt app is running!');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unable to start App', error);
    process.exit(1);
  }
})();