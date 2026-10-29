import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";

const MIN_PHOTOS = 6;
const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const PHOTO_FETCH_TIMEOUT_MS = 15_000;

function generateOrderId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[randomInt(chars.length)]).join("");
}

function cleanText(value: unknown, maxLength = 100): string {
  return typeof value === "string"
    ? value.replace(/[^\p{L}\p{N}\s\-.,/#@+]/gu, "").replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function getCloudinaryPhotoUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return null;
    if (url.username || url.password || url.port || url.search || url.hash) return null;

    const expectedPrefix = `/${cloudName}/image/upload/`;
    if (!url.pathname.startsWith(expectedPrefix)) return null;

    // Use Cloudinary's JPEG conversion so jsPDF receives a predictable image format.
    url.pathname = url.pathname.replace(
      `/${cloudName}/image/upload/`,
      `/${cloudName}/image/upload/f_jpg,q_auto:good/`,
    );
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchPhotoAsBase64(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(PHOTO_FETCH_TIMEOUT_MS),
    redirect: "error",
  });

  if (!response.ok) throw new Error(`Photo fetch failed: ${response.status}`);

  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "image/jpeg") throw new Error("Cloudinary did not return a JPEG");

  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_PHOTO_BYTES) throw new Error("Photo exceeds size limit");

  if (!response.body) throw new Error("Photo response is empty");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_PHOTO_BYTES) {
        await reader.cancel();
        throw new Error("Photo exceeds size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) throw new Error("Photo response is empty");
  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return buffer.toString("base64");
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 64 * 1024) {
      return NextResponse.json({ error: "Слишком большой запрос" }, { status: 413 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректные данные заказа" }, { status: 400 });
    }

    const { name, phone, photoUrls, lang, delivery } = body as Record<string, unknown>;

    if (typeof name !== "string" || !name.trim() || name.length > 120) {
      return NextResponse.json({ error: "Имя клиента обязательно" }, { status: 400 });
    }
    if (typeof phone !== "string" || !phone.trim() || phone.length > 40) {
      return NextResponse.json({ error: "Телефон обязателен" }, { status: 400 });
    }
    if (!Array.isArray(photoUrls) || photoUrls.length < MIN_PHOTOS || photoUrls.length > MAX_PHOTOS) {
      return NextResponse.json({ error: `Нужно от 1 до 10 фото` }, { status: 400 });
    }

    const cloudinaryUrls = photoUrls.map(getCloudinaryPhotoUrl);
    if (cloudinaryUrls.some((url) => url === null)) {
      return NextResponse.json({ error: "Одно или несколько фото имеют некорректный адрес. Загрузите их повторно." }, { status: 400 });
    }

    if (!delivery || typeof delivery !== "object" || Array.isArray(delivery) || typeof (delivery as Record<string, unknown>).method !== "string") {
      return NextResponse.json({ error: "Не выбран способ получения" }, { status: 400 });
    }
    const deliveryData = delivery as Record<string, unknown>;
    const method = deliveryData.method;

    if (method === "posta") {
      if (
        typeof deliveryData.postalCode !== "string" || !deliveryData.postalCode.trim() ||
        typeof deliveryData.city !== "string" || !deliveryData.city.trim() ||
        typeof deliveryData.district !== "string" || !deliveryData.district.trim()
      ) {
        return NextResponse.json({ error: "Заполните адрес для Poșta Moldovei (индекс, город/село, район)" }, { status: 400 });
      }
    } else if (method === "novapost") {
      if (typeof deliveryData.novaPostBranch !== "string" || !deliveryData.novaPostBranch.trim()) {
        return NextResponse.json({ error: "Укажите номер отделения Nova Poshta" }, { status: 400 });
      }
    } else if (method !== "pickup" && method !== "later") {
      return NextResponse.json({ error: "Некорректный способ получения" }, { status: 400 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatIds = (process.env.TELEGRAM_CHAT_ID || "").split(",").map((id) => id.trim()).filter(Boolean);
    if (!token || chatIds.length === 0) {
      console.error("Order delivery is not configured: missing Telegram token or chat ID");
      return NextResponse.json({ error: "Не удалось принять заказ. Попробуйте позже или свяжитесь с нами напрямую." }, { status: 500 });
    }

    const orderId = generateOrderId();
    const safeName = cleanText(name, 50);
    const safePhone = cleanText(phone, 40);
    const numPhotos = cloudinaryUrls.length;

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const photoSize = 25.5;
    const gap = 1.7;
    const leftOffset = 11.3;
    const rightOffset = 15;
    const stripHeight = 35;
    const stripWidth = leftOffset + numPhotos * photoSize + Math.max(0, numPhotos - 1) * gap + rightOffset;
    const startX = (297 - stripWidth) / 2;
    const startY = (210 - stripHeight) / 2;

    pdf.setFillColor(0, 0, 0);
    pdf.rect(startX, startY, stripWidth, stripHeight, "F");
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.1);
    pdf.line(startX - 3, startY, startX + stripWidth + 3, startY);
    pdf.line(startX - 3, startY + stripHeight, startX + stripWidth + 3, startY + stripHeight);
    pdf.line(startX, startY - 3, startX, startY + stripHeight + 3);
    pdf.line(startX + stripWidth, startY - 3, startX + stripWidth, startY + stripHeight + 3);

    pdf.setFillColor(255, 255, 255);
    const circleRadius = 5.3 / 2;
    pdf.circle(startX + 2 + circleRadius, startY + stripHeight / 2, circleRadius, "F");

    const holeW = 2;
    const holeH = 2.5;
    const cornerR = 0.5;
    const step = 4.75;
    const holeMarginY = 1.125;
    for (let i = step * 2; i < stripWidth - holeW; i += step) {
      const currentX = startX + i;
      pdf.roundedRect(currentX, startY + holeMarginY, holeW, holeH, cornerR, cornerR, "F");
      pdf.roundedRect(currentX, startY + stripHeight - holeMarginY - holeH, holeW, holeH, cornerR, cornerR, "F");
    }

    const photoResults = await Promise.allSettled(
      (cloudinaryUrls as string[]).map((url) => fetchPhotoAsBase64(url)),
    );
    const failedPhotos = photoResults.filter((result) => result.status === "rejected").length;

    if (failedPhotos > 0) {
      console.error(`Order ${orderId}: ${failedPhotos} of ${numPhotos} photos could not be downloaded`);
      return NextResponse.json(
        { error: "Не удалось подготовить все фотографии. Пожалуйста, отправьте заказ ещё раз." },
        { status: 502 },
      );
    }

    photoResults.forEach((result, index) => {
      if (result.status !== "fulfilled") return;
      const xPos = startX + leftOffset + index * (photoSize + gap);
      const yPos = startY + (stripHeight - photoSize) / 2;
      pdf.addImage(`data:image/jpeg;base64,${result.value}`, "JPEG", xPos, yPos, photoSize, photoSize);
    });

    const pdfBuffer = Buffer.from(pdf.output("arraybuffer"));
    const langNote = lang === "ro" ? "\n🌐 Клиент оформлял на румынском (по возможности говорите по-румынски)" : "";

    let deliveryText: string;
    if (method === "posta") {
      const postalCode = cleanText(deliveryData.postalCode, 20);
      const city = cleanText(deliveryData.city, 80);
      const district = cleanText(deliveryData.district, 80);
      const street = cleanText(deliveryData.street, 100);
      deliveryText = `🚚 Способ получения: Poșta Moldovei — 30 лей\n📮 Индекс: ${postalCode}\n🏘 ${city}, р-н ${district}${street ? `\n🏠 Улица: ${street}` : ""}`;
    } else if (method === "novapost") {
      deliveryText = `🚚 Способ получения: Nova Poshta — 60 лей\n📦 Отделение №${cleanText(deliveryData.novaPostBranch, 40)}`;
    } else if (method === "pickup") {
      deliveryText = "🚚 Способ получения: Самовывоз — бесплатно\n📍 A. Bernardazzi 64, Кишинёв (09:00–23:00)";
    } else {
      deliveryText = "🚚 Способ получения: клиент уточнит после макета";
    }

    const captionText = `🔥 Новый заказ #${orderId}\n👤 Клиент: ${safeName}\n📞 Тел: ${safePhone}\n📸 Фотографий: ${numPhotos} шт.\n${deliveryText}${langNote}`;

    let deliveredToAtLeastOne = false;
    for (const chatId of chatIds) {
      const tgFormData = new FormData();
      tgFormData.append("chat_id", chatId);
      tgFormData.append("document", new Blob([pdfBuffer], { type: "application/pdf" }), `Brelok_${orderId}.pdf`);
      tgFormData.append("caption", captionText);

      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
          method: "POST",
          body: tgFormData,
          signal: AbortSignal.timeout(15_000),
        });
        if (tgRes.ok) {
          deliveredToAtLeastOne = true;
        } else {
          console.error(`Telegram delivery failed for order ${orderId}: ${tgRes.status}`);
        }
      } catch (error) {
        console.error(`Telegram request failed for order ${orderId}`, error);
      }
    }

    if (!deliveredToAtLeastOne) {
      return NextResponse.json(
        { error: "Заказ не удалось передать менеджеру. Попробуйте ещё раз или свяжитесь с нами напрямую." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, orderId });
  } catch (error) {
    console.error("Order generation failed:", error);
    return NextResponse.json({ error: "Не удалось подготовить заказ. Попробуйте ещё раз." }, { status: 500 });
  }
}
