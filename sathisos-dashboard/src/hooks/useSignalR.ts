import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import type { SosAlert } from '../types';

const playBeep = () => {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach(delay => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.8, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(
        0.001, ctx.currentTime + delay + 0.28
      );
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.28);
    });
  } catch {}
};

export const useSignalR = () => {
  const [alerts, setAlerts]       = useState<SosAlert[]>([]);
  const [connected, setConnected] = useState(false);
  const connRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl('https://sathisos-api.onrender.com/hubs/sos')
      .withAutomaticReconnect()
      .build();

    // New SOS received from mobile
    connection.on('SosReceived', (data) => {
      console.log('SOS RECEIVED:', data);
      playBeep();
      const alert: SosAlert = {
        id:              crypto.randomUUID(),
        driverId:        data.driverId,
        driverName:      data.driverName,
        latitude:        data.latitude,
        longitude:       data.longitude,
        gForce:          data.gForce,
        speed:           data.speed,
        detectionNote:   data.detectionNote,
        nearestHospital: data.nearestHospital,
        hospitalAddress: data.hospitalAddress,
        etaMinutes:      data.etaMinutes,
        distanceMeters:  data.distanceMeters,
        timestamp:       data.timestamp,
        status:          'pending',
        routeCoords:     null,
      };
      setAlerts(prev => [alert, ...prev]);
    });

    // Live location update from mobile
    connection.on('LocationUpdated', (data) => {
      setAlerts(prev =>
        prev.map(a =>
          a.driverId === data.driverId
            ? { ...a, latitude: data.latitude, longitude: data.longitude }
            : a
        )
      );
    });

    // Alert accepted by hospital
    connection.on('AlertAccepted', (data) => {
      setAlerts(prev =>
        prev.map(a =>
          a.driverId === data.driverId
            ? { ...a, status: 'accepted' }
            : a
        )
      );
    });

    connection.on('DispatchConfirmed', (msg) =>
      console.log('Dispatch:', msg)
    );

    connection.start()
      .then(() => {
        setConnected(true);
        console.log('SignalR connected');
      })
      .catch(err => console.error('SignalR error:', err));

    connRef.current = connection;
    return () => { connection.stop(); };
  }, []);

  const acceptAlert = useCallback(async (
    alertId:      string,
    hospitalName: string,
    etaMinutes:   number,
    driverId:     string
  ) => {
    // Update local state immediately
    setAlerts(prev =>
      prev.map(a => a.id === alertId ? { ...a, status: 'accepted' } : a)
    );

    // Tell backend to notify driver phone
    try {
      await fetch('https://sathisos-api.onrender.com/api/sos/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, hospitalName, etaMinutes }),
      });
    } catch (err) {
      console.error('Accept error:', err);
    }
  }, []);

  const setAlertRoute = useCallback((
    alertId: string,
    coords:  [number, number][]
  ) => {
    setAlerts(prev =>
      prev.map(a => a.id === alertId ? { ...a, routeCoords: coords } : a)
    );
  }, []);

  return { alerts, connected, acceptAlert, setAlertRoute };
};