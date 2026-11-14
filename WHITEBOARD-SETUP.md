# iLiam Whiteboard

Open `other.html` → **OPEN WHITEBOARD**, or `whiteboard.html`.

## What works without Firebase setup

The whiteboard itself works locally, including pen, highlighter, eraser, line, arrow, rectangle, ellipse, text, sticky notes, brush colors and thickness, a grid and paper color, zoom/pan, keyboard shortcuts, undo/redo, and clearing the board. Your local draft autosaves in the current browser using `localStorage`.

**Export options**: PNG image, SVG vector graphic, and editable `.iliamboard` JSON project file. Import `.iliamboard` files through the file menu. These are whiteboard files, not Google Docs, Microsoft Word, or Adobe formats.

## Shared whiteboard rooms and privacy

1. Sign in with your iLiam account through Community.
2. Open **Other → Whiteboard → Collaborate → Create shared board**. New boards start **Restricted**.
3. Under **General access**, choose:
   - **Restricted** — only the board owner and specifically invited iLiam accounts can view and edit.
   - **Anyone with the link** — anyone who knows the link can **view**, even without signing in; anyone signed in with an iLiam account and the link can **edit**.
4. To invite an iLiam account, type their username or nickname in **Invite an iLiam account**, choose **Invite**, and optionally send them the link. You can **Remove** an invited account later. Up to 20 invitees.
5. Invited users can open Whiteboard → **Collaborate → Shared with me** to discover boards shared directly with them. Board owners can find their rooms under **Your shared boards**.
6. Click **Copy link** to share `whiteboard.html?board=<32-character-code>`. A restricted board *cannot* be opened with the link alone by uninvited users.
7. Pens and shapes sync after each completed stroke; multiple participants can collaborate.

**Privacy:** Firestore rules enforce access separately on board documents and their drawing elements. Simply hiding the board in the interface does not grant privacy, so the latest rules must be published. The code is a random 128-bit value; publicly sharing it gives people access under the board's public-link settings.

The board owner alone can change General access, invite/remove accounts, rename the shared board, change its paper color, and clear all drawings. Old shared boards without an access-mode field retain the previous *signed-in users with the link* behavior until the owner chooses Restricted or Anyone with the link.

This is iLiam account sharing, modeled on Google Docs. Inviting a Gmail address directly or signing in with Google OAuth is **not** included. Shared editing uses Firestore; there is no automatic email/push invitation.

### REQUIRED: publish Firestore rules

The new `match /whiteboards/{boardId}` rules and its nested `/elements/{elementId}` rules are committed to this repository's `firestore.rules`. **GitHub Pages does not publish Firebase rules.** Open the Firebase Console for project `iliam-4d0c9`, navigate to Firestore Database → Rules, paste the complete latest repository rules, and click Publish.

If the updated rules have not been published, local drawing and export remain available, but new sharing settings, account invitations, and the Shared with me list will fail with Firebase permission errors.

### Notes and limits

- This is a first-version collaborative board, not Google Docs, Sheets, or Slides. Those would be separate applications and need more extensive editors and file-format support.
- Shared editing uses Firestore writes; lots of large drawings can incur Firebase usage and costs.
- The whiteboard shows the latest synced drawings, and local Undo affects your recent actions; simultaneous edits from different users may need retrying if a connection drops.
- Shared rooms require an active internet connection, and existing rooms are persistent rather than automatically expiring.
- There is no per-user invitation approval, comment-only role, or moderator panel. An invited user has editing permission. Only share public edit links with trusted people.
- JavaScript syntax and required element IDs were checked. **The Firestore room flow still needs a live test with two signed-in accounts after publishing the rules.**
