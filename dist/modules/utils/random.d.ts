/**
 * Generates a random number between min and max (inclusive) with optional decimal precision
 *
 * @type {RandomNumberGenerator}
 */
export const random: RandomNumberGenerator;
export function setRandomSeed(seed?: number | null): void;
export function resetRandomSeed(): void;
export function createSeededRandom(seed?: number, seededMin?: number, seededMax?: number, seededDecimalLength?: number): RandomNumberGenerator;
export function randomPick<T>(items: string | Array<T>): string | T;
export function shuffle(items: any[], rnd?: RandomNumberGenerator): any[];
/**
 * Generate a random number between optional min and max (inclusive) and decimal precision
 */
export type RandomNumberGenerator = (min?: number, max?: number, decimalLength?: number) => number;
