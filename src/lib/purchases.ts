import { Platform } from 'react-native';
import { create } from 'zustand';

/**
 * RevenueCat subscription layer. Fully guarded: with no native module (Expo Go
 * / web), no API key, or no products yet, everything no-ops and the app stays
 * on the free tier. The moment the Apple Developer account exists and you set
 * EXPO_PUBLIC_REVENUECAT_IOS_KEY (+ create the products), the paywall goes live.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Purchases: any = null;
try {
  Purchases = require('react-native-purchases').default;
} catch {
  Purchases = null;
}

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
export const ENTITLEMENT = 'premium';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Pkg = any; // RevenueCat PurchasesPackage

export const usePurchases = create<{
  ready: boolean;
  configured: boolean;
  isPremium: boolean;
  packages: Pkg[];
  busy: boolean;
  error: string | null;
}>(() => ({
  ready: false,
  configured: false,
  isPremium: false,
  packages: [],
  busy: false,
  error: null,
}));

function apiKey(): string {
  return Platform.OS === 'android' ? ANDROID_KEY : IOS_KEY;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readPremium(info: any): boolean {
  return !!info?.entitlements?.active?.[ENTITLEMENT];
}

export async function initPurchases(appUserId?: string) {
  const key = apiKey();
  if (!Purchases || !key) {
    usePurchases.setState({ ready: true, configured: false });
    return;
  }
  try {
    Purchases.configure({ apiKey: key, appUserID: appUserId });
    usePurchases.setState({ configured: true });
    Purchases.addCustomerInfoUpdateListener((info: unknown) => {
      usePurchases.setState({ isPremium: readPremium(info) });
    });
    const info = await Purchases.getCustomerInfo();
    usePurchases.setState({ isPremium: readPremium(info) });
    await loadOfferings();
  } catch (e) {
    console.warn('RevenueCat init failed', e);
  } finally {
    usePurchases.setState({ ready: true });
  }
}

/** Tie entitlements to the signed-in account so they follow the user. */
export async function loginPurchases(uid: string) {
  if (!Purchases || !usePurchases.getState().configured) return;
  try {
    const { customerInfo } = await Purchases.logIn(uid);
    usePurchases.setState({ isPremium: readPremium(customerInfo) });
  } catch (e) {
    console.warn('RevenueCat logIn failed', e);
  }
}

export async function logoutPurchases() {
  if (!Purchases || !usePurchases.getState().configured) return;
  try {
    await Purchases.logOut();
    usePurchases.setState({ isPremium: false });
  } catch {
    // logOut throws if already anonymous — ignore
  }
}

export async function loadOfferings() {
  if (!Purchases) return;
  try {
    const offerings = await Purchases.getOfferings();
    usePurchases.setState({ packages: offerings?.current?.availablePackages ?? [] });
  } catch (e) {
    console.warn('RevenueCat offerings failed', e);
  }
}

export async function purchase(pkg: Pkg): Promise<boolean> {
  if (!Purchases) return false;
  usePurchases.setState({ busy: true, error: null });
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const premium = readPremium(customerInfo);
    usePurchases.setState({ isPremium: premium });
    return premium;
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(e as any)?.userCancelled) {
      usePurchases.setState({ error: 'Purchase could not be completed. Please try again.' });
    }
    return false;
  } finally {
    usePurchases.setState({ busy: false });
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!Purchases) return false;
  usePurchases.setState({ busy: true, error: null });
  try {
    const info = await Purchases.restorePurchases();
    const premium = readPremium(info);
    usePurchases.setState({ isPremium: premium });
    if (!premium) usePurchases.setState({ error: 'No active subscription found to restore.' });
    return premium;
  } catch {
    usePurchases.setState({ error: 'Could not restore purchases.' });
    return false;
  } finally {
    usePurchases.setState({ busy: false });
  }
}

/** Gate premium features: `if (!useIsPremium()) …` */
export function useIsPremium(): boolean {
  return usePurchases((s) => s.isPremium);
}
