# iLiam Whiteboard

Open `other.html` → **OPEN WHITEBOARD**, or `whiteboard.html`.

## What works without Firebase setup

The whiteboard itself works locally, including pen, highlighter, eraser, line, arrow, rectangle, ellipse, text, sticky notes, brush colors and thickness, a grid and paper color, zoom/pan, keyboard shortcuts, undo/redo, and clearing the board. Your local draft autosaves in the current browser using `localStorage`.

**Export options**: PNG image, SVG vector graphic, and editable `.iliamboard` JSON project file. Import `.iliamboard` files through the file menu. These are whiteboard files, not Google Docs, Microsoft Word, or Adobe formats.

## Shared whiteboard rooms

1. Sign in using your iLiam account in Community.
2. Return to the Whiteboard and click **👥 Collaborate**.
3. Click **Create shared board**. Any existing local shapes and strokes are copied into the new room.
4. Use **Copy invite link** or **Copy code** to invite friends.
5. Friends sign in with their own iLiam accounts, open the link or paste the code, and edit the same board.
6. Strokes and shapes sync across devices **when a stroke is finished**. It is not a full live-cursor system.

The URL contains the room code: `whiteboard.html?board=<code>`. The code uses 128 random bits (32 lowercase hex characters). Share it privately. Any signed-in iLiam account *with the code* can view, add to, and erase the shared board; the code itself is the access mechanism. The creator alone can change the shared title, paper color, and clear all drawings. The room is not publicly listed. Persistent room data is stored in the Firestore `whiteboards/{roomId}` collection and each drawing in `whiteboards/{roomId}/elements`. The whiteboard does **not** upload camera data or media.

### REQUIRED: publish Firestore rules

The new `match /whiteboards/{boardId}` rules and its nested `/elements/{elementId}` rules are committed to this repository's `firestore.rules`. **GitHub Pages does not publish Firebase rules.** Open the Firebase Console for project `iliam-4d0c9`, navigate to Firestore Database → Rules, paste the complete latest repository rules, and click Publish.

If you haven't published them yet, local drawing and export still work, but shared-room creation and joining will fail with Firebase permission errors.

### Notes and limits

- This is a first-version collaborative board, not Google Docs, Sheets, or Slides. Those would be separate applications and need more extensive editors and file-format support.
- Shared editing uses Firestore writes; lots of large drawings can incur Firebase usage and costs.
- The whiteboard shows the latest synced drawings, and local Undo affects your recent actions; simultaneous edits from different users may need retrying if a connection drops.
- Shared rooms require an active internet connection, and existing rooms are persistent rather than automatically expiring.
- In this release, there is no per-user invite approval or moderator panel. Only give codes to trusted friends.
- JavaScript syntax and required element IDs were checked. **The Firestore room flow still needs a live test with two signed-in accounts after publishing the rules.**
