import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FunnelMob } from '../funnelmob';
import { FunnelMobConfiguration, LogLevel } from '../configuration';
import { FunnelMobEventParameters } from '../event-parameters';
import { StandardEvents } from '../standard-events';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('Standard Events', () => {
  let sdk: FunnelMob;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // Reset singleton
    // @ts-expect-error accessing private static
    FunnelMob.instance = null;
    sdk = FunnelMob.shared;

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: 'test', server_timestamp: new Date().toISOString() }),
    });

    sdk.initialize(new FunnelMobConfiguration({ apiKey: 'test-key', logLevel: LogLevel.None }));

    // initialize() auto-fires an ActivateApp event. Drain it so each test
    // starts with an empty queue.
    sdk.flush();
    await new Promise((r) => setTimeout(r, 10));
    vi.clearAllMocks();
  });

  afterEach(() => {
    sdk.destroy();
  });

  // Helper: flush and capture the event batch sent to the server.
  async function getQueuedEvents(): Promise<Record<string, unknown>[]> {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    sdk.flush();
    await new Promise((r) => setTimeout(r, 50));

    const eventsCalls = mockFetch.mock.calls.filter(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('/events')
    );
    if (eventsCalls.length === 0) return [];
    const body = JSON.parse(eventsCalls[eventsCalls.length - 1][1].body);
    return body.events as Record<string, unknown>[];
  }

  describe('StandardEvents constants', () => {
    it('has all 29 standard event name constants', () => {
      expect(StandardEvents.Purchase).toBe('Purchase');
      expect(StandardEvents.ViewContent).toBe('ViewContent');
      expect(StandardEvents.Search).toBe('Search');
      expect(StandardEvents.AddToCart).toBe('AddToCart');
      expect(StandardEvents.AddToWishlist).toBe('AddToWishlist');
      expect(StandardEvents.InitiateCheckout).toBe('InitiateCheckout');
      expect(StandardEvents.AddPaymentInfo).toBe('AddPaymentInfo');
      expect(StandardEvents.Lead).toBe('Lead');
      expect(StandardEvents.CompleteRegistration).toBe('CompleteRegistration');
      expect(StandardEvents.Contact).toBe('Contact');
      expect(StandardEvents.Schedule).toBe('Schedule');
      expect(StandardEvents.FindLocation).toBe('FindLocation');
      expect(StandardEvents.CustomizeProduct).toBe('CustomizeProduct');
      expect(StandardEvents.Donate).toBe('Donate');
      expect(StandardEvents.SubmitApplication).toBe('SubmitApplication');
      expect(StandardEvents.ApplicationApproval).toBe('ApplicationApproval');
      expect(StandardEvents.Download).toBe('Download');
      expect(StandardEvents.SubmitForm).toBe('SubmitForm');
      expect(StandardEvents.StartTrial).toBe('StartTrial');
      expect(StandardEvents.Subscribe).toBe('Subscribe');
      expect(StandardEvents.AchieveLevel).toBe('AchieveLevel');
      expect(StandardEvents.UnlockAchievement).toBe('UnlockAchievement');
      expect(StandardEvents.SpentCredits).toBe('SpentCredits');
      expect(StandardEvents.Rate).toBe('Rate');
      expect(StandardEvents.CompleteTutorial).toBe('CompleteTutorial');
      expect(StandardEvents.ActivateApp).toBe('ActivateApp');
      expect(StandardEvents.InAppAdClick).toBe('InAppAdClick');
      expect(StandardEvents.InAppAdImpression).toBe('InAppAdImpression');
      expect(StandardEvents.PageView).toBe('PageView');
    });

  });

  describe('trackPurchase', () => {
    it('sends Purchase event with revenue', async () => {
      sdk.trackPurchase(29.99, 'USD');
      const events = await getQueuedEvents();

      expect(events).toHaveLength(1);
      expect(events[0].event_name).toBe('Purchase');
      expect((events[0].revenue as Record<string, string>).amount).toBe('29.99');
      expect((events[0].revenue as Record<string, string>).currency).toBe('USD');
    });

    it('sends Purchase event with revenue and parameters', async () => {
      const params = new FunnelMobEventParameters().set('order_id', 'ORD-123').set('num_items', 2);
      sdk.trackPurchase(99.0, 'EUR', params);
      const events = await getQueuedEvents();

      expect(events[0].event_name).toBe('Purchase');
      expect((events[0].revenue as Record<string, string>).currency).toBe('EUR');
      expect((events[0].parameters as Record<string, unknown>).order_id).toBe('ORD-123');
    });

    it('normalizes currency to uppercase', async () => {
      sdk.trackPurchase(10, 'usd');
      const events = await getQueuedEvents();
      expect((events[0].revenue as Record<string, string>).currency).toBe('USD');
    });
  });

  describe('trackSubscribe', () => {
    it('sends Subscribe event with required revenue', async () => {
      sdk.trackSubscribe(9.99, 'USD');
      const events = await getQueuedEvents();

      expect(events[0].event_name).toBe('Subscribe');
      expect((events[0].revenue as Record<string, string>).amount).toBe('9.99');
    });
  });

  describe('trackStartTrial', () => {
    it('sends StartTrial event with zero value for free trials', async () => {
      sdk.trackStartTrial(0, 'USD');
      const events = await getQueuedEvents();

      expect(events[0].event_name).toBe('StartTrial');
      expect((events[0].revenue as Record<string, string>).amount).toBe('0.00');
    });
  });

  describe('trackDonate', () => {
    it('sends Donate event with required revenue', async () => {
      sdk.trackDonate(50, 'USD');
      const events = await getQueuedEvents();

      expect(events[0].event_name).toBe('Donate');
      expect((events[0].revenue as Record<string, string>).amount).toBe('50.00');
    });
  });

  describe('trackViewContent', () => {
    it('sends ViewContent event with no args', async () => {
      sdk.trackViewContent();
      const events = await getQueuedEvents();

      expect(events[0].event_name).toBe('ViewContent');
      expect(events[0].revenue).toBeUndefined();
    });

    it('sends ViewContent event with optional parameters', async () => {
      const params = new FunnelMobEventParameters().set('content_name', 'Product A');
      sdk.trackViewContent(params);
      const events = await getQueuedEvents();

      expect(events[0].event_name).toBe('ViewContent');
      expect((events[0].parameters as Record<string, unknown>).content_name).toBe('Product A');
    });
  });

  describe('trackSearch', () => {
    it('sends Search event', async () => {
      sdk.trackSearch(new FunnelMobEventParameters().set('search_string', 'sneakers'));
      const events = await getQueuedEvents();

      expect(events[0].event_name).toBe('Search');
      expect((events[0].parameters as Record<string, unknown>).search_string).toBe('sneakers');
    });
  });

  describe('trackAddToCart', () => {
    it('sends AddToCart event', async () => {
      sdk.trackAddToCart();
      const events = await getQueuedEvents();
      expect(events[0].event_name).toBe('AddToCart');
    });
  });

  describe('trackLead', () => {
    it('sends Lead event with no args', async () => {
      sdk.trackLead();
      const events = await getQueuedEvents();
      expect(events[0].event_name).toBe('Lead');
    });
  });

  describe('trackCompleteRegistration', () => {
    it('sends CompleteRegistration event', async () => {
      sdk.trackCompleteRegistration(
        new FunnelMobEventParameters().set('registration_method', 'Email')
      );
      const events = await getQueuedEvents();
      expect(events[0].event_name).toBe('CompleteRegistration');
    });
  });

  describe('trackSpentCredits', () => {
    it('sends SpentCredits with value in parameters', async () => {
      sdk.trackSpentCredits(100);
      const events = await getQueuedEvents();

      expect(events[0].event_name).toBe('SpentCredits');
      expect(events[0].revenue).toBeUndefined();
      expect((events[0].parameters as Record<string, unknown>).value).toBe(100);
    });

    it('merges additional parameters with required value', async () => {
      const params = new FunnelMobEventParameters().set('content_type', 'product');
      sdk.trackSpentCredits(50, params);
      const events = await getQueuedEvents();

      const p = events[0].parameters as Record<string, unknown>;
      expect(p.value).toBe(50);
      expect(p.content_type).toBe('product');
    });
  });

  describe('no-arg events', () => {
    const noArgEvents: Array<[string, () => void]> = [
      ['Contact', () => sdk.trackContact()],
      ['Schedule', () => sdk.trackSchedule()],
      ['FindLocation', () => sdk.trackFindLocation()],
      ['CustomizeProduct', () => sdk.trackCustomizeProduct()],
      ['SubmitApplication', () => sdk.trackSubmitApplication()],
      ['ApplicationApproval', () => sdk.trackApplicationApproval()],
      ['AchieveLevel', () => sdk.trackAchieveLevel()],
      ['UnlockAchievement', () => sdk.trackUnlockAchievement()],
      ['CompleteTutorial', () => sdk.trackCompleteTutorial()],
      ['ActivateApp', () => sdk.trackActivateApp()],
      ['InAppAdClick', () => sdk.trackInAppAdClick()],
      ['InAppAdImpression', () => sdk.trackInAppAdImpression()],
      ['PageView', () => sdk.trackPageView()],
      ['Rate', () => sdk.trackRate()],
      ['Download', () => sdk.trackDownload()],
      ['SubmitForm', () => sdk.trackSubmitForm()],
      ['AddToWishlist', () => sdk.trackAddToWishlist()],
      ['InitiateCheckout', () => sdk.trackInitiateCheckout()],
      ['AddPaymentInfo', () => sdk.trackAddPaymentInfo()],
    ];

    for (const [eventName, track] of noArgEvents) {
      it(`sends ${eventName} event`, async () => {
        track();
        const events = await getQueuedEvents();
        expect(events[0].event_name).toBe(eventName);
        expect(events[0].revenue).toBeUndefined();
      });
    }
  });
});
