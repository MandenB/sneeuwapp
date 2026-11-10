import { useEffect, useState, type FormEvent } from 'react'
import './App.css'

type Resort = {
  id: string
  name: string
  country: string
  countryCode: string
  admin1?: string
  latitude: number
  longitude: number
  elevation: number
}

type GeocodingResult = {
  id: number
  name: string
  country: string
  country_code: string
  admin1?: string
  latitude: number
  longitude: number
  elevation: number
}

type WeatherValue = number | null

type WeatherData = {
  current: {
    time: string
    temperature_2m: WeatherValue
    apparent_temperature: WeatherValue
    weather_code: WeatherValue
    wind_speed_10m: WeatherValue
    wind_direction_10m: WeatherValue
    wind_gusts_10m: WeatherValue
    cloud_cover: WeatherValue
    snowfall: WeatherValue
    snow_depth: WeatherValue
  }
  hourly: {
    time: string[]
    temperature_2m: WeatherValue[]
    apparent_temperature: WeatherValue[]
    weather_code: WeatherValue[]
    wind_speed_10m: WeatherValue[]
    wind_direction_10m: WeatherValue[]
    wind_gusts_10m: WeatherValue[]
    cloud_cover: WeatherValue[]
    snowfall: WeatherValue[]
    snow_depth: WeatherValue[]
  }
  daily: {
    time: string[]
    temperature_2m_max: WeatherValue[]
    temperature_2m_min: WeatherValue[]
    weather_code: WeatherValue[]
    snowfall_sum: WeatherValue[]
    wind_speed_10m_max: WeatherValue[]
    wind_gusts_10m_max: WeatherValue[]
    precipitation_probability_max: WeatherValue[]
  }
  timezone: string
}

type ModelVariable = 'snowfall' | 'snow_depth' | 'cloud_cover' | 'temperature_2m' | 'wind_speed_10m'
type ModelId = string
type AvailableModel = {
  id: ModelId
  label: string
  color: string
  metrics: Partial<Record<ModelVariable, WeatherValue[]>>
}
type ModelForecast = {
  hourly: { time: string[] }
  timezone: string
  models: AvailableModel[]
}

type HistoricalSnowDepth = {
  daily: { date: string; snowDepthCm: number }[]
  timezone: string
}

type Unit = 'celsius' | 'fahrenheit'
type ComparisonMetric = ModelVariable
type SnowfallView = 'total' | '12-hour'
type GraphTab = 'forecast' | 'history'

const forecastModels: { id: string; label: string; color: string }[] = [
  { id: 'ecmwf_ifs025', label: 'ECMWF IFS', color: '#54816b' },
  { id: 'gfs_seamless', label: 'GFS', color: '#d49a45' },
  { id: 'gfs_global', label: 'GFS Global', color: '#cf7954' },
  { id: 'icon_seamless', label: 'ICON', color: '#7185a6' },
  { id: 'icon_global', label: 'ICON Global', color: '#987bb5' },
  { id: 'icon_eu', label: 'ICON EU', color: '#638bb1' },
  { id: 'icon_d2', label: 'ICON-D2', color: '#4d8c91' },
  { id: 'meteofrance_seamless', label: 'Météo-France', color: '#aa7194' },
  { id: 'meteofrance_arpege_world', label: 'ARPEGE World', color: '#ba7d9e' },
  { id: 'meteofrance_arpege_europe', label: 'ARPEGE Europe', color: '#94607e' },
  { id: 'meteofrance_arome_france', label: 'AROME France', color: '#c18eaa' },
  { id: 'jma_seamless', label: 'JMA', color: '#6a9da0' },
  { id: 'gem_seamless', label: 'GEM', color: '#a17855' },
  { id: 'ukmo_seamless', label: 'UK Met Office', color: '#768b55' },
  { id: 'ukmo_global_deterministic_10km', label: 'UKMO Global', color: '#95a45f' },
  { id: 'meteoswiss_icon_ch1', label: 'MeteoSwiss ICON-CH1', color: '#5184a0' },
  { id: 'meteoswiss_icon_ch2', label: 'MeteoSwiss ICON-CH2', color: '#739bb0' },
  { id: 'knmi_harmonie_arome_europe', label: 'KNMI HARMONIE', color: '#b48743' },
]

const comparisonMetrics: { id: ComparisonMetric; label: string }[] = [
  { id: 'snowfall', label: 'Snowfall' },
  { id: 'snow_depth', label: 'Snow depth' },
  { id: 'cloud_cover', label: 'Cloud cover' },
  { id: 'temperature_2m', label: 'Temperature' },
  { id: 'wind_speed_10m', label: 'Wind speed' },
]

const initialResort: Resort = {
  id: 'zermatt',
  name: 'Zermatt',
  country: 'Switzerland',
  countryCode: 'CH',
  admin1: 'Valais',
  latitude: 46.01998,
  longitude: 7.74863,
  elevation: 1608,
}
const directionLabels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

function weatherLabel(code: WeatherValue) {
  if (code === null) return 'Conditions unavailable'
  if (code === 0) return 'Clear'
  if (code <= 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code <= 48) return 'Fog'
  if (code <= 57) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Rain showers'
  if (code <= 86) return 'Snow showers'
  if (code <= 99) return 'Thunderstorm'
  return 'Conditions unavailable'
}

function weatherIcon(code: WeatherValue) {
  if (code === null) return '—'
  if (code === 0) return '☀'
  if (code <= 2) return '◒'
  if (code <= 3) return '☁'
  if (code <= 48) return '≋'
  if (code <= 67 || (code >= 80 && code <= 82)) return '☂'
  if (code <= 77 || code === 85 || code === 86) return '❄'
  if (code <= 99) return 'ϟ'
  return '☁'
}

function temperature(value: WeatherValue, unit: Unit) {
  if (value === null) return '—'
  const converted = unit === 'fahrenheit' ? (value * 9) / 5 + 32 : value
  return Math.round(converted).toString()
}

function direction(value: WeatherValue) {
  if (value === null) return '—'
  return directionLabels[Math.round(value / 22.5) % directionLabels.length]
}

function formatValue(value: WeatherValue, suffix: string, digits = 0) {
  if (value === null) return '—'
  return `${Number(value.toFixed(digits))}${suffix}`
}

function getHourLabel(time: string) {
  const hour = Number(time.slice(11, 13))
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return '—'
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2020, 0, 1, hour)))
}

function getDayLabel(day: string, timezone: string, index: number) {
  if (index === 0) return 'Today'
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    timeZone: timezone,
  }).format(new Date(`${day}T12:00:00Z`))
}

function getModelDayLabel(day: string) {
  const parts = new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(new Date(`${day}T12:00:00Z`))
  return parts
    .filter((part) => part.type === 'weekday' || part.type === 'day')
    .map((part) => part.value)
    .join(' ')
}

function getSnowSeasonStartYear(date = new Date()) {
  return date.getUTCMonth() >= 9 ? date.getUTCFullYear() : date.getUTCFullYear() - 1
}

function formatResortLabel(resort: Resort) {
  return [resort.name, resort.admin1, resort.country]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(', ')
}

async function searchAlpineLocations(query: string, signal: AbortSignal): Promise<Resort[]> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.search = new URLSearchParams({
    name: query,
    count: '100',
    language: 'en',
    format: 'json',
  }).toString()
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Location search is unavailable right now. Please try again.')
  const data = (await response.json()) as { results?: GeocodingResult[] }
  const alpineCountries = new Set(['FR', 'CH', 'IT', 'AT', 'DE', 'SI', 'LI'])
  return (data.results ?? [])
    .filter((location) =>
      alpineCountries.has(location.country_code) &&
      location.latitude >= 43 &&
      location.latitude <= 48.7 &&
      location.longitude >= 5 &&
      location.longitude <= 17.5,
    )
    .map((location) => ({
      id: String(location.id),
      name: location.name,
      country: location.country,
      countryCode: location.country_code,
      admin1: location.admin1,
      latitude: location.latitude,
      longitude: location.longitude,
      elevation: Number.isFinite(location.elevation) ? location.elevation : 0,
    }))
}

