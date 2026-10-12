import { PageTemplate } from '@/components/page-template';
import { View, Text, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

import { PrimaryButton } from '@/components/primary-button';

export default function TodayScreen() {
  const [showModal, setShowModal] = useState(false);


  return (
    <View>
      <PageTemplate
        title="Today"
        subtitle="The habits you're checking off right now."
        placeholder="Today's habit list will live here. Check habits off as you complete them — the session is persisted with expo-secure-store on device and local storage on web, so you stay logged in between launches."
      />

      <PrimaryButton
        label="Show Modal"
        onPress={() => setShowModal(true)}
      />

      {showModal && (
        <Modal
          animationType="slide"
          transparent={false}
        >
          <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                      <Text>Modal Content Here</Text>
          <PrimaryButton
            label="Close Modal"
            onPress={() => setShowModal(false)}
          />
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}
