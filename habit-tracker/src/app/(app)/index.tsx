import { PageTemplate } from '@/components/page-template';

export default function TodayScreen() {
  return (
    <PageTemplate
      title="Today"
      subtitle="The habits you're checking off right now."
      placeholder="Today's habit list will live here. Check habits off as you complete them — the session is persisted with expo-secure-store on device and local storage on web, so you stay logged in between launches."
    />
  );
}
