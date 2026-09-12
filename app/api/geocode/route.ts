export const maxDuration = 15

// Best-effort reverse geocoding via OpenStreetMap Nominatim.
// Falls back gracefully so the flow never blocks on it.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  if (!lat || !lon) {
    return Response.json({ error: 'lat and lon required' }, { status: 400 })
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat,
    )}&lon=${encodeURIComponent(lon)}`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'CityPin-LA311-Assistant/1.0 (civic service request app)',
        'Accept-Language': 'en',
      },
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
