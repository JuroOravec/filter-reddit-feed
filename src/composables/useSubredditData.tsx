import { useEffect, useState } from "react";
import cloneDeep from "lodash/cloneDeep";
import keyBy from "lodash/keyBy";
import sortBy from "lodash/sortBy";

import { getStorageItems, setStorageItems, StorageKey, watchItemStorageChange } from "../utils/storage";
import { computeUpdatedSubredditFeeds, constructStorageSubredditFeeds, parseStorageSubredditFeeds, SubredditFeed } from "../models/subredditFeed";
import { parseStorageSubreddits, Subreddit } from "../models/subreddit";

/** Colocated info on subreddit and its feed */
export interface SubredditData {
  subreddit: Subreddit;
  subredditFeed: SubredditFeed;
}

export interface UseSubredditData {
  subredditData: Readonly<SubredditData[]>;
  isLoadingSubreddits: Readonly<boolean>;
  updateSubredditFeedFrequency: (input: { internalId: string, frequency: number }) => void;
}

const useSubredditData = (): UseSubredditData => {
  const [isLoadingSubreddits, setIsLoadingSubreddits] = useState<boolean>(true);
  const [subreddits, setSubreddits] = useState<Subreddit[]>([]);
  const [subredditFeeds, setSubredditFeeds] = useState<SubredditFeed[]>([]);

  useEffect(() => {
    // Get initial data from the storage
    getStorageItems({
      [StorageKey.subreddits]: '',
      [StorageKey.subredditFeeds]: '',
    }).then(({
      [StorageKey.subreddits]: newSubredditsCsv,
      [StorageKey.subredditFeeds]: newSubredditFeedsCsv,
    }) => {
      const newSubreddits = parseStorageSubreddits(newSubredditsCsv) ?? [];
      setSubreddits(newSubreddits);
      const newSubredditFeeds = parseStorageSubredditFeeds(newSubredditFeedsCsv) ?? [];
      setSubredditFeeds(newSubredditFeeds);

      setIsLoadingSubreddits(false);
    })
      .catch((e) => {
        console.error(e);
      });

    // Update local data on storage change
    const stopWatchStorage = watchItemStorageChange({
      [StorageKey.subreddits]: async (newSubredditsCsv, oldSubreddits, area) => {
        if (area !== 'sync') return;
        const newSubreddits = parseStorageSubreddits(newSubredditsCsv) ?? [];
        setSubreddits(newSubreddits);
      },

      [StorageKey.subredditFeeds]: async (newSubredditFeedsCsv, oldSubredditFeeds, area) => {
        if (area !== 'sync') return;
        const newSubredditFeeds = parseStorageSubredditFeeds(newSubredditFeedsCsv) ?? [];
        setSubredditFeeds(newSubredditFeeds);
      },
    });

    return stopWatchStorage;
  }, []);

  const updateSubredditFeeds = (newSubredditFeeds: SubredditFeed[]): void => {
    const subredditFeedsCsv = constructStorageSubredditFeeds(newSubredditFeeds);
    setStorageItems({ [StorageKey.subredditFeeds]: subredditFeedsCsv }).then(() => {
      setSubredditFeeds(newSubredditFeeds);
    });
  };

  const updateSubredditFeedFrequency = (input: { internalId: string, frequency: number }): void => {
    const { internalId, frequency } = input;

    const updatedSubredditFeeds: SubredditFeed[] = computeUpdatedSubredditFeeds(
      subredditFeeds,
      { internalId },
      { configFrequency: frequency }
    );
    updateSubredditFeeds(updatedSubredditFeeds);
  };

  const sortedSubreddits: Subreddit[] = sortBy(subreddits, (subreddit) => subreddit.subredditName);
  const subredditFeedsById = keyBy(subredditFeeds, (feed) => feed.internalId);
  const subredditData: SubredditData[] = sortedSubreddits.reduce<SubredditData[]>((acc, subreddit) => {
    const subredditFeed = subredditFeedsById[subreddit.internalId];
    if (subredditFeed) {
      acc.push({ subreddit, subredditFeed });
    }
    return acc;
  }, []);

  return {
    subredditData,
    updateSubredditFeedFrequency,
    isLoadingSubreddits,
  };
};

export default useSubredditData;
