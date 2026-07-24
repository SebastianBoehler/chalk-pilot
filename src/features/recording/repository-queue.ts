export function createOperationQueue() {
  const queues = new Map<string, Promise<unknown>>();

  return async function queue<T>(key: string, operation: () => Promise<T>) {
    const previous = queues.get(key) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    queues.set(key, current);
    try {
      return await current;
    } finally {
      if (queues.get(key) === current) queues.delete(key);
    }
  };
}
