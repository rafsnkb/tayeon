// Browser shim for the design-sync bundle.
//
// The DS bundle is built from Next.js app code, which reads `process.env.*`
// at module scope (Next's own `__NEXT_*` feature flags, and the public
// Firebase config in @/lib/firebase/client). Browsers have no `process`, so
// without this the bundle throws `ReferenceError: process is not defined`
// before a single component mounts.
//
// Values are deliberate PLACEHOLDERS — never real credentials. The bundle is
// uploaded to claude.ai/design, so nothing secret may be baked into it. The
// Firebase keys exist only so `initializeApp` doesn't throw during import;
// no preview performs a real network call.
const env: Record<string, string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "ds-preview-placeholder",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "ds-preview.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "ds-preview",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "ds-preview.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "0",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:0:web:0",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-DSPREVIEW",
};

const g = globalThis as unknown as { process?: { env: Record<string, string>; cwd: () => string } };
if (!g.process) g.process = { env, cwd: () => "/" };

export {};
