import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Vibration, ScrollView
} from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import * as signalR from '@microsoft/signalr';
import { useAuth, API_BASE } from './AuthContext';

const G_THRESHOLD      = 3.0;
const SPEED_THRESHOLD  = 60;
const COUNTDOWN_SEC    = 10;
const FUSION_WINDOW    = 4000; // 4 Seconds memory window

export default function SosScreen() {
  const { token, userId, name, logout } = useAuth();

  // ── States ───────────────────────────────────────────────────
  const [gForce, setGForce]       = useState(0);
  const [speed, setSpeed]         = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sosSent, setSosSent]     = useState(false);
  const [sosInfo, setSosInfo]     = useState<any>(null);
  const [micOn, setMicOn]         = useState(false);
  const [log, setLog]             = useState<string[]>([]);

  // Toggle States
  const [gEnabled, setGEnabled]         = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [speedEnabled, setSpeedEnabled] = useState(true);

  // ── Refs ─────────────────────────────────────────────────────
  const countdownRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const crashRef       = useRef<any>(null);
  const crashTriggered = useRef(false);
  const soundCheckRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationRef    = useRef<any>(null);
  const hubRef         = useRef<signalR.HubConnection | null>(null);

  // Sensor Value Refs
  const latestGRef       = useRef(0);
  const prevSpeedRef     = useRef(0);
  const speedDropRef     = useRef(0);
  const prevDbRef        = useRef(-160);

  // Trigger Timestamps for "Sensor Fusion Memory"
  const gTriggerAt       = useRef(0);
  const soundTriggerAt   = useRef(0);
  const speedTriggerAt   = useRef(0);

  const addLog = (msg: string) =>
    setLog(prev => [
      `${new Date().toLocaleTimeString()} — ${msg}`,
      ...prev.slice(0, 14)
    ]);

  // 🔥 WIPE MEMORY WHEN TOGGLED OFF (Prevents Ghost Triggers)
  useEffect(() => {
    if (!gEnabled) {
      gTriggerAt.current = 0;
      latestGRef.current = 0;
    }
    if (!soundEnabled) {
      soundTriggerAt.current = 0;
      prevDbRef.current = -160;
    }
    if (!speedEnabled) {
      speedTriggerAt.current = 0;
      speedDropRef.current = 0;
    }
  }, [gEnabled, soundEnabled, speedEnabled]);

  // 🧠 DYNAMIC PERMUTATION LOGIC
  const calculateConfidence = (hasG: boolean, hasSound: boolean, hasSpeed: boolean) => {
    let activeCount = 0;
    if (gEnabled) activeCount++;
    if (soundEnabled) activeCount++;
    if (speedEnabled) activeCount++;

    if (activeCount === 0) return { score: 0, sources: [] };

    const pointPerSensor = 100 / activeCount;
    let score = 0;
    let sources: string[] = [];

    if (gEnabled && hasG) {
      score += pointPerSensor;
      sources.push('G-Force');
    }
    if (soundEnabled && hasSound) {
      score += pointPerSensor;
      sources.push('Sound');
    }
    if (speedEnabled && hasSpeed) {
      score += pointPerSensor;
      sources.push('Speed');
    }

    return { score, sources };
  };

  const evaluateAccident = () => {
    if (crashTriggered.current || sosSent) return;

    const now = Date.now();
    const currentG = latestGRef.current;
    const currentSpeed = prevSpeedRef.current;

    // PREVENT PHONE DROP: Only applies if both G and Speed are active
    if (gEnabled && speedEnabled && currentG > G_THRESHOLD && currentSpeed < 10) {
      addLog(`Ignored: Phone drop detected (${currentG.toFixed(1)}G at low speed)`);
      latestGRef.current = 0;
      gTriggerAt.current = 0;
      return;
    }

    // Check if sensors triggered within the 4-second memory window
    const hasG = (now - gTriggerAt.current) < FUSION_WINDOW;
    const hasSound = (now - soundTriggerAt.current) < FUSION_WINDOW;
    const hasSpeed = (now - speedTriggerAt.current) < FUSION_WINDOW;

    const { score, sources } = calculateConfidence(hasG, hasSound, hasSpeed);

    if (score > 0) {
       addLog(`Confidence: ${score.toFixed(0)}% [${sources.join(' + ')}]`);
    }

    if (score >= 60) {
      crashTriggered.current = true;
      addLog(`🚨 ACCIDENT CONFIRMED (${score.toFixed(0)}%)`);
      startCountdown(currentG, `Accident detected by: ${sources.join(' & ')}`);
    }
  };

  // ── SignalR — receive hospital confirmation ──────────────────
  useEffect(() => {
    if (!token || !userId) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/sos?access_token=${token}`)
      .withAutomaticReconnect()
      .build();

    connection.on('HelpConfirmed', (data) => {
      Vibration.vibrate([200, 100, 200, 100, 200, 100, 200]);
      Alert.alert(
        'Help is Coming!',
        `${data.hospitalName}\nETA: ~${data.etaMinutes} minutes\n\nStay calm. Ambulance is on the way.`,
        [{ text: 'OK' }]
      );
      setSosInfo((prev: any) =>
        prev ? { ...prev, etaMinutes: data.etaMinutes } : prev
      );
      addLog(`Hospital confirmed — ETA ${data.etaMinutes} min`);
    });

    connection.start()
      .then(async () => {
        await connection.invoke('RegisterDriver', userId);
        addLog('Connected to hospital network');
      })
      .catch(err => console.error('Hub error:', err));

    hubRef.current = connection;
    return () => { connection.stop(); };
  }, [token, userId]);

  // ── Accelerometer ────────────────────────────────────────────
  useEffect(() => {
    Accelerometer.setUpdateInterval(300);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const mag = Math.sqrt(x * x + y * y + z * z);
      const currentG = parseFloat(mag.toFixed(2));

      setGForce(currentG);
      latestGRef.current = currentG;

      if (gEnabled && currentG > G_THRESHOLD) {
        gTriggerAt.current = Date.now();
        evaluateAccident();
      }
    });
    return () => sub.remove();
  }, [sosSent, gEnabled, soundEnabled, speedEnabled]);

  // ── GPS + live location ping ─────────────────────────────────
  useEffect(() => {
    let watcher: any = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      watcher = await Location.watchPositionAsync(
        {
          accuracy:         Location.Accuracy.High,
          timeInterval:     4000,
          distanceInterval: 5,
        },
        (loc) => {
          const spd = loc.coords.speed
            ? parseFloat((loc.coords.speed * 3.6).toFixed(1))
            : 0;

          setSpeed(spd);

          const prevSpeed = prevSpeedRef.current;
          const drop = prevSpeed - spd;
          speedDropRef.current = drop > 0 ? drop : 0;
          prevSpeedRef.current = spd;

          locationRef.current = {
            latitude:  loc.coords.latitude,
            longitude: loc.coords.longitude,
            speed:     spd,
          };

          if (speedEnabled && speedDropRef.current > 30) {
             speedTriggerAt.current = Date.now();
             evaluateAccident();
          }

          fetch(`${API_BASE}/api/sos/location`, {
            method:  'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              driverId:  userId,
              latitude:  loc.coords.latitude,
              longitude: loc.coords.longitude,
              speed:     spd,
            }),
          }).catch(() => {});
        }
      );
    })();

    return () => { watcher?.remove(); };
  }, [sosSent, gEnabled, soundEnabled, speedEnabled, token, userId]);

  // ── Microphone sound monitoring ──────────────────────────────
  useEffect(() => {
    startSoundMonitoring();
    return () => stopSoundMonitoring();
  }, [sosSent, gEnabled, soundEnabled, speedEnabled]);

  const startSoundMonitoring = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        addLog('Microphone permission denied');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      setMicOn(true);
      if (soundEnabled) addLog('Sound monitoring active');

      soundCheckRef.current = setInterval(async () => {
        if (crashTriggered.current || sosSent || !soundEnabled) return;

        try {
          const rec = new Audio.Recording();
          await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
          await rec.startAsync();

          let maxDb = -160;

          for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 250));
            const status = await rec.getStatusAsync();
            const db = (status as any).metering ?? -160;
            if (db > maxDb) maxDb = db;
          }

          await rec.stopAndUnloadAsync();

          const metering = maxDb;
          const prevDb = prevDbRef.current;
          const spike = metering - prevDb;

          prevDbRef.current = metering;

          if (metering === 0 || metering === -1) return;

          if (soundEnabled && metering > -25 && spike > 20) {
            soundTriggerAt.current = Date.now();
            addLog(`🔊 SOUND SPIKE (${metering.toFixed(0)} dB)`);
            evaluateAccident();
          }

        } catch (err) {
           // Ignore minor read errors
        }
      }, 3000);

    } catch {
      addLog('Sound monitoring unavailable');
    }
  };

  const stopSoundMonitoring = () => {
    if (soundCheckRef.current) clearInterval(soundCheckRef.current);
    setMicOn(false);
  };

  // ── Countdown & SOS ──────────────────────────────────────────
  const startCountdown = async (detectedG: number, reason: string) => {
    Vibration.vibrate([400, 200, 400, 200, 400]);

    const loc = locationRef.current;
    if (!loc) {
      crashTriggered.current = false;
      addLog('No GPS — countdown cancelled');
      return;
    }

    crashRef.current = {
      lat:    loc.latitude,
      lng:    loc.longitude,
      g:      detectedG,
      speed:  loc.speed ?? 0,
      reason,
    };

    let remaining = COUNTDOWN_SEC;
    setCountdown(remaining);

    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        setCountdown(null);
        triggerSOS();
      }
    }, 1000);
  };

  const cancelSOS = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(null);
    crashRef.current = null;
    crashTriggered.current = false;

    // Clear the memory timestamps!
    gTriggerAt.current = 0;
    soundTriggerAt.current = 0;
    speedTriggerAt.current = 0;
    latestGRef.current = 0;

    Vibration.cancel();
    addLog('SOS cancelled — driver is safe');
  };

  const triggerSOS = async () => {
    const data = crashRef.current;
    if (!data) return;

    try {
      addLog('Sending SOS...');
      const res = await fetch(`${API_BASE}/api/sos`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          driverId:      userId,
          driverName:    name,
          latitude:      data.lat,
          longitude:     data.lng,
          gForce:        data.g,
          speed:         data.speed,
          detectionNote: data.reason,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        setSosSent(true);
        setSosInfo(json);
        Vibration.vibrate(800);
        addLog(`SOS sent → ${json.nearestHospital}, ETA ${json.etaMinutes} min`);
      } else {
        addLog('SOS failed — server error');
        crashTriggered.current = false;
      }
    } catch (err) {
      Alert.alert('Error', 'Could not send SOS. Check your network.');
      addLog('SOS failed — network error');
      crashTriggered.current = false;
    }
  };

  const manualSOS = async () => {
    if (crashTriggered.current || sosSent) return;
    const loc = locationRef.current;
    if (!loc) {
      Alert.alert('Wait', 'Getting GPS location, try again in 2 seconds.');
      return;
    }
    crashTriggered.current = true;
    crashRef.current = {
      lat:    loc.latitude,
      lng:    loc.longitude,
      g:      0,
      speed:  loc.speed ?? 0,
      reason: 'Manual SOS by driver',
    };
    addLog('Manual SOS triggered');
    await triggerSOS();
  };

  const reset = () => {
    setSosSent(false);
    setSosInfo(null);
    crashTriggered.current = false;
    crashRef.current = null;

    gTriggerAt.current = 0;
    soundTriggerAt.current = 0;
    speedTriggerAt.current = 0;
    latestGRef.current = 0;

    addLog('System reset — monitoring resumed');
  };

  // ── UI Rendering ─────────────────────────────────────────────
  const gColor = gForce > G_THRESHOLD ? '#ef4444' : gForce > 2.0 ? '#f59e0b' : '#22c55e';
  const sColor = speed > SPEED_THRESHOLD ? '#f59e0b' : '#60a5fa';

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>

      <View style={s.header}>
        <Text style={s.title}>Sathi-SOS</Text>
        <View style={s.badges}>
          <View style={[s.badge, { backgroundColor: micOn && soundEnabled ? '#14532d' : '#1f2937' }]}>
            <Text style={[s.badgeText, { color: micOn && soundEnabled ? '#4ade80' : '#6b7280' }]}>
              {micOn && soundEnabled ? 'MIC ON' : 'MIC OFF'}
            </Text>
          </View>
          <View style={[s.badge, { backgroundColor: speedEnabled ? '#1e3a5f' : '#1f2937' }]}>
            <Text style={[s.badgeText, { color: speedEnabled ? '#60a5fa' : '#6b7280' }]}>
              {speedEnabled ? 'GPS LIVE' : 'GPS OFF'}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.accountRow}>
        <View style={s.accountInfo}>
          <Text style={s.accountLabel}>SIGNED IN AS</Text>
          <Text style={s.accountName}>{name || 'Driver'}</Text>
        </View>
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={() =>
            Alert.alert('Logout', 'Are you sure you want to log out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: () => logout() },
            ])
          }
        >
          <Text style={s.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={s.toggleContainer}>
        <Text style={s.toggleHeader}>DETECTION SENSORS</Text>
        <View style={s.toggleRow}>
          <TouchableOpacity onPress={() => setGEnabled(!gEnabled)} style={[s.toggleBtn, gEnabled && s.toggleBtnActive]}>
            <Text style={[s.toggleText, gEnabled && s.toggleTextActive]}>G-FORCE</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setSoundEnabled(!soundEnabled)} style={[s.toggleBtn, soundEnabled && s.toggleBtnActive]}>
            <Text style={[s.toggleText, soundEnabled && s.toggleTextActive]}>SOUND</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setSpeedEnabled(!speedEnabled)} style={[s.toggleBtn, speedEnabled && s.toggleBtnActive]}>
            <Text style={[s.toggleText, speedEnabled && s.toggleTextActive]}>SPEED</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.sensorRow}>
        <View style={[s.sensorBox, !gEnabled && { opacity: 0.4 }]}>
          <Text style={s.sensorLabel}>G-FORCE</Text>
          <Text style={[s.sensorVal, { color: gEnabled ? gColor : '#6b7280' }]}>
            {gForce.toFixed(2)}
          </Text>
          <Text style={s.sensorUnit}>G</Text>
          <View style={s.miniBar}>
            <View style={[s.miniBarFill, {
              width: `${Math.min((gForce / 5) * 100, 100)}%` as any,
              backgroundColor: gEnabled ? gColor : '#6b7280',
            }]} />
          </View>
        </View>

        <View style={[s.sensorBox, !speedEnabled && { opacity: 0.4 }]}>
          <Text style={s.sensorLabel}>SPEED</Text>
          <Text style={[s.sensorVal, { color: speedEnabled ? sColor : '#6b7280' }]}>
            {speed.toFixed(0)}
          </Text>
          <Text style={s.sensorUnit}>km/h</Text>
          <View style={s.miniBar}>
            <View style={[s.miniBarFill, {
              width: `${Math.min((speed / 120) * 100, 100)}%` as any,
              backgroundColor: speedEnabled ? sColor : '#6b7280',
            }]} />
          </View>
        </View>
      </View>

      {countdown !== null && (
        <View style={s.alertBox}>
          <Text style={s.alertTitle}>ACCIDENT DETECTED!</Text>
          <Text style={s.alertSub}>{crashRef.current?.reason}</Text>
          <Text style={s.countNum}>{countdown}</Text>
          <Text style={s.alertSub}>seconds until SOS is sent</Text>
          <TouchableOpacity style={s.cancelBtn} onPress={cancelSOS}>
            <Text style={s.cancelText}>I AM SAFE — CANCEL</Text>
          </TouchableOpacity>
        </View>
      )}

      {sosSent && sosInfo && (
        <View style={s.sentBox}>
          <Text style={s.sentTitle}>SOS SENT</Text>
          <Text style={s.sentHosp}>{sosInfo.nearestHospital}</Text>
          <Text style={s.sentSub}>Help is on the way</Text>
          {sosInfo.etaMinutes > 0 && (
            <Text style={s.etaText}>ETA: ~{sosInfo.etaMinutes} minutes</Text>
          )}
          <TouchableOpacity style={s.resetBtn} onPress={reset}>
            <Text style={s.resetText}>Reset System</Text>
          </TouchableOpacity>
        </View>
      )}

      {!sosSent && countdown === null && (
        <TouchableOpacity style={s.sosBtn} onPress={manualSOS}>
          <Text style={s.sosBtnText}>MANUAL{'\n'}SOS</Text>
        </TouchableOpacity>
      )}

      <View style={s.logBox}>
        <Text style={s.logTitle}>Detection Log</Text>
        {log.length === 0 ? (
          <Text style={s.logEmpty}>Monitoring for accidents...</Text>
        ) : (
          log.map((entry, i) => (
            <Text key={i} style={s.logEntry}>{entry}</Text>
          ))
        )}
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:       { flex: 1, backgroundColor: '#030712' },
  container:    { alignItems: 'center', padding: 20, paddingTop: 54, paddingBottom: 40 },
  header:       { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:        { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  badges:       { flexDirection: 'row', gap: 8 },
  badge:        { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText:    { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },

  accountRow:   { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111827', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#1f2937' },
  accountInfo:  { flexShrink: 1 },
  accountLabel: { fontSize: 9, color: '#6b7280', letterSpacing: 1, marginBottom: 2 },
  accountName:  { fontSize: 14, color: '#fff', fontWeight: '600' },
  logoutBtn:    { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151' },
  logoutText:   { color: '#f87171', fontSize: 12, fontWeight: 'bold' },

  toggleContainer: { width: '100%', marginBottom: 16 },
  toggleHeader: { fontSize: 10, color: '#6b7280', letterSpacing: 1, marginBottom: 8, textAlign: 'center' },
  toggleRow:    { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  toggleBtn:    { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#374151', backgroundColor: '#1f2937' },
  toggleBtnActive: { borderColor: '#4ade80', backgroundColor: '#14532d' },
  toggleText:   { color: '#9ca3af', fontSize: 12, fontWeight: 'bold' },
  toggleTextActive:{ color: '#4ade80' },

  sensorRow:    { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 20 },
  sensorBox:    { flex: 1, backgroundColor: '#111827', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1f2937' },
  sensorLabel:  { fontSize: 10, color: '#6b7280', letterSpacing: 1, marginBottom: 4 },
  sensorVal:    { fontSize: 36, fontWeight: 'bold' },
  sensorUnit:   { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  miniBar:      { width: '100%', height: 4, backgroundColor: '#1f2937', borderRadius: 2, overflow: 'hidden' },
  miniBarFill:  { height: 4, borderRadius: 2 },
  alertBox:     { backgroundColor: '#7f1d1d', borderRadius: 16, padding: 24, alignItems: 'center', width: '100%', marginBottom: 20, borderWidth: 1, borderColor: '#ef4444' },
  alertTitle:   { fontSize: 20, fontWeight: 'bold', color: '#fca5a5', marginBottom: 6 },
  alertSub:     { fontSize: 12, color: '#fca5a5', marginBottom: 4, textAlign: 'center' },
  countNum:     { fontSize: 72, fontWeight: 'bold', color: '#ef4444', lineHeight: 80 },
  cancelBtn:    { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14, marginTop: 12 },
  cancelText:   { color: '#7f1d1d', fontWeight: 'bold', fontSize: 13 },
  sentBox:      { backgroundColor: '#052e16', borderRadius: 16, padding: 24, alignItems: 'center', width: '100%', marginBottom: 20, borderWidth: 1, borderColor: '#22c55e' },
  sentTitle:    { fontSize: 22, fontWeight: 'bold', color: '#4ade80' },
  sentHosp:     { fontSize: 16, color: '#86efac', fontWeight: '600', marginTop: 4 },
  sentSub:      { fontSize: 13, color: '#86efac', marginTop: 4 },
  etaText:      { fontSize: 20, color: '#4ade80', fontWeight: 'bold', marginTop: 10 },
  resetBtn:     { marginTop: 16, backgroundColor: '#166534', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  resetText:    { color: '#fff', fontWeight: 'bold' },
  sosBtn:       { backgroundColor: '#dc2626', borderRadius: 100, width: 150, height: 150, alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 4, borderColor: '#7f1d1d' },
  sosBtnText:   { color: '#fff', fontWeight: 'bold', fontSize: 18, textAlign: 'center' },
  logBox:       { width: '100%', backgroundColor: '#0f172a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e293b' },
  logTitle:     { fontSize: 11, color: '#475569', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  logEmpty:     { fontSize: 12, color: '#374151', textAlign: 'center', paddingVertical: 8 },
  logEntry:     { fontSize: 11, color: '#64748b', marginBottom: 4 },
});