import { useEffect, useRef, useState } from 'react'
import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'

setWorkerUrl(workerUrl)

type MapViewProps = {
  active: boolean
  latitude: number
  longitude: number
  resortName: string
}

type SkiFeatureProperties = {
  kind: 'piste' | 'lift'
  difficulty: string
  name: string
  liftType: string
}

type SlopeFeatureProperties = {
  slopeDegrees: number
  slopeClass: 'gentle' | 'moderate' | 'steep' | 'very-steep'
}

type OverpassGeometryPoint = {
  lat: number
  lon: number
}

type OverpassElement = {
  type: 'way'
  id: number
  tags?: Record<string, string>
  geometry?: OverpassGeometryPoint[]
}

type SkiFeatureCollection = FeatureCollection<LineString, SkiFeatureProperties>
type SlopeFeatureCollection = FeatureCollection<Polygon, SlopeFeatureProperties>

const emptySkiFeatures: SkiFeatureCollection = { type: 'FeatureCollection', features: [] }
const emptySlopeFeatures: SlopeFeatureCollection = { type: 'FeatureCollection', features: [] }
const overpassUrl = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
const pisteTypes = 'chair_lift|gondola|cable_car|drag_lift|t-bar|j-bar|platter|magic_carpet|mixed_lift|rope_tow'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function overpassGeometry(value: unknown): OverpassGeometryPoint[] {
  if (!Array.isArray(value)) return []
  return value.filter((point): point is OverpassGeometryPoint =>
    isRecord(point) &&
    typeof point.lat === 'number' &&
    typeof point.lon === 'number' &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon),
  )
}

function isOverpassElement(value: unknown): value is OverpassElement {
  return isRecord(value) &&
    typeof value.id === 'number' &&
    value.type === 'way'
}

function getGeoJSONSource(map: MapLibreMap, id: string): GeoJSONSource | null {
  const source = map.getSource(id)
  return source?.type === 'geojson' ? source as GeoJSONSource : null
}

function parseSkiFeatures(value: unknown): SkiFeatureCollection {
  if (!isRecord(value) || !Array.isArray(value.elements)) {
    throw new Error('The OpenStreetMap response was not in the expected format.')
  }

  const features: Feature<LineString, SkiFeatureProperties>[] = []
  const addedWays = new Set<number>()

  function addFeature(
    id: number,
    kind: SkiFeatureProperties['kind'],
    tags: Record<string, string>,
    geometry: unknown,
  ) {
    const points = overpassGeometry(geometry)
    if (points.length < 2 || addedWays.has(id)) return

    const rawDifficulty = tags['piste:difficulty'] ?? tags.difficulty ?? ''
    const difficulty = rawDifficulty === 'novice'
      ? 'novice'
      : rawDifficulty === 'easy'
        ? 'easy'
        : rawDifficulty === 'intermediate'
          ? 'intermediate'
          : rawDifficulty === 'advanced' || rawDifficulty === 'expert'
            ? 'expert'
            : rawDifficulty === 'freeride'
              ? 'freeride'
              : 'unknown'

    features.push({
      type: 'Feature',
      id,
      properties: {
        kind,
        difficulty,
        name: tags.name ?? '',
        liftType: tags.aerialway ?? '',
      },
      geometry: {
        type: 'LineString',
        coordinates: points.map((point) => [point.lon, point.lat]),
      },
    })
    addedWays.add(id)
  }

  value.elements.filter(isOverpassElement).forEach((elementValue) => {
    const tags = isRecord(elementValue.tags)
      ? Object.fromEntries(
        Object.entries(elementValue.tags).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      )
      : {}

    if (typeof tags.aerialway === 'string') {
      addFeature(elementValue.id, 'lift', tags, elementValue.geometry)
    } else if (tags['piste:type'] === 'downhill') {
      addFeature(elementValue.id, 'piste', tags, elementValue.geometry)
    }
  })

  return { type: 'FeatureCollection', features }
}

function slopeClass(degrees: number): SlopeFeatureProperties['slopeClass'] {
  if (degrees < 25) return 'gentle'
  if (degrees < 30) return 'moderate'
  if (degrees < 35) return 'steep'
  return 'very-steep'
}

function createSlopeFeatures(map: MapLibreMap): SlopeFeatureCollection {
  const canvas = map.getCanvas()
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const columns = Math.max(32, Math.min(88, Math.ceil(width / 12)))
  const rows = Math.max(20, Math.min(48, Math.ceil(height / 12)))
  const samples = Array.from({ length: rows + 1 }, (_, row) =>
    Array.from({ length: columns + 1 }, (_, column) => {
      const point = map.unproject([
        (column / columns) * width,
        (row / rows) * height,
      ])
      const position: [number, number] = [point.lng, point.lat]
      return {
        position,
        elevation: map.queryTerrainElevation(position),
      }
    }),
  )
  const features: Feature<Polygon, SlopeFeatureProperties>[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const northwest = samples[row][column]
      const northeast = samples[row][column + 1]
      const southeast = samples[row + 1][column + 1]
      const southwest = samples[row + 1][column]
      const corners = [northwest, northeast, southeast, southwest]
      if (corners.some((corner) => corner.elevation === null)) continue

      const centerLongitude = corners.reduce((sum, corner) => sum + corner.position[0], 0) / 4
      const centerLatitude = corners.reduce((sum, corner) => sum + corner.position[1], 0) / 4
      const meanElevation = corners.reduce((sum, corner) => sum + (corner.elevation ?? 0), 0) / 4
      const metersPerLongitude = 111_320 * Math.cos(centerLatitude * (Math.PI / 180))
      let sumXX = 0
      let sumYY = 0
      let sumXY = 0
      let sumXZ = 0
      let sumYZ = 0

      corners.forEach((corner) => {
        const x = (corner.position[0] - centerLongitude) * metersPerLongitude
        const y = (corner.position[1] - centerLatitude) * 111_320
        const z = (corner.elevation ?? meanElevation) - meanElevation
        sumXX += x * x
        sumYY += y * y
        sumXY += x * y
        sumXZ += x * z
        sumYZ += y * z
      })

      const determinant = sumXX * sumYY - sumXY * sumXY
      if (determinant < 1e-8) continue

      const gradientX = (sumXZ * sumYY - sumYZ * sumXY) / determinant
      const gradientY = (sumYZ * sumXX - sumXZ * sumXY) / determinant
      const degrees = Math.atan(Math.hypot(gradientX, gradientY)) * (180 / Math.PI)
      features.push({
        type: 'Feature',
        properties: { slopeDegrees: Math.round(degrees), slopeClass: slopeClass(degrees) },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            northwest.position,
            northeast.position,
            southeast.position,
            southwest.position,
            northwest.position,
          ]],
        },
      })
    }
  }

  return { type: 'FeatureCollection', features }
}

