// Modal de l'app. Sur le web, une modale s'ouvre par-dessus toute la page :
// on garde son contenu dans la même colonne de téléphone que l'app.
import React from 'react';
import { Modal as RNModal, ModalProps, Platform, StyleSheet, View } from 'react-native';

export const PHONE_MAX_WIDTH = 460;

export const Modal: React.FC<ModalProps> = ({ children, ...props }) => (
  <RNModal {...props}>
    {Platform.OS === 'web' ? (
      <View style={[styles.outer, { backgroundColor: props.transparent ? 'transparent' : '#000' }]}>
        <View style={styles.inner}>{children}</View>
      </View>
    ) : (
      children
    )}
  </RNModal>
);

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  inner: { flex: 1, width: '100%', maxWidth: PHONE_MAX_WIDTH, overflow: 'hidden' },
});
