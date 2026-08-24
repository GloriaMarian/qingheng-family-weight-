"use client";

import { EMPTY_STATE, type AppState } from "./types";

const DB_NAME = "qingheng-weight-journal";
const STORE_NAME = "state";
const STATE_KEY = "app-state-v1";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadState(): Promise<AppState> {
  if (typeof indexedDB === "undefined") return EMPTY_STATE;
  try {
    const db = await openDb();
    return await new Promise<AppState>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = () => {
        const saved = request.result as AppState | undefined;
        resolve(saved ? { ...saved, exercises: saved.exercises ?? [] } : EMPTY_STATE);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return EMPTY_STATE;
  }
}

export async function saveState(state: AppState) {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(state, STATE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearState() {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(STATE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
