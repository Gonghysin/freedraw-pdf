/**
 * One Euro filter (Casiez, Roussel, Vogel, CHI 2012): an adaptive low-pass filter that
 * removes jitter at low speed and keeps lag small at high speed. Used for mouse/trackpad
 * input, which has no pressure and a noisy, sparse sample stream.
 */
class LowPass {
	private last: number | null = null;
	filter(value: number, alpha: number): number {
		this.last = this.last === null ? value : alpha * value + (1 - alpha) * this.last;
		return this.last;
	}
	get value(): number | null { return this.last; }
}

const alphaFor = (cutoff: number, dtSeconds: number): number => 1 / (1 + (1 / (2 * Math.PI * cutoff)) / dtSeconds);

export class OneEuroFilter {
	private readonly x = new LowPass();
	private readonly dx = new LowPass();
	private lastValue: number | null = null;
	private lastTime: number | null = null;
	constructor(private readonly minCutoff: number, private readonly beta: number, private readonly dCutoff = 1) {}
	filter(value: number, timeMs: number): number {
		if (this.lastValue === null || this.lastTime === null) {
			this.lastValue = value; this.lastTime = timeMs;
			return this.x.filter(value, 1);
		}
		const dt = Math.max(0.001, (timeMs - this.lastTime) / 1000);
		const rate = (value - this.lastValue) / dt;
		const smoothedRate = this.dx.filter(rate, alphaFor(this.dCutoff, dt));
		const cutoff = this.minCutoff + this.beta * Math.abs(smoothedRate);
		this.lastValue = value; this.lastTime = timeMs;
		return this.x.filter(value, alphaFor(cutoff, dt));
	}
}

/** Smooths a pointer path in screen pixels. strength 0..1 (higher = steadier, more lag at slow speed). */
export class PointerPathSmoother {
	private readonly fx: OneEuroFilter;
	private readonly fy: OneEuroFilter;
	constructor(strength: number) {
		const s = Math.max(0, Math.min(1, strength));
		const minCutoff = 4 * (1 - s) + 0.3;
		this.fx = new OneEuroFilter(minCutoff, 0.012);
		this.fy = new OneEuroFilter(minCutoff, 0.012);
	}
	filter(x: number, y: number, timeMs: number): { x: number; y: number } {
		return { x: this.fx.filter(x, timeMs), y: this.fy.filter(y, timeMs) };
	}
}
