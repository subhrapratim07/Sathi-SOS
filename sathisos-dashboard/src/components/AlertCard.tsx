import type { SosAlert } from '../types';

interface Props {
  alert:    SosAlert;
  onAccept: (id: string, hospital: string, eta: number, driverId: string) => void;
}

export const AlertCard = ({ alert, onAccept }: Props) => {
  const time      = new Date(alert.timestamp).toLocaleTimeString();
  const isPending = alert.status === 'pending';

  const noteIcon =
    alert.detectionNote?.toLowerCase().includes('sound')  ? '🔊' :
    alert.detectionNote?.toLowerCase().includes('manual') ? '👆' : '💥';

  const noteBg =
    alert.detectionNote?.toLowerCase().includes('sound')  ? 'bg-purple-900/40 border-purple-700/50' :
    alert.detectionNote?.toLowerCase().includes('manual') ? 'bg-blue-900/40 border-blue-700/50'     :
                                                            'bg-orange-900/40 border-orange-700/50';

  return (
    <div className={`rounded-xl border p-4 mb-3 transition-all ${
      isPending
        ? 'border-red-500 bg-red-950/60'
        : 'border-green-600 bg-green-950/60'
    }`}>

      {/* Top row — status + time + accept button */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          {isPending && (
            <span className="animate-pulse w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          )}
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            isPending
              ? 'bg-red-500/20 text-red-400'
              : 'bg-green-500/20 text-green-400'
          }`}>
            {isPending ? 'PENDING' : 'ACCEPTED'}
          </span>
          <span className="text-gray-500 text-xs">{time}</span>
        </div>

        {isPending ? (
          <button
            onClick={() => onAccept(
              alert.id,
              alert.nearestHospital,
              alert.etaMinutes,
              alert.driverId
            )}
            className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors"
          >
            Accept
          </button>
        ) : (
          <span className="text-green-400 text-xs font-semibold">
            Help dispatched
          </span>
        )}
      </div>

      {/* Driver row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-base font-bold text-white flex-shrink-0">
          {(alert.driverName || 'D')[0].toUpperCase()}
        </div>
        <div>
          <p className="text-white text-sm font-semibold leading-tight">
            {alert.driverName || 'Unknown Driver'}
          </p>
          <p className="text-gray-500 text-xs">
            ID: {alert.driverId?.slice(0, 8)}...
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-black/30 rounded-lg p-2 text-center">
          <p className="text-yellow-400 font-bold text-sm leading-tight">
            {alert.gForce?.toFixed(1)}G
          </p>
          <p className="text-gray-500 text-xs">G-Force</p>
        </div>
        <div className="bg-black/30 rounded-lg p-2 text-center">
          <p className="text-blue-400 font-bold text-sm leading-tight">
            {alert.speed?.toFixed(0)} km/h
          </p>
          <p className="text-gray-500 text-xs">Speed</p>
        </div>
        <div className="bg-black/30 rounded-lg p-2 text-center">
          <p className="text-orange-400 font-bold text-sm leading-tight">
            ~{alert.etaMinutes} min
          </p>
          <p className="text-gray-500 text-xs">ETA</p>
        </div>
      </div>

      {/* Hospital info */}
      <div className="bg-black/20 rounded-lg p-2 mb-2">
        <p className="text-gray-400 text-xs mb-0.5">Nearest hospital</p>
        <p className="text-white text-sm font-semibold leading-tight">
          {alert.nearestHospital}
        </p>
        <p className="text-gray-500 text-xs">{alert.hospitalAddress}</p>
        {alert.distanceMeters > 0 && (
          <p className="text-gray-600 text-xs mt-0.5">
            {(alert.distanceMeters / 1000).toFixed(2)} km away
          </p>
        )}
      </div>

      {/* Detection trigger */}
      {alert.detectionNote && (
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border mb-2 ${noteBg}`}>
          <span className="text-sm">{noteIcon}</span>
          <div>
            <p className="text-xs font-semibold text-gray-300 leading-tight">
              Detection trigger
            </p>
            <p className="text-xs text-gray-400">{alert.detectionNote}</p>
          </div>
        </div>
      )}

      {/* GPS coords */}
      <p className="text-gray-600 text-xs">
        GPS: {alert.latitude?.toFixed(4)}, {alert.longitude?.toFixed(4)}
      </p>
    </div>
  );
};