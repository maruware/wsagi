export const mapIterateAll = <In, Out>(
  iterator: IterableIterator<In>,
  func: (item: In) => Promise<Out>
) => {
  const promises: Promise<Out>[] = []

  for (let item of iterator) {
    promises.push(func(item))
  }
  return Promise.all(promises)
}
