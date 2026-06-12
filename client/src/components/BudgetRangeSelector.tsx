import { useState, useRef, useCallback, useEffect, useMemo } from 'react'

export interface BudgetRangeSelectorProps {
  onChange?: (range: { min: number | null; max: number }) => void
  onSubmit?: (range: { min: number | null; max: number }) => void
  availableCount?: number
}

function generateHistogramBars(count: number): number[] {
  const bars: number[] = []
  const peakIdx = Math.floor(count * 0.3)

  for (let i = 0; i < count; i++) {
    let normalized: number
    if (i <= peakIdx) {
      normalized = i / peakIdx
      normalized = 1 - Math.pow(1 - normalized, 3)
    } else {
      normalized = (i - peakIdx) / (count - 1 - peakIdx)
      normalized = 1 - normalized * normalized
    }
    const noise = 0.9 + Math.random() * 0.2
    const height = Math.max(0.08, normalized * noise)
    bars.push(height)
  }

  return bars
}

function formatCurrency(value: number | null, isMax: boolean): string {
  if (value === null || value === undefined) return isMax ? '' : ''
  if (value >= 10000) return '$10K+'
  if (value >= 1000) {
    const k = (value / 1000).toFixed(1).replace(/\.0$/, '')
    return `$${k}K`
  }
  return `$${value.toLocaleString()}`
}

function formatInputValue(value: number | null): string {
  if (value === null || value === undefined) return ''
  return value.toLocaleString()
}

function parseInputValue(value: string): number | null {
  const cleaned = value.replace(/[^0-9]/g, '')
  if (!cleaned) return null
  return parseInt(cleaned, 10)
}

