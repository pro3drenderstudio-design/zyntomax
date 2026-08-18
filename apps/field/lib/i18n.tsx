import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

export type Lang = "en" | "yo" | "ha" | "pcm";
export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "yo", label: "Yorùbá" },
  { code: "ha", label: "Hausa" },
  { code: "pcm", label: "Pidgin" },
];

const STR = {
  welcome_back: { en: "Welcome back", yo: "Kú àbọ̀", ha: "Barka da dawowa", pcm: "Welcome back" },
  request_pickup: { en: "Request a pickup", yo: "Béèrè ìkójọ", ha: "Nemi a dauko", pcm: "Request pickup" },
  snap_tagline: { en: "Snap your recyclables — we come to you", yo: "Ya àwòrán — a máa wá bá ọ", ha: "Dauki hoto — mu zo wurinka", pcm: "Snap your recyclables — we go come meet you" },
  home: { en: "Home", yo: "Ilé", ha: "Gida", pcm: "Home" },
  pickups: { en: "Pickups", yo: "Ìkójọ", ha: "Dauko", pcm: "Pickups" },
  wallet: { en: "Wallet", yo: "Àpò owó", ha: "Jakar kuɗi", pcm: "Wallet" },
  profile: { en: "Profile", yo: "Àkọọ́lẹ̀", ha: "Bayani", pcm: "Profile" },
  recycled: { en: "Recycled", yo: "Àtúnlò", ha: "An sake amfani", pcm: "Recycled" },
  earned: { en: "Earned", yo: "Tí a rí gbà", ha: "An samu", pcm: "You don make" },
  rewards: { en: "Rewards", yo: "Èrè", ha: "Ladani", pcm: "Rewards" },
  rates: { en: "Rates", yo: "Owó ìdíyelé", ha: "Farashi", pcm: "Price" },
  withdraw_to_bank: { en: "Withdraw to bank", yo: "Yọ sí báńkì", ha: "Cire zuwa banki", pcm: "Withdraw to bank" },
  available_to_withdraw: { en: "Available to withdraw", yo: "Tó wà láti yọ", ha: "Akwai don cirewa", pcm: "Wey you fit withdraw" },
  lifetime_earned: { en: "Lifetime earned", yo: "Àpapọ̀ tí a rí", ha: "Jimlar da aka samu", pcm: "Total wey you make" },
  withdrawn: { en: "Withdrawn", yo: "Tí a yọ", ha: "An cire", pcm: "Wey you don comot" },
  recent_collections: { en: "Recent collections", yo: "Ìkójọ àìpẹ́", ha: "Tarin baya-bayan nan", pcm: "Recent collections" },
  see_all: { en: "See all", yo: "Wo gbogbo rẹ̀", ha: "Duba duk", pcm: "See all" },
  no_collections: { en: "No collections yet", yo: "Kò sí ìkójọ síbẹ̀", ha: "Babu tarin tukuna", pcm: "No collection yet" },
  next_reward: { en: "Next reward", yo: "Èrè tó kàn", ha: "Lada na gaba", pcm: "Next reward" },
  more_to_unlock: { en: "more to unlock", yo: "kù láti ṣílẹ̀kùn", ha: "sauran buɗewa", pcm: "remain to unlock" },
  account: { en: "Account", yo: "Àkọọ́lẹ̀", ha: "Asusu", pcm: "Account" },
  support: { en: "Support", yo: "Ìrànlọ́wọ́", ha: "Tallafi", pcm: "Support" },
  sign_out: { en: "Sign out", yo: "Jáde", ha: "Fita", pcm: "Comot" },
  edit_profile: { en: "Edit profile", yo: "Ṣàtúnṣe àkọọ́lẹ̀", ha: "Gyara bayani", pcm: "Edit profile" },
  bank_kyc: { en: "Bank & KYC", yo: "Báńkì & KYC", ha: "Banki & KYC", pcm: "Bank & KYC" },
  sales_history: { en: "Sales history", yo: "Ìtàn ọjà", ha: "Tarihin sayarwa", pcm: "Sales history" },
  todays_rates: { en: "Today's rates", yo: "Owó òní", ha: "Farashin yau", pcm: "Today price" },
  invite_earn: { en: "Invite & earn", yo: "Pè & jèrè", ha: "Gayyata & samu", pcm: "Invite & earn" },
  settings_language: { en: "Settings & language", yo: "Ètò & èdè", ha: "Saituna & harshe", pcm: "Settings & language" },
  help_faq: { en: "Help & FAQ", yo: "Ìrànlọ́wọ́", ha: "Taimako", pcm: "Help & FAQ" },
  language: { en: "Language", yo: "Èdè", ha: "Harshe", pcm: "Language" },
  security: { en: "Security", yo: "Ààbò", ha: "Tsaro", pcm: "Security" },
  app_lock: { en: "App lock", yo: "Títì app", ha: "Kulle manhaja", pcm: "App lock" },
  no_pickups: { en: "No pickup requests yet", yo: "Kò sí ìbéèrè ìkójọ", ha: "Babu buƙatun dauko", pcm: "No pickup request yet" },
  open_request: { en: "You have an open request", yo: "O ní ìbéèrè tí ó ṣí", ha: "Kana da buƙata a buɗe", pcm: "You get request wey dey open" },
  sign_in: { en: "Sign in", yo: "Wọlé", ha: "Shiga", pcm: "Sign in" },
  create_account: { en: "Create account", yo: "Ṣí àkọọ́lẹ̀", ha: "Ƙirƙiri asusu", pcm: "Create account" },
  phone_number: { en: "Phone number", yo: "Nọ́mbà fóònù", ha: "Lambar waya", pcm: "Phone number" },
} satisfies Record<string, Record<Lang, string>>;

export type StrKey = keyof typeof STR;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: StrKey) => string };
const I18nContext = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => STR[k]?.en ?? String(k) });

const KEY = "zyntomax.admin.lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    (async () => {
      const saved = (await AsyncStorage.getItem(KEY)) as Lang | null;
      if (saved) setLangState(saved);
      else {
        const device = Localization.getLocales()[0]?.languageCode;
        if (device && ["yo", "ha"].includes(device)) setLangState(device as Lang);
      }
    })();
  }, []);
  const setLang = (l: Lang) => { setLangState(l); AsyncStorage.setItem(KEY, l); };
  const t = (k: StrKey) => STR[k]?.[lang] ?? STR[k]?.en ?? String(k);
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }
