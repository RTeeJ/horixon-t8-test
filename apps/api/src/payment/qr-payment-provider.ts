import { randomUUID } from 'node:crypto';
import { Money } from '@coffee/domain';

export interface QrPaymentProvider {
  createQr(orderId: string, amount: Money, expiresAt: Date): Promise<{ qrPayload: string; providerRef: string }>;
}

export const QR_PROVIDER = Symbol('QR_PROVIDER');

/** QR lifetime (R§11.1): expired means now > expiresAt. */
export const QR_TTL_MS = 5 * 60_000;

export class MockQrProvider implements QrPaymentProvider {
  async createQr(_orderId: string, amount: Money, _expiresAt: Date): Promise<{ qrPayload: string; providerRef: string }> {
    const providerRef = 'MOCK-' + randomUUID();
    return { providerRef, qrPayload: 'MOCKPAY|' + providerRef + '|' + amount.toString() };
  }
}
