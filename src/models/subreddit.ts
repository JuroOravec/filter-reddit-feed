import { ParsedSubreddit } from '@/contentScript/getSubreddits';
import differenceBy from 'lodash/differenceBy';
import keyBy from 'lodash/keyBy';
import max from 'lodash/max';
import Papa from 'papaparse';

export interface SubredditInfo {
  subredditId: string;
  subredditName: string;
  subredditUrl: string;
};

interface StoredSubreddit {
  internalId: string;
  rawName: string;
  isSubscribed: '1' | '0';
};

export interface Subreddit extends SubredditInfo {
  internalId: string;
  isSubscribed: boolean;
}

const SPECIAL_SUBREDDITS = ['r/all', 'r/popular'];
export const isIgnoredSubreddit = (subreddit: SubredditInfo): boolean => {
  return SPECIAL_SUBREDDITS.includes(subreddit.subredditName);
};

export const parseSubredditUrl = (inputSubredditUrl: string): SubredditInfo | null => {
  const subredditUrl = new URL(inputSubredditUrl.replace(/\s+/g, ''))

  // Find and set the part of url that ID's the subreddit, eg "/r/subredditName"
  const [minimalSubredditUrlPath] = subredditUrl.href.match(/\/r\/[^/#?%]+/g) ?? [null];
  if (!minimalSubredditUrlPath) return null;

  subredditUrl.pathname = minimalSubredditUrlPath;

  const subredditName = subredditUrl.pathname.replace(/^\/+/, '');
  const subredditId = subredditName.toLowerCase();

  const subreddit: SubredditInfo = {
    subredditId: subredditId,
    subredditName: subredditName,
    subredditUrl: subredditUrl.href,
  }

  // Ignore special subreddits names that don't actually map to a subreddit
  if (isIgnoredSubreddit(subreddit)) return null;

  return subreddit;
};

export const parseSubredditName = (subredditName: string): SubredditInfo | null => {
  const cleanSubredditName = subredditName.replace(/\s+/g, '').replace(/\/+$/, '').replace(/^\/+/, '');
  const subredditUrl = new URL(`https://www.reddit.com/${cleanSubredditName}`);

  return parseSubredditUrl(subredditUrl.href);
};

const CSV_DELIMETER = ',';
const CSV_NEWLINE = '\n';

/**
 * Store a list of subreddit names (with leading "r\" omitted) and their internal IDs as csv.
 * Eg ["r/all", "r/AskReddit", "r/Pokemon"] => "internalId,rawName\n0,all\n1,AskReddit\n2,Pokemon"
 */
export const constructStorageSubreddits = (subreddits: Subreddit[]): string => {
  const subredditData = subreddits.map(({ internalId, subredditName, isSubscribed }): StoredSubreddit => ({
    internalId,
    rawName: subredditName.replace(/^r\//, ''),
    isSubscribed: isSubscribed ? '1' : '0',
  }));
  const csv = Papa.unparse(subredditData, { delimiter: CSV_DELIMETER, newline: CSV_NEWLINE });
  return csv;
};

/**
 * Parse subreddit from storage csv.
 * Eg "internalId,rawName\n0,all\n1,AskReddit\n2,Pokemon" => ["r/all", "r/AskReddit", "r/Pokemon"]
 */
export const parseStorageSubreddits = (data?: string): Subreddit[] => {
  if (!data) return [];

  const { errors, data: results } = Papa.parse<StoredSubreddit>(data, {
    header: true,
    delimiter: CSV_DELIMETER,
    newline: CSV_NEWLINE
  });
  if (errors?.length) throw errors[0];

  return results.map(({ internalId, rawName, isSubscribed }) => ({
    ...parseSubredditName(`r/${rawName}`)!,
    internalId,
    isSubscribed: Number.parseInt(isSubscribed) === 1,
  }));
};

const subredditComparer = ({ subredditId }: SubredditInfo) => subredditId;
const subredditDifference = (subredditsA: SubredditInfo[], subredditsB: SubredditInfo[]): SubredditInfo[] =>
  differenceBy(subredditsA, subredditsB, subredditComparer);

/**
 * Merge and update two sets of subreddits. Returns the merged copy.
 *
 * The merge function assumes that newSubreddits is the new *current* set of subscribed subreddits.
 * So subreddits in newSubreddits as set as subscribed.
 * Similarly, the subreddits that were dropped going from old to new subreddits, those are set as unsubscribed.
 */
export const mergeSubreddits = (newSubreddits: ParsedSubreddit[], oldSubreddits: Subreddit[]): Subreddit[] => {
  // Flag existing subreddits as unsubscribed if they are not among the parsed ones
  /** Subreddits in old set but not in new set */
  const unsubscribedSubredditsById = keyBy(
    subredditDifference(oldSubreddits, newSubreddits),
    subredditComparer
  );
  /** Copy of the oldSubreddits but with updated state */
  const updatedOldSubreddits: Subreddit[] = oldSubreddits.map((subreddit): Subreddit => ({
    ...subreddit,
    isSubscribed: !unsubscribedSubredditsById[subreddit.subredditId],
  }));

  // Note: Tho we pass the ID as string, here we recognize that currently it's autoincremented int
  // So we find the next highest integer that won't interfere with existing IDs
  const highestInternalIdInOldSubreddits = max(
    oldSubreddits.map(({ internalId }) => {
      const numVal = Number.parseInt(internalId);
      return Number.isNaN(numVal) || !Number.isFinite(numVal) ? 0 : numVal;
    })
  ) ?? 0;

  // Add new subreddits that are not among the existing ones
  const updatedNewSubreddits: Subreddit[] = subredditDifference(newSubreddits, oldSubreddits)
    .map((subreddit, index): Subreddit => ({
      ...subreddit,
      internalId: (highestInternalIdInOldSubreddits + 1 + index).toString(),
      isSubscribed: true,
    }));

  return [...updatedOldSubreddits, ...updatedNewSubreddits];
};
