/**
 * Delay time
 * await delay()
 * @param ms -  Duration in milliseconds (default: 10000)
 */
export function delay(ms: number = 7000): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
