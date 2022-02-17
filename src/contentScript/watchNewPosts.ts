import { parseSubredditUrl, Subreddit, SubredditInfo } from "../models/subreddit";
import { isNotNull } from "../utils/isNotNull";
import type { SubredditFeed } from "@/models/subredditFeed";

interface PostDataElements {
  postElement: HTMLElement;
  wrapperElement: HTMLElement | null;
}

export interface PostData extends PostDataElements {
  subreddit: Readonly<Subreddit>;
  subredditFeed: Readonly<SubredditFeed>;
}

export interface PostDataContext {
  subreddits: Subreddit[],
  subredditFeeds: SubredditFeed[],
  currentSubreddit: SubredditInfo | null;
}

interface PostDataInput extends PostDataElements, PostDataContext { };

type StopMutationObserver = () => void;

const isNodeDiv = (node: Node): node is HTMLElement => {
  return (node as HTMLElement)?.tagName === 'DIV';
};

/** Create a MutationObserver that triggers the callback on every single mutation record. */
const createMutationObserver = (
  /** Watched HTML element */
  element: HTMLElement,
  /** Callback function to execute when mutations are observed */
  onSingleMutationRecordCallback: (mutation: MutationRecord) => void,
): StopMutationObserver => {
  // Options for the observer (which mutations to observe)
  const config = { attributes: false, childList: true, subtree: true };

  // Create an observer instance linked to the callback function
  const observer = new MutationObserver((mutationsList): void => {
    // Use traditional 'for loops' for IE 11
    for (const mutation of mutationsList) {
      onSingleMutationRecordCallback(mutation);
    }
  });

  // Start observing the target node for configured mutations
  observer.observe(element, config);

  // Later, you can stop observing
  const stopMutationObserver = () => observer.disconnect();

  return stopMutationObserver;
};

const getSubredditIdFromPostEl = (postEl: HTMLElement): string | null => {
  const subredditUrl = postEl?.querySelector<HTMLLinkElement>('a[data-click-id="subreddit"]')?.href;
  if (!subredditUrl) return null;

  return parseSubredditUrl(subredditUrl)?.subredditId ?? null;
};

/**
 * Given a Post HTMLElement and available subreddits and their feed configs.
 * Associate the HTMLElement with correct subreddit data.
 */
const transformPostData = (data: PostDataInput): PostData | null => {
  if (!data) return null;
  const { wrapperElement, postElement, subreddits, subredditFeeds } = data;

  const subredditId = getSubredditIdFromPostEl(postElement);
  if (!subredditId) return null;

  const subreddit = subreddits.find((subreddit) => subreddit.subredditId === subredditId);
  if (!subreddit?.internalId) return null;

  const subredditFeed = subredditFeeds.find((feed) => feed.internalId === subreddit.internalId) ?? null;
  if (!subredditFeed) return null;

  return {
    subreddit,
    subredditFeed,
    postElement,
    wrapperElement,
  };
};


/**
 * Given a MutationRecord and context info, pick out those mutations that add an element
 * with a .Post CSS class.
 */
const filterAndTransformMutationRecordToPostData = (
  mutation: MutationRecord,
  context: PostDataContext
): PostData[] => {
  if (mutation.type !== 'childList') return [];

  // Pick out only mutation records that add element with .Post CSS class
  const addedPosts: PostData[] = Array.from(mutation.addedNodes).reduce((acc, wrapperElement) => {
    if (!isNodeDiv(wrapperElement)) return acc;

    const postElement = wrapperElement.querySelector<HTMLElement>('.Post');
    if (!postElement) return acc;

    const postData = transformPostData({ wrapperElement, postElement, ...context });
    if (postData) acc.push(postData);
    return acc;
  }, [] as PostData[]);

  return addedPosts;
};

/**
 * Watch the posts feed container HTML element for additions of new posts,
 * and trigger the callback on addition.
 * 
 * @example
 * // Remove (hide from user) posts that are not from r/superstonk
 *
 * // Select the node that will be observed for mutations
 * const postsContainer = document.querySelector('[class*="ListingLayout"]');
 *
 * // Callback that defines what happens when a new post element is added
 * const removeNonSuperstonkPosts = ({ subreddit, wrapperElement, postElement }) => {
 *   if (subreddit.toLowerCase() !== 'r/superstonk') {
 *     wrapperElement ? wrapperElement.remove() : postElement.remove();
 *   }
 * };
 *
 * const unwatch = watchNewPosts(postsContainer, removeNonSuperstonkPosts);
 */
const watchNewPosts = (
  /** Watched HTML element */
  element: HTMLElement,
  /** Callback triggered when new post is added */
  onNewPost: (data: PostData) => void,
  contextGetter: () => PostDataContext): StopMutationObserver => {

  const stopMutationObserver = createMutationObserver(element, (mutation) => {
    const context = contextGetter();

    // Do not filter posts on a subreddit feed as there is only one subreddit shown
    if (context.currentSubreddit) return;

    const addedPosts = filterAndTransformMutationRecordToPostData(mutation, context);
    addedPosts.map(onNewPost);
  });

  // Run first iteration (before the observer is triggered)
  const initialPostData: PostData[] = Array.from(element.querySelectorAll<HTMLElement>('.Post'))
    .map((postElement) => {
      return transformPostData({ postElement, wrapperElement: null, ...contextGetter() })
    })
    .filter(isNotNull);
  initialPostData.map(onNewPost);

  return stopMutationObserver;
};

export default watchNewPosts;
