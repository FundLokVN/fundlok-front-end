interface TurnstileInstance {
  render: (
    container: string | HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      /** "interaction-only": hidden unless Cloudflare needs a click. */
      appearance?: "always" | "execute" | "interaction-only";
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

interface Window {
  turnstile?: TurnstileInstance;
}
