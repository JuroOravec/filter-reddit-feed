export const isNotNull = <T extends any>(val: T): val is Exclude<T, null> => {
  return val != null;
};
