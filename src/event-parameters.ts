type ParameterValue = string | number | boolean;

/**
 * Container for custom event parameters
 */
export class FunnelMobEventParameters {
  private params: Map<string, ParameterValue> = new Map();

  /**
   * Set a parameter value
   */
  set(key: string, value: ParameterValue): this {
    this.params.set(key, value);
    return this;
  }

  /**
   * Get a parameter value
   */
  get(key: string): ParameterValue | undefined {
    return this.params.get(key);
  }

  /**
   * Check if a parameter exists
   */
  has(key: string): boolean {
    return this.params.has(key);
  }

  /**
   * Remove a parameter
   */
  delete(key: string): boolean {
    return this.params.delete(key);
  }

  /**
   * Get all parameters as an object
   */
  toObject(): Record<string, ParameterValue> | undefined {
    if (this.params.size === 0) return undefined;
    return Object.fromEntries(this.params);
  }

  /**
   * Create parameters from an object
   */
  static fromObject(obj: Record<string, ParameterValue>): FunnelMobEventParameters {
    const params = new FunnelMobEventParameters();
    for (const [key, value] of Object.entries(obj)) {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        params.set(key, value);
      }
    }
    return params;
  }
}
