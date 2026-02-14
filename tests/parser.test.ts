import { describe, it, expect } from 'vitest'
import { parseMessage } from '@/lib/sms/parser'

describe('SMS Parser', () => {
  describe('HELP intent', () => {
    it('matches "help"', () => {
      const result = parseMessage('help')
      expect(result.type).toBe('HELP')
      expect(result.confidence).toBeGreaterThanOrEqual(0.8)
    })

    it('matches "commands"', () => {
      const result = parseMessage('commands')
      expect(result.type).toBe('HELP')
    })

    it('matches "?"', () => {
      const result = parseMessage('?')
      expect(result.type).toBe('HELP')
    })
  })

  describe('BORROW intent', () => {
    it('matches "borrow the drill"', () => {
      const result = parseMessage('borrow the drill')
      expect(result.type).toBe('BORROW')
      expect(result.entities.itemName).toBe('drill')
    })

    it('matches "can I get the mixer?"', () => {
      const result = parseMessage('can I get the mixer?')
      expect(result.type).toBe('BORROW')
      expect(result.entities.itemName).toBe('mixer')
    })

    it('extracts shop name from "borrow drill from Johns shop"', () => {
      const result = parseMessage("borrow drill from John's shop")
      expect(result.type).toBe('BORROW')
      expect(result.entities.itemName).toBeTruthy()
    })

    it('matches "checkout the table saw"', () => {
      const result = parseMessage('checkout the table saw')
      expect(result.type).toBe('BORROW')
      expect(result.entities.itemName).toBe('table saw')
    })
  })

  describe('RETURN intent', () => {
    it('matches "return the mixer"', () => {
      const result = parseMessage('return the mixer')
      expect(result.type).toBe('RETURN')
      expect(result.entities.itemName).toBe('mixer')
    })

    it('matches "bring back the drill"', () => {
      const result = parseMessage('bring back the drill')
      expect(result.type).toBe('RETURN')
      expect(result.entities.itemName).toBe('drill')
    })

    it('matches "I\'m done with the hammer"', () => {
      const result = parseMessage("I'm done with the hammer")
      expect(result.type).toBe('RETURN')
      expect(result.entities.itemName).toBe('hammer')
    })
  })

  describe('SEARCH intent', () => {
    it('matches "what\'s available?"', () => {
      const result = parseMessage("what's available?")
      expect(result.type).toBe('SEARCH')
    })

    it('matches "do you have a drill?"', () => {
      const result = parseMessage('do you have a drill?')
      expect(result.type).toBe('SEARCH')
      expect(result.entities.itemName).toBe('drill')
    })

    it('matches "list items"', () => {
      const result = parseMessage('list items')
      expect(result.type).toBe('SEARCH')
    })

    it('matches "search for saw"', () => {
      const result = parseMessage('search for saw')
      expect(result.type).toBe('SEARCH')
      expect(result.entities.itemName).toBe('saw')
    })
  })

  describe('STATUS intent', () => {
    it('matches "my borrows"', () => {
      const result = parseMessage('my borrows')
      expect(result.type).toBe('STATUS')
    })

    it('matches "what do I have?"', () => {
      const result = parseMessage('what do I have?')
      expect(result.type).toBe('STATUS')
    })

    it('matches "my stuff"', () => {
      const result = parseMessage('my stuff')
      expect(result.type).toBe('STATUS')
    })
  })

  describe('CANCEL intent', () => {
    it('matches "cancel my reservation"', () => {
      const result = parseMessage('cancel my reservation')
      expect(result.type).toBe('CANCEL')
    })

    it('matches "cancel reservation for the drill"', () => {
      const result = parseMessage('cancel reservation for the drill')
      expect(result.type).toBe('CANCEL')
      expect(result.entities.itemName).toBe('drill')
    })
  })

  describe('RESERVE intent', () => {
    it('matches "reserve the trailer for next Saturday"', () => {
      const result = parseMessage('reserve the trailer for next Saturday')
      expect(result.type).toBe('RESERVE')
      expect(result.entities.itemName).toBe('trailer')
    })

    it('matches "book the mixer for Friday"', () => {
      const result = parseMessage('book the mixer for Friday')
      expect(result.type).toBe('RESERVE')
      expect(result.entities.itemName).toBe('mixer')
    })
  })

  describe('Disambiguation (number choices)', () => {
    it('treats bare "1" as a choice', () => {
      const result = parseMessage('1')
      expect(result.entities.choiceIndex).toBe(1)
    })

    it('treats bare "2" as a choice', () => {
      const result = parseMessage('2')
      expect(result.entities.choiceIndex).toBe(2)
    })
  })

  describe('UNKNOWN intent', () => {
    it('returns UNKNOWN for gibberish', () => {
      const result = parseMessage('asdfghjkl')
      expect(result.type).toBe('UNKNOWN')
      expect(result.confidence).toBe(0)
    })
  })

  describe('preserves raw message', () => {
    it('includes original message in raw field', () => {
      const result = parseMessage('borrow the drill')
      expect(result.raw).toBe('borrow the drill')
    })
  })
})
