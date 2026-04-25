import {
  initConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type ProductPurchase,
  type PurchaseError,
} from 'react-native-iap';
import { supabase } from '../db/supabase';

export const PREMIUM_PRODUCT_ID = 'com.rioshikiego.eigotaisen.premium.monthly';

// IAP接続を初期化
export async function setupIAP(): Promise<void> {
  await initConnection();
}

// サブスク商品情報を取得
export async function fetchPremiumProduct() {
  const subs = await fetchProducts({ skus: [PREMIUM_PRODUCT_ID], type: 'subs' });
  return subs?.[0] ?? null;
}

// サブスク購入を実行
export async function purchasePremium(): Promise<void> {
  await requestPurchase({
    request: { apple: { sku: PREMIUM_PRODUCT_ID } },
    type: 'subs',
  });
}

// 購入完了後にSupabaseを更新
export async function activatePremium(purchase: ProductPurchase): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('ログインが必要です');

  await supabase
    .from('profiles')
    .update({ is_premium: true })
    .eq('id', session.user.id);

  await finishTransaction({ purchase });
}

// 過去のサブスクを復元
export async function restorePremium(): Promise<boolean> {
  const purchases = await getAvailablePurchases();
  const hasPremium = purchases.some(p => p.productId === PREMIUM_PRODUCT_ID);

  if (hasPremium) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase
        .from('profiles')
        .update({ is_premium: true })
        .eq('id', session.user.id);
    }
  }

  return hasPremium;
}

// 購入リスナーのセットアップ
export function setupPurchaseListeners(
  onSuccess: (purchase: ProductPurchase) => void,
  onError: (error: PurchaseError) => void,
) {
  const successSub = purchaseUpdatedListener(onSuccess);
  const errorSub = purchaseErrorListener(onError);
  return () => {
    successSub.remove();
    errorSub.remove();
  };
}
