export const maxDuration = 15

const NOMINATIM_HEADERS = {
  'User-Agent': 'CityPin-LA311-Assistant/1.0 (civic service request app)',
  'Accept-Language': 'en',
}

// Best-effort geocoding via OpenStreetMap Nominatim. Supports two modes:
//   - reverse: ?lat=..&lon=..  -> street address for coordinates
//   - forward: ?q=..           -> street address + coordinates for a place name
// Falls back gracefully so the flow never blocks on it.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')
  const q = searchParams.get('q')

  // Forward geocoding: turn a place/landmark the user mentioned into a real
  // Los Angeles street address with coordinates.
  if (q) {
    try {
      // Bias results toward the LA area so a landmark name resolves locally.
      const url =
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1` +
        `&addressdetails=1&countrycodes=us` +
        `&viewbox=-118.6682,34.3373,-118.1553,33.7037&bounded=0` +
        `&q=${encodeURIComponent(q)}`

      const res = await fetch(url, {
        headers: NOMINATIM_HEADERS,
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) throw new Error(`nominatim ${res.status}`)

      const data = (await res.json()) as Array<{
        display_name?: string
        lat?: string
        lon?: string
      }>
      const hit = data[0]
      return Response.json({
        address: hit?.display_name ?? null,
        lat: hit?.lat ? Number(hit.lat) : null,
        lng: hit?.lon ? Number(hit.lon) : null,
      })
    } catch (err) {
      console.log('[v0] forward geocode error:', err instanceof Error ? err.message : err)
      return Response.json({ address: null, lat: null, lng: null })
    }
  }

  if (!lat || !lon) {
    return Response.json({ error: 'lat and lon, or q, required' }, { status: 400 })
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat,
    )}&lon=${encodeURIComponent(lon)}`

    const res = await fetch(url, {
      headers: NOMINATIM_HEADERS,
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) throw new Error(`nominatim ${res.status}`)

    const data = (await res.json()) as { display_name?: string }
    return Response.json({ address: data.display_name ?? null })
  } catch (err) {
    console.log('[v0] geocode error:', err instanceof Error ? err.message : err)
    // Non-fatal: caller keeps the raw coordinates.
    return Response.json({ address: null })
  }
}
