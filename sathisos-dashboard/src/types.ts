export interface SosAlert {
  id:              string;
  driverId:        string;
  driverName:      string;
  latitude:        number;
  longitude:       number;
  gForce:          number;
  speed:           number;
  detectionNote:   string;
  nearestHospital: string;
  hospitalAddress: string;
  etaMinutes:      number;
  distanceMeters:  number;
  timestamp:       string;
  status:          'pending' | 'accepted' | 'resolved';
  routeCoords:     [number, number][] | null;
}