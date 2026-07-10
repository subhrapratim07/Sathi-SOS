import { useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useSignalR } from './hooks/useSignalR';
import { AlertCard } from './components/AlertCard';
import { RoutePolyline } from './components/RoutePolyline';
import { HOSPITAL_COORDS } from './data/hospitals';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const mkIcon = (color: string) => new L.Icon({
  iconUrl:    `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
  shadowUrl:  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:   [25, 41],
  iconAnchor: [12, 41],
});

const redIcon   = mkIcon('red');
const greenIcon = mkIcon('green');
const blueIcon  = mkIcon('blue');

// Only focus map on very first alert, never again
function MapAutoFocus({ alerts }: { alerts: any[] }) {
  const map        = useMap();
  const hasFocused = useRef(false);

  useEffect(() => {
    if (alerts.length > 0 && !hasFocused.current) {
      map.setView([alerts[0].latitude, alerts[0].longitude], 15);
      hasFocused.current = true;
    }
  }, [alerts.length]);

  return null;
}

function App() {
  const { alerts, connected, acceptAlert, setAlertRoute } = useSignalR();
  const pendingCount = alerts.filter(a => a.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold text-sm">
            S
          </div>
          <div>
            <h1 className="text-lg font-bold">Sathi-SOS</h1>
            <p className="text-xs text-gray-400">Hospital Emergency Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {pendingCount > 0 && (
            <span className="animate-pulse bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
              {pendingCount} ACTIVE SOS
            </span>
          )}
          <div className={`flex items-center gap-2 text-sm ${
            connected ? 'text-green-400' : 'text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-400' : 'bg-red-400'
            }`} />
            {connected ? 'Live' : 'Disconnected'}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Left panel */}
        <div className="w-96 bg-gray-900 border-r border-gray-800 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-sm text-gray-300">
              SOS Alerts ({alerts.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {alerts.length === 0 ? (
              <div className="text-center text-gray-600 mt-16">
                <div className="text-4xl mb-3">🛡️</div>
                <p className="text-sm">No active alerts</p>
                <p className="text-xs mt-1">Waiting for SOS signals...</p>
              </div>
            ) : (
              alerts.map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onAccept={acceptAlert}
                />
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1">
          <MapContainer
            center={[22.5726, 88.3639]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="OpenStreetMap"
            />

            <MapAutoFocus alerts={alerts} />

            {/* Blue hospital markers */}
            {Object.entries(HOSPITAL_COORDS).map(([name, coords]) => (
              <Marker key={name} position={coords} icon={blueIcon}>
                <Popup>
                  <strong>{name}</strong><br />Hospital
                </Popup>
              </Marker>
            ))}

            {/* SOS markers + circles + routes */}
            {alerts.map(alert => {
              const driverPos: [number, number] = [alert.latitude, alert.longitude];
              const hospPos = HOSPITAL_COORDS[alert.nearestHospital];

              return (
                <>
                  <Marker
                    key={`marker-${alert.id}`}
                    position={driverPos}
                    icon={alert.status === 'accepted' ? greenIcon : redIcon}
                  >
                    <Popup>
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                        <strong>SOS Alert</strong><br />
                        Driver: {alert.driverName}<br />
                        G-Force: {alert.gForce?.toFixed(1)}G<br />
                        Speed: {alert.speed?.toFixed(0)} km/h<br />
                        Trigger: {alert.detectionNote}<br />
                        Hospital: {alert.nearestHospital}<br />
                        ETA: ~{alert.etaMinutes} min<br />
                        Time: {new Date(alert.timestamp).toLocaleTimeString()}
                      </div>
                    </Popup>
                  </Marker>

                  <Circle
                    key={`circle-${alert.id}`}
                    center={driverPos}
                    radius={200}
                    color={alert.status === 'pending' ? 'red' : 'green'}
                    fillOpacity={0.15}
                  />

                  {alert.status === 'accepted' && hospPos && (
                    <RoutePolyline
                      key={`route-${alert.id}`}
                      from={driverPos}
                      to={hospPos}
                      onRouteReady={coords => setAlertRoute(alert.id, coords)}
                    />
                  )}
                </>
              );
            })}

          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default App;