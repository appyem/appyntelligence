import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDEYjuX4Aqkz18fm7KE81COjI0KhiptvPk",
  authDomain: "appynteligencia-184e3.firebaseapp.com",
  projectId: "appynteligencia-184e3",
  storageBucket: "appynteligencia-184e3.firebasestorage.app",
  messagingSenderId: "1039583872474",
  appId: "1:1039583872474:web:26888283f025ea668a2ce3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
import { getStorage } from "firebase/storage";
export const storage = getStorage(app);
export default app;
