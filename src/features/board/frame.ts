export function grayscaleSample(
  image: ImageData,
  outputWidth = 96,
  outputHeight = 54,
): Uint8Array {
  const output = new Uint8Array(outputWidth * outputHeight);
  for (let y = 0; y < outputHeight; y += 1) {
    const sourceY = Math.min(
      image.height - 1,
      Math.floor((y / outputHeight) * image.height),
    );
    for (let x = 0; x < outputWidth; x += 1) {
      const sourceX = Math.min(
        image.width - 1,
        Math.floor((x / outputWidth) * image.width),
      );
      const source = (sourceY * image.width + sourceX) * 4;
      output[y * outputWidth + x] = Math.round(
        image.data[source] * 0.2126 +
          image.data[source + 1] * 0.7152 +
          image.data[source + 2] * 0.0722,
      );
    }
  }
  return output;
}

export function captureVideoFrame(video: HTMLVideoElement): ImageData {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("The camera frame is not ready yet");
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas image processing is unavailable");
  context.drawImage(video, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

export function imageDataUrl(
  image: ImageData,
  type: "image/jpeg" | "image/png" = "image/jpeg",
): string {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas image encoding is unavailable");
  context.putImageData(image, 0, 0);
  return canvas.toDataURL(type, type === "image/jpeg" ? 0.82 : undefined);
}
