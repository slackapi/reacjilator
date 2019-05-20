# Reacjilator for Slack

Reacjilator は Slack 用のボットで、ユーザからのリアクション絵文字（「リアク字」）に反応してそのリアクションのあったメッセージを翻訳します。たとえば英語のメッセージにたいして `:flag-jp:` のリアク字がつけられると即時にそのメッセージの日本語の翻訳がスレッドに表示されます。

![Reacjilator demo](tutorial_images/reacjilator-demo.gif)



## 自分の Slack Workspace でこのアプリを動かすには

### Slack アプリ設定

1. [api.slack.com/apps](https://api.slack.com/apps): でアプリを作成
2. Event Subscription をオンにする。必要な Bot イベントは `reaction_added` で Request URL は `https://自前のサーバ.com/events` へポイントする。(Glitch server: `http://your-glitch-project.glitch.me/events`)
3. 下記のスコープをオンに追加する。
 - "chat:write:bot" (Send messages with chat.postMessage by a bot),
 - "reactions:read" (Access the workspace’s emoji reaction history)
 - "channels:read" (Access public channels info)
 - "*:history" (Access user's  channels)
4. アプリをインストールし、user token `xoxp-` を取得

### 認証キー

まず `.env_test` ファイルネームを `.env` に書き換え、必要な認証キーなどの情報を入力してください。

```
SLACK_SIGNING_SECRET=
SLACK_ACCESS_TOKEN=
GOOGLE_PROJECT_ID=
GOOGLE_KEY=
```

Slack の認証キーなどは設定画面の **Basic Information** から、 auth token は **OAuth & Permissions** から。

翻訳の API で使う、Google Cloud project ID と API も自前で準備してください。 [cloud.google.com/translate/docs/getting-started](https://cloud.google.com/translate/docs/getting-started)


## Deployment Examples

### Deploy on Google Cloud Functions

このプロジェクトの `google-cloud-functions` ブランチを参照してください。

### Deploy on Heroku

もしくは、下の Heroku ボタンを使って Heroku サーバにデプロイするのならば、`.env` ファイルを使わず、フォームに入力することによってそのままでブロイ可能です。 

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/slackAPI/reacjilator)

*Heroku にデプロイした場合、Slack アプリ設定ページの **Event Subscription** で入力する Request URLは `https://the-name-you-picked.herokuapp.com/events`* のようになります。
