import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

// 로컬 에뮬레이터 접속 — `NEXT_PUBLIC_FIREBASE_EMULATORS=1` 이고 프로덕션 빌드가 아닐 때만.
// 카카오 로그인은 실제 카카오 콘솔·도메인이 있어야 해서 로컬에서 로그인한 화면(받은 이용권 등)을
// 열어볼 방법이 없었다. 에뮬레이터를 붙이면 커스텀 토큰으로 가짜 유저를 만들어 볼 수 있다.
// window.__devSignIn 은 그 커스텀 토큰을 주입하는 창구다(브라우저 자동화/수동 확인용).
if (process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1" && process.env.NODE_ENV !== "production") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  if (typeof window !== "undefined") {
    (window as unknown as { __devSignIn?: (token: string) => Promise<unknown> }).__devSignIn = (token) =>
      signInWithCustomToken(auth, token);
  }
}
