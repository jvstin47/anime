export function captureTargetFrame(source: HTMLCanvasElement | OffscreenCanvas | SVGElement | HTMLElement, destCanvas: HTMLCanvasElement | OffscreenCanvas, options: {
    width: number;
    height: number;
    background?: string;
}): Promise<HTMLCanvasElement | OffscreenCanvas>;
export function canvasToBlob(canvas: HTMLCanvasElement | OffscreenCanvas, format?: "png" | "webp" | "jpeg", quality?: number): Promise<Blob>;
