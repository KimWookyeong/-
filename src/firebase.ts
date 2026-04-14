import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAdgzqWGyzExAEYSFeiVBHW9eDwuzdldIc",
  authDomain: "mugeum-daisy.firebaseapp.com",
  databaseURL: "https://mugeum-daisy-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mugeum-daisy",
  storageBucket: "mugeum-daisy.firebasestorage.app",
  messagingSenderId: "760821868154",
  appId: "1:760821868154:web:7bd7debd9bd50858cbbdc3",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);