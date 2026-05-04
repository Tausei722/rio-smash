import {
  initConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';
import { supabase } from '../db/supabase';

export const PREMIUM_PRODUCT_ID = 'com.rioshikiego.eigotaisen.premium';

// IAP接続を初期化
export async function setupIAP(): Promise<void> {
  await initConnection();
}

// 商品情報を取得
export async function fetchPremiumProduct() {
  const products = await fetchProducts({ skus: [PREMIUM_PRODUCT_ID], type: 'in-app' });
  return products?.[0] ?? null;
}

// 購入を実行
export async function purchasePremium(): Promise<void> {
  const products = await fetchProducts({ skus: [PREMIUM_PRODUCT_ID], type: 'in-app' });
  if (!products || products.length === 0) {
    throw Object.assign(new Error('商品が見つかりません。しばらくしてからもう一度お試しください。'), { code: 'SKU_NOT_FOUND' });
  }
  await requestPurchase({
    request: { apple: { sku: PREMIUM_PRODUCT_ID } },
    type: 'in-app',
  });
}

// 購入完了後にSupabaseを更新
export async function activatePremium(purchase: Purchase): Promise<void> {
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
  onSuccess: (purchase: Purchase) => void,
  onError: (error: PurchaseError) => void,
) {
  const successSub = purchaseUpdatedListener(onSuccess);
  const errorSub = purchaseErrorListener(onError);
  return () => {
    successSub.remove();
    errorSub.remove();
  };
}
