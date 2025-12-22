import { describe, it, expect } from 'vitest';
import { FunnelMobEventParameters } from '../event-parameters';

describe('FunnelMobEventParameters', () => {
  it('returns undefined for empty parameters', () => {
    const params = new FunnelMobEventParameters();

    expect(params.toObject()).toBeUndefined();
  });

  it('stores all parameter types', () => {
    const params = new FunnelMobEventParameters()
      .set('string_key', 'hello')
      .set('int_key', 42)
      .set('float_key', 3.14)
      .set('bool_key', true);

    const obj = params.toObject();
    expect(obj).toEqual({
      string_key: 'hello',
      int_key: 42,
      float_key: 3.14,
      bool_key: true,
    });
  });

  it('creates from object', () => {
    const params = FunnelMobEventParameters.fromObject({
      item_id: 'sku_123',
      quantity: 2,
    });

    const obj = params.toObject();
    expect(obj).toEqual({
      item_id: 'sku_123',
      quantity: 2,
    });
  });

  it('filters unsupported types from object', () => {
    const params = FunnelMobEventParameters.fromObject({
      valid_string: 'hello',
      valid_number: 42,
      invalid_array: [1, 2, 3] as unknown as string,
      invalid_object: { nested: 'value' } as unknown as string,
    });

    const obj = params.toObject();
    expect(obj).toEqual({
      valid_string: 'hello',
      valid_number: 42,
    });
  });

  it('supports get and has methods', () => {
    const params = new FunnelMobEventParameters().set('key', 'value');

    expect(params.get('key')).toBe('value');
    expect(params.has('key')).toBe(true);
    expect(params.has('missing')).toBe(false);
  });

  it('supports delete method', () => {
    const params = new FunnelMobEventParameters()
      .set('key1', 'value1')
      .set('key2', 'value2');

    params.delete('key1');

    expect(params.has('key1')).toBe(false);
    expect(params.has('key2')).toBe(true);
  });
});
