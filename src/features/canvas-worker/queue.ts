export function createKeyedQueue() {
  const pending = new Map<string, Promise<unknown>>();

  async function run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = pending.get(key) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    pending.set(key, current);
    try {
      return await current;
    } finally {
      if (pending.get(key) === current) pending.delete(key);
    }
  }

  return { run };
}

export type KeyedQueue = ReturnType<typeof createKeyedQueue>;
