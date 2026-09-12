'use client'

import { useState } from 'react'
import { Locate, MapPin } from 'lucide-react'

export function LocationPicker({
  address,
  lat,
  lng,
  onChange,
}: {
  address: string
  lat: number | null
  lng: number | null
  onChange: (v: { address: string; lat: number | null; lng: number | null }) => void
}) {
  const [locating, setLocating] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setStatus('Location is not available on this device. Enter the address below.')
      return
    }
    setLocating(true)
    setStatus(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const nextLat = pos.coords.latitude
        const nextLng = pos.coords.longitude
        onChange({ address, lat: nextLat, lng: nextLng })
        try {
          const res = await fetch(`/api/geocode?lat=${nextLat}&lon=${nextLng}`)
          const data = await res.json()
          if (data.address) {
            onChange({ address: data.address, lat: nextLat, lng: nextLng })
            setStatus('Location found. Edit the address if needed.')
          } else {
            setStatus('Got your GPS location. Add a street address if you can.')
          }
        } catch {
          setStatus('Got your GPS location. Add a street address if you can.')
        } finally {
          setLocating(false)
        }
      },
      () => {
        setLocating(false)
        setStatus('Could not get your location. Please enter the address below.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating}
        className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50 disabled:opacity-60"
      >
        {locating ? (
          <span className="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        ) : (
          <Locate className="size-5" aria-hidden="true" />
        )}
        {locating ? 'Finding you…' : 'Use my current location'}
      </button>

      <div className="relative">
        <MapPin
          className="pointer-events-none absolute left-3 top-3.5 size-5 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="address"
          value={address}
          onChange={(e) => onChange({ address: e.target.value, lat, lng })}
          placeholder="Street address or nearest intersection"
          className="w-full rounded-xl border border-input bg-card py-3 pl-11 pr-4 text-base outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
        />
      </div>

      {lat != null && lng != null && (
        <p className="px-1 font-mono text-xs text-muted-foreground">
          GPS: {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      )}
      {status && (
        <p className="px-1 text-sm text-muted-foreground" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  )
}
