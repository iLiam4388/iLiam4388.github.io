# iLiam Calls — setup and testing

The Community page includes account-to-account **Audio Call** and **Video Call** controls.

## Before using calls

1. Publish the repository's latest [firestore.rules](./firestore.rules) in the Firebase console for project `iliam-4d0c9`: Firestore Database → Rules → paste → **Publish**. GitHub Pages does not publish Firestore rules.
2. Wait for GitHub Pages to deploy the latest Community files.
3. Open Community in **two separate browsers/devices**, signed in with **two different iLiam accounts** that have saved `profiles/{uid}` documents.
4. Both users must keep Community open. On one account click **CALL SOMEONE**, select the other account, and click **Audio Call** or **Video Call**.
5. On the other account accept the incoming call. Allow microphone/camera access when your browser requests it.

## How it works

- Firebase Authentication supplies the same sign-in used by Community; no additional credentials are required.
- Firestore's `calls` collection contains invitation status, WebRTC offer/answer, and ICE candidates. **Audio/video media does not get uploaded to Firestore.**
- WebRTC sends the audio/video stream between peers when a route can be established. Included STUN servers do not guarantee calls across all firewalls or mobile networks.
- The browser must remain open to receive calls; background push ringing is not implemented.
- For reliable cross-network calling, configure a TURN server with secure, short-lived credentials and add it to the `iceServers` configuration in `community-calls.js`. Do **not** put permanent TURN secrets in a public GitHub repository.

## Troubleshooting

- **Permission denied / missing permissions:** Publish the updated Firestore rules.
- **The button stays disabled:** Sign in through Community and confirm the account has a profile.
- **Calls do not connect:** Make sure both browsers have microphone permissions and test on the same network first. A TURN service may be necessary on different networks.
- **No incoming call:** Both users must be signed in, with Community open. Calls currently ring only on that page.
- **Camera doesn't work:** Use HTTPS and allow browser camera permissions.

This is an initial one-to-one calling feature, not a production-grade FaceTime replacement. It has not been end-to-end tested with two real accounts/devices yet.

## Temporary group calls (up to four people)

The Community **GROUP CALL** button lets the caller select up to three other accounts and choose **Group Audio** or **Group Video**. These are one-time call rooms; there are no persistent named groups.

Every invitee sees an invitation in Community, and must accept before microphone/camera streams begin. WebRTC forms separate peer-to-peer links among accepted participants. An invitee can decline without ending the call for everybody; the host can end the whole room.

The `groupCalls` collection, `members`, `connections`, and ICE candidate subcollections require the newest `firestore.rules` file to be published in Firebase. Both the ordinary **CALL SOMEONE** button and group calls coexist.

Limits and cautions:
- This first release is **four people total maximum**, including the caller; larger calls would need a media server/SFU.
- Camera/microphone permissions are requested for each participating device.
- Browsers must keep the Community page open; no push notifications when the page is closed.
- Group calls use STUN and a peer-to-peer mesh without a TURN relay; some carrier and school networks may not connect reliably.
- Calls use secure connections, but this has not yet been verified with a real four-person group test.
- Firestore call-room and signaling records are not automatically deleted after calls finish. Add Firebase TTL cleanup or a scheduled backend job if usage grows.

**Test:** Publish updated rules; use two different accounts on two devices to start a group call (then add a third and fourth). Confirm accept, decline, mute, camera off, and host end work as expected.

## Screen sharing (desktop video calls)

During an **iLiam video call**, choose **🖥 Share screen**, then select a desktop screen, browser tab or application window in your browser's permission chooser. The outgoing camera video is temporarily replaced by the chosen screen for the other participant(s). Choose **⏹ Stop sharing** or use the browser's native **Stop sharing** control to return to your camera. Hanging up also releases screen capture.

- Works in the main 1–4-person WebRTC video-call interface and legacy one-to-one video calls.
- It uses `navigator.mediaDevices.getDisplayMedia()` and WebRTC `RTCRtpSender.replaceTrack()`. The browser prompts every time; no Firebase rules or extra database fields are required.
- **Video calls only** for this version: audio-only calls do not negotiate a video sender. Screen audio and system audio are not shared.
- Desktop browsers with Screen Capture API support (such as current Chromium-based Chrome, Edge or Opera) are the primary targets. Many mobile browsers do not offer web screen sharing.
- If an existing network/browser cannot replace the outgoing video track, the UI shows an error. Screen sharing has not yet been verified in a live multi-device call.


## Ringtones, actionable notifications, and Picture-in-Picture

The **Call Someone** panel now has **🔔 Enable call notifications**. This requests browser notification permission and registers `iliam-call-sw.js` for actionable notifications on supported desktop browsers.

When an incoming call arrives, a simple two-tone ringtone plays if the browser has permitted audio playback after a user interaction. An on-page call banner provides **Accept** and **Decline**. If browser notifications are granted and the tab is in the background, a system notification is requested with Accept and Decline actions (display of action buttons depends on browser/OS support). The browser notification opens or focuses Community; accepting tries to join the call there. Permissions may still be needed.

**Across iLiam pages:** `iliam-sitewide-calls.js` is loaded on the Home, Videos, Photos, Downloads, Games, Store, Other, 2D Rider, and 3D Rider pages. Calls can ring there without navigating to Community first. The original page can stay open while accepting in a separate Community tab. Incoming calls also ring when an iLiam page is open in a background browser tab and the user is viewing another website.

**Important limits:**
- This is **not full background web push**. When every iLiam tab is closed, JavaScript and Firestore listeners are no longer running. True closed-site notifications require configuring Firebase Cloud Messaging/Web Push, a VAPID key, storing permitted device tokens, and a trusted server/Cloud Function that sends push notifications. GitHub Pages alone cannot securely send that push.
- Browsers may prevent automatic audio until the user has clicked or pressed a key on the site. The ringtone may therefore be silent the first time.
- **▣ Picture in Picture** is available during video calls where the browser supports it. This floats a video above other tabs/windows while the Community tab remains open; audio calls keep playing in the background but have no video PiP window. The call ends if the Community call tab closes.
- Browser support for system-notification buttons and Picture-in-Picture differs. Try Opera GX on Windows first; if a feature isn't supported, use the visible in-page controls.
- No additional Firestore rules are required for these UI changes. End-to-end acceptance, ringtone playback and system-notification action handling have not been live-tested across two devices.
