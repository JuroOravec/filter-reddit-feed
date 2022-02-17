
// Sentry.init({
//   dsn:
//     "https://aaa9f167f7fc4c4fa4a19bc7114c9cfc@o470159.ingest.sentry.io/5500430",
//   integrations: [new Sentry.Integrations.BrowserTracing()],
//   tracesSampleRate: 1.0,
// });

/**
 * Wrap a function to handle errors.
 */
export const withErrorHandle = <TArgs extends any[], TReturn extends any>(
  fn: (...args: TArgs) => TReturn
) => (...args: TArgs): TReturn => {
  try {
    return fn(...args);
  } catch (e) {
    // Sentry.captureException(e);
    throw e;
  }
};

export const createError = (message: string) => {
  return Error(message);
};
