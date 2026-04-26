/**
 * Standard event names for common actions.
 *
 * Names mirror Meta/TikTok Standard Events verbatim so the postback layer
 * does not need to translate. ActivateApp is fired automatically by init().
 */
export const StandardEvents = {
  ActivateApp: 'ActivateApp',
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
  InAppAdClick: 'InAppAdClick',
  InAppAdImpression: 'InAppAdImpression',
} as const;

export type StandardEventName = (typeof StandardEvents)[keyof typeof StandardEvents];
