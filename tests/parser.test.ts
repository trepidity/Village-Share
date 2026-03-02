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

    it('extracts shop name from possessive "borrow daniel\'s drill"', () => {
      const result = parseMessage("borrow daniel's drill")
      expect(result.type).toBe('BORROW')
      expect(result.entities.itemName).toBe('drill')
      expect(result.entities.shopName).toBe('daniel')
    })

    it('extracts shop name from possessive "can i get mike\'s chainsaw"', () => {
      const result = parseMessage("can i get mike's chainsaw")
      expect(result.type).toBe('BORROW')
      expect(result.entities.itemName).toBe('chainsaw')
      expect(result.entities.shopName).toBe('mike')
    })

    it('extracts multi-word item from possessive "borrow sarah\'s table saw"', () => {
      const result = parseMessage("borrow sarah's table saw")
      expect(result.type).toBe('BORROW')
      expect(result.entities.itemName).toBe('table saw')
      expect(result.entities.shopName).toBe('sarah')
    })

    it('handles loose possessive "i want daniel\'s drill"', () => {
      const result = parseMessage("i want daniel's drill")
      expect(result.type).toBe('BORROW')
      expect(result.entities.itemName).toBe('drill')
      expect(result.entities.shopName).toBe('daniel')
    })

    it('handles loose possessive "i want to borrow daniel\'s drill"', () => {
      const result = parseMessage("i want to borrow daniel's drill")
      expect(result.type).toBe('BORROW')
      expect(result.entities.itemName).toBe('drill')
      expect(result.entities.shopName).toBe('daniel')
    })

    it('handles typo "barrow jared\'s 16\' trailer"', () => {
      const result = parseMessage("barrow jared's 16' trailer")
      expect(result.type).toBe('BORROW')
      expect(result.entities.shopName).toBe('jared')
      expect(result.entities.itemName).toBe("16' trailer")
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

    it('extracts locationName from "return the drill at carson\'s"', () => {
      const result = parseMessage("return the drill at carson's")
      expect(result.type).toBe('RETURN')
      expect(result.entities.itemName).toBe('drill')
      expect(result.entities.locationName).toBe('carson')
    })

    it('extracts locationName from "return the drill, left it at mike\'s"', () => {
      const result = parseMessage("return the drill, left it at mike's")
      expect(result.type).toBe('RETURN')
      expect(result.entities.itemName).toBe('drill')
      expect(result.entities.locationName).toBe('mike')
    })

    it('extracts locationName from "drop off the drill at carson\'s"', () => {
      const result = parseMessage("drop off the drill at carson's")
      expect(result.type).toBe('RETURN')
      expect(result.entities.itemName).toBe('drill')
      expect(result.entities.locationName).toBe('carson')
    })

    it('extracts locationName from "bring back the saw, it\'s at mike\'s"', () => {
      const result = parseMessage("bring back the saw, it's at mike's")
      expect(result.type).toBe('RETURN')
      expect(result.entities.itemName).toBe('saw')
      expect(result.entities.locationName).toBe('mike')
    })

    it('extracts both shopName and locationName from "return drill to daniel at carson\'s"', () => {
      const result = parseMessage("return drill to daniel at carson's")
      expect(result.type).toBe('RETURN')
      expect(result.entities.itemName).toBe('drill')
      expect(result.entities.shopName).toBe('daniel')
      expect(result.entities.locationName).toBe('carson')
    })

    it('does not set locationName when not present', () => {
      const result = parseMessage('return the drill')
      expect(result.type).toBe('RETURN')
      expect(result.entities.itemName).toBe('drill')
      expect(result.entities.locationName).toBeUndefined()
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

    it('matches "status of my tools"', () => {
      const result = parseMessage('status of my tools')
      expect(result.type).toBe('STATUS')
    })

    it('matches "my tools"', () => {
      const result = parseMessage('my tools')
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

  describe('AVAILABILITY intent', () => {
    it('matches "is the drill available?"', () => {
      const result = parseMessage('is the drill available?')
      expect(result.type).toBe('AVAILABILITY')
      expect(result.entities.itemName).toBe('drill')
    })

    it('matches "is the trailer in use?"', () => {
      const result = parseMessage('is the trailer in use?')
      expect(result.type).toBe('AVAILABILITY')
      expect(result.entities.itemName).toBe('trailer')
    })

    it('matches "is the mower free?"', () => {
      const result = parseMessage('is the mower free?')
      expect(result.type).toBe('AVAILABILITY')
      expect(result.entities.itemName).toBe('mower')
    })

    it('matches "is anyone using the drill?"', () => {
      const result = parseMessage('is anyone using the drill?')
      expect(result.type).toBe('WHO_HAS')
      expect(result.entities.itemName).toBe('drill')
    })

    it('matches "is the saw being used?"', () => {
      const result = parseMessage('is the saw being used?')
      expect(result.type).toBe('AVAILABILITY')
      expect(result.entities.itemName).toBe('saw')
    })

    it('matches "when is the trailer available?"', () => {
      const result = parseMessage('when is the trailer available?')
      expect(result.type).toBe('AVAILABILITY')
      expect(result.entities.itemName).toBe('trailer')
    })

    it('matches "when is the drill free?"', () => {
      const result = parseMessage('when is the drill free?')
      expect(result.type).toBe('AVAILABILITY')
      expect(result.entities.itemName).toBe('drill')
    })

    it('matches "check trailer availability"', () => {
      const result = parseMessage('check trailer availability')
      expect(result.type).toBe('AVAILABILITY')
      expect(result.entities.itemName).toBe('trailer')
    })

    it('matches multi-word item "is the table saw available?"', () => {
      const result = parseMessage('is the table saw available?')
      expect(result.type).toBe('AVAILABILITY')
      expect(result.entities.itemName).toBe('table saw')
    })

    it('matches "is there a mower available"', () => {
      const result = parseMessage('is there a mower available')
      expect(result.type).toBe('AVAILABILITY')
      expect(result.entities.itemName).toBe('mower')
    })

    it('matches "is someone borrowing the ladder?"', () => {
      const result = parseMessage('is someone borrowing the ladder?')
      expect(result.type).toBe('WHO_HAS')
      expect(result.entities.itemName).toBe('ladder')
    })
  })

  describe('WHO_HAS intent', () => {
    it('matches "who has a drill"', () => {
      const result = parseMessage('who has a drill')
      expect(result.type).toBe('WHO_HAS')
      expect(result.entities.itemName).toBe('drill')
    })

    it('matches "who has the trailer?"', () => {
      const result = parseMessage('who has the trailer?')
      expect(result.type).toBe('WHO_HAS')
      expect(result.entities.itemName).toBe('trailer')
    })

    it('matches "who\'s got the saw?"', () => {
      const result = parseMessage("who's got the saw?")
      expect(result.type).toBe('WHO_HAS')
      expect(result.entities.itemName).toBe('saw')
    })

    it('matches "who\'s using the mower?"', () => {
      const result = parseMessage("who's using the mower?")
      expect(result.type).toBe('WHO_HAS')
      expect(result.entities.itemName).toBe('mower')
    })

    it('matches "where is the small chainsaw at?"', () => {
      const result = parseMessage('where is the small chainsaw at?')
      expect(result.type).toBe('AVAILABILITY')
      expect(result.entities.itemName).toBe('small chainsaw')
    })

    it('matches "where is the drill?"', () => {
      const result = parseMessage('where is the drill?')
      expect(result.type).toBe('AVAILABILITY')
      expect(result.entities.itemName).toBe('drill')
    })

    it('matches "where\'s the saw?"', () => {
      const result = parseMessage("where's the saw?")
      expect(result.type).toBe('AVAILABILITY')
      expect(result.entities.itemName).toBe('saw')
    })

    it('matches "where can I find the ladder?"', () => {
      const result = parseMessage('where can I find the ladder?')
      expect(result.type).toBe('AVAILABILITY')
      expect(result.entities.itemName).toBe('ladder')
    })

    it('matches "where do I get the trailer?"', () => {
      const result = parseMessage('where do I get the trailer?')
      expect(result.type).toBe('AVAILABILITY')
      expect(result.entities.itemName).toBe('trailer')
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
