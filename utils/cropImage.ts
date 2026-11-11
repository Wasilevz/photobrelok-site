import { Area } from "react-easy-crop";

// Функция загрузки картинки в память браузера
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

// Главная функция "ножниц"
export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  // Ограничиваем максимальный размер до 1200px:
  // Для печати мини-фото 25.5мм это дает сверхчеткие >1200 DPI,
  // при этом предотвращает зависание мобильного браузера и ускоряет загрузку фото с камеры смартфона
  const MAX_SIZE = 1200;
  const scale = Math.min(1, MAX_SIZE / Math.max(pixelCrop.width, pixelCrop.height));
  const targetWidth = Math.max(1, Math.round(pixelCrop.width * scale));
  const targetHeight = Math.max(1, Math.round(pixelCrop.height * scale));

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Вырезаем нужный кусок и рисуем на холсте
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  // Превращаем холст обратно в файл картинки (Blob) в формате JPEG
  return new Promise((resolve) => {
    canvas.toBlob((file) => {
      resolve(file);
    }, "image/jpeg", 0.9);
  });
}