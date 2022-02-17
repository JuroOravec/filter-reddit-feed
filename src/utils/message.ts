import type { ParsedSubreddit } from "../contentScript/getSubreddits";
import { withErrorHandle } from "./error";

type EventListenerCallback<TEvent extends chrome.events.Event<any>> = Parameters<TEvent['addListener']>[0];

type _OnRuntimeMessageCallback = EventListenerCallback<chrome.runtime.ExtensionMessageEvent>;
type _OnRuntimeMessageCallbackParams = Parameters<_OnRuntimeMessageCallback>;

/**
 * Modified callback that's passed to chrome.runtime.onMessage.addListener.
 * 
 * This one can infer the shape of the message based on the MessageType.
 */
type OnRuntimeMessageCallback<T extends MessageType> =
  (
    message: Message<T>,
    sender: _OnRuntimeMessageCallbackParams[1],
    sendResponse: (response?: MessageResponse<T>['payload']) => void
  ) => void;

type StopHandle = () => void;

/** Message types sent between extension compartments (content / background / popup / options) */
export enum MessageType {
  didObtainSubreddits = "filter-reddit-feed:didObtainSubreddits",
}

interface DidObtainSubredditsMessageData {
  subreddits: ParsedSubreddit[];
}

/** Mapping of MessageType enum to data type that we expect */
interface _MessageTypeToData {
  [MessageType.didObtainSubreddits]: DidObtainSubredditsMessageData;
}

/** Mapping of MessageType enum to data type that we expect */
interface _MessageTypeToResponse {
  [MessageType.didObtainSubreddits]: void;
}

/** Message sent between extension compartments (content / background / popup / options) */
export interface Message<T extends MessageType = any> {
  messageType?: T;
  payload?: _MessageTypeToData[T];
}

/** Message response sent back from a listener that called sendResponse */
export interface MessageResponse<T extends MessageType = any> {
  messageType?: T;
  payload?: _MessageTypeToResponse[T];
}

/**
 * Infer message type based on the MessageType.
 *
 * @example
 * const x: Message = {};
 *
 * if (isMessage(x, MessageType.didUpdateSubredditFeeds)) {
 *   console.log(x.payload.isIcon); // `x.payload` is inferred as DidUpdateSubredditFeedsMessageData
 * }
 */
export const isMessage = <T extends MessageType>(
  data: Message,
  messageType: T
): data is Message<T> => {
  return data.messageType === messageType;
};

const constructMessage = <T extends MessageType>(
  messageType: T,
  payload: Message<T>['payload'],
): Message<T> => ({
  messageType,
  payload,
});

const constructMessageResponse = <T extends MessageType>(
  messageType: T,
  payload: MessageResponse<T>['payload'],
): MessageResponse<T> => ({
  messageType,
  payload,
});

/**
 * Wrapper for sending messages between different extension compartments.
 * Use this wrapper for traceability and type safefy.
 */
export const sendMessage = <T extends MessageType>(
  messageType: T,
  payload: Message<T>['payload'],
): Promise<MessageResponse<T>[]> => {
  const message: Message<T> = constructMessage(messageType, payload);

  // Send message to background script, popup page, and options page
  const runtimeSendMessagePromise: Promise<MessageResponse<T>> = new Promise((res, rej) => {
    chrome.runtime.sendMessage(message, (response: MessageResponse<T>) => {
      chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(response);
    });
  });

  if (!chrome.tabs) {
    return Promise.all([runtimeSendMessagePromise]);
  }

  // Given a tab, send message to the content script of that tab that tab
  const sendTabMessage = (tab: chrome.tabs.Tab): Promise<MessageResponse<T>> => new Promise((res, rej) => {
    chrome.tabs.sendMessage(tab.id!, message, (response: MessageResponse<T>) => {
      chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(response);
    });
  });

  // Send message to tabs with content scripts and wait for them all
  const tabsSendMessagePromise: Promise<MessageResponse<T>[]> = new Promise((res, rej) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // List of all promises of sending messages to active content scripts
      const tabsSendMessagePromises = tabs
        .filter((tab) => tab.id)
        .map(sendTabMessage);

      Promise.all(tabsSendMessagePromises).then(res).catch(rej);
    });
  });

  // Merge the promises into one so it can be awaited
  const mergedPromise: Promise<MessageResponse<T>[]> = Promise.all([runtimeSendMessagePromise, tabsSendMessagePromise] as const)
    .then(([runtimeResult, tabsResults]) => {
      return [runtimeResult, ...tabsResults];
    })

  return mergedPromise;
};

/**
 * Synchronous variant of sendMessage.
 * Wrapper for sending messages between different extension compartments.
 * Use this wrapper for traceability and type safefy.
 */
export const sendMessageSync = <T extends MessageType>(
  messageType: T,
  payload: Message<T>['payload'],
  /**
   * Callback on sent message. Callback is triggered once for runtime.sendMessage,
   * and for each tab the message is sent to.
   */
  callback?: (response: MessageResponse<T>) => void,
): void => {
  const message: Message<T> = constructMessage(messageType, payload);

  // Send message to background script, popup page, and options page
  chrome.runtime.sendMessage(message, callback);

  // Send message to content scripts
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.id) return;
      chrome.tabs.sendMessage(tab.id, message, callback);
    });
  });
};

/**
 * Wrapper for receiving messages between different extension compartments.
 * Use this wrapper for traceability and type safefy.
 */
export const receiveMessage = <T extends Partial<{ [Key in MessageType]: OnRuntimeMessageCallback<Key> }>>(
  listeners: T,
  options?: {
    /**
     * Whether the messages that were not processed should be re-emitted.
     * 
     * Popup and content script messages cannot communicate directly,
     * instead the message has to go via background script. Using this
     * option in background scripts allows popup to listen for events from
     * content script and vice versa.
     */
    broadcastUnhandledMessages?: boolean
  },
): StopHandle => {
  const { broadcastUnhandledMessages = false } = options ?? {};

  /** Actual callback called on chrome.runtime.onMessage */
  const onMessage: _OnRuntimeMessageCallback = (data: Message, sender, sendResponse) => {
    const { messageType, payload } = data ?? {};
    if (!messageType) return;

    if (chrome.runtime.lastError) {
      throw chrome.runtime.lastError;
    }

    const wrappedSendResponse = (response: unknown): void => {
      const messageResponse: MessageResponse = constructMessageResponse(messageType, response);
      sendResponse(messageResponse);
    };

    const listener = listeners[messageType as MessageType];
    listener?.(data, sender, wrappedSendResponse);

    if (broadcastUnhandledMessages && !listener) {
      // sendMessage has to be sent synchronously here. Otherwise we get
      // "Unchecked runtime.lastError: The message port closed before a response was received."
      sendMessageSync(messageType, payload);
    }

    return true; // Indicate that sendResponse can be called async
  };

  /** OnMessage callback with error handling. This is the function we pass to add/removeListener */
  const onMessageCallback = withErrorHandle(onMessage);
  chrome.runtime.onMessage.addListener(onMessageCallback);

  const removeCallback: StopHandle = () => {
    chrome.runtime.onMessage.removeListener(onMessageCallback);
  };

  return removeCallback;
};
