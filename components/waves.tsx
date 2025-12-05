"use client";

import { useEffect, useRef } from "react";

class Grad {
	constructor(
		public x: number,
		public y: number,
		public z: number,
	) {}
	dot2(x: number, y: number) {
		return this.x * x + this.y * y;
	}
}

class Noise {
	private perm: number[];
	private gradP: Grad[];
	private grad3: Grad[] = [
		new Grad(1, 1, 0),
		new Grad(-1, 1, 0),
		new Grad(1, -1, 0),
		new Grad(-1, -1, 0),
		new Grad(1, 0, 1),
		new Grad(-1, 0, 1),
		new Grad(1, 0, -1),
		new Grad(-1, 0, -1),
		new Grad(0, 1, 1),
		new Grad(0, -1, 1),
		new Grad(0, 1, -1),
		new Grad(0, -1, -1),
	];
	private p: number[] = [
		151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99,
		37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
		57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27,
		166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102,
		143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116,
		188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126,
		255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152,
		2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113,
		224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
		81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121,
		50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215,
		61, 156, 180,
	];

	constructor(seed = Math.random()) {
		this.perm = new Array<number>(512).fill(0);
		this.gradP = new Array<Grad>(512).fill(this.grad3[0]!);
		if (seed > 0 && seed < 1) seed *= 65536;
		seed = Math.floor(seed);
		if (seed < 256) seed |= seed << 8;
		for (let i = 0; i < 256; i++) {
			const pVal = this.p[i] ?? 0;
			const v = i & 1 ? pVal ^ (seed & 255) : pVal ^ ((seed >> 8) & 255);
			this.perm[i] = v;
			this.perm[i + 256] = v;
			const gradVal = this.grad3[v % 12] ?? this.grad3[0]!;
			this.gradP[i] = gradVal;
			this.gradP[i + 256] = gradVal;
		}
	}

	perlin2(x: number, y: number): number {
		let X = Math.floor(x);
		let Y = Math.floor(y);
		x -= X;
		y -= Y;
		X &= 255;
		Y &= 255;
		const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
		const lerp = (a: number, b: number, t: number) => (1 - t) * a + t * b;
		const permY = this.perm[Y] ?? 0;
		const permY1 = this.perm[Y + 1] ?? 0;
		const n00 = (this.gradP[X + permY] ?? this.grad3[0]!).dot2(x, y);
		const n01 = (this.gradP[X + permY1] ?? this.grad3[0]!).dot2(x, y - 1);
		const n10 = (this.gradP[X + 1 + permY] ?? this.grad3[0]!).dot2(x - 1, y);
		const n11 = (this.gradP[X + 1 + permY1] ?? this.grad3[0]!).dot2(x - 1, y - 1);
		const u = fade(x);
		return lerp(lerp(n00, n10, u), lerp(n01, n11, u), fade(y));
	}
}

interface Point {
	x: number;
	y: number;
	wave: { x: number; y: number };
	cursor: { x: number; y: number; vx: number; vy: number };
}

export function Waves() {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const container = containerRef.current;
		if (!canvas || !container) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const noise = new Noise();
		let lines: Point[][] = [];
		let frameId: number;
		let bounds = { width: 0, height: 0, left: 0, top: 0 };
		const mouse = { x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false };

		const cfg = {
			lineColor: "rgba(0, 0, 0, 0.06)",
			speedX: 0.0125,
			speedY: 0.005,
			ampX: 32,
			ampY: 16,
			xGap: 10,
			yGap: 32,
			friction: 0.925,
			tension: 0.005,
			maxMove: 100,
		};

		function setSize() {
			if (!container || !canvas) return;
			const rect = container.getBoundingClientRect();
			bounds = { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
			canvas.width = rect.width;
			canvas.height = rect.height;
		}

		function setLines() {
			lines = [];
			const oW = bounds.width + 200;
			const oH = bounds.height + 30;
			const cols = Math.ceil(oW / cfg.xGap);
			const rows = Math.ceil(oH / cfg.yGap);
			const xStart = (bounds.width - cfg.xGap * cols) / 2;
			const yStart = (bounds.height - cfg.yGap * rows) / 2;
			for (let i = 0; i <= cols; i++) {
				const pts: Point[] = [];
				for (let j = 0; j <= rows; j++) {
					pts.push({
						x: xStart + cfg.xGap * i,
						y: yStart + cfg.yGap * j,
						wave: { x: 0, y: 0 },
						cursor: { x: 0, y: 0, vx: 0, vy: 0 },
					});
				}
				lines.push(pts);
			}
		}

		function tick(t: number) {
			mouse.sx += (mouse.x - mouse.sx) * 0.1;
			mouse.sy += (mouse.y - mouse.sy) * 0.1;
			const dx = mouse.x - mouse.lx;
			const dy = mouse.y - mouse.ly;
			mouse.v = Math.hypot(dx, dy);
			mouse.vs = Math.min(100, mouse.vs + (mouse.v - mouse.vs) * 0.1);
			mouse.lx = mouse.x;
			mouse.ly = mouse.y;
			mouse.a = Math.atan2(dy, dx);

			for (const pts of lines) {
				for (const p of pts) {
					const move = noise.perlin2((p.x + t * cfg.speedX) * 0.002, (p.y + t * cfg.speedY) * 0.0015) * 12;
					p.wave.x = Math.cos(move) * cfg.ampX;
					p.wave.y = Math.sin(move) * cfg.ampY;
					const pdx = p.x - mouse.sx;
					const pdy = p.y - mouse.sy;
					const dist = Math.hypot(pdx, pdy);
					const l = Math.max(175, mouse.vs);
					if (dist < l) {
						const s = 1 - dist / l;
						const f = Math.cos(dist * 0.001) * s;
						p.cursor.vx += Math.cos(mouse.a) * f * l * mouse.vs * 0.00065;
						p.cursor.vy += Math.sin(mouse.a) * f * l * mouse.vs * 0.00065;
					}
					p.cursor.vx += -p.cursor.x * cfg.tension;
					p.cursor.vy += -p.cursor.y * cfg.tension;
					p.cursor.vx *= cfg.friction;
					p.cursor.vy *= cfg.friction;
					p.cursor.x = Math.min(cfg.maxMove, Math.max(-cfg.maxMove, p.cursor.x + p.cursor.vx * 2));
					p.cursor.y = Math.min(cfg.maxMove, Math.max(-cfg.maxMove, p.cursor.y + p.cursor.vy * 2));
				}
			}

			ctx?.clearRect(0, 0, bounds.width, bounds.height);
			ctx?.beginPath();
			ctx!.strokeStyle = cfg.lineColor;
			for (const pts of lines) {
				if (pts.length === 0) continue;
				const moved = (p: Point, cur: boolean) => ({
					x: Math.round((p.x + p.wave.x + (cur ? p.cursor.x : 0)) * 10) / 10,
					y: Math.round((p.y + p.wave.y + (cur ? p.cursor.y : 0)) * 10) / 10,
				});
				const firstPt = pts[0]!;
				let p1 = moved(firstPt, false);
				ctx?.moveTo(p1.x, p1.y);
				for (let i = 0; i < pts.length; i++) {
					const isLast = i === pts.length - 1;
					const pt = pts[i]!;
					p1 = moved(pt, !isLast);
					ctx?.lineTo(p1.x, p1.y);
				}
			}
			ctx?.stroke();
			frameId = requestAnimationFrame(tick);
		}

		const onResize = () => {
			setSize();
			setLines();
		};
		const onMove = (x: number, y: number) => {
			mouse.x = x - bounds.left;
			mouse.y = y - bounds.top;
			if (!mouse.set) {
				mouse.sx = mouse.x;
				mouse.sy = mouse.y;
				mouse.lx = mouse.x;
				mouse.ly = mouse.y;
				mouse.set = true;
			}
		};
		const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
		const onTouchMove = (e: TouchEvent) => {
			const touch = e.touches[0];
			if (touch) onMove(touch.clientX, touch.clientY);
		};

		setSize();
		setLines();
		frameId = requestAnimationFrame(tick);
		window.addEventListener("resize", onResize, { passive: true });
		window.addEventListener("mousemove", onMouseMove, { passive: true });
		window.addEventListener("touchmove", onTouchMove, { passive: true });

		return () => {
			cancelAnimationFrame(frameId);
			window.removeEventListener("resize", onResize);
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("touchmove", onTouchMove);
		};
	}, []);

	return (
		<div ref={containerRef} className="absolute inset-0 z-[2] overflow-hidden pointer-events-none">
			<canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
		</div>
	);
}
