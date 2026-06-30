/**
 * useChatWidgetStore (T-006)
 *
 * Controls the top-level widget open/close state and display mode.
 *
 * Locale is no longer stored here. The single source of truth for locale
 * is useI18n().locale. Persistence to localStorage is handled in ChatWidget.vue.
 */

export const useChatWidgetStore = defineStore('chatWidget', () => {
  const [isOpen, setOpenState] = useAppState(false);
  const mode = ref<'normal' | 'fallback'>('normal');

  function setOpen(value: boolean) {
    setOpenState(value);
  }

  function toggle() {
    setOpen(!isOpen.value);
  }

  function setMode(m: 'normal' | 'fallback') {
    mode.value = m;
  }

  function reset() {
    setOpen(false);
    mode.value = 'normal';
  }

  return {
    isOpen,
    mode,

    setOpen,
    toggle,
    setMode,
    reset,
  };
});
