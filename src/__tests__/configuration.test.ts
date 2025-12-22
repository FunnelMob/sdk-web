import { describe, it, expect } from 'vitest';
import { FunnelMobConfiguration, Environment, LogLevel } from '../configuration';

describe('FunnelMobConfiguration', () => {
  it('has correct defaults', () => {
    const config = new FunnelMobConfiguration({
      appId: 'com.test.app',
      apiKey: 'fm_test_key',
    });

    expect(config.appId).toBe('com.test.app');
    expect(config.apiKey).toBe('fm_test_key');
    expect(config.environment).toBe(Environment.Production);
    expect(config.logLevel).toBe(LogLevel.None);
    expect(config.flushIntervalMs).toBe(30000);
    expect(config.maxBatchSize).toBe(100);
  });

  it('accepts all options', () => {
    const config = new FunnelMobConfiguration({
      appId: 'com.test.app',
      apiKey: 'fm_test_key',
      environment: Environment.Sandbox,
      logLevel: LogLevel.Debug,
      flushIntervalMs: 10000,
      maxBatchSize: 50,
    });

    expect(config.environment).toBe(Environment.Sandbox);
    expect(config.logLevel).toBe(LogLevel.Debug);
    expect(config.flushIntervalMs).toBe(10000);
    expect(config.maxBatchSize).toBe(50);
  });

  it('enforces minimum flush interval', () => {
    const config = new FunnelMobConfiguration({
      appId: 'com.test.app',
      apiKey: 'fm_test_key',
      flushIntervalMs: 500,
    });

    expect(config.flushIntervalMs).toBe(1000);
  });

  it('clamps max batch size', () => {
    const configLow = new FunnelMobConfiguration({
      appId: 'com.test.app',
      apiKey: 'fm_test_key',
      maxBatchSize: 0,
    });

    const configHigh = new FunnelMobConfiguration({
      appId: 'com.test.app',
      apiKey: 'fm_test_key',
      maxBatchSize: 200,
    });

    expect(configLow.maxBatchSize).toBe(1);
    expect(configHigh.maxBatchSize).toBe(100);
  });

  it('returns correct production base URL', () => {
    const config = new FunnelMobConfiguration({
      appId: 'com.test.app',
      apiKey: 'fm_test_key',
      environment: Environment.Production,
    });

    expect(config.baseUrl).toBe('https://api.funnelmob.com/v1');
  });

  it('returns correct sandbox base URL', () => {
    const config = new FunnelMobConfiguration({
      appId: 'com.test.app',
      apiKey: 'fm_test_key',
      environment: Environment.Sandbox,
    });

    expect(config.baseUrl).toBe('https://sandbox.funnelmob.com/v1');
  });
});
