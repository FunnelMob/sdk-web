import { describe, it, expect } from 'vitest';

// Helper function matching SDK validation
function isValidEventName(name: string): boolean {
  if (!name || name.length === 0) return false;
  if (name.length > 100) return false;

  const pattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
  return pattern.test(name);
}

describe('Event Validation', () => {
  describe('valid event names', () => {
    it('accepts simple names', () => {
      expect(isValidEventName('purchase')).toBe(true);
      expect(isValidEventName('buttonClick')).toBe(true);
      expect(isValidEventName('a')).toBe(true);
    });

    it('accepts names with underscores', () => {
      expect(isValidEventName('button_click')).toBe(true);
      expect(isValidEventName('level_complete_bonus')).toBe(true);
    });

    it('accepts names with numbers', () => {
      expect(isValidEventName('step2_complete')).toBe(true);
      expect(isValidEventName('level1Complete')).toBe(true);
    });

    it('accepts standard event names', () => {
      expect(isValidEventName('fm_registration')).toBe(true);
      expect(isValidEventName('fm_purchase')).toBe(true);
    });

    it('accepts max length name', () => {
      const maxName = 'a'.repeat(100);
      expect(isValidEventName(maxName)).toBe(true);
    });
  });

  describe('invalid event names', () => {
    it('rejects empty name', () => {
      expect(isValidEventName('')).toBe(false);
    });

    it('rejects name starting with number', () => {
      expect(isValidEventName('2nd_purchase')).toBe(false);
      expect(isValidEventName('123')).toBe(false);
    });

    it('rejects name with special characters', () => {
      expect(isValidEventName('purchase-complete')).toBe(false);
      expect(isValidEventName('purchase.complete')).toBe(false);
      expect(isValidEventName('purchase@home')).toBe(false);
      expect(isValidEventName('purchase#1')).toBe(false);
    });

    it('rejects name with spaces', () => {
      expect(isValidEventName('purchase complete')).toBe(false);
      expect(isValidEventName(' purchase')).toBe(false);
      expect(isValidEventName('purchase ')).toBe(false);
    });

    it('rejects name too long', () => {
      const longName = 'a'.repeat(101);
      expect(isValidEventName(longName)).toBe(false);
    });
  });
});
