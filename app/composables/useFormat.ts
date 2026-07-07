const messageTimeFormatter = new Intl.DateTimeFormat("zh-TW", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Taipei",
});

export function useFormat() {
  function formatMessageTime(value: string): string | null {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? null
      : messageTimeFormatter.format(date);
  }

  return {
    formatMessageTime,
  };
}
