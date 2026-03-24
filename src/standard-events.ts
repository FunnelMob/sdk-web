/**
 * Standard event names for common actions
 */
export const StandardEvents = {
  // Legacy fm_-prefixed names (kept for backwards compatibility)
  REGISTRATION: 'fm_registration',
  LOGIN: 'fm_login',
  PURCHASE: 'fm_purchase',
  SUBSCRIBE: 'fm_subscribe',
  TUTORIAL_COMPLETE: 'fm_tutorial_complete',
  LEVEL_COMPLETE: 'fm_level_complete',
  ADD_TO_CART: 'fm_add_to_cart',
  CHECKOUT: 'fm_checkout',

  // Standard Meta/TikTok event names
  PageView: 'PageView',
  ViewContent: 'ViewContent',
  Search: 'Search',
  AddToCart: 'AddToCart',
  AddToWishlist: 'AddToWishlist',
  InitiateCheckout: 'InitiateCheckout',
  AddPaymentInfo: 'AddPaymentInfo',
  Purchase: 'Purchase',
  Lead: 'Lead',
  CompleteRegistration: 'CompleteRegistration',
  Contact: 'Contact',
  Schedule: 'Schedule',
  FindLocation: 'FindLocation',
  CustomizeProduct: 'CustomizeProduct',
  Donate: 'Donate',
  SubmitApplication: 'SubmitApplication',
  ApplicationApproval: 'ApplicationApproval',
  Download: 'Download',
  SubmitForm: 'SubmitForm',
  StartTrial: 'StartTrial',
  Subscribe: 'Subscribe',
  AchieveLevel: 'AchieveLevel',
  UnlockAchievement: 'UnlockAchievement',
  SpentCredits: 'SpentCredits',
  Rate: 'Rate',
  CompleteTutorial: 'CompleteTutorial',
  ActivateApp: 'ActivateApp',
  InAppAdClick: 'InAppAdClick',
  InAppAdImpression: 'InAppAdImpression',
} as const;

export type StandardEventName = (typeof StandardEvents)[keyof typeof StandardEvents];
