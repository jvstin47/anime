export function mapWebMCodecId(codec: string): string;
export function muxWebMFrames(options: MuxWebMOptions): Uint8Array;
export type WebMFrameChunk = {
    /**
     * - Raw encoded video frame payload
     */
    data: Uint8Array;
    /**
     * - Frame presentation timestamp in milliseconds
     */
    timestampMs: number;
    /**
     * - Whether this chunk is a keyframe
     */
    isKey?: boolean;
};
export type MuxWebMOptions = {
    width: number;
    height: number;
    fps?: number;
    codec?: string;
    durationMs?: number;
    chunks: Array<WebMFrameChunk>;
};