async function getWeather(resort: Resort, signal: AbortSignal, elevation = resort.elevation): Promise<WeatherData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude: String(resort.latitude),
    longitude: String(resort.longitude),
    elevation: String(elevation),
    current:
      'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,snowfall,snow_depth',
    hourly:
      'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,snowfall,snow_depth',
    daily:
      'temperature_2m_max,temperature_2m_min,weather_code,snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max,precipitation_probability_max',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    snowfall_unit: 'cm',
    forecast_days: '10',
    timezone: 'auto',
  }).toString()

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Mountain weather is unavailable right now. Please try again.')
  return (await response.json()) as WeatherData
}

async function getModelForecast(
  resort: Resort,
  signal: AbortSignal,
  elevation = resort.elevation,
): Promise<ModelForecast> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude: String(resort.latitude),
    longitude: String(resort.longitude),
    elevation: String(elevation),
    hourly: 'snowfall,snow_depth,cloud_cover,temperature_2m,wind_speed_10m',
    snowfall_unit: 'cm',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    forecast_days: '16',
    timezone: 'auto',
    models: forecastModels.map((model) => model.id).join(','),
  }).toString()

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Model comparison data is unavailable right now. Please try again.')
  const data = (await response.json()) as {
    hourly: Record<string, unknown>
    timezone: string
  }
  const time = data.hourly.time
  if (!Array.isArray(time) || !time.every((value) => typeof value === 'string')) {
    throw new Error('The model forecast response did not include a valid timeline.')
  }

  const metrics: ModelVariable[] = ['snowfall', 'snow_depth', 'cloud_cover', 'temperature_2m', 'wind_speed_10m']
  const models = forecastModels.flatMap((model) => {
    const availableMetrics: Partial<Record<ModelVariable, WeatherValue[]>> = {}
    for (const metric of metrics) {
      const values = data.hourly[`${metric}_${model.id}`]
      if (
        Array.isArray(values) &&
        values.every((value) => value === null || typeof value === 'number') &&
        values.some((value) => typeof value === 'number')
      ) {
        availableMetrics[metric] = values as WeatherValue[]
      }
    }
    if (Object.keys(availableMetrics).length === 0) return []
    return [{ ...model, metrics: availableMetrics }]
  })

  return {
    hourly: { time },
    timezone: data.timezone,
    models,
  }
}

async function getHistoricalSnowDepth(
  resort: Resort,
  seasonStartYear: number,
  signal: AbortSignal,
  elevation = resort.elevation,
): Promise<HistoricalSnowDepth> {
  const startDate = new Date(Date.UTC(seasonStartYear, 9, 1))
  const seasonEndDate = new Date(Date.UTC(seasonStartYear + 1, 8, 30))
  const archiveEndDate = new Date()
  archiveEndDate.setUTCDate(archiveEndDate.getUTCDate() - 7)
  const endDate = archiveEndDate < seasonEndDate ? archiveEndDate : seasonEndDate
  if (endDate < startDate) return { daily: [], timezone: 'UTC' }

  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.search = new URLSearchParams({
    latitude: String(resort.latitude),
    longitude: String(resort.longitude),
    elevation: String(elevation),
    start_date: startDate.toISOString().slice(0, 10),
    end_date: endDate.toISOString().slice(0, 10),
    hourly: 'snow_depth',
    timezone: 'auto',
  }).toString()

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Historical snow-depth data is unavailable for this location. Please try again later.')
  const data = (await response.json()) as {
    hourly?: { time?: unknown; snow_depth?: unknown }
    timezone?: unknown
  }
  const times = data.hourly?.time
  const depths = data.hourly?.snow_depth
  if (
    !Array.isArray(times) ||
    !times.every((time) => typeof time === 'string') ||
    !Array.isArray(depths) ||
    depths.length !== times.length ||
    !depths.every((depth) => depth === null || typeof depth === 'number') ||
    typeof data.timezone !== 'string'
  ) {
    throw new Error('Historical snow-depth data returned an invalid response.')
  }

  const latestDepthByDate = new Map<string, number>()
  times.forEach((time, index) => {
    const depth = depths[index]
    if (depth !== null) latestDepthByDate.set(time.slice(0, 10), depth * 100)
  })

  return {
    daily: [...latestDepthByDate].map(([date, snowDepthCm]) => ({ date, snowDepthCm })),
    timezone: data.timezone,
  }
}

