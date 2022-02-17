import getSubreddits from './contentScript/getSubreddits';
import watchNewPosts, { PostData, PostDataContext } from './contentScript/watchNewPosts';
import { MessageType, sendMessage } from './utils/message';
import querySelectorUntilFound from './utils/querySelectorUntilFound';
import { parseStorageSubreddits, parseSubredditUrl, Subreddit } from './models/subreddit';
import { getStorageItems, setStorageItems, StorageKey, watchItemStorageChange } from './utils/storage';
import { computeUpdatedSubredditFeeds, constructStorageSubredditFeeds, parseStorageSubredditFeeds, shouldSkipFeedPost, SubredditFeed } from './models/subredditFeed';

////////////////////////////////////////////////////////////////////////
// STATE
////////////////////////////////////////////////////////////////////////

let subreddits: Subreddit[] = [];
let subredditFeeds: SubredditFeed[] = [];

////////////////////////////////////////////////////////////////////////
// STATE MGMT
////////////////////////////////////////////////////////////////////////

// Get initial data from the storage
getStorageItems({
  [StorageKey.subreddits]: '',
  [StorageKey.subredditFeeds]: '',
}).then(({
  [StorageKey.subreddits]: newSubredditsCsv,
  [StorageKey.subredditFeeds]: newSubredditFeedsCsv,
}) => {
  subreddits = parseStorageSubreddits(newSubredditsCsv) ?? [];
  subredditFeeds = parseStorageSubredditFeeds(newSubredditFeedsCsv) ?? [];
})
  .catch((e) => {
    console.error(e);
  });

// Update local data on storage change
const stopWatchStorage = watchItemStorageChange({
  [StorageKey.subreddits]: async (newSubreddits, oldSubreddits, area) => {
    if (area !== 'sync') return;
    subreddits = parseStorageSubreddits(newSubreddits) ?? [];
  },

  [StorageKey.subredditFeeds]: async (newSubredditFeeds, oldSubredditFeeds, area) => {
    if (area !== 'sync') return;
    subredditFeeds = parseStorageSubredditFeeds(newSubredditFeeds) ?? [];
  },
});

const updateSubredditFeeds = (newSubredditFeeds: SubredditFeed[]): void => {
  subredditFeeds = newSubredditFeeds;
  const subredditFeedsCsv = constructStorageSubredditFeeds(newSubredditFeeds);
  setStorageItems({ [StorageKey.subredditFeeds]: subredditFeedsCsv });
};

////////////////////////////////////////////////////////////////////////
// MAIN EXEC
////////////////////////////////////////////////////////////////////////

// Emit subreddits info once user opens menu with subreddits
getSubreddits().then((subreddits) => {
  sendMessage(MessageType.didObtainSubreddits, { subreddits });
});

// Callback that defines what happens when a new post element is added
const onNewPost = ({
  subreddit,
  subredditFeed,
  wrapperElement,
  postElement
}: PostData) => {
  // Hide the post if we've seen more posts from that subreddit than we've specified
  // with the frequency.
  const shouldSkip = shouldSkipFeedPost(subredditFeed);

  if (shouldSkip) {
    // Uncomment this for debugging / presentation
    // (wrapperElement ?? postElement).style.opacity = '0.5';
    (wrapperElement ?? postElement)?.remove();
  }

  // Update the state
  const newSubredditFeeds = computeUpdatedSubredditFeeds(subredditFeeds, subredditFeed, {
    statsSkips: subredditFeed.stats.skips + (shouldSkip ? 1 : 0),
    statsTotal: subredditFeed.stats.skips + 1,
  })
  updateSubredditFeeds(newSubredditFeeds);
};

// Select the node that will be observed for mutations
querySelectorUntilFound<HTMLElement>('[class*="ListingLayout"]', 50)
  .then((postsContainer) => {
    // We need to access these inside watchNewPosts.
    // These values may change depending on `chrome.storage` and web URL changes.
    // At this point there's no reason to add a reactivity lib to this project,
    // so let's just pass a getter.
    const contextGetter = (): PostDataContext => {
      const currentSubreddit = parseSubredditUrl(window.location.href) ?? null;
      return { subreddits, subredditFeeds, currentSubreddit }
    };

    const unwatch = watchNewPosts(postsContainer, onNewPost, contextGetter);
  });
