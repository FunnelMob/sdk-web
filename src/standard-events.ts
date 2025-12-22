/**
 * Standard event names for common actions
 */
export const StandardEvents = {
  REGISTRATION: 'fm_registration',
  LOGIN: 'fm_login',
  PURCHASE: 'fm_purchase',
  SUBSCRIBE: 'fm_subscribe',
  TUTORIAL_COMPLETE: 'fm_tutorial_complete',
  LEVEL_COMPLETE: 'fm_level_complete',
  ADD_TO_CART: 'fm_add_to_cart',
  CHECKOUT: 'fm_checkout',
} as const;

export type StandardEventName = (typeof StandardEvents)[keyof typeof StandardEvents];
