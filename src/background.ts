import sortBy from 'lodash/sortBy';
import unionBy from 'lodash/unionBy';
import find from 'lodash/find';

import { MessageType, receiveMessage } from "./utils/message";
import { getStorageItems, setStorageItems, StorageKey, watchItemStorageChange } from "./utils/storage";
import { constructStorageSubreddits, mergeSubreddits, parseStorageSubreddits, Subreddit } from './models/subreddit';
import {
  constructStorageSubredditFeeds,
  createSubredditFeedConfig,
  parseStorageSubredditFeeds,
  SubredditFeed
} from './models/subredditFeed';
import type { ParsedSubreddit } from './contentScript/getSubreddits';

const stopWatchStorage = watchItemStorageChange({
  /**
   * When the list of user's subreddits change, we prune / update the list
   * of subreddit feed data (user preference + stats)
   */
  [StorageKey.subreddits]: async (newSubreddits, oldSubreddits, area) => {
    if (area !== 'sync') return;

    const { [StorageKey.subredditFeeds]: oldSubredditFeedsCsv } = await getStorageItems({ [StorageKey.subredditFeeds]: '' });
    const oldSubredditFeeds = parseStorageSubredditFeeds(oldSubredditFeedsCsv);

    const newSubredditFeeds: SubredditFeed[] = parseStorageSubreddits(newSubreddits).map(({ internalId }) => {
      const oldSubredditFeed = find(oldSubredditFeeds, { internalId });
      return oldSubredditFeed ?? createSubredditFeedConfig({ internalId });
    }) ?? [];

    // Keep the old and add the new configs
    const mergedSubredditFeeds = sortBy<SubredditFeed>(
      unionBy<SubredditFeed>(oldSubredditFeeds, newSubredditFeeds, (feed) => feed.internalId),
      (feed) => feed.internalId
    );

    await setStorageItems({
      [StorageKey.subredditFeeds]: constructStorageSubredditFeeds(mergedSubredditFeeds),
    });
  },

  // Update the badge count based on how many subreddits were detected
  [StorageKey.subredditFeeds]: (newSubredditFeedsCsv, _, area) => {
    if (area !== 'sync') return;

    const subredditFeeds = parseStorageSubredditFeeds(newSubredditFeedsCsv ?? '');
    chrome.browserAction.setBadgeText({ text: subredditFeeds.length.toString() });
  }
});


////////////////////////////////////////////////////////////////////////
// MESSAGING
////////////////////////////////////////////////////////////////////////

const stopWatchMessage = receiveMessage({
  // Store user's subreddits on user's storage
  [MessageType.didObtainSubreddits]: async (message, sender, sendResponse) => {
    const { [StorageKey.subreddits]: oldSubredditsCsv } = await getStorageItems({ [StorageKey.subreddits]: '' });
    debugger;
    const oldSubreddits: Subreddit[] = oldSubredditsCsv ? parseStorageSubreddits(oldSubredditsCsv) : [];
    const newSubreddits: ParsedSubreddit[] = message.payload?.subreddits ?? [];

    const mergedSubreddits = mergeSubreddits(newSubreddits, oldSubreddits);
    const newSubredditsCsv = constructStorageSubreddits(mergedSubreddits);

    setStorageItems({
      [StorageKey.subreddits]: newSubredditsCsv,
    });
  },
}, {
  broadcastUnhandledMessages: true
});
