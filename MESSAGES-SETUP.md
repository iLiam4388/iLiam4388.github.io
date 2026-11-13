# iLiam Messages (Community)

iLiam Messages is separate from Community posts and the standalone Call Someone picker.

## Features

- Sign in with the existing iLiam Community account.
- Use **Messages → Add user** to choose a person for a one-to-one chat, or two/three people for a group chat of up to **four total participants**.
- Group chats require a title. Messages load and update live in Firestore.
- In a conversation, press **Call**, then choose **Audio call** or **Video call**. This launches the existing call system with the conversation members preselected.
- **Call Settings** has **Edit** to manage blocked callers and a **Do Not Disturb** checkbox at the bottom.

## Firebase setup

GitHub Pages deploys the website, **not Firestore security rules**.

1. Open Firebase project `iliam-4d0c9` → Firestore Database → Rules.
2. Copy the repository's latest [firestore.rules](./firestore.rules), including `/chats/{chatId}` and `/messages/{messageId}`, and publish.
3. Sign in with two separate iLiam accounts, open Community → Messages in both browsers, and test a direct chat.
4. Create a 3- or 4-person group chat, test text delivery, then test the Audio/Video call menu.

### Privacy / limitations

Firestore security rules restrict chat reads to signed-in members and restrict new messages to those members. **Messages are not end-to-end encrypted**; trusted Firebase project administrators with backend access may still read them. Do not share sensitive information.

Messages and incoming calls only update while the website is open. Offline push notifications, typing indicators, file attachments, read receipts, and message retention cleanup are not implemented.

The app currently loads a limited set of accounts and the newest 100 messages per conversation. The UI and JavaScript were checked, but **live two-device tests and Firebase rule publishing are still required**.