export default function BudgetRangeSelector({
  onChange,
  onSubmit,
  availableCount = 26466,
}: BudgetRangeSelectorProps) {
  const MAX_LIMIT = 10000
  const BAR_COUNT = 45

  const [minValue, setMinValue] = useState<number | null>(null)
  const [maxValue, setMaxValue] = useState<number>(2400)
  const [minInput, setMinInput] = useState('')
  const [maxInput, setMaxInput] = useState('2,400')
  const [dragging, setDragging] = useState<'min' | 'max' | null>(null)
  const [hoveredHandle, setHoveredHandle] = useState<'min' | 'max' | null>(null)

  const histogramRef = useRef<HTMLDivElement>(null)
  const bars = useMemo(() => generateHistogramBars(BAR_COUNT), [])

  useEffect(() => {
    setMinInput(formatInputValue(minValue))
  }, [minValue])

  useEffect(() => {
    setMaxInput(formatInputValue(maxValue))
  }, [maxValue])

  useEffect(() => {
    onChange?.({ min: minValue, max: maxValue })
  }, [minValue, maxValue, onChange])

  const getValueFromPosition = useCallback(
    (clientX: number): number => {
      if (!histogramRef.current) return 0
      const rect = histogramRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return Math.round(ratio * MAX_LIMIT)
    },
    []
  )

  const handleMouseDown = useCallback(
    (handle: 'min' | 'max') => (e: React.MouseEvent) => {
      e.preventDefault()
      setDragging(handle)
    },
    []
  )

  const handleTouchStart = useCallback(
    (handle: 'min' | 'max') => (e: React.TouchEvent) => {
      setDragging(handle)
    },
    []
  )

  useEffect(() => {
    if (!dragging) return

    const handleMove = (clientX: number) => {
      const newValue = getValueFromPosition(clientX)
      if (dragging === 'min') {
        const clamped = Math.min(newValue, (maxValue ?? MAX_LIMIT) - 50)
        setMinValue(clamped <= 0 ? null : clamped)
      } else {
        const clamped = Math.max(newValue, (minValue ?? 0) + 50)
        setMaxValue(Math.min(clamped, MAX_LIMIT))
      }
    }

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX)
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) handleMove(e.touches[0].clientX)
    }
    const onEnd = () => setDragging(null)

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onEnd)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onEnd)
    }
  }, [dragging, minValue, maxValue, getValueFromPosition])

  const handleHistogramClick = useCallback(
    (e: React.MouseEvent) => {
      if (!histogramRef.current) return
      const rect = histogramRef.current.getBoundingClientRect()
      const ratio = (e.clientX - rect.left) / rect.width
      const clickedValue = Math.round(ratio * MAX_LIMIT)

      const minDist = Math.abs(clickedValue - (minValue ?? 0))
      const maxDist = Math.abs(clickedValue - maxValue)

      if (minDist < maxDist) {
        const clamped = Math.min(clickedValue, maxValue - 50)
        setMinValue(clamped <= 0 ? null : clamped)
      } else {
        const clamped = Math.max(clickedValue, (minValue ?? 0) + 50)
        setMaxValue(Math.min(clamped, MAX_LIMIT))
      }
    },
    [minValue, maxValue]
  )

  const handleMinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setMinInput(val)
    const parsed = parseInputValue(val)
    if (parsed !== null) {
      const clamped = Math.min(parsed, (maxValue ?? MAX_LIMIT) - 50)
      setMinValue(clamped <= 0 ? null : clamped)
    } else {
      setMinValue(null)
    }
  }

  const handleMaxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setMaxInput(val)
    const parsed = parseInputValue(val)
    if (parsed !== null) {
      const clamped = Math.max(parsed, (minValue ?? 0) + 50)
      setMaxValue(Math.min(clamped, MAX_LIMIT))
    } else {
      setMaxValue(MAX_LIMIT)
    }
  }

  const handleMinInputBlur = () => {
    setMinInput(formatInputValue(minValue))
  }

  const handleMaxInputBlur = () => {
    setMaxInput(formatInputValue(maxValue))
  }

  const minPercent = ((minValue ?? 0) / MAX_LIMIT) * 100
  const maxPercent = (maxValue / MAX_LIMIT) * 100

  return (
    <div className="w-full bg-white rounded-lg p-4 select-none border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Price Range</h3>

      <div className="relative mb-6 px-1">
        <div
          ref={histogramRef}
          className="relative flex items-end justify-between h-20 cursor-pointer"
          onClick={handleHistogramClick}
          style={{ gap: '2px' }}
        >
          {bars.map((height, i) => {
            const barValue = (i / (BAR_COUNT - 1)) * MAX_LIMIT
            const isActive = barValue >= (minValue ?? 0) && barValue <= maxValue
            return (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-colors duration-150"
                style={{
                  height: `${height * 100}%`,
                  backgroundColor: isActive ? '#3b82f6' : '#e0e7ff',
                }}
              />
            )
          })}
        </div>

        <div className="relative h-1.5 mt-2 bg-slate-200 rounded-full mx-0">
          <div
            className="absolute top-0 h-full rounded-full"
            style={{
              left: `${minPercent}%`,
              width: `${maxPercent - minPercent}%`,
              backgroundColor: '#3b82f6',
            }}
          />

          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            style={{ left: `${minPercent}%` }}
            onMouseDown={handleMouseDown('min')}
            onTouchStart={handleTouchStart('min')}
            onMouseEnter={() => setHoveredHandle('min')}
            onMouseLeave={() => setHoveredHandle(null)}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white border-2 shadow-md flex items-center justify-center cursor-grab transition-transform duration-100 ${dragging === 'min' ? 'scale-110 cursor-grabbing' : ''} ${hoveredHandle === 'min' ? 'scale-105' : ''}`}
              style={{ borderColor: dragging === 'min' || hoveredHandle === 'min' ? '#3b82f6' : '#cbd5e1' }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            </div>
          </div>

          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            style={{ left: `${maxPercent}%` }}
            onMouseDown={handleMouseDown('max')}
            onTouchStart={handleTouchStart('max')}
            onMouseEnter={() => setHoveredHandle('max')}
            onMouseLeave={() => setHoveredHandle(null)}
          >
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-slate-900 text-xs font-semibold px-2 py-1 rounded-lg shadow-md border border-slate-200 whitespace-nowrap z-10">
              {formatCurrency(maxValue, true)}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-slate-200 rotate-45" />
            </div>
            <div
              className={`w-5 h-5 rounded-full bg-white border-2 shadow-md flex items-center justify-center cursor-grab transition-transform duration-100 ${dragging === 'max' ? 'scale-110 cursor-grabbing' : ''} ${hoveredHandle === 'max' ? 'scale-105' : ''}`}
              style={{ borderColor: dragging === 'max' || hoveredHandle === 'max' ? '#3b82f6' : '#cbd5e1' }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-2">
          <span className="text-xs text-slate-500 font-medium">$0</span>
          <span className="text-xs text-slate-500 font-medium">$10K+</span>
        </div>
      </div>

      <div className="flex items-end gap-2 mb-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-700 mb-1">Min</label>
          <input
            type="text"
            value={minInput}
            onChange={handleMinInputChange}
            onBlur={handleMinInputBlur}
            placeholder="No min"
            className="w-full px-2 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
          />
        </div>
        <div className="pb-2 text-slate-400 text-xs font-medium">–</div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-700 mb-1">Max</label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-900 font-medium">$</span>
            <input
              type="text"
              value={maxInput}
              onChange={handleMaxInputChange}
              onBlur={handleMaxInputBlur}
              className="w-full pl-5 pr-2 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
            />
          </div>
        </div>
      </div>

      {(minValue || maxValue) && (
        <p className="text-xs text-slate-600 text-center mb-3">
          Selected: {minValue ? `$${minValue.toLocaleString()}` : '$0'} – ${maxValue.toLocaleString()}/mo
        </p>
      )}
    </div>
  )
}
