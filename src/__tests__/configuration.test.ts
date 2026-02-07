import { describe, it, expect } from 'vitest';
import { FunnelMobConfiguration, Server, LogLevel } from '../configuration';

describe('FunnelMobConfiguration', () => {
  it('has correct defaults', () => {
    const config = new FunnelMobConfiguration({
      apiKey: 'fm_test_key',
    });

    expect(config.apiKey).toBe('fm_test_key');
    expect(config.server).toBe(Server.Production);
    expect(config.logLevel).toBe(LogLevel.None);
    expect(config.flushIntervalMs).toBe(30000);
    expect(config.maxBatchSize).toBe(100);
  });

  it('accepts all options', () => {
    const config = new FunnelMobConfiguration({
      apiKey: 'fm_test_key',
      server: Server.Sandbox,
      logLevel: LogLevel.Debug,
      flushIntervalMs: 10000,
      maxBatchSize: 50,
    });

    expect(config.server).toBe(Server.Sandbox);
    expect(config.logLevel).toBe(LogLevel.Debug);
    expect(config.flushIntervalMs).toBe(10000);
    expect(config.maxBatchSize).toBe(50);
  });

  it('enforces minimum flush interval', () => {
    const config = new FunnelMobConfiguration({
      apiKey: 'fm_test_key',
      flushIntervalMs: 500,
    });

    expect(config.flushIntervalMs).toBe(1000);
  });

  it('clamps max batch size', () => {
    const configLow = new FunnelMobConfiguration({
      apiKey: 'fm_test_key',
      maxBatchSize: 0,
    });

    const configHigh = new FunnelMobConfiguration({
      apiKey: 'fm_test_key',
      maxBatchSize: 200,
    });

    expect(configLow.maxBatchSize).toBe(1);
    expect(configHigh.maxBatchSize).toBe(100);
  });

  it('returns correct production base URL', () => {
    const config = new FunnelMobConfiguration({
      apiKey: 'fm_test_key',
      server: Server.Production,
    });

    expect(config.baseUrl).toBe('https://api.funnelmob.com/v1');
  });

  it('returns correct sandbox base URL', () => {
    const config = new FunnelMobConfiguration({
      apiKey: 'fm_test_key',
      server: Server.Sandbox,
    });

    expect(config.baseUrl).toBe('https://sandbox.funnelmob.com/v1');
  });
});
