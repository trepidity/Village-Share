export type IntentType =
  | 'BORROW'
  | 'RETURN'
  | 'SEARCH'
  | 'RESERVE'
  | 'STATUS'
  | 'HELP'
  | 'CANCEL'
  | 'AVAILABILITY'
  | 'WHO_HAS'
  | 'ADD_ITEM'
  | 'REMOVE_ITEM'
  | 'UNKNOWN'

export interface ParsedIntent {
  type: IntentType
  confidence: number // 0-1
  entities: {
    itemName?: string
    shopName?: string
    locationName?: string // Physical location ("at [shop]") for returns
    date?: string // ISO date string
    dateEnd?: string // ISO date string for range end
    quantity?: number
    choiceIndex?: number // For disambiguation (reply "1" or "2")
  }
  raw: string // original message
}
