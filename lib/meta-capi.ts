import { createHash } from "node:crypto";
import { META_PIXEL_ID } from "@/lib/meta";

const GRAPH_URL = "https://graph.facebook.com/v21.0";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** E.164 без «+»: приводит молдавские номера вида 60 123 456 к 37360123456 */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("373") && digits.length >= 11) return digits;
  const local = digits.startsWith("0") ? digits.slice(1) : digits;
  if (local.length >= 8 && local.length <= 9) return `373${local}`;
  return digits;
}

export type CapiOrder = {
  orderId: string;
  name: string;
  phone: string;
  eventIds: { lead?: string; purchase?: string };
  sourceUrl: string;
  clientIp?: string;
  userAgent?: string;
};

/**
 * Отправляет Lead и Purchase в Meta Conversions API (серверная сторона).
 * event_id совпадают с пикселем — Meta дедуплицирует.
 * Никогда не бросает ошибку: сбой CAPI не должен ломать заказ.
 */
export async function sendCapiEvents(order: CapiOrder): Promise<void> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) {
    console.warn(`Meta CAPI skipped for order ${order.orderId}: META_CAPI_TOKEN is not set`);
    return;
  }

  const userData: Record<string, string | string[]> = {};
  const phone = normalizePhone(order.phone);
  if (phone) userData.ph = [sha256(phone)];
  const [fn, ...lnParts] = order.name.trim().split(/\s+/);
  if (fn) userData.fn = sha256(fn.toLowerCase());
  if (lnParts.length) userData.ln = sha256(lnParts.join(" ").toLowerCase());
  userData.external_id = sha256(order.orderId);
  if (order.clientIp) userData.client_ip_address = order.clientIp;
  if (order.userAgent) userData.client_user_agent = order.userAgent;

  const customData = {
    currency: "MDL",
    value: 250,
    content_name: "photobrelok",
    content_type: "product",
    content_ids: [order.orderId],
  };
  const common = {
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: order.sourceUrl,
    action_source: "website",
    user_data: userData,
    custom_data: customData,
  };

  const data = [
    { ...common, event_name: "Lead", event_id: order.eventIds.lead || `lead_${order.orderId}` },
    { ...common, event_name: "Purchase", event_id: order.eventIds.purchase || `purchase_${order.orderId}` },
  ];

  try {
    const url = new URL(`${GRAPH_URL}/${META_PIXEL_ID}/events`);
    url.searchParams.set("access_token", token);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data,
        ...(process.env.META_TEST_EVENT_CODE
          ? { test_event_code: process.env.META_TEST_EVENT_CODE }
          : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`Meta CAPI failed for order ${order.orderId}: ${res.status} ${body}`);
    } else {
      console.log(`Meta CAPI ok for order ${order.orderId}: ${body}`);
    }
  } catch (error) {
    console.error(`Meta CAPI request failed for order ${order.orderId}`, error);
  }
}
