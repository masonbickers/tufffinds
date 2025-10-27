export type WaTarget = {
  key: string;           // identifier for logs / forced tests
  number: string;        // E.164 WITHOUT "+" (e.g. 4479..., 39..., 1...)
  text?: string;         // default message (optional)
  weight?: number;       // for traffic share (default 1)
};

export const WHATSAPP_POOL: WaTarget[] = [
  { key: "ginevra", number: "447591207418", text: "Hi — found you via Instagram.", weight: 1 },
  { key: "gina",  number: "447591222910", text: "Hi — found you via Instagram.",   weight: 1 },
  // add more team members here; adjust weight to change split (e.g., 7 vs 3 for 70/30)
];
