/** Same as querySelector, but periodically queries the document for the element until it finds it */
const querySelectorUntilFound = <T extends Element = Element>(selector: string, interval: number = 10): Promise<T> => {
  return new Promise((res, rej) => {
    let intervalId: NodeJS.Timer | null = null;

    const onInterval = (): void => {
      const el = document.querySelector<T>(selector);
      if (!el) return;

      if (intervalId != null) {
        clearInterval(intervalId);
      }

      res(el);
    };

    intervalId = setInterval(onInterval, interval);
  });
};

export default querySelectorUntilFound;
