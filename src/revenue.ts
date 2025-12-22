import { EventRevenue } from './internal/event';

/**
 * Revenue information for purchase events
 */
export class FunnelMobRevenue {
  /** Revenue amount */
  readonly amount: number;

  /** ISO 4217 currency code (e.g., "USD", "EUR") */
  readonly currency: string;

  constructor(amount: number, currency: string) {
    this.amount = amount;
    this.currency = currency.toUpperCase();
  }

  /**
   * Create USD revenue
   */
  static usd(amount: number): FunnelMobRevenue {
    return new FunnelMobRevenue(amount, 'USD');
  }

  /**
   * Create EUR revenue
   */
  static eur(amount: number): FunnelMobRevenue {
    return new FunnelMobRevenue(amount, 'EUR');
  }

  /**
   * Create GBP revenue
   */
  static gbp(amount: number): FunnelMobRevenue {
    return new FunnelMobRevenue(amount, 'GBP');
  }

  /**
   * Convert to internal event revenue format
   */
  toEventRevenue(): EventRevenue {
    return {
      amount: this.amount.toFixed(2),
      currency: this.currency,
    };
  }
}
