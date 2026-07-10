import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface Props {
  from:         [number, number];
  to:           [number, number];
  onRouteReady: (coords: [number, number][]) => void;
}

export const RoutePolyline = ({ from, to, onRouteReady }: Props) => {
  const map      = useMap();
  const polyRef  = useRef<L.Polyline | null>(null);
  const drawnRef = useRef(false);

  useEffect(() => {
    if (drawnRef.current) return;
    drawnRef.current = true;

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from[1]},${from[0]};${to[1]},${to[0]}` +
      `?overview=full&geometries=geojson`;

    console.log('Fetching route:', url);

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!data.routes?.[0]) {
          console.error('No route returned from OSRM');
          return;
        }

        const coords: [number, number][] =
          data.routes[0].geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng]
          );

        if (polyRef.current) map.removeLayer(polyRef.current);

        polyRef.current = L.polyline(coords, {
          color:     '#3B82F6',
          weight:    6,
          opacity:   0.9,
          dashArray: '12 6',
        }).addTo(map);

        map.fitBounds(polyRef.current.getBounds(), { padding: [60, 60] });
        onRouteReady(coords);
        console.log('Route drawn successfully:', coords.length, 'points');
      })
      .catch(err => console.error('Route fetch error:', err));

    return () => {
      if (polyRef.current) {
        map.removeLayer(polyRef.current);
        polyRef.current = null;
      }
    };
  }, []);

  return null;
};