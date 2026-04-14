import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCpvAlYDQbx6WdBRdh-PHOoNyf5IRQIag4",
  authDomain: "fourseasons-runandmap.firebaseapp.com",
  databaseURL: "https://fourseasons-runandmap-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fourseasons-runandmap",
  storageBucket: "fourseasons-runandmap.firebasestorage.app",
  messagingSenderId: "738045125812",
  appId: "1:738045125812:web:0a2b3a28819e35d6cae3e1"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);