"use client";

// Tremor Raw BarChart (tremor.so), trimmed to the props Figu uses: index, categories,
// colors, valueFormatter, layout, type (default | stacked), legend and tooltip.
// Recharts animations are off: motion in this app comes from Remotion only.

import {
	Bar,
	CartesianGrid,
	BarChart as RechartsBarChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
	AvailableChartColors,
	type ChartColor,
	constructCategoryColors,
	getColorClassName,
} from "./chart-utils";

type Fila = Record<string, string | number | null>;

export type BarChartProps = {
	data: Fila[];
	index: string;
	categories: string[];
	colors?: ChartColor[];
	valueFormatter?: (value: number) => string;
	/** "vertical" draws horizontal bars (categories on the Y axis). */
	layout?: "horizontal" | "vertical";
	type?: "default" | "stacked";
	showLegend?: boolean;
	yAxisWidth?: number;
	className?: string;
	/** Accessible summary of what the chart shows. */
	"aria-label"?: string;
};

type TooltipPayload = {
	dataKey?: string | number;
	value?: number | string;
	payload?: Fila;
};

function ChartTooltip({
	active,
	payload,
	label,
	colors,
	valueFormatter,
}: {
	active?: boolean;
	payload?: readonly TooltipPayload[];
	label?: string | number;
	colors: Map<string, ChartColor>;
	valueFormatter: (v: number) => string;
}) {
	if (!active || !payload?.length) return null;
	return (
		<div className="rounded-ui bg-bg-2 text-sm shadow-md ring-1 ring-bg-4">
			<p className="border-b border-bg-4 px-3 py-2 font-medium text-ink">
				{label}
			</p>
			<ul className="space-y-1 px-3 py-2">
				{payload.map((p) => {
					const key = String(p.dataKey);
					return (
						<li key={key} className="flex items-center justify-between gap-6">
							<span className="flex items-center gap-2 text-ink-2">
								<span
									aria-hidden
									className={cn(
										"size-2 rounded-sm",
										getColorClassName(colors.get(key) ?? "gris", "bg"),
									)}
								/>
								{key}
							</span>
							<span className="font-medium tabular-nums text-ink">
								{valueFormatter(Number(p.value ?? 0))}
							</span>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

export function ChartLegend({
	categories,
	colors,
}: {
	categories: string[];
	colors: Map<string, ChartColor>;
}) {
	return (
		<ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
			{categories.map((c) => (
				<li key={c} className="flex items-center gap-2">
					<span
						aria-hidden
						className={cn(
							"size-2.5 rounded-sm",
							getColorClassName(colors.get(c) ?? "gris", "bg"),
						)}
					/>
					{c}
				</li>
			))}
		</ul>
	);
}

export function BarChart({
	data,
	index,
	categories,
	colors = AvailableChartColors,
	valueFormatter = (v) => String(v),
	layout = "horizontal",
	type = "default",
	showLegend = true,
	yAxisWidth = 56,
	className,
	"aria-label": ariaLabel,
}: BarChartProps) {
	const categoryColors = constructCategoryColors(categories, colors);
	const vertical = layout === "vertical";
	const stacked = type === "stacked";
	const tick = { fontSize: 12 };
	const valueAxis = {
		type: "number" as const,
		tick,
		tickLine: false,
		axisLine: false,
		tickFormatter: valueFormatter,
		className: "fill-ink-3",
	};
	const indexAxis = {
		type: "category" as const,
		dataKey: index,
		tick,
		tickLine: false,
		axisLine: false,
		interval: 0 as const,
		className: "fill-ink-3",
	};
	return (
		<div className={cn("grid gap-3", className)}>
			{showLegend && (
				<ChartLegend categories={categories} colors={categoryColors} />
			)}
			<div className="h-64 w-full" role="img" aria-label={ariaLabel}>
				<ResponsiveContainer width="100%" height="100%">
					<RechartsBarChart
						data={data}
						layout={layout}
						margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
						barCategoryGap="20%"
					>
						<CartesianGrid
							className="stroke-bg-4"
							strokeDasharray="0"
							horizontal={!vertical}
							vertical={vertical}
						/>
						{vertical ? (
							<>
								<XAxis {...valueAxis} />
								<YAxis {...indexAxis} width={yAxisWidth} />
							</>
						) : (
							<>
								<XAxis {...indexAxis} interval="preserveStartEnd" />
								<YAxis {...valueAxis} width={yAxisWidth} />
							</>
						)}
						<ReferenceLine
							{...(vertical ? { x: 0 } : { y: 0 })}
							className="stroke-ink-3"
						/>
						<Tooltip
							isAnimationActive={false}
							cursor={{ className: "fill-bg-3" }}
							content={({ active, payload, label }) => (
								<ChartTooltip
									active={active}
									payload={payload as readonly TooltipPayload[] | undefined}
									label={label as string | number | undefined}
									colors={categoryColors}
									valueFormatter={valueFormatter}
								/>
							)}
						/>
						{categories.map((c) => (
							<Bar
								key={c}
								dataKey={c}
								name={c}
								stackId={stacked ? "stack" : undefined}
								className={getColorClassName(
									categoryColors.get(c) ?? "gris",
									"fill",
								)}
								fill=""
								isAnimationActive={false}
								maxBarSize={48}
							/>
						))}
					</RechartsBarChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
