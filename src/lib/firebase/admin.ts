import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const adminApp =
  getApps()[0] ??
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    serviceAccountId: process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL,
  });

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
