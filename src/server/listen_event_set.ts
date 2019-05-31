export class ListenEventSet {
  idToListenEvents: Map<string, Set<string>>

  constructor() {
    this.idToListenEvents = new Map()
  }

  add(id: string, event: string) {
    if (!this.idToListenEvents.has(id)) {
      this.idToListenEvents.set(id, new Set())
    }
    this.idToListenEvents.get(id).add(event)
  }

  remove(id: string, event: string) {
    if (!this.idToListenEvents.has(id)) {
      throw new Error(`Not found client id[${id}] in ListenEventSet`)
    }
    this.idToListenEvents.get(id).delete(event)
  }

  getListenEvents(id: string) {
    return this.idToListenEvents.get(id).values()
  }

  hasListenEvent(id: string, event: string) {
    return (
      this.idToListenEvents.has(id) && this.idToListenEvents.get(id).has(event)
    )
  }
}
