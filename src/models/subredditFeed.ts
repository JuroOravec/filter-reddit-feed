import Papa from 'papaparse';
import cloneDeep from 'lodash/cloneDeep';

interface StoredSubredditFeed {
  internalId: string;
  configFrequency: number;
  statTotal: number;
  statSkips: number;
};

export interface SubredditFeedConfig {
  frequency: number;
}

export interface SubredditFeed {
  internalId: string;
  config: SubredditFeedConfig;
  stats: SubredditFeedStats;
}

export interface SubredditFeedStats {
  /** Total number of times we encoutered posts of this subreddit */
  total: number;
  /** Number of times the subreddit post was skipped (not shown) */
  skips: number;
}

export const configDefaults: Readonly<Required<SubredditFeedConfig>> = {
  frequency: 1,
};

export const createSubredditFeedConfig = ({ internalId }: { internalId: string }): SubredditFeed => ({
  internalId,
  config: { ...configDefaults },
  stats: { total: 0, skips: 0 },
});

const CSV_DELIMETER = ',';
const CSV_NEWLINE = '\n';

const parseFloatFromCsv = (val: string | number, defaultVal: number = 0): number => {
  const numVal = Number.parseFloat(val as string);
  return Number.isNaN(numVal) || !Number.isFinite(numVal) ? defaultVal : numVal;
}

/**
 * Store a list of configs describing subreddit feeds as a csv.
 */
export const constructStorageSubredditFeeds = (subredditFeeds: SubredditFeed[]): string => {
  const subredditFeedData = subredditFeeds.map(({ internalId, config, stats }): StoredSubredditFeed => ({
    internalId,
    configFrequency: config.frequency,
    statTotal: stats.total,
    statSkips: stats.skips,
  }));
  const csv = Papa.unparse(subredditFeedData, { delimiter: CSV_DELIMETER, newline: CSV_NEWLINE });
  return csv;
};

/**
 * Parse subreddit feeds from storage csv.
 */
export const parseStorageSubredditFeeds = (data?: string): SubredditFeed[] => {
  if (!data) return [];

  const { errors, data: results } = Papa.parse<StoredSubredditFeed>(data, { header: true, delimiter: CSV_DELIMETER, newline: CSV_NEWLINE });
  if (errors?.length) throw errors[0];

  return results.map(({ internalId, configFrequency, statTotal, statSkips }): SubredditFeed => ({
    internalId,
    config: { frequency: parseFloatFromCsv(configFrequency, 1) },
    stats: { skips: parseFloatFromCsv(statSkips, 0), total: parseFloatFromCsv(statTotal, 0) },
  }));
};

/**
 * Decide whether the given subreddit post should be skipped or not
 * based on the stats and desired frequency
 */
export const shouldSkipFeedPost = (subredditFeed: SubredditFeed): boolean => {
  const { config, stats } = subredditFeed;

  const currFreq = 1 - (stats.skips / stats.total);
  const shouldSkip = currFreq > config.frequency;
  return shouldSkip;
};

/** Compute the next subredditsFeeds state given the changes (reducer) */
export const computeUpdatedSubredditFeeds = (
  subredditFeeds: SubredditFeed[],
  id: { internalId: string },
  changes: { configFrequency?: number, statsSkips?: number, statsTotal?: number }
): SubredditFeed[] => {
  const { internalId } = id;
  const { configFrequency, statsSkips, statsTotal } = changes;

  const subredditFeed = subredditFeeds.find((feed) => feed.internalId === internalId);
  if (!subredditFeed) return subredditFeeds;

  // Make deep copy with updated state
  const newSubredditFeeds = subredditFeeds.map((feed) => {
    if (feed.internalId !== internalId) return feed;

    const feedCopy = cloneDeep(feed);
    feedCopy.config.frequency = configFrequency ?? feedCopy.config.frequency ?? 1;
    feedCopy.stats.skips = statsSkips ?? feedCopy.stats.skips ?? 0;
    feedCopy.stats.total = statsTotal ?? feedCopy.stats.total ?? 0;

    return feedCopy;
  });

  return newSubredditFeeds;
};
