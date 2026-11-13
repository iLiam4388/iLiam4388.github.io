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

## November 2026 update: chat tools and notifications

- **Delete chat** hides the conversation from the signed-in user's inbox. It does **not** delete the shared message history or remove the conversation from other members' inboxes. Starting the same private chat again restores it to the user's inbox.
- **Edit group** lets a member rename an existing group and select a group picture from their device. The image is resized to a small JPEG data URL and stored with the chat document in Firestore. This does not expose or modify personal profile-picture controls.
- **Messages → Settings** offers a separate **Messages Do Not Disturb** checkbox and a private block list. Blocking a person stops new direct-message sends in either direction via security rules. In group chats the blocker hides that person's messages locally and suppresses their message alerts; other group members may still read them.
- **Enable browser notifications** requests the browser's Notification permission. New messages and incoming calls show in-page notices, with system notifications when permission is granted and the page is in the background. The Community page must remain open; this is not push delivery while the browser/site is closed.
- Existing **Calls Do Not Disturb** remains independent of Messages Do Not Disturb.
- **Important:** changes to `firestore.rules` must be **published manually in Firebase Console** before these new features will be allowed. GitHub commits do not deploy Firebase rules.

Testing suggestion: with two signed-in accounts, enable notifications, exchange messages, try DND on one side, block/unblock, edit a group picture/name, then delete a chat from just one inbox and verify that it still exists for the other person.

## Editing group membership

Inside a group conversation, select **✎ Edit group**. The group creator can search for accounts, tick people to add, untick members to remove, and choose **Save changes**. The creator must remain in the group and the total must be **2–4 members**.

Security rules permit only the **creator** to change the member list. Other members can still edit the group name/picture. Members removed from a chat lose access to that conversation under Firestore rules. **New members gain access to the existing message history**, so choose invitees carefully. Updating a group chat changes which accounts the conversation's Call button invites.

The latest `firestore.rules` must be published in Firebase Console before member editing can work; updating GitHub Pages alone does not deploy the rules.
