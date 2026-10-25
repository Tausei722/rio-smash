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

// トランザクションを確実に完了させる（未完了取引はキューに残り続けるため）。
// Sandbox↔本番の環境不一致等で finishTransaction が失敗しても、例外を外に投げない。
export async function finishPurchaseSafely(purchase: Purchase): Promise<void> {
  try {
    await finishTransaction({ purchase });
  } catch (e) {
    // ここで throw すると、起動時リスナーの未処理 rejection になりアプリが落ちる。
    console.warn('[IAP] finishTransaction failed (ignored):', (e as Error)?.message);
  }
}

// 購入完了後にSupabaseを更新
export async function activatePremium(purchase: Purchase): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    try {
      await supabase
        .from('profiles')
        .update({ is_premium: true })
        .eq('id', session.user.id);
    } catch (e) {
      console.warn('[IAP] profiles update failed (ignored):', (e as Error)?.message);
    }
  }
  await finishPurchaseSafely(purchase);
}

// 過去のサブスクを復元
export async function restorePremium(): Promise<boolean> {
  let purchases: Purchase[] = [];
  try {
    purchases = await getAvailablePurchases();
  } catch (e) {
    console.warn('[IAP] getAvailablePurchases failed:', (e as Error)?.message);
    return false;
  }
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
  onSuccess: (purchase: Purchase) => void | Promise<void>,
  onError: (error: PurchaseError) => void,
) {
  // 起動時、キューに残った未完了取引で即発火することがある。
  // コールバックが throw / reject してもアプリを落とさないよう、ここで完全に握りつぶす。
  const successSub = purchaseUpdatedListener((purchase: Purchase) => {
    Promise.resolve()
      .then(() => onSuccess(purchase))
      .catch(e => console.warn('[IAP] onSuccess handler error (ignored):', (e as Error)?.message));
  });
  const errorSub = purchaseErrorListener((error: PurchaseError) => {
    try {
      onError(error);
    } catch (e) {
      console.warn('[IAP] onError handler error (ignored):', (e as Error)?.message);
    }
  });
  return () => {
    successSub.remove();
    errorSub.remove();
  };
}
