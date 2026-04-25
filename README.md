# FunnelMob Web SDK

A Mobile Measurement Partner (MMP) SDK for attributing app installs to advertising campaigns.

## Installation

```bash
# npm
npm install @funnelmob/sdk

# yarn
yarn add @funnelmob/sdk

# pnpm
pnpm add @funnelmob/sdk
```

## Quick Start

```typescript
import { FunnelMob, FunnelMobConfiguration } from '@funnelmob/sdk';

// Configure the SDK
const config = new FunnelMobConfiguration({
  apiKey: 'fm_live_abc123',
});

// Initialize
FunnelMob.shared.initialize(config);

// Track events
FunnelMob.shared.trackEvent('button_click');

// Cleanup before page unload (optional)
window.addEventListener('beforeunload', () => {
  FunnelMob.shared.destroy();
});
```

## Configuration

```typescript
import { FunnelMobConfiguration, LogLevel } from '@funnelmob/sdk';

const config = new FunnelMobConfiguration({
  apiKey: 'fm_live_abc123',         // Required: Your API key
  logLevel: LogLevel.None,          // Optional: None, Error, Warning, Info, Debug, Verbose
  flushIntervalMs: 30000,           // Optional: Auto-flush interval in ms (min: 1000, default: 30000)
  maxBatchSize: 100,                // Optional: Events per batch (1-100, default: 100)
  baseUrl: 'http://localhost:3080', // Optional: Override the API host (default: https://api.funnelmob.com)
});
```

### Overriding the base URL (local development)

By default the SDK POSTs to `https://api.funnelmob.com`, appending `/v1/<endpoint>` to each request. For local development against a dev backend, pass an explicit `baseUrl` containing the **host root only** (the SDK adds `/v1`):

```typescript
const config = new FunnelMobConfiguration({
  apiKey: 'fm_live_abc123',
  baseUrl: 'http://localhost:3080',
});
```

A trailing slash on `baseUrl` is trimmed automatically.

## Event Tracking

### Simple Events

```typescript
FunnelMob.shared.trackEvent('level_complete');
```

### Events with Revenue

```typescript
import { FunnelMobRevenue } from '@funnelmob/sdk';

const revenue = FunnelMobRevenue.usd(29.99);
FunnelMob.shared.trackEvent('purchase', revenue);

// Other currencies
const eur = FunnelMobRevenue.eur(19.99);
const gbp = FunnelMobRevenue.gbp(14.99);
const jpy = new FunnelMobRevenue(2000, 'JPY');
```

### Events with Parameters

```typescript
import { FunnelMobEventParameters } from '@funnelmob/sdk';

// Fluent builder pattern
const params = new FunnelMobEventParameters()
  .set('item_id', 'sku_123')
  .set('quantity', 2)
  .set('price', 29.99)
  .set('is_gift', false);

FunnelMob.shared.trackEvent('add_to_cart', params);

// Or create from an object
const params = FunnelMobEventParameters.fromObject({
  item_id: 'sku_123',
  quantity: 2,
  price: 29.99,
});
```

### Events with Revenue and Parameters

```typescript
const revenue = FunnelMobRevenue.usd(99.00);
const params = new FunnelMobEventParameters()
  .set('plan', 'annual')
  .set('trial_days', 7);

FunnelMob.shared.trackEvent('subscribe', revenue, params);
```

## Standard Events

### Using Typed Methods (Recommended)

29 typed methods provide self-documenting event tracking with compile-time safety:

```typescript
// Simple events
FunnelMob.shared.trackPageView();
FunnelMob.shared.trackAddToCart({ item_id: 'SKU-123', content_type: 'product' });

// Revenue events (value + currency required)
FunnelMob.shared.trackPurchase(29.99, 'USD', { order_id: 'ORD-456' });
FunnelMob.shared.trackSubscribe(9.99, 'USD');
FunnelMob.shared.trackStartTrial(0, 'USD');
FunnelMob.shared.trackDonate(10, 'USD');

// Spend credits (value only)
FunnelMob.shared.trackSpentCredits(100);
```

