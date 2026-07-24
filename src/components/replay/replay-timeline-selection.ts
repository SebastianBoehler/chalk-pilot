export function selectTimelineEvent<T extends { offsetMs: number }>(
  events: readonly T[],
  currentMs: number,
): T | undefined {
  let selected: T | undefined;
  for (const event of events) {
    if (
      event.offsetMs <= currentMs &&
      event.offsetMs >= (selected?.offsetMs ?? -1)
    ) {
      selected = event;
    }
  }
  return selected;
}
