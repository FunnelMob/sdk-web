import { describe, it, expect } from 'vitest';
import { FunnelMobRevenue } from '../revenue';

describe('FunnelMobRevenue', () => {
  it('creates USD revenue', () => {
    const revenue = FunnelMobRevenue.usd(29.99);

    expect(revenue.amount).toBe(29.99);
    expect(revenue.currency).toBe('USD');
  });

  it('normalizes currency to uppercase', () => {
    const revenue = new FunnelMobRevenue(10.0, 'eur');

    expect(revenue.currency).toBe('EUR');
  });

  it('formats amount with 2 decimal places', () => {
    const revenue = FunnelMobRevenue.usd(100);
    const eventRevenue = revenue.toEventRevenue();

    expect(eventRevenue.amount).toBe('100.00');
    expect(eventRevenue.currency).toBe('USD');
  });

  it('rounds amount correctly', () => {
    const revenue = FunnelMobRevenue.usd(29.999);
    const eventRevenue = revenue.toEventRevenue();

    expect(eventRevenue.amount).toBe('30.00');
  });

  it('creates EUR revenue', () => {
    const revenue = FunnelMobRevenue.eur(50.0);

    expect(revenue.currency).toBe('EUR');
  });

  it('creates GBP revenue', () => {
    const revenue = FunnelMobRevenue.gbp(75.0);

    expect(revenue.currency).toBe('GBP');
  });
});