function UpperMountainConditions({
  weather,
  elevation,
  currentTime,
  unit,
  loading,
  error,
}: {
  weather: WeatherData | null
  elevation: number
  currentTime: string
  unit: Unit
  loading: boolean
  error: string
}) {
  const firstHour = weather?.hourly.time.findIndex((time) => time >= currentTime) ?? -1
  const snowfallHours = firstHour >= 0
    ? weather?.hourly.snowfall.slice(firstHour, firstHour + 24) ?? []
    : []
  const snowfall = snowfallHours.length === 24 && snowfallHours.every((value) => value !== null)
    ? snowfallHours.reduce<number>((total, value) => total + (value ?? 0), 0)
    : null
  const snowDepth = weather?.current.snow_depth === null || weather?.current.snow_depth === undefined
    ? null
    : weather.current.snow_depth * 100
  const temperatureUnit = unit === 'celsius' ? '°C' : '°F'

  return (
    <section className="forecast-section upper-mountain-section">
      <div className="section-heading">
        <div>
          <p className="card-kicker">UPPER MOUNTAIN</p>
          <h2>Conditions at {elevation.toLocaleString()} m</h2>
        </div>
        <span className="forecast-caption">Same coordinates · higher elevation</span>
      </div>
      {loading && <p className="no-model-data">Loading upper-mountain forecast…</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {weather && (
        <div className="upper-mountain-grid">
          <article>
            <span>Temperature</span>
            <strong>{weather.current.temperature_2m === null ? '—' : `${temperature(weather.current.temperature_2m, unit)}${temperatureUnit}`}</strong>
          </article>
          <article>
            <span>New snow · 24 h</span>
            <strong>{formatValue(snowfall, ' cm', 1)}</strong>
          </article>
          <article>
            <span>Snow on ground</span>
            <strong>{formatValue(snowDepth, ' cm')}</strong>
          </article>
          <article>
            <span>Wind · {direction(weather.current.wind_direction_10m)}</span>
            <strong>{formatValue(weather.current.wind_speed_10m, ' km/h')}</strong>
          </article>
        </div>
      )}
    </section>
  )
}

function ModelSnowfallChart({
  forecast,
  mountainForecast,
  mountainForecastLoading,
  mountainForecastError,
  currentTime,
  unit,
  resort,
  upperElevation,
}: {
  forecast: ModelForecast
  mountainForecast: ModelForecast | null
  mountainForecastLoading: boolean
  mountainForecastError: string
  currentTime: string
  unit: Unit
  resort: Resort
  upperElevation: number
}) {
  const [visibleModels, setVisibleModels] = useState<string[]>(() => forecast.models.map((model) => model.id))
  const [metric, setMetric] = useState<ComparisonMetric>('snowfall')
  const [view, setView] = useState<SnowfallView>('total')
  const [graphTab, setGraphTab] = useState<GraphTab>('forecast')
  const [forecastElevation, setForecastElevation] = useState<'location' | 'mountain'>('location')
  const [historyElevation, setHistoryElevation] = useState<'location' | 'mountain'>('location')
  const [historyTabVisited, setHistoryTabVisited] = useState(false)
  const [daysToShow, setDaysToShow] = useState(16)
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const chart = { width: 760, height: 278, left: 44, right: 18, top: 18, bottom: 48 }
  const plotWidth = chart.width - chart.left - chart.right
  const plotHeight = chart.height - chart.top - chart.bottom
  const activeForecast = forecastElevation === 'location' ? forecast : mountainForecast ?? forecast
  const activeElevation = forecastElevation === 'location' ? resort.elevation : upperElevation
  const displayedElevation = graphTab === 'forecast'
    ? activeElevation
    : historyElevation === 'location' ? resort.elevation : upperElevation
  const firstMatch = activeForecast.hourly.time.findIndex((time) => time >= currentTime)
  const firstHour = firstMatch < 0 ? 0 : firstMatch
  const firstTime = activeForecast.hourly.time[firstHour]
  const lastAvailableHour = Math.max(
    firstHour,
    ...activeForecast.models.flatMap((model) => {
      const values = model.metrics[metric] ?? []
      for (let index = values.length - 1; index >= firstHour; index -= 1) {
        if (values[index] !== null) return [index]
      }
      return []
    }),
  )
  const availableHours = lastAvailableHour - firstHour + 1
  const rangeHours = Math.min(availableHours, daysToShow * 24)
  const visibleLastAvailableHour = firstHour + rangeHours - 1
  const forecastDays = Math.ceil(rangeHours / 24)
  const bucketCount = Math.ceil(rangeHours / 12)
  const chartPoints = firstTime ? [{ time: firstTime }] : []

  useEffect(() => {
    setVisibleModels(activeForecast.models.map((model) => model.id))
    setSelectedPoint(null)
  }, [activeForecast])

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const end = Math.min(firstHour + (bucket + 1) * 12, visibleLastAvailableHour + 1)
    const time = activeForecast.hourly.time[end - 1]
    if (time) chartPoints.push({ time })
  }

  const metricDetails = {
    snowfall: { unit: 'cm', description: 'snowfall' },
    snow_depth: { unit: 'cm', description: 'snow depth' },
    cloud_cover: { unit: '%', description: 'cloud cover' },
    temperature_2m: { unit: unit === 'celsius' ? '°C' : '°F', description: 'temperature' },
    wind_speed_10m: { unit: 'km/h', description: 'wind speed' },
  }[metric]

  const series = activeForecast.models.flatMap((model) => {
    const hourlyValues = model.metrics[metric]
    if (!hourlyValues) return []
    let runningTotal = 0
    let forecastEnded = false
    let coverageHours = 0
    const increments = chartPoints.map((_, pointIndex) => {
      if (pointIndex === 0) return metric === 'snowfall' ? 0 : hourlyValues[firstHour]
      if (metric === 'snow_depth') {
        const depthIndex = Math.min(firstHour + pointIndex * 12 - 1, visibleLastAvailableHour)
        const depth = hourlyValues[depthIndex]
        if (depth !== null) {
          const intervalStart = firstHour + (pointIndex - 1) * 12
          coverageHours += Math.min(12, visibleLastAvailableHour - intervalStart + 1)
        }
        return depth
      }
      const start = firstHour + (pointIndex - 1) * 12
      const end = Math.min(firstHour + pointIndex * 12, visibleLastAvailableHour + 1)
      const hours = hourlyValues.slice(start, end)
      const availableHours = hours.filter((value): value is number => value !== null)
      if (forecastEnded || availableHours.length === 0) {
        forecastEnded = true
        return null
      }
      if (metric === 'snowfall' && availableHours.length !== hours.length) {
        forecastEnded = true
        return null
      }
      coverageHours += availableHours.length
      if (metric === 'snowfall') {
        return availableHours.reduce((sum, value) => sum + value, 0)
      }
      return availableHours.reduce((sum, value) => sum + value, 0) / availableHours.length
    })
    const chartIncrements = increments.map((value) => {
      if (value === null) return null
      if (metric === 'snow_depth') return value * 100
      if (metric === 'temperature_2m' && unit === 'fahrenheit') return (value * 9) / 5 + 32
      return value
    })
    const cumulative = chartIncrements.reduce<WeatherValue[]>((values, value) => {
      if (value === null || values.at(-1) === null) {
        values.push(null)
        return values
      }
      runningTotal += value
      values.push(runningTotal)
      return values
    }, [])
    const complete = chartIncrements.length > 1 && chartIncrements.at(-1) !== null
    return [{
      ...model,
      display: metric === 'snowfall'
        ? view === 'total' ? cumulative : chartIncrements
        : chartIncrements,
      total: complete ? cumulative.at(-1) ?? null : null,
      current: chartIncrements[0],
      nextPeriod: chartIncrements[1] ?? null,
      coverageHours,
      complete,
    }]
  })

  const meanValues = chartPoints.map((_, index) => {
    const availableValues = series
      .map((model) => model.display[index])
      .filter((value): value is number => value !== null)
    if (availableValues.length === 0) return null
    return availableValues.reduce((sum, value) => sum + value, 0) / availableValues.length
  })
  const completeModels = series.filter((model) => model.complete)
  const modelTotals = completeModels
    .map((model) => model.total)
    .filter((value): value is number => value !== null)
  const meanTotal = modelTotals.length > 0
    ? modelTotals.reduce((sum, value) => sum + value, 0) / modelTotals.length
    : null
  const periodValues = series
    .map((model) => model.nextPeriod)
    .filter((value): value is number => value !== null)
  const periodMean = periodValues.length > 0
    ? periodValues.reduce((sum, value) => sum + value, 0) / periodValues.length
    : null
  const currentValues = series
    .map((model) => model.current)
    .filter((value): value is number => value !== null)
  const currentMean = currentValues.length > 0
    ? currentValues.reduce((sum, value) => sum + value, 0) / currentValues.length
    : null
  const isSnow = metric === 'snowfall'
  const summaryValue = isSnow
    ? view === 'total' ? meanTotal : periodMean
    : currentMean
  const summaryCount = isSnow
    ? view === 'total' ? completeModels.length : periodValues.length
    : currentValues.length
  const chartValues = series.flatMap((model) => model.display.map((value) => value ?? 0))
  const allValues = [...chartValues, ...meanValues.filter((value): value is number => value !== null)]
  const rawMin = Math.min(0, ...allValues)
  const rawMax = Math.max(0, ...allValues)
  const tickStep = metric === 'snowfall'
    ? rawMax <= 10 ? 2 : rawMax <= 30 ? 5 : 10
    : metric === 'snow_depth' ? rawMax <= 100 ? 10 : rawMax <= 500 ? 50 : 100
    : metric === 'cloud_cover' ? 25
      : metric === 'temperature_2m' ? 10
        : 10
  const minY = metric === 'temperature_2m' ? Math.floor(rawMin / tickStep) * tickStep : 0
  const maxY = Math.max(minY + tickStep, Math.ceil(rawMax / tickStep) * tickStep)
  const ticks = Array.from({ length: Math.floor((maxY - minY) / tickStep) + 1 }, (_, index) => minY + index * tickStep)
  const x = (index: number) => chart.left + (chartPoints.length <= 1 ? plotWidth / 2 : (index / (chartPoints.length - 1)) * plotWidth)
  const y = (value: number) => chart.top + plotHeight - ((value - minY) / (maxY - minY)) * plotHeight
  const pathFor = (values: WeatherValue[]) => {
    let hasStarted = false
    return values.reduce((path, value, index) => {
      if (value === null) {
        hasStarted = false
        return path
      }
      const command = hasStarted ? 'L' : 'M'
      hasStarted = true
      return `${path}${command}${x(index)},${y(value)} `
    }, '')
  }
  const formatValue = (value: WeatherValue) => {
    if (value === null) return '—'
    const formatted = metric === 'snowfall' || metric === 'snow_depth' ? Number(value.toFixed(1)) : Math.round(value)
    return `${formatted}${metricDetails.unit === '%' ? '%' : ` ${metricDetails.unit}`}`
  }
  const heading = {
    snowfall: view === 'total' ? 'Total snowfall' : 'Snowfall (12 hr)',
    snow_depth: 'Predicted snow depth',
    cloud_cover: 'Cloud cover · 12-hour average',
    temperature_2m: 'Temperature · 12-hour average',
    wind_speed_10m: 'Wind speed · 12-hour average',
  }[metric]
  const summaryLabel = isSnow
    ? view === 'total'
      ? `${forecastDays}-day mean · ${summaryCount} full-range models`
      : `Next 12-hour mean · ${summaryCount} models`
    : `Current mean · ${summaryCount} models`
  const inspectedModels = selectedPoint === null
    ? []
    : series.filter((model) =>
      visibleModels.includes(model.id) && model.display[selectedPoint] !== null,
    )
  const inspectedMean = selectedPoint === null ? null : meanValues[selectedPoint]

  return (
    <section className="forecast-section model-chart-card">
      <div className="section-heading">
        <div>
          <p className="card-kicker">{graphTab === 'forecast' ? 'MODEL COMPARISON' : 'HISTORICAL WEATHER · OPEN-METEO'}</p>
          <h2>{graphTab === 'forecast' ? heading : 'Historical snow depth'}</h2>
        </div>
        <span className="forecast-caption">
          {graphTab === 'forecast'
            ? `${series.length} models · up to ${forecastDays} days · ${activeElevation.toLocaleString()} m · ${activeForecast.timezone.replaceAll('_', ' ')}`
              : `Selected snow season · ${displayedElevation.toLocaleString()} m`}
        </span>
      </div>
      <div className="graph-tabs" role="tablist" aria-label="Graph type">
        <button
          type="button"
          role="tab"
          id="graph-tab-forecast"
          aria-selected={graphTab === 'forecast'}
          aria-controls="forecast-graph-panel"
          className={graphTab === 'forecast' ? 'selected' : ''}
          onClick={() => setGraphTab('forecast')}
        >
          Forecast graphs
        </button>
        <button
          type="button"
          role="tab"
          id="graph-tab-history"
          aria-selected={graphTab === 'history'}
          aria-controls="historical-snow-panel"
          className={graphTab === 'history' ? 'selected' : ''}
          onClick={() => {
            setGraphTab('history')
            setHistoryTabVisited(true)
          }}
        >
          Historical snow depth
        </button>
      </div>
      {graphTab === 'forecast' && (
        <div id="forecast-graph-panel" role="tabpanel" aria-labelledby="graph-tab-forecast">
      <div className="graph-elevation-tabs" role="tablist" aria-label="Forecast graph elevation">
        <button
          type="button"
          role="tab"
          aria-selected={forecastElevation === 'location'}
          className={forecastElevation === 'location' ? 'selected' : ''}
          onClick={() => setForecastElevation('location')}
        >
          Selected location · {resort.elevation.toLocaleString()} m
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={forecastElevation === 'mountain'}
          className={forecastElevation === 'mountain' ? 'selected' : ''}
          onClick={() => setForecastElevation('mountain')}
        >
          Mountain · {upperElevation.toLocaleString()} m
        </button>
      </div>
      {forecastElevation === 'mountain' && !mountainForecast ? (
        mountainForecastError
          ? <p className="error-message" role="alert">{mountainForecastError}</p>
          : <p className="model-loading" role="status">
            {mountainForecastLoading
              ? `Loading model forecast for ${upperElevation.toLocaleString()} m…`
              : `No model forecast is available at ${upperElevation.toLocaleString()} m.`}
          </p>
      ) : (
        <>
      <div className="metric-tabs" role="tablist" aria-label="Forecast variable">
        {comparisonMetrics.map((item) => (
          <button
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={metric === item.id}
            aria-controls="model-chart-panel"
            className={metric === item.id ? 'selected' : ''}
            key={item.id}
            onClick={() => setMetric(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {isSnow && (
        <div className="chart-controls" role="group" aria-label="Snowfall chart view">
          <button
            type="button"
            className={view === 'total' ? 'selected' : ''}
            aria-pressed={view === 'total'}
            onClick={() => setView('total')}
          >
            Total snowfall
          </button>
          <button
            type="button"
            className={view === '12-hour' ? 'selected' : ''}
            aria-pressed={view === '12-hour'}
            onClick={() => setView('12-hour')}
          >
            Snowfall (12 hr)
          </button>
        </div>
      )}
      <label className="chart-range-control" htmlFor="forecast-range">
        <span>Show up to <strong>{daysToShow} days</strong> of forecast data</span>
        <input
          id="forecast-range"
          type="range"
          min="1"
          max="16"
          step="1"
          value={daysToShow}
          onChange={(event) => {
            setDaysToShow(Number(event.target.value))
            setSelectedPoint(null)
          }}
        />
        <span className="chart-range-endpoints"><span>1 day</span><span>16 days</span></span>
      </label>
      <div className="model-chart-summary">
        <strong>{formatValue(summaryValue)}</strong>
        <span>{summaryLabel}</span>
        <span className="model-summary-note">
          {isSnow && view === 'total' ? 'Mean uses full-range models' : 'Average of available models'}
        </span>
      </div>
      <div className="model-chart-scroll" id="model-chart-panel" role="tabpanel" aria-labelledby={`tab-${metric}`}>
        {series.length === 0
          ? <p className="no-model-data">No {metricDetails.description} models returned data for this location.</p>
          : <svg
            className="model-chart"
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            role="button"
            tabIndex={0}
            aria-label={`Click the ${metricDetails.description} chart to inspect model values by forecast time`}
            onClick={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect()
              const chartX = ((event.clientX - bounds.left) / bounds.width) * chart.width
              const point = Math.round(((chartX - chart.left) / plotWidth) * (chartPoints.length - 1))
              setSelectedPoint(Math.max(0, Math.min(chartPoints.length - 1, point)))
            }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
              event.preventDefault()
              setSelectedPoint((current) => {
                const next = current ?? 0
                return Math.max(0, Math.min(chartPoints.length - 1, next + (event.key === 'ArrowRight' ? 1 : -1)))
              })
            }}
          >
          {ticks.map((value) => {
            const lineY = y(value)
            return (
              <g key={value}>
                <line x1={chart.left} x2={chart.width - chart.right} y1={lineY} y2={lineY} className="chart-grid-line" />
                <text x={chart.left - 10} y={lineY + 3} textAnchor="end" className="chart-axis-label">{Math.round(value)}</text>
              </g>
            )
          })}
          {chartPoints.map((point, index) => index % 4 === 0 && (
            <text
              key={point.time}
              x={x(index)}
              y={chart.height - 20}
              textAnchor="middle"
              className="chart-axis-label chart-day-label"
            >
              {getModelDayLabel(point.time.slice(0, 10))}
              <tspan x={x(index)} dy="13">{getHourLabel(point.time)}</tspan>
            </text>
          ))}
          {series.map((model) => visibleModels.includes(model.id) && (
            <g key={model.id}>
              <path d={pathFor(model.display)} fill="none" stroke={model.color} className="model-line" />
              {model.display.map((value, index) => value === null ? null : (
                <circle key={chartPoints[index].time} cx={x(index)} cy={y(value)} r="3" fill={model.color} className="model-point">
                  <title>{`${model.label} · ${chartPoints[index].time}: ${formatValue(value)}`}</title>
                </circle>
              ))}
            </g>
          ))}
          <g>
            <path d={pathFor(meanValues)} fill="none" className="mean-line" />
            {meanValues.map((value, index) => value === null ? null : (
              <circle key={chartPoints[index].time} cx={x(index)} cy={y(value)} r="3.5" className="mean-point">
                <title>{`Model mean · ${chartPoints[index].time}: ${formatValue(value)}`}</title>
              </circle>
            ))}
          </g>
          {selectedPoint !== null && (
            <line
              x1={x(selectedPoint)}
              x2={x(selectedPoint)}
              y1={chart.top}
              y2={chart.height - chart.bottom}
              className="selected-chart-point"
              pointerEvents="none"
            />
          )}
          </svg>}
      </div>
      <div className="chart-inspector" aria-live="polite">
        {selectedPoint === null || !chartPoints[selectedPoint]
          ? <p>Click a point on the graph to inspect values from each model.</p>
          : (
            <>
              <strong className="chart-inspector-time">
                {chartPoints[selectedPoint].time.replace('T', ' ')} local
              </strong>
              {inspectedModels.length === 0 && inspectedMean === null
                ? <p>No model data is available at this time.</p>
                : (
                  <div className="chart-inspector-values">
                    {inspectedModels.map((model) => (
                      <span key={model.id}>
                        <i style={{ backgroundColor: model.color }} />
                        {model.label}: <strong>{formatValue(model.display[selectedPoint])}</strong>
                      </span>
                    ))}
                    {inspectedMean !== null && (
                      <span>
                        <i className="mean-inspector-swatch" />
                        Model mean: <strong>{formatValue(inspectedMean)}</strong>
                      </span>
                    )}
                  </div>
                )}
            </>
          )}
      </div>
      <div className="model-legend" aria-label="Toggle forecast models">
        {series.map((model) => {
          const isVisible = visibleModels.includes(model.id)
          const legendValue = isSnow
            ? view === 'total' ? model.total : model.nextPeriod
            : model.current
          return (
            <button
              className={`model-legend-item ${isVisible ? '' : 'model-hidden'}`}
              type="button"
              key={model.id}
              aria-pressed={isVisible}
              onClick={() => setVisibleModels((current) => (
                isVisible
                  ? current.filter((id) => id !== model.id)
                  : [...current, model.id]
              ))}
            >
              <span className="legend-swatch" style={{ backgroundColor: model.color }} />
              <span>{model.label}</span>
              <strong>{formatValue(legendValue)}</strong>
              {model.coverageHours > 0 && model.coverageHours < rangeHours && (
                <small>{Math.max(1, Math.round(model.coverageHours / 24))}-day</small>
              )}
            </button>
          )
        })}
        <span className="model-legend-item model-mean-legend">
          <span className="legend-swatch" />
          <span>Model mean</span>
          <strong>{formatValue(isSnow ? view === 'total' ? meanTotal : periodMean : currentMean)}</strong>
        </span>
      </div>
      <p className="model-chart-note">
        {metric === 'snow_depth'
          ? 'Snow depth is shown in centimetres and sampled every 12 hours. It estimates snow on the ground, not new snowfall.'
          : isSnow
            ? 'The total mean uses models covering the full range; other means use available model data. A mean is a guide, not a certainty.'
            : 'Lines show 12-hour averages. The mean is calculated from available model data, not a separate forecast.'}
        {' '}Only models that return data for this elevation and metric are shown; see{' '}
        <a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">
          Open-Meteo's model documentation
        </a>{' '}for the catalogue of supported feeds.
      </p>
        </>
      )}
        </div>
      )}
      {historyTabVisited && (
        <div hidden={graphTab !== 'history'}>
          <HistoricalSnowDepthChart
            resort={resort}
            elevation={historyElevation === 'location' ? resort.elevation : upperElevation}
            elevationSelection={historyElevation}
            locationElevation={resort.elevation}
            upperElevation={upperElevation}
            onElevationChange={setHistoryElevation}
          />
        </div>
      )}
    </section>
  )
}

function HistoricalSnowDepthChart({
  resort,
  elevation,
  elevationSelection,
  locationElevation,
  upperElevation,
  onElevationChange,
}: {
  resort: Resort
  elevation: number
  elevationSelection: 'location' | 'mountain'
  locationElevation: number
  upperElevation: number
  onElevationChange: (selection: 'location' | 'mountain') => void
}) {
  const currentSeasonStartYear = getSnowSeasonStartYear()
  const seasons = Array.from({ length: 10 }, (_, index) => currentSeasonStartYear - index)
  const [seasonStartYear, setSeasonStartYear] = useState(currentSeasonStartYear)
  const [history, setHistory] = useState<HistoricalSnowDepth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const chart = { width: 760, height: 278, left: 44, right: 18, top: 18, bottom: 48 }
  const plotWidth = chart.width - chart.left - chart.right
  const plotHeight = chart.height - chart.top - chart.bottom

  useEffect(() => {
    const controller = new AbortController()
    setHistory(null)
    setLoading(true)
    setError('')
    setSelectedPoint(null)

    void getHistoricalSnowDepth(resort, seasonStartYear, controller.signal, elevation)
      .then(setHistory)
      .catch((failure: unknown) => {
        if (failure instanceof Error && failure.name === 'AbortError') return
        setError(
          failure instanceof Error
            ? failure.message
            : 'Historical snow-depth data could not be loaded.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [resort, elevation, seasonStartYear])

  const points = history?.daily ?? []
  const maximumDepth = Math.max(0, ...points.map((point) => point.snowDepthCm))
  const tickStep = Math.max(10, Math.ceil(maximumDepth / 4 / 10) * 10)
  const maxY = Math.max(tickStep, Math.ceil(maximumDepth / tickStep) * tickStep)
  const ticks = Array.from({ length: Math.floor(maxY / tickStep) + 1 }, (_, index) => index * tickStep)
  const x = (index: number) => chart.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth)
  const y = (value: number) => chart.top + plotHeight - (value / maxY) * plotHeight
  const path = points.reduce((result, point, index) => (
    `${result}${index === 0 ? 'M' : 'L'}${x(index)},${y(point.snowDepthCm)} `
  ), '')
  const monthLabels = points.flatMap((point, index) => (
    point.date.slice(8, 10) === '01'
      ? [{ index, label: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(new Date(`${point.date}T12:00:00Z`)) }]
      : []
  ))
  const formatDepth = (value: number) => `${Number(value.toFixed(1))} cm`

  return (
    <div className="historical-snow-panel" id="historical-snow-panel" role="tabpanel" aria-labelledby="graph-tab-history">
      <div className="graph-elevation-tabs" role="tablist" aria-label="Historical graph elevation">
        <button
          type="button"
          role="tab"
          aria-selected={elevationSelection === 'location'}
          className={elevationSelection === 'location' ? 'selected' : ''}
          onClick={() => onElevationChange('location')}
        >
          Selected location · {locationElevation.toLocaleString()} m
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={elevationSelection === 'mountain'}
          className={elevationSelection === 'mountain' ? 'selected' : ''}
          onClick={() => onElevationChange('mountain')}
        >
          Mountain · {upperElevation.toLocaleString()} m
        </button>
      </div>
      <label className="historical-season-select" htmlFor="historical-snow-season">
        <span>Snow season</span>
        <select
          id="historical-snow-season"
          value={seasonStartYear}
          onChange={(event) => {
            setSeasonStartYear(Number(event.target.value))
            setSelectedPoint(null)
          }}
        >
          {seasons.map((startYear) => (
            <option key={startYear} value={startYear}>{startYear}–{startYear + 1}</option>
          ))}
        </select>
      </label>
      {loading && <p className="no-model-data" role="status">Loading historical snow-depth data…</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {!loading && !error && points.length === 0 && (
        <p className="no-model-data">No historical snow-depth data is available for this location.</p>
      )}
      {!loading && !error && points.length > 0 && (
        <>
          <div className="model-chart-scroll">
            <svg
              className="model-chart historical-snow-chart"
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              role="button"
              tabIndex={0}
              aria-label="Historical daily snow depth. Click or use the arrow keys to inspect values."
              onClick={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect()
                const chartX = ((event.clientX - bounds.left) / bounds.width) * chart.width
                const point = Math.round(((chartX - chart.left) / plotWidth) * (points.length - 1))
                setSelectedPoint(Math.max(0, Math.min(points.length - 1, point)))
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                event.preventDefault()
                setSelectedPoint((current) => {
                  const next = current ?? 0
                  return Math.max(0, Math.min(points.length - 1, next + (event.key === 'ArrowRight' ? 1 : -1)))
                })
              }}
            >
              {ticks.map((value) => (
                <g key={value}>
                  <line x1={chart.left} x2={chart.width - chart.right} y1={y(value)} y2={y(value)} className="chart-grid-line" />
                  <text x={chart.left - 10} y={y(value) + 3} textAnchor="end" className="chart-axis-label">{value}</text>
                </g>
              ))}
              {monthLabels.map(({ index, label }) => (
                <text key={points[index].date} x={x(index)} y={chart.height - 20} textAnchor="middle" className="chart-axis-label chart-day-label">
                  {label}
                </text>
              ))}
              <path d={path} fill="none" className="historical-snow-line" />
              {selectedPoint !== null && (
                <>
                  <line
                    x1={x(selectedPoint)}
                    x2={x(selectedPoint)}
                    y1={chart.top}
                    y2={chart.height - chart.bottom}
                    className="selected-chart-point"
                    pointerEvents="none"
                  />
                  <circle cx={x(selectedPoint)} cy={y(points[selectedPoint].snowDepthCm)} r="4" className="historical-snow-point" pointerEvents="none" />
                </>
              )}
            </svg>
          </div>
          <div className="chart-inspector" aria-live="polite">
            {selectedPoint === null
              ? <p>Click the graph to inspect the daily snow depth.</p>
              : (
                <>
                  <strong className="chart-inspector-time">{points[selectedPoint].date}</strong>
                  <span>Snow depth: <strong>{formatDepth(points[selectedPoint].snowDepthCm)}</strong></span>
                </>
              )}
          </div>
        </>
      )}
      <p className="model-chart-note">
        Daily values use the last available hourly reading in the location’s timezone. Historical model data is an estimate and may differ from on-mountain measurements.
      </p>
    </div>
  )
}

type ForecastPeriod = 'day' | 'night'

function DetailedForecastTable({
  weather,
  unit,
}: {
  weather: WeatherData
  unit: Unit
}) {
  const rows = weather.daily.time.flatMap((day, dayIndex) => (
    (['day', 'night'] as const).map((period) => {
      const matchingHours = weather.hourly.time
        .map((time, index) => {
          const date = time.slice(0, 10)
          const hour = Number(time.slice(11, 13))
          const inPeriod: boolean = period === 'day'
            ? date === day && hour >= 6 && hour < 18
            : (date === day && hour >= 18) ||
              (date === weather.daily.time[dayIndex + 1] && hour < 6)
          return inPeriod ? index : -1
        })
        .filter((index) => index >= 0)
      const values = matchingHours.map((index) => ({
        temperature: weather.hourly.temperature_2m[index],
        code: weather.hourly.weather_code[index],
        snowfall: weather.hourly.snowfall[index],
        wind: weather.hourly.wind_speed_10m[index],
        windDirection: weather.hourly.wind_direction_10m[index],
        cloud: weather.hourly.cloud_cover[index],
      }))
      const availableSnow = values.map((value) => value.snowfall).filter((value): value is number => value !== null)
      const snowfall = values.length > 0 && availableSnow.length === values.length
        ? availableSnow.reduce((sum, value) => sum + value, 0)
        : null
      const temperatures = values.map((value) => value.temperature).filter((value): value is number => value !== null)
      const temperatureValue = temperatures.length > 0
        ? period === 'day' ? Math.max(...temperatures) : Math.min(...temperatures)
        : null
      const windValues = values.filter((value) => value.wind !== null)
      const strongestWind = windValues.reduce<(typeof values)[number] | null>(
        (strongest, value) => strongest === null || (value.wind ?? 0) > (strongest.wind ?? 0) ? value : strongest,
        null,
      )
      const cloudValues = values.map((value) => value.cloud).filter((value): value is number => value !== null)
      const cloudAverage = cloudValues.length > 0
        ? cloudValues.reduce((sum, value) => sum + value, 0) / cloudValues.length
        : null
      const weatherCode = values.find((value) => value.code !== null)?.code ?? null
      return {
        key: `${day}-${period}`,
        day,
        dayIndex,
        period: period as ForecastPeriod,
        temperature: temperatureValue,
        snowfall,
        wind: strongestWind?.wind ?? null,
        windDirection: strongestWind?.windDirection ?? null,
        cloud: cloudAverage,
        weatherCode,
      }
    })
  ))
  const maxSnowfall = Math.max(1, ...rows.map((row) => row.snowfall ?? 0))
  const temperatureUnit = unit === 'celsius' ? '°C' : '°F'

  return (
    <section className="forecast-section detailed-forecast">
      <div className="section-heading">
        <div>
          <p className="card-kicker">LOCATION FORECAST</p>
          <h2>Next 10 days</h2>
        </div>
        <span className="forecast-caption">Day & night · local time</span>
      </div>
      <div className="detail-table" role="table" aria-label="Ten-day day and night snow forecast">
        <div className="detail-table-header" role="row">
          <span role="columnheader">Period</span>
          <span role="columnheader">Weather</span>
          <span role="columnheader">Temp</span>
          <span role="columnheader">Cloud</span>
          <span role="columnheader">Wind</span>
          <span role="columnheader">New snow</span>
        </div>
        {rows.map((row) => (
          <div
            className={`detail-table-row ${row.period === 'night' ? 'night-row' : 'forecast-day-row'}`}
            role="row"
            key={row.key}
          >
            <span className="detail-period" role="cell">
              <strong>{row.dayIndex === 0 && row.period === 'day' ? 'Today' : getDayLabel(row.day, weather.timezone, row.dayIndex)}</strong>
              <span className={`detail-period-label ${row.period}`} aria-label={row.period}>
                <i aria-hidden="true">{row.period === 'day' ? '☀' : '☾'}</i>
                {row.period === 'day' ? 'Day' : 'Night'}
              </span>
            </span>
            <span className="detail-weather" role="cell" title={weatherLabel(row.weatherCode)}>
              <span aria-hidden="true">{weatherIcon(row.weatherCode)}</span>
              <span>{weatherLabel(row.weatherCode)}</span>
            </span>
            <strong className="detail-temperature" role="cell">
              {row.temperature === null ? '—' : `${temperature(row.temperature, unit)}${temperatureUnit}`}
            </strong>
            <span className="detail-cloud" role="cell">{formatValue(row.cloud === null ? null : Math.round(row.cloud), '%')}</span>
            <span className="detail-wind" role="cell">
              {row.wind === null ? '—' : `${direction(row.windDirection)} ${formatValue(row.wind, ' km/h')}`}
            </span>
            <span className="detail-snow" role="cell">
              <span className="detail-snow-bar">
                <span style={{ width: `${Math.min(100, ((row.snowfall ?? 0) / maxSnowfall) * 100)}%` }} />
              </span>
              <strong>{formatValue(row.snowfall, ' cm', 1)}</strong>
            </span>
          </div>
        ))}
      </div>
      <p className="model-chart-note">Day covers 6 am–6 pm; night covers 6 pm–6 am. Snowfall is shown in centimetres.</p>
    </section>
  )
}

function App() {
  const [resort, setResort] = useState(initialResort)
  const [upperElevation, setUpperElevation] = useState(2800)
  const [upperElevationInput, setUpperElevationInput] = useState('2800')
  const [searchText, setSearchText] = useState(() => formatResortLabel(initialResort))
  const [locationOptions, setLocationOptions] = useState<Resort[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [upperWeather, setUpperWeather] = useState<WeatherData | null>(null)
  const [modelForecast, setModelForecast] = useState<ModelForecast | null>(null)
  const [mountainModelForecast, setMountainModelForecast] = useState<ModelForecast | null>(null)
  const [mountainModelLoading, setMountainModelLoading] = useState(true)
  const [mountainModelError, setMountainModelError] = useState('')
  const [unit, setUnit] = useState<Unit>('celsius')
  const [loading, setLoading] = useState(true)
  const [upperLoading, setUpperLoading] = useState(true)
  const [error, setError] = useState('')
  const [upperError, setUpperError] = useState('')
  const [modelError, setModelError] = useState('')
  const minUpperElevation = Math.min(4500, Math.round(resort.elevation + 100))

  useEffect(() => {
    const query = searchText.trim()
    if (query.length < 2 || query === formatResortLabel(resort)) {
      setLocationOptions([])
      setSearching(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setSearching(true)
      setSearchError('')
      void searchAlpineLocations(query, controller.signal)
        .then(setLocationOptions)
        .catch((searchFailure: unknown) => {
          if (searchFailure instanceof Error && searchFailure.name === 'AbortError') return
          setLocationOptions([])
          setSearchError(
            searchFailure instanceof Error
              ? searchFailure.message
              : 'Something went wrong while searching Alpine locations.',
          )
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, 300)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [resort, searchText])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setModelError('')
    setWeather(null)
    setModelForecast(null)

    void Promise.allSettled([
      getWeather(resort, controller.signal),
      getModelForecast(resort, controller.signal),
    ])
      .then(([weatherResult, modelResult]) => {
        if (controller.signal.aborted) return
        if (weatherResult.status === 'fulfilled') {
          setWeather(weatherResult.value)
        } else {
          setError(
            weatherResult.reason instanceof Error
              ? weatherResult.reason.message
              : 'Something went wrong while loading the mountain weather.',
          )
        }
        if (modelResult.status === 'fulfilled') {
          setModelForecast(modelResult.value)
        } else if (!(modelResult.reason instanceof Error && modelResult.reason.name === 'AbortError')) {
          setModelError(
            modelResult.reason instanceof Error
              ? modelResult.reason.message
              : 'Snowfall model comparison could not be loaded.',
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [resort])

  useEffect(() => {
    const controller = new AbortController()
    setUpperWeather(null)
    setUpperLoading(true)
    setUpperError('')

    void getWeather(resort, controller.signal, upperElevation)
      .then(setUpperWeather)
      .catch((failure: unknown) => {
        if (failure instanceof Error && failure.name === 'AbortError') return
        setUpperError(
          failure instanceof Error
            ? failure.message
            : 'Upper-mountain weather could not be loaded.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setUpperLoading(false)
      })

    return () => controller.abort()
  }, [resort, upperElevation])

  useEffect(() => {
    const controller = new AbortController()
    setMountainModelForecast(null)
    setMountainModelLoading(true)
    setMountainModelError('')

    void getModelForecast(resort, controller.signal, upperElevation)
      .then(setMountainModelForecast)
      .catch((failure: unknown) => {
        if (failure instanceof Error && failure.name === 'AbortError') return
        setMountainModelError(
          failure instanceof Error
            ? failure.message
            : 'Upper-mountain model forecast could not be loaded.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setMountainModelLoading(false)
      })

    return () => controller.abort()
  }, [resort, upperElevation])

  function chooseResort(location: Resort) {
    const nextUpperElevation = Math.min(4500, Math.round((location.elevation + 1200) / 50) * 50)
    setResort(location)
    setUpperElevation(nextUpperElevation)
    setUpperElevationInput(String(nextUpperElevation))
    setSearchText(formatResortLabel(location))
    setShowSuggestions(false)
    setLocationOptions([])
    setSearchError('')
  }

  function applyUpperElevationInput() {
    const parsedElevation = Number(upperElevationInput)
    const nextElevation = upperElevationInput.trim() === '' || !Number.isFinite(parsedElevation)
      ? upperElevation
      : Math.max(minUpperElevation, Math.min(4500, Math.round(parsedElevation)))
    setUpperElevation(nextElevation)
    setUpperElevationInput(String(nextElevation))
  }

  function handleLocationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = searchText.trim().toLocaleLowerCase()
    const match = locationOptions.find((option) =>
      formatResortLabel(option).toLocaleLowerCase() === query ||
      option.name.toLocaleLowerCase() === query,
    ) ?? locationOptions[0]
    if (match) {
      chooseResort(match)
      return
    }
    if (!searching) {
      setSearchError('No matching location found in the Alps. Try a nearby town or resort name.')
    }
  }

  const current = weather?.current
  const hourlyStart = current && weather
    ? weather.hourly.time.findIndex((time) => time >= current.time)
    : -1
  const hourlyForecast = weather && hourlyStart >= 0
    ? weather.hourly.time.slice(hourlyStart, hourlyStart + 8).map((time, index) => {
        const hourIndex = hourlyStart + index
        return {
          time,
          temperature: weather.hourly.temperature_2m[hourIndex],
          code: weather.hourly.weather_code[hourIndex],
          snowfall: weather.hourly.snowfall[hourIndex],
          wind: weather.hourly.wind_speed_10m[hourIndex],
        }
      })
    : []
  const next24HoursSnowfall = weather && hourlyStart >= 0
    ? weather.hourly.snowfall
        .slice(hourlyStart, hourlyStart + 24)
        .reduce<number | null>((total, amount) => {
          if (amount === null) return total
          return (total ?? 0) + amount
        }, null)
    : null
  const snowDepthCm = current?.snow_depth === null || current?.snow_depth === undefined
    ? null
    : current.snow_depth * 100
  const temperatureUnit = unit === 'celsius' ? '°C' : '°F'

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Alpine report home">
          <span className="brand-mark" aria-hidden="true">⌁</span>
          <span>alpine<span className="brand-light"> / report</span></span>
        </a>
        <span className="topbar-note">Mountain weather across the Alps</span>
        <div className="topbar-actions">
          <a
            className="feedback-button"
            href="https://github.com/MandenB/sneeuwapp/issues/new"
            target="_blank"
            rel="noreferrer"
          >
            Leave feedback
          </a>
          <div className="unit-switch" aria-label="Temperature units">
            <button
              type="button"
              className={unit === 'celsius' ? 'selected' : ''}
              aria-pressed={unit === 'celsius'}
              onClick={() => setUnit('celsius')}
            >
              °C
            </button>
            <button
              type="button"
              className={unit === 'fahrenheit' ? 'selected' : ''}
              aria-pressed={unit === 'fahrenheit'}
              onClick={() => setUnit('fahrenheit')}
            >
              °F
            </button>
          </div>
        </div>
      </header>

      <section className="page-heading">
        <p className="eyebrow">ALPINE SKI REPORT</p>
        <h1>Mountain conditions</h1>
        <p>Snow, wind and weather at your favourite ski areas.</p>
      </section>

      <section className="resort-bar" aria-label="Ski resort search">
        <form className="resort-search" onSubmit={handleLocationSubmit}>
          <label className="resort-search-label" htmlFor="resort-search">
            <span className="resort-pin" aria-hidden="true">⌖</span>
            <span className="resort-search-field">
              <span className="select-caption">FIND A RESORT OR LOCATION</span>
              <input
                id="resort-search"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showSuggestions && locationOptions.length > 0}
                aria-controls="location-suggestions"
                value={searchText}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
                onChange={(event) => {
                  setSearchText(event.target.value)
                  setShowSuggestions(true)
                  setSearchError('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setShowSuggestions(false)
                }}
                placeholder="Type an Alpine resort..."
                autoComplete="off"
              />
            </span>
          </label>
          <button type="submit" className="location-search-button" disabled={searching || searchText.trim().length < 2}>
            {searching ? 'Searching…' : 'Find'}
          </button>
          {showSuggestions && searchText.trim() !== formatResortLabel(resort) && (
            <div className="location-suggestions" id="location-suggestions" role="listbox" aria-label="Alpine locations">
              {searching && <p className="suggestion-status">Searching Alpine locations…</p>}
              {!searching && locationOptions.length === 0 && searchText.trim().length >= 2 && !searchError && (
                <p className="suggestion-status">No Alpine locations found. Try a resort or nearby town.</p>
              )}
              {locationOptions.slice(0, 8).map((location) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={location.id === resort.id}
                  key={location.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseResort(location)}
                >
                  <span>{location.name}</span>
                  <small>{[location.admin1, location.country].filter(Boolean).join(', ')}</small>
                  <small>{Math.round(location.elevation).toLocaleString()} m</small>
                </button>
              ))}
            </div>
          )}
        </form>
        <span className="resort-elevation">
          <span aria-hidden="true">●</span> Location point · {resort.elevation.toLocaleString()} m
        </span>
        <label className="upper-elevation-control" htmlFor="upper-elevation">
          <span>UPPER-MOUNTAIN ELEVATION</span>
          <span className="upper-elevation-input">
            <input
              id="upper-elevation"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-describedby="upper-elevation-help"
              value={upperElevationInput}
              onChange={(event) => {
                if (/^\d{0,4}$/.test(event.target.value)) setUpperElevationInput(event.target.value)
              }}
              onBlur={applyUpperElevationInput}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
            <span>m</span>
          </span>
          <small id="upper-elevation-help">Enter {minUpperElevation}–4,500 m</small>
        </label>
      </section>

      {error && <p className="error-message" role="alert">{error}</p>}
      {searchError && <p className="error-message" role="alert">{searchError}</p>}

      {current && weather && (
        <div className="weather-content" aria-live="polite">
          <section className="conditions-card">
            <div className="conditions-overview">
              <div>
                <p className="card-kicker">{resort.name.toUpperCase()} · LOCATION · {resort.elevation.toLocaleString()} M</p>
                <p className="current-description">{weatherLabel(current.weather_code)}</p>
                <p className="current-temp">
                  {current.temperature_2m === null
                    ? '—'
                    : (
                      <>
                        {temperature(current.temperature_2m, unit)}
                        <span>{unit === 'celsius' ? '°C' : '°F'}</span>
                      </>
                    )}
                </p>
                <p className="feels-like">
                  Feels like {current.apparent_temperature === null
                    ? '—'
                    : `${temperature(current.apparent_temperature, unit)}${unit === 'celsius' ? '°C' : '°F'}`}
                  <span className="weather-updated">                   · Updated {getHourLabel(current.time)}</span>
                </p>
              </div>
              <div className="current-weather-icon" aria-hidden="true">
                {weatherIcon(current.weather_code)}
              </div>
              <div className="fresh-snow">
                <span className="snowflake" aria-hidden="true">❄</span>
                <span className="fresh-snow-label">NEW SNOW · 24 H</span>
                <strong>{formatValue(next24HoursSnowfall, ' cm', 1)}</strong>
              </div>
            </div>

            <div className="conditions-grid">
              <article className="condition-stat">
                <span className="stat-icon snow-icon" aria-hidden="true">❄</span>
                <span className="stat-label">Snow on ground</span>
                <strong>{formatValue(snowDepthCm, ' cm')}</strong>
              </article>
              <article className="condition-stat">
                <span className="stat-icon cloud-icon" aria-hidden="true">☁</span>
                <span className="stat-label">Cloud cover</span>
                <strong>{formatValue(current.cloud_cover, '%')}</strong>
              </article>
              <article className="condition-stat">
                <span className="stat-icon wind-icon" aria-hidden="true">↗</span>
                <span className="stat-label">Wind · {direction(current.wind_direction_10m)}</span>
                <strong>{formatValue(current.wind_speed_10m, ' km/h')}</strong>
              </article>
              <article className="condition-stat">
                <span className="stat-icon gust-icon" aria-hidden="true">≋</span>
                <span className="stat-label">Wind gusts</span>
                <strong>{formatValue(current.wind_gusts_10m, ' km/h')}</strong>
              </article>
            </div>
          </section>

          <UpperMountainConditions
            weather={upperWeather}
            elevation={upperElevation}
            currentTime={current.time}
            unit={unit}
            loading={upperLoading}
            error={upperError}
          />

          {modelForecast
            ? <ModelSnowfallChart
              forecast={modelForecast}
              mountainForecast={mountainModelForecast}
              mountainForecastLoading={mountainModelLoading}
              mountainForecastError={mountainModelError}
              currentTime={current.time}
              unit={unit}
              resort={resort}
              upperElevation={upperElevation}
            />
            : modelError
              ? <p className="error-message" role="alert">{modelError}</p>
              : <div className="model-loading" role="status">Loading snowfall model comparison…</div>}

          <section className="forecast-section">
            <div className="section-heading">
              <div>
                <p className="card-kicker">HOURLY</p>
                <h2>At selected location</h2>
              </div>
              <span className="forecast-caption">Next 8 hours · local time</span>
            </div>
            <div className="hourly-list">
              {hourlyForecast.map((hour, index) => (
                <article className={`hour-card ${index === 0 ? 'hour-now' : ''}`} key={hour.time}>
                  <p>{index === 0 ? 'Now' : getHourLabel(hour.time)}</p>
                  <span className="hour-icon" aria-hidden="true">{weatherIcon(hour.code)}</span>
                  <strong>{hour.temperature === null ? '—' : `${temperature(hour.temperature, unit)}${temperatureUnit}`}</strong>
                  <span className="hour-snow" title="Snowfall">❄ {formatValue(hour.snowfall, '', 1)}</span>
                  <span className="hour-wind" title="Wind speed">↗ {formatValue(hour.wind, '')}</span>
                </article>
              ))}
            </div>
          </section>

          <DetailedForecastTable weather={weather} unit={unit} />
        </div>
      )}

      {loading && (
        <div className="loading-card" role="status">
          <span className="loading-icon" aria-hidden="true">❄</span>
          Loading mountain conditions…
        </div>
      )}

      <footer className="footer">
        <span>Forecasts are point estimates at the selected-location and upper-mountain elevations, not measurements across the full resort.</span>
        <span>Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></span>
      </footer>
    </main>
  )
}

export default App
