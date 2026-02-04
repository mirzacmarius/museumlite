"use client";

type GlobalWithLocalStorage = typeof globalThis & { localStorage?: Storage };

const globalWithStorage: GlobalWithLocalStorage = globalThis;
const storage = globalWithStorage.localStorage;

if (storage && typeof storage.setItem !== "function") {
  const memoryStorage = new Map<string, string>();

  const stubStorage: Storage = {
    getItem: (key) => memoryStorage.get(key) ?? null,
    setItem: (key, value) => {
      memoryStorage.set(key, value);
    },
    removeItem: (key) => {
      memoryStorage.delete(key);
    },
    clear: () => {
      memoryStorage.clear();
    },
    key: (index) => Array.from(memoryStorage.keys())[index] ?? null,
    get length() {
      return memoryStorage.size;
    },
  };

  globalWithStorage.localStorage = stubStorage;
}