function MapView({ active, latitude, longitude, resortName }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const initialCenterRef = useRef({ latitude, longitude })
  const initialResortNameRef = useRef(resortName)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState('')
  const [pistesVisible, setPistesVisible] = useState(false)
  const [slopeVisible, setSlopeVisible] = useState(false)
  const [pisteStatus, setPisteStatus] = useState('')
  const [slopeStatus, setSlopeStatus] = useState('')

  useEffect(() => {
    if (!containerRef.current) return

    const map = new MapLibreMap({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [initialCenterRef.current.longitude, initialCenterRef.current.latitude],
      zoom: 11,
      pitch: 60,
      bearing: 20,
      maxPitch: 85,
      maxZoom: 17,
      attributionControl: { compact: false },
    })

    map.once('style.load', () => {
      const winterColors = [
        ['background', 'background-color', '#cbd8cc'],
        ['park', 'fill-color', '#b1c7b2'],
        ['water', 'fill-color', '#97b9c8'],
        ['landcover_wood', 'fill-color', '#98b29c'],
        ['landuse_residential', 'fill-color', '#c1d0c3'],
        ['building', 'fill-color', '#aab9ae'],
        ['waterway', 'line-color', '#7599a5'],
        ['highway_path', 'line-color', '#a5b2a5'],
        ['highway_minor', 'line-color', '#a2b0a3'],
        ['highway_major_casing', 'line-color', '#879587'],
        ['highway_major_inner', 'line-color', '#c3d1c5'],
      ] as const
      winterColors.forEach(([layerId, property, color]) => {
        if (map.getLayer(layerId)) map.setPaintProperty(layerId, property, color)
      })
      const roadOpacities = [
        ['highway_path', 0.25],
        ['highway_minor', 0.25],
        ['highway_major_casing', 0.22],
        ['highway_major_inner', 0.3],
      ] as const
      roadOpacities.forEach(([layerId, opacity]) => {
        if (map.getLayer(layerId)) map.setPaintProperty(layerId, 'line-opacity', opacity)
      })
      map.addSource('terrain', {
        type: 'raster-dem',
        tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
        tileSize: 512,
        encoding: 'terrarium',
        attribution: '<a href="https://mapterhorn.com/attribution" target="_blank" rel="noreferrer">Mapterhorn terrain data sources</a>',
      })
      map.addLayer({
        id: 'terrain-hillshade',
        type: 'hillshade',
        source: 'terrain',
        paint: {
          'hillshade-accent-color': '#98a99b',
          'hillshade-exaggeration': 0.3,
          'hillshade-highlight-color': '#dce6dc',
          'hillshade-illumination-direction': 315,
          'hillshade-shadow-color': '#718174',
        },
      }, 'waterway')
      map.setTerrain({ source: 'terrain', exaggeration: 1 })

      map.addSource('ski-overlays', {
        type: 'geojson',
        data: emptySkiFeatures,
        attribution: '© OpenStreetMap contributors',
      })
      map.addSource('slope-angle-data', {
        type: 'geojson',
        data: emptySlopeFeatures,
      })

      const firstSymbolLayerId = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id
      map.addLayer({
        id: 'slope-angle-fill',
        type: 'fill',
        source: 'slope-angle-data',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': [
            'match',
            ['get', 'slopeClass'],
            'moderate', '#f0ce5a',
            'steep', '#e88b3b',
            'very-steep', '#cc5148',
            '#6daf87',
          ],
          'fill-opacity': 0.4,
        },
      }, map.getLayer('highway_path') ? 'highway_path' : firstSymbolLayerId)
      map.addLayer({
        id: 'ski-pistes',
        type: 'line',
        source: 'ski-overlays',
        filter: ['==', ['get', 'kind'], 'piste'],
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'match',
            ['get', 'difficulty'],
            'novice', '#27864b',
            'easy', '#287cc2',
            'intermediate', '#d94b43',
            'expert', '#343a35',
            'freeride', '#8e5ca2',
            '#c98432',
          ],
          'line-width': 3.5,
        },
      }, firstSymbolLayerId)
      map.addLayer({
        id: 'ski-lifts',
        type: 'line',
        source: 'ski-overlays',
        filter: ['==', ['get', 'kind'], 'lift'],
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#813b9b',
          'line-dasharray': [1.5, 1.5],
          'line-width': 2.8,
        },
      }, firstSymbolLayerId)
    })
    map.addControl(
      new NavigationControl({ showZoom: true, showCompass: true, visualizePitch: true }),
      'top-right',
    )
    markerRef.current = new Marker({ color: '#b7792e' })
      .setLngLat([initialCenterRef.current.longitude, initialCenterRef.current.latitude])
      .addTo(map)
    markerRef.current.getElement().setAttribute('aria-label', `Selected location: ${initialResortNameRef.current}`)
    markerRef.current.getElement().setAttribute('title', initialResortNameRef.current)
    map.once('load', () => setMapLoaded(true))
    map.on('error', () => {
      setMapError('Some map or terrain tiles could not be loaded. Check your connection and try again.')
    })
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const layerIds = ['ski-pistes', 'ski-lifts']
    layerIds.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', pistesVisible ? 'visible' : 'none')
      }
    })
    if (!pistesVisible) {
      setPisteStatus('')
      return
    }

    let debounceTimer: number | undefined
    let controller: AbortController | null = null
    let loadedBounds: { south: number; west: number; north: number; east: number } | null = null
    let pendingBounds: { south: number; west: number; north: number; east: number } | null = null

    async function loadSkiData() {
      if (map.getZoom() < 10.5) {
        controller?.abort()
        controller = null
        pendingBounds = null
        setPisteStatus('Zoom in closer to load mapped ski runs and lifts.')
        return
      }

      const bounds = map.getBounds()
      const south = bounds.getSouth()
      const west = bounds.getWest()
      const north = bounds.getNorth()
      const east = bounds.getEast()
      if (north - south > 0.6 || east - west > 0.6) {
        controller?.abort()
        controller = null
        pendingBounds = null
        setPisteStatus('Zoom in closer to load mapped ski runs and lifts.')
        return
      }

      const visibleBounds = { south, west, north, east }
      const containsBounds = (outer: typeof visibleBounds, inner: typeof visibleBounds) =>
        outer.south <= inner.south &&
        outer.west <= inner.west &&
        outer.north >= inner.north &&
        outer.east >= inner.east

      if (loadedBounds && containsBounds(loadedBounds, visibleBounds)) {
        controller?.abort()
        controller = null
        pendingBounds = null
        return
      }
      if (pendingBounds && containsBounds(pendingBounds, visibleBounds)) return

      controller?.abort()
      controller = null
      pendingBounds = null

      const latitudePadding = (north - south) * 0.3
      const longitudePadding = (east - west) * 0.3
      const queryBounds = {
        south: Math.max(-90, south - latitudePadding),
        west: Math.max(-180, west - longitudePadding),
        north: Math.min(90, north + latitudePadding),
        east: Math.min(180, east + longitudePadding),
      }
      const bbox = `${queryBounds.south},${queryBounds.west},${queryBounds.north},${queryBounds.east}`
      const query = `[out:json][timeout:30];(way["piste:type"="downhill"](${bbox});way["aerialway"~"^(${pisteTypes})$"](${bbox}););out geom;`
      const requestController = new AbortController()
      controller = requestController
      pendingBounds = queryBounds
      let timedOut = false
      const timeout = window.setTimeout(() => {
        timedOut = true
        requestController.abort()
      }, 30_000)
      setPisteStatus('Loading mapped ski runs and lifts…')

      try {
        const response = await fetch(overpassUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: query }),
          signal: requestController.signal,
        })
        if (!response.ok) throw new Error(`OpenStreetMap query returned ${response.status}.`)

        const data = parseSkiFeatures(await response.json())
        const source = getGeoJSONSource(map, 'ski-overlays')
        if (!source) {
          throw new Error('The ski overlay source is unavailable.')
        }
        source.setData(data)
        loadedBounds = queryBounds
        setPisteStatus(data.features.length
          ? `${data.features.length} mapped lines · © OpenStreetMap contributors`
          : 'No mapped ski runs or lifts in this view.')
      } catch (error) {
        if (requestController.signal.aborted) {
          if (timedOut) setPisteStatus('The OpenStreetMap query timed out. Zoom in or try again.')
          return
        }
        setPisteStatus(error instanceof Error
          ? `Could not load ski data: ${error.message}`
          : 'Could not load ski data. Check your connection and try again.')
      } finally {
        window.clearTimeout(timeout)
        if (controller === requestController) {
          controller = null
          pendingBounds = null
        }
      }
    }

    function scheduleLoad() {
      window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        void loadSkiData()
      }, 400)
    }

    map.on('moveend', scheduleLoad)
    scheduleLoad()
    return () => {
      map.off('moveend', scheduleLoad)
      window.clearTimeout(debounceTimer)
      controller?.abort()
    }
  }, [mapLoaded, pistesVisible])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const source = getGeoJSONSource(map, 'slope-angle-data')
    if (!source) {
      setSlopeStatus('The slope-angle layer is unavailable.')
      return
    }

    map.setLayoutProperty('slope-angle-fill', 'visibility', slopeVisible ? 'visible' : 'none')
    if (!slopeVisible) {
      source.setData(emptySlopeFeatures)
      setSlopeStatus('')
      return
    }

    let debounceTimer: number | undefined
    let retryTimer: number | undefined
    let pendingFrame: number | undefined
    let generation = 0
    let retries = 0

    function calculate() {
      const currentGeneration = generation
      setSlopeStatus('Calculating slope angles from terrain…')
      pendingFrame = window.requestAnimationFrame(() => {
        if (currentGeneration !== generation) return
        const features = createSlopeFeatures(map)
        if (currentGeneration !== generation) return
        source.setData(features)

        if (features.features.length === 0 && retries < 2) {
          retries += 1
          setSlopeStatus('Waiting for terrain elevation data…')
          retryTimer = window.setTimeout(calculate, 700)
          return
        }
        setSlopeStatus(features.features.length
          ? `${features.features.length.toLocaleString()} approximate terrain cells · not avalanche hazard`
          : 'No terrain elevations available in this view. Try panning or zooming.')
      })
    }

    function scheduleCalculation() {
      generation += 1
      retries = 0
      window.clearTimeout(debounceTimer)
      window.clearTimeout(retryTimer)
      if (map.getZoom() < 10.5) {
        source.setData(emptySlopeFeatures)
        setSlopeStatus('Zoom in closer to calculate slope angles.')
        return
      }
      debounceTimer = window.setTimeout(calculate, 300)
    }

    map.on('moveend', scheduleCalculation)
    scheduleCalculation()
    return () => {
      generation += 1
      map.off('moveend', scheduleCalculation)
      window.clearTimeout(debounceTimer)
      window.clearTimeout(retryTimer)
      if (pendingFrame !== undefined) window.cancelAnimationFrame(pendingFrame)
    }
  }, [mapLoaded, slopeVisible])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !active) return

    const frame = window.requestAnimationFrame(() => map.resize())
    return () => window.cancelAnimationFrame(frame)
  }, [active])

  useEffect(() => {
    mapRef.current?.flyTo({ center: [longitude, latitude], duration: 900 })
    markerRef.current?.setLngLat([longitude, latitude])
    markerRef.current?.getElement().setAttribute('aria-label', `Selected location: ${resortName}`)
    markerRef.current?.getElement().setAttribute('title', resortName)
  }, [latitude, longitude, resortName])

  return (
    <div className="map-view">
      <div
        ref={containerRef}
        className="map-canvas"
        role="region"
        aria-label={`Interactive 3D terrain map around ${resortName}`}
      />
      <div className="map-overlay-controls" role="group" aria-label="Map overlays">
        <label>
          <input
            type="checkbox"
            checked={pistesVisible}
            onChange={(event) => setPistesVisible(event.target.checked)}
          />
          <span>Ski runs and lifts</span>
        </label>
        {pistesVisible && (
          <>
            <p className="map-overlay-status" role="status">{pisteStatus}</p>
            <div className="map-overlay-legend" aria-label="Ski piste difficulty legend">
              <span><i className="legend-line piste-novice" />Novice</span>
              <span><i className="legend-line piste-easy" />Easy</span>
              <span><i className="legend-line piste-intermediate" />Intermediate</span>
              <span><i className="legend-line piste-expert" />Advanced</span>
              <span><i className="legend-line lift-line" />Lift</span>
            </div>
          </>
        )}
        <label>
          <input
            type="checkbox"
            checked={slopeVisible}
            onChange={(event) => setSlopeVisible(event.target.checked)}
          />
          <span>Slope angle</span>
        </label>
        {slopeVisible && (
          <>
            <p className="map-overlay-status" role="status">{slopeStatus}</p>
            <div className="map-overlay-legend" aria-label="Slope angle legend">
              <span><i className="legend-swatch slope-gentle" />0–25°</span>
              <span><i className="legend-swatch slope-moderate" />25–30°</span>
              <span><i className="legend-swatch slope-steep" />30–35°</span>
              <span><i className="legend-swatch slope-very-steep" />35°+</span>
            </div>
            <p className="map-overlay-warning">Terrain slope only — not avalanche danger or safety advice.</p>
          </>
        )}
      </div>
      <div className="map-location-chip">{resortName}</div>
      {!mapLoaded && !mapError && <div className="map-status" role="status">Loading 3D terrain…</div>}
      {mapError && <div className="map-error" role="alert">{mapError}</div>}
      <p className="map-hint">Drag to pan · Right-drag to rotate and tilt · Scroll to zoom</p>
    </div>
  )
}

export default MapView
