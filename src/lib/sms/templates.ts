/**
 * SMS response templates for VillageShare.
 * All messages target 160 chars where possible (single SMS segment).
 */

export const templates = {
  welcome: () =>
    'Welcome to VillageShare! Text HELP for a list of commands, or just tell me what you need.',

  help: () =>
    [
      'VillageShare commands:',
      'BORROW [item] - borrow an item',
      'RETURN [item] - return an item',
      'RETURN [item] at [name] - return to a different location',
      'SEARCH [term] - find items',
      'WHERE IS [item] - find an item\'s location',
      'WHO HAS [item] - see who borrowed it',
      'RESERVE [item] for [date] - book ahead',
      'STATUS - see your borrows',
      'CANCEL [item] - cancel reservation',
      'ADD [item] - add an item to your collection',
      'REMOVE [item] - remove an item from your collection',
    ].join('\n'),

  unknownUser: (appUrl: string) =>
    `I don't recognize this number. Sign up at ${appUrl} and verify your phone to get started!`,

  searchResults: (
    items: Array<{ name: string; status: string }>,
    shopName: string
  ) => {
    const header = `Items in ${shopName}:`
    const lines = items
      .slice(0, 8)
      .map((item) => `- ${item.name} (${item.status})`)
    const overflow =
      items.length > 8 ? `\n...and ${items.length - 8} more` : ''
    return [header, ...lines].join('\n') + overflow
  },

  searchResultsCrossShop: (
    query: string | undefined,
    results: Array<{ shopName: string; name: string; status: string }>
  ) => {
    const header = query
      ? `Results for "${query}":`
      : `Items across your collections:`
    const lines = results
      .slice(0, 8)
      .map((r) => `- ${r.name} (${r.status}) [${r.shopName}]`)
    const overflow =
      results.length > 8
        ? `\n...and ${results.length - 8} more. Text SEARCH [term] to narrow results.`
        : ''
    return [header, ...lines].join('\n') + overflow
  },

  noItemsFound: (query?: string, crossShop?: boolean) =>
    query
      ? crossShop
        ? `No items found matching "${query}" in any of your collections.`
        : `No items found matching "${query}". Try SEARCH to see everything available.`
      : crossShop
        ? 'No items found in any of your collections right now.'
        : 'No items found in this collection right now.',

  borrowConfirm: (itemName: string, shopName: string, pickupLocation?: string) =>
    pickupLocation
      ? `Done! You've borrowed the ${itemName} from ${shopName}. Pick it up at ${pickupLocation}. Text RETURN ${itemName} when you're done with it.`
      : `Done! You've borrowed the ${itemName} from ${shopName}. Text RETURN ${itemName} when you're done with it.`,

  borrowRequested: (itemName: string) =>
    `Your request to borrow the ${itemName} has been sent to the collection owner. You'll get a text when it's approved.`,

  returnConfirm: (itemName: string, locationName?: string) =>
    locationName
      ? `Got it! The ${itemName} has been returned. It's at ${locationName}.`
      : `Got it! The ${itemName} has been marked as returned. Thanks for bringing it back!`,

  itemNotFound: (itemName: string) =>
    `I couldn't find "${itemName}" in this collection. Text SEARCH to see what's available.`,

  itemUnavailable: (itemName: string, status: string) =>
    `Sorry, the ${itemName} is currently ${status}. Want me to let you know when it's back? Reply YES.`,

  statusList: (borrows: Array<{ itemName: string; dueAt?: string }>) => {
    if (borrows.length === 0) return templates.noBorrows()
    const header = 'Your active borrows:'
    const lines = borrows.slice(0, 6).map((b) => {
      const due = b.dueAt ? ` (due ${formatShortDate(b.dueAt)})` : ''
      return `- ${b.itemName}${due}`
    })
    const overflow =
      borrows.length > 6 ? `\n...and ${borrows.length - 6} more` : ''
    return [header, ...lines].join('\n') + overflow
  },

  noBorrows: () =>
    "You don't have any active borrows right now. Text SEARCH to find something to borrow!",

  disambiguation: (type: string, options: string[]) => {
    const header = `I found ${options.length} ${type}s:`
    const lines = options.slice(0, 5).map((opt, i) => `${i + 1}. ${opt}`)
    return [header, ...lines, 'Reply with a number to pick one.'].join('\n')
  },

  reserveConfirm: (itemName: string, date: string) =>
    `Reserved! The ${itemName} is booked for ${date}. I'll send you a reminder the day before.`,

  cancelConfirm: (itemName: string) =>
    `Your reservation for the ${itemName} has been cancelled.`,

  reserveConflict: (itemName: string) =>
    `Sorry, the ${itemName} is already reserved for that date. Try a different day or text SEARCH to find alternatives.`,

  availabilityCrossShop: (
    itemName: string,
    results: Array<{ shopName: string; status: string; detail?: string }>
  ) => {
    const header = `${itemName} availability:`
    const lines = results.slice(0, 6).map((r) => {
      const detail = r.detail ? ` (${r.detail})` : ''
      return `- ${r.shopName}: ${r.status}${detail}`
    })
    return [header, ...lines].join('\n')
  },

  availabilityFree: (itemName: string, shopName?: string, locationName?: string) =>
    locationName
      ? `The ${itemName} is available! It's at ${locationName} (belongs to ${shopName}). Text BORROW ${itemName} to check it out.`
      : shopName
        ? `The ${itemName} is available at ${shopName}! Text BORROW ${itemName} from ${shopName} to check it out.`
        : `The ${itemName} is available! Text BORROW ${itemName} to check it out.`,

  availabilityBusy: (itemName: string, dueBack?: string) =>
    dueBack
      ? `The ${itemName} is currently borrowed (due back ${dueBack}).`
      : `The ${itemName} is currently borrowed.`,

  availabilitySchedule: (
    itemName: string,
    schedule: Array<{ type: string; dates: string }>
  ) => {
    const header = `Schedule for ${itemName}:`
    const lines = schedule
      .slice(0, 5)
      .map((s) => `- ${s.type}: ${s.dates}`)
    return [header, ...lines].join('\n')
  },

  availabilityDateFree: (itemName: string, dateRange: string) =>
    `The ${itemName} is free ${dateRange}! Text RESERVE ${itemName} for ${dateRange} to book it.`,

  availabilityDateConflict: (itemName: string, conflictDates: string) =>
    `The ${itemName} is reserved ${conflictDates}. Try different dates or text SEARCH for alternatives.`,

  availabilityNone: (itemName: string) =>
    `I couldn't find "${itemName}" in any of your collections. Text SEARCH to see what's available.`,

  // WHO_HAS templates
  whoHasBorrower: (itemName: string, borrowerName: string, borrowerPhone?: string, dueAt?: string) => {
    let msg = `The ${itemName} is borrowed by ${borrowerName}`
    if (borrowerPhone) msg += ` (${borrowerPhone})`
    msg += '.'
    if (dueAt) msg += ` Due back ${dueAt}.`
    return msg
  },

  whoHasNobody: (itemName: string) =>
    `The ${itemName} isn't currently borrowed. It's available!`,

  whoHasMultiple: (itemName: string, results: Array<{ shopName: string; borrowerName?: string; borrowerPhone?: string; dueAt?: string }>) => {
    const header = `${itemName} across your collections:`
    const lines = results.slice(0, 6).map((r) => {
      if (r.borrowerName) {
        const phone = r.borrowerPhone ? ` (${r.borrowerPhone})` : ''
        const due = r.dueAt ? `, due ${r.dueAt}` : ''
        return `- ${r.shopName}: borrowed by ${r.borrowerName}${phone}${due}`
      }
      return `- ${r.shopName}: available`
    })
    return [header, ...lines].join('\n')
  },

  // ADD_ITEM templates
  addItemConfirm: (itemName: string, shopName: string) =>
    `Done! Added "${itemName}" to ${shopName}. It's marked as available.`,

  addItemDuplicate: (itemName: string, shopName: string) =>
    `There's already an item called "${itemName}" in ${shopName}.`,

  addItemNotOwner: () =>
    'Only collection owners can add items. Ask the owner to add it, or manage items in the app.',

  addItemPrompt: () =>
    'What item do you want to add? Text ADD [item name].',

  // REMOVE_ITEM templates
  removeItemConfirm: (itemName: string, shopName: string) =>
    `Done! Removed "${itemName}" from ${shopName}.`,

  removeItemBorrowed: (itemName: string) =>
    `Can't remove the ${itemName} — it's currently borrowed. It needs to be returned first.`,

  removeItemNotOwner: () =>
    'Only collection owners can remove items.',

  removeItemPrompt: () =>
    'What item do you want to remove? Text REMOVE [item name].',

  noActiveShop: () =>
    "You're not part of a village yet. Ask someone for an invite link, or visit the app to create your own village.",

  error: () =>
    'Oops, something went wrong on our end. Please try again in a moment.',
}

/**
 * Format a date string into a short human-readable form for SMS.
 * e.g. "Feb 14" or "Feb 14, 2027" if not the current year.
 */
function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}
