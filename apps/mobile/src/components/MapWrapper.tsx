import React from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';

export default function MapWrapper({ location, isMapReady, setIsMapReady }: any) {
  return (
    <MapView
      style={{ width: '100%', height: '100%' }}
      initialRegion={{
        latitude: location?.coords.latitude || 24.7136,
        longitude: location?.coords.longitude || 46.6753,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }}
      showsUserLocation={true}
      showsMyLocationButton={true}
      onMapReady={() => setIsMapReady(true)}
    >
      {isMapReady && location && (
        <Polyline
          coordinates={[
            { latitude: location.coords.latitude, longitude: location.coords.longitude },
            { latitude: location.coords.latitude + 0.001, longitude: location.coords.longitude + 0.001 }
          ]}
          strokeColor="#3498DB"
          strokeWidth={6}
        />
      )}
    </MapView>
  );
}
