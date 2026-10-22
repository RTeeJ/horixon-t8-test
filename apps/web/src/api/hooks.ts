import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { Menu, type DiscountPreset, type MenuItemData, type OrderInput, type VoidReason } from '@coffee/domain';
import { ApiError, apiFetch } from './client';
import type { OrderDto, OrderStatus, OrderSummaryDto, PaymentResultDto } from './types';

const POLL_MS = 3000;

interface MenuResponse {
  items: Omit<MenuItemData, 'isActive'>[];
}

/** The API returns only active items, so every row is marked active here. */
export function useMenu(): UseQueryResult<Menu> {
  return useQuery({
    queryKey: ['menu'],
    queryFn: async () => {
      const res = await apiFetch<MenuResponse>('/menu', { public: true });
      return Menu.fromItems(res.items.map((i) => ({ ...i, isActive: true })));
    },
  });
}

/** Active discount presets, in display order (R§9.1). Needs a signed-in user; `data` is undefined while loading or after a failure. */
export function useDiscountPresets(): UseQueryResult<DiscountPreset[], ApiError> {
  return useQuery({
    queryKey: ['discount-presets'],
    queryFn: async () => (await apiFetch<{ presets: DiscountPreset[] }>('/discount-presets')).presets,
  });
}

export function usePlaceOrder(): UseMutationResult<OrderDto, ApiError, { input: OrderInput; idempotencyKey: string }> {
  return useMutation({
    mutationFn: ({ input, idempotencyKey }) =>
      apiFetch<OrderDto>('/orders', { method: 'POST', body: input, idempotencyKey }),
  });
}

export type PaymentBody = { method: 'QR' } | { method: 'CASH'; cashReceived: string };

export function useStartPayment(
  orderId: string,
): UseMutationResult<PaymentResultDto, ApiError, { body: PaymentBody; idempotencyKey: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }) =>
      apiFetch<PaymentResultDto>(`/orders/${encodeURIComponent(orderId)}/payments`, {
        method: 'POST',
        body,
        idempotencyKey,
      }),
    onSuccess: (result) => client.setQueryData(['order', orderId], result.order),
  });
}

export function useOrder(id: string): UseQueryResult<OrderDto, ApiError> {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => apiFetch<OrderDto>(`/orders/${encodeURIComponent(id)}`),
  });
}

/** Polls a payment while it is PENDING; the server evaluates expiry on each read (R§11.1). */
export function usePayment(txId: string | null): UseQueryResult<PaymentResultDto, ApiError> {
  const client = useQueryClient();
  return useQuery({
    queryKey: ['payment', txId],
    queryFn: async () => {
      const result = await apiFetch<PaymentResultDto>(`/payments/${encodeURIComponent(txId ?? '')}`);
      // Keeps the order cache current so PaymentPage leaves for the receipt when the order is PAID or VOIDED.
      client.setQueryData(['order', result.order.id], result.order);
      return result;
    },
    enabled: txId !== null,
    refetchInterval: (query) => (query.state.data?.transaction.status === 'PENDING' ? POLL_MS : false),
  });
}

/** Dev-only: pretends the customer paid the QR. */
export function useMockConfirm(): UseMutationResult<PaymentResultDto, ApiError, { txId: string; idempotencyKey: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ txId, idempotencyKey }) =>
      apiFetch<PaymentResultDto>(`/payments/${encodeURIComponent(txId)}/mock-confirm`, {
        method: 'POST',
        idempotencyKey,
      }),
    onSuccess: (result) => client.setQueryData(['order', result.order.id], result.order),
  });
}

export interface OrderFilters {
  date: string;
  status: 'ALL' | OrderStatus;
  method: 'ALL' | 'QR' | 'CASH' | 'NONE';
  sort: 'desc' | 'asc';
}

/** Orders for one Bangkok business date; `ALL` filters are left out of the query string (R§14). */
export function useOrders(f: OrderFilters): UseQueryResult<OrderSummaryDto[], ApiError> {
  return useQuery({
    queryKey: ['orders', f],
    queryFn: async () => {
      const qs = new URLSearchParams({ date: f.date });
      if (f.status !== 'ALL') qs.set('status', f.status);
      if (f.method !== 'ALL') qs.set('method', f.method);
      qs.set('sort', f.sort);
      const res = await apiFetch<{ orders: OrderSummaryDto[] }>(`/orders?${qs.toString()}`);
      return res.orders;
    },
  });
}

/** Voids a pending order (R§10.2). Settles either way with a list/detail refetch: a 409 means another terminal changed it. */
export function useVoidOrder(): UseMutationResult<
  OrderDto,
  ApiError,
  { orderId: string; body: { reasonCode: VoidReason; note?: string }; idempotencyKey: string }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, body, idempotencyKey }) =>
      apiFetch<OrderDto>(`/orders/${encodeURIComponent(orderId)}/void`, { method: 'POST', body, idempotencyKey }),
    // Fired, not awaited: the mutation must settle at once so the dialog can close or show the error.
    onSettled: (_data, _error, { orderId }) => {
      void client.invalidateQueries({ queryKey: ['orders'] });
      void client.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}