See [docs/specs/sdk_events_reference.md](../docs/specs/sdk_events_reference.md) for the full list of 29 typed methods with platform support details.

### Using Constants

For custom event handling or when using the generic `trackEvent` API:

```typescript
import { StandardEvents } from '@funnelmob/sdk';

FunnelMob.shared.trackEvent(StandardEvents.REGISTRATION);
FunnelMob.shared.trackEvent(StandardEvents.LOGIN);
FunnelMob.shared.trackEvent(StandardEvents.PURCHASE);
FunnelMob.shared.trackEvent(StandardEvents.SUBSCRIBE);
FunnelMob.shared.trackEvent(StandardEvents.TUTORIAL_COMPLETE);
FunnelMob.shared.trackEvent(StandardEvents.LEVEL_COMPLETE);
FunnelMob.shared.trackEvent(StandardEvents.ADD_TO_CART);
FunnelMob.shared.trackEvent(StandardEvents.CHECKOUT);
```

## SDK Control

```typescript
// Disable tracking (e.g., for GDPR compliance)
FunnelMob.shared.setEnabled(false);

// Re-enable tracking
FunnelMob.shared.setEnabled(true);

// Force send queued events immediately
FunnelMob.shared.flush();

// Cleanup resources (stops flush timer, sends remaining events)
FunnelMob.shared.destroy();
```

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import type { StandardEventName } from '@funnelmob/sdk';

function trackCustomEvent(name: string | StandardEventName) {
  FunnelMob.shared.trackEvent(name);
}
```

## Framework Integration

### React

```typescript
import { useEffect } from 'react';
import { FunnelMob, FunnelMobConfiguration } from '@funnelmob/sdk';

function App() {
  useEffect(() => {
    const config = new FunnelMobConfiguration({
      apiKey: 'fm_live_abc123',
    });
    FunnelMob.shared.initialize(config);

    return () => {
      FunnelMob.shared.destroy();
    };
  }, []);

  return <div>...</div>;
}
```

### Vue

```typescript
// main.ts
import { FunnelMob, FunnelMobConfiguration } from '@funnelmob/sdk';

const config = new FunnelMobConfiguration({
  apiKey: 'fm_live_abc123',
});
FunnelMob.shared.initialize(config);

// In components
FunnelMob.shared.trackEvent('page_view');
```

## Validation

### Event Names

- Must not be empty
- Maximum 100 characters
- Must match pattern: `^[a-zA-Z][a-zA-Z0-9_]*$`
  - Must start with a letter
  - Can contain letters, numbers, and underscores
  - No hyphens, spaces, or special characters

```typescript
// Valid
FunnelMob.shared.trackEvent('purchase');           // OK
FunnelMob.shared.trackEvent('level_2_complete');   // OK
FunnelMob.shared.trackEvent('buttonClick');        // OK

// Invalid (logged as errors, not thrown)
FunnelMob.shared.trackEvent('2nd_level');          // Starts with number
FunnelMob.shared.trackEvent('my-event');           // Contains hyphen
FunnelMob.shared.trackEvent('');                   // Empty
```

### Currency

- Must be a 3-letter ISO 4217 code
- Automatically converted to uppercase

```typescript
// Valid
new FunnelMobRevenue(29.99, 'USD');
new FunnelMobRevenue(29.99, 'usd');  // Converted to 'USD'

// Invalid
new FunnelMobRevenue(29.99, 'US');      // Too short
new FunnelMobRevenue(29.99, 'USDD');    // Too long
```

## Error Handling

Errors are logged to the console rather than thrown. Set `logLevel` to see validation errors:

```typescript
const config = new FunnelMobConfiguration({
  apiKey: 'fm_live_abc123',
  logLevel: LogLevel.Debug,  // See validation errors in console
});
```

## Requirements

- Modern browsers (ES2015+)
- Node.js 16+ (for SSR)
- TypeScript 5.0+ (for type definitions)

## License

MIT
