import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";

initializeApp();

export const ping = onRequest((req, res) => {
  res.json({ ok: true });
});
