import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MapWrapper() {
  return (
    <View style={styles.webMapFallback}>
      <Text style={styles.webMapText}>
         الخريطة الحية تعمل على أجهزة الهاتف فقط (Live Map is only available on physical mobile devices).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webMapFallback: { width: '100%', padding: 20, backgroundColor: '#2C3E50', borderRadius: 16, marginBottom: 20, alignItems: 'center' },
  webMapText: { color: '#BDC3C7', fontSize: 14, textAlign: 'center' },
});
