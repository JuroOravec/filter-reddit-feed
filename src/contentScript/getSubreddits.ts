import { parseSubredditUrl } from "../models/subreddit";
import { isNotNull } from "../utils/isNotNull";

export interface ParsedSubreddit {
  subredditId: string;
  subredditName: string;
  subredditUrl: string;
  hasIcon: boolean;
  iconUrl: string | null;
}

interface Timer {
  getTime: () => number;
  incrementTime: (ms: number) => number;
}

const transformSubredditLinkEl = (subredditEl: HTMLLinkElement, index: number): ParsedSubreddit | null => {
  if (!subredditEl) return null;

  const subredditData = parseSubredditUrl(subredditEl.href);
  if (!subredditData) return null;

  const subredditImg = subredditEl.querySelector('img');

  return {
    ...subredditData,
    hasIcon: Boolean(subredditImg),
    iconUrl: subredditImg ? subredditImg.src : null,
  };
};

const getSubredditsFromSubredditConfigMenuOnDesktop = (): HTMLLinkElement[] => {
  const subredditsMenuFilter = document.querySelector('#header-subreddit-filter');
  if (!subredditsMenuFilter) return [];
  const subredditsMenu = subredditsMenuFilter.closest('[role="menu"]');
  if (!subredditsMenu) return [];
  const subredditLinkEls = subredditsMenu.querySelectorAll<HTMLLinkElement>('[href^="/r/"]');
  return Array.from(subredditLinkEls);
};

const startsWithSubredditPrefixPattern = /^\/?r\//;

const getSubredditsFromSubredditConfigMenuOnMobile = (): HTMLLinkElement[] => {
  // We can't specifically target only subreddits, so we filter out non-subreddit links
  return Array.from(document.querySelectorAll<HTMLLinkElement>('nav.OverlayMenu li a')).filter((el) => {
    return startsWithSubredditPrefixPattern.test(el.textContent ?? '');
  });
};

const getSubredditsFromSubredditConfigMenu = (): HTMLLinkElement[] => {
  const subredditsOnDesktop = getSubredditsFromSubredditConfigMenuOnDesktop();
  return subredditsOnDesktop.length ? subredditsOnDesktop : getSubredditsFromSubredditConfigMenuOnMobile();
};

/**
 * Factory for a callback for setInterval. The callback will keep executing
 * and updating the time it's been running for until either:
 * a) We've found the subreddit elements we've been searching for (success)
 * b) We've timed out (error) 
 */
const creteOnTickCallback = (input: {
  onSuccess: (res: ParsedSubreddit[]) => void,
  onError: (err: Error) => void,
  timer: Timer;
  frequency: number;
  timeout: number;
}) => () => {
  const { onSuccess, onError, timer, frequency, timeout } = input;

  const subreddits = getSubredditsFromSubredditConfigMenu();
  const transformedSubreddits = subreddits.map(transformSubredditLinkEl).filter(isNotNull);

  if (transformedSubreddits.length) {
    const logData = { tries: timer.getTime() / frequency };
    console.debug(`Parsed user's subreddits from the document (${JSON.stringify(logData)})`);
    return onSuccess(transformedSubreddits);
  }

  // No subreddits found, keep trying or timeout
  timer.incrementTime(frequency);

  // Stop polling if we're beyond timeout
  if (timeout >= 0 && timer.getTime() >= timeout) {
    const logData = { timeout, frequency, tries: timer.getTime() / frequency };
    return onError(Error(`Timed out trying to get user's subreddits from the document (${JSON.stringify(logData)})`));
  }
};

/**
 * Main function of this block. Extract info on user's subreddits. Handles both desktop / mobile.
 * The Promise resolves once the subreddits info is available, which is when user opens
 * the subreddits menu.
 * 
 * @example
 * const extractedSubreddits = await getSubreddits();
 */
const getSubreddits = async (
  timeout = -1, // Keep trying forever
  frequency = 100, // Try every 100 ms
): Promise<ParsedSubreddit[]> => {

  return new Promise<ParsedSubreddit[]>((resolve, reject) => {
    let intervalId: NodeJS.Timer;
    let timePassed = 0;

    const timer: Timer = {
      getTime: () => timePassed,
      incrementTime: (ms: number) => {
        timePassed += ms;
        return timePassed;
      },
    };

    const onSuccess = (result: ParsedSubreddit[]) => {
      window.clearInterval(intervalId);
      resolve(result);
    };
    const onError = (error: Error) => {
      window.clearInterval(intervalId);
      reject(error);
    };

    const onTick = creteOnTickCallback({ onSuccess, onError, timer, timeout, frequency });
    intervalId = setInterval(onTick, frequency);
  });
};

export default getSubreddits;
