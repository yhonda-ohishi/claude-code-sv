export class OutputBuffer {
  private buffer: string[] = [];
  private maxLines: number;

  constructor(maxLines: number = 1000) {
    this.maxLines = maxLines;
  }

  push(output: string): void {
    this.buffer.push(output);
    if (this.buffer.length > this.maxLines) {
      this.buffer.shift();
    }
  }

  getAll(): string[] {
    return [...this.buffer];
  }

  getRecent(count: number): string[] {
    return this.buffer.slice(-count);
  }

  clear(): void {
    this.buffer = [];
  }

  get length(): number {
    return this.buffer.length;
  }
}
