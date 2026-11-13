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
