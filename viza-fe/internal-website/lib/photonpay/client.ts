interface PhotonPayGood {
  name: string;
  virtual: boolean;
  price: string;
  quantity: string;
}

interface PhotonPayShopper {
  id: string;
  nickName: string;
  platform: string;
  shopperIp: string;
  email: string;
}

interface PhotonPayRisk {
  fingerprintId: string;
  platform: string;
  retryTimes: string;
}

export interface CreateCashierSessionInput {
  reqId: string;
  amountMinor: number;
  currency: string;
  siteId: string;
  goods: PhotonPayGood[];
  shopper: PhotonPayShopper;
  risk: PhotonPayRisk;
  notifyUrl: string;
  redirectUrl: string;
  autoRedirect: boolean;
}

export interface CreateCashierSessionOutput {
  payRedirectUrl?: string;
}

class PhotonPayClient {
  async createCashierSession(
    _input: CreateCashierSessionInput,
  ): Promise<CreateCashierSessionOutput> {
    throw new Error(
      "PhotonPay checkout is not available from the Vercel runtime. Keep PHOTONPAY_ENABLED=false or proxy checkout creation through the backend.",
    );
  }
}

export function isPhotonPayEnabled(): boolean {
  return process.env.PHOTONPAY_ENABLED?.toLowerCase() === "true";
}

export function getPhotonPaySiteId(): string | null {
  return process.env.PHOTONPAY_SITE_ID?.trim() || null;
}

export function getPhotonPayClient(): PhotonPayClient | null {
  if (!isPhotonPayEnabled()) return null;

  const hasRequiredEnv =
    Boolean(process.env.PHOTONPAY_BASE_URL?.trim()) &&
    Boolean(process.env.PHOTONPAY_APP_ID?.trim()) &&
    Boolean(process.env.PHOTONPAY_APP_SECRET?.trim());

  return hasRequiredEnv ? new PhotonPayClient() : null;
}
