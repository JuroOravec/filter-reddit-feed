import { withErrorHandle } from "./error";
import type { SubredditFeed } from "../models/subredditFeed";

type EventListenerCallback<TEvent extends chrome.events.Event<any>> = Parameters<TEvent['addListener']>[0];

type _OnStorageChangedCallback = EventListenerCallback<chrome.storage.StorageChangedEvent>;

/**
 * Modified version of chrome.storage.StorageChange.
 * 
 * This one can infer the old / new value type based on the StorageKey.
 */
interface StorageChange<T extends StorageKey> {
  /** Optional. The new value of the item, if there is a new value. */
  newValue?: Storage[T];
  /** Optional. The old value of the item, if there was an old value. */
  oldValue?: Storage[T];
}

type StorageChanges = { [Key in StorageKey]?: StorageChange<Key> };

/**
 * Modified callback that's passed to chrome.storage.onChanged.addListener.
 * 
 * This one can infer the old / new value type based on the StorageKey.
 */
type OnStorageChangedCallback<T extends StorageKey> =
  (
    newValue: StorageChange<T>['newValue'],
    oldValue: StorageChange<T>['oldValue'],
    areaName: chrome.storage.AreaName,
  ) => void;

type StorageChangeCallbacks = { [Key in StorageKey]: OnStorageChangedCallback<Key> };

type StopHandle = () => void;

/** Storage keys used in chrome.storage */
export enum StorageKey {
  subreddits = "StorageKey:subreddits",
  subredditFeeds = "StorageKey:subredditFeeds",
}

/** Mapping of StorageKey enum to data type that we expect */
interface Storage {
  [StorageKey.subreddits]: string;
  [StorageKey.subredditFeeds]: string;
}

/**
 * Wrapper for setting data to storage.
 * Use this wrapper for traceability and type safefy.
 */
export const setStorageItems = <TKeys extends StorageKey>(items: { [Key in TKeys]: Storage[Key] }): Promise<void> => {
  return new Promise((res, rej) => {
    chrome.storage.sync.set(items, () => {
      chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res();
    });
  });
};

/**
 * Wrapper for getting data from storage.
 * Use this wrapper for traceability and type safefy.
 */
export const getStorageItems = <TKeys extends StorageKey>(items: { [Key in TKeys]: Storage[Key] }): Promise<{ [Key in TKeys]: Storage[Key] }> => {
  return new Promise((res, rej) => {
    chrome.storage.sync.get(items, (response) => {
      chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(response as any);
    });
  });
};

/**
 * Wrapper for handling storage item changes.
 * Use this wrapper for traceability and type safefy.
 */
export const watchItemStorageChange = <T extends Partial<StorageChangeCallbacks>>(
  listeners: T,
): StopHandle => {
  /** Actual callback called on chrome.storage.onChanged */
  const onChanged: _OnStorageChangedCallback = async (changes: StorageChanges, area) => {
    const changedKeys = Object.keys(changes ?? {});
    if (!changedKeys.length) return;

    if (chrome.runtime.lastError) {
      throw chrome.runtime.lastError;
    }

    const listenerPromises = changedKeys.map((storageKey): Promise<any> => {
      const { newValue, oldValue } = changes?.[storageKey as StorageKey] as StorageChange<StorageKey> ?? {};

      const listener = listeners?.[storageKey as StorageKey] as OnStorageChangedCallback<StorageKey>;
      return Promise.resolve(listener?.(newValue, oldValue, area));
    });

    return Promise.all(listenerPromises);
  };

  /** OnChanged callback with error handling. This is the function we pass to add/removeListener */
  const onChangedCallback = withErrorHandle(onChanged);
  chrome.storage.onChanged.addListener(onChangedCallback);

  const removeCallback: StopHandle = () => {
    chrome.storage.onChanged.removeListener(onChangedCallback);
  };

  return removeCallback;
};
