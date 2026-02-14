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
      'SEARCH [term] - find items',
      'RESERVE [item] for [date] - book ahead',
      'STATUS - see your borrows',
      'CANCEL [item] - cancel reservation',
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

  noItemsFound: (query?: string) =>
    query
      ? `No items found matching "${query}". Try SEARCH to see everything available.`
      : 'No items found in this shop right now.',

  borrowConfirm: (itemName: string, shopName: string) =>
    `Done! You've borrowed the ${itemName} from ${shopName}. Text RETURN ${itemName} when you're done with it.`,

  borrowRequested: (itemName: string) =>
    `Your request to borrow the ${itemName} has been sent to the shop owner. You'll get a text when it's approved.`,

  returnConfirm: (itemName: string) =>
    `Got it! The ${itemName} has been marked as returned. Thanks for bringing it back!`,

  itemNotFound: (itemName: string) =>
    `I couldn't find "${itemName}" in this shop. Text SEARCH to see what's available.`,

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

  noActiveShop: () =>
    "You're not connected to a shop yet. Ask a shop owner for an invite, or visit the app to create your own.",

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
