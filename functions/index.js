// Event-driven iLiam post retention. Requires Firebase Blaze + deployment.
// Existing GitHub Actions scheduled cleanup remains active until this is deployed.
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();
const ACTIVE_POSTS = 50;
const LEGACY_POSTS = 200;
const PAGE_SIZE = 300;

// Triggered only by a new post, never by archiving/updating/deleting posts.
// At-least-once delivery is safe: already-archived posts are skipped.
exports.cleanupPostsOnCreate = onDocumentCreated(
  {
    document: "posts/{postId}",
    region: "us-central1",
    maxInstances: 1,
    concurrency: 1,
    retry: false
  },
  async () => {
    const posts = db.collection("posts");
    const count = await posts.count().get();
    if (count.data().count <= ACTIVE_POSTS) return;

    let cursor = null;
    let rank = 0;
    let archived = 0;
    let deleted = 0;

    while (true) {
      let q = posts.orderBy("createdAt", "desc").limit(PAGE_SIZE);
      if (cursor) q = q.startAfter(cursor);
      const page = await q.get();
      if (page.empty) break;
      cursor = page.docs[page.docs.length - 1];

      for (const post of page.docs) {
        const index = rank++;
        if (index < ACTIVE_POSTS) continue;

        if (index >= ACTIVE_POSTS + LEGACY_POSTS) {
          await db.recursiveDelete(post.ref);
          deleted++;
          continue;
        }

        const data = post.data();
        if (data.legacy === true) continue;
        await db.recursiveDelete(post.ref.collection("votes"));
        await db.recursiveDelete(post.ref.collection("comments"));
        // Replace the document, removing counts, attachments, and interactive metadata.
        await post.ref.set({
          uid: String(data.uid || ""),
          username: String(data.username || "unknown"),
          text: String(data.text || ""),
          createdAt: data.createdAt,
          legacy: true
        });
        archived++;
      }
    }
    console.log(`Post retention: ${archived} archived; ${deleted} deleted`);
  }
);
