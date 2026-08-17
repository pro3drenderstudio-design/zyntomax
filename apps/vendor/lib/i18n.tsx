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

const STR: Record<string, Record<Lang, string>> = {
  welcome_back: { en: "Welcome back", yo: "Kú àbọ̀", ha: "Barka da dawowa", pcm: "Welcome back" },
  request_pickup: { en: "Request a pickup", yo: "Béèrè fún ìkó jọ", ha: "Nemi a dauko", pcm: "Request pickup" },
  snap_tagline: { en: "Snap your recyclables — we come to you", yo: "Ya àwòrán rẹ — a máa wá bá ọ", ha: "Dauki hoto — mu zo wurin ka", pcm: "Snap your recyclables — we go come meet you" },
  home: { en: "Home", yo: "Ilé", ha: "Gida", pcm: "Home" },
  pickups: { en: "Pickups", yo: "Ìkójọ", ha: "Dauko", pcm: "Pickups" },
  wallet: { en: "Wallet", yo: "Àpò owó", ha: "Jakar kuɗi", pcm: "Wallet" },
  profile: { en: "Profile", yo: "Àkọọ́lẹ̀", ha: "Bayani", pcm: "Profile" },
  recycled: { en: "Recycled", yo: "Àtúnlò", ha: "Sake amfani", pcm: "Recycled" },
  earned: { en: "Earned", yo: "Owó tí a rí", ha: "Kuɗin da aka samu", pcm: "Money wey you don make" },
  withdraw_to_bank: { en: "Withdraw to bank", yo: "Yọ owó sí báńkì", ha: "Cire zuwa banki", pcm: "Withdraw to bank" },
  available_to_withdraw: { en: "Available to withdraw", yo: "Owó tó wà láti yọ", ha: "Akwai don cirewa", pcm: "Money wey you fit withdraw" },
  language: { en: "Language", yo: "Èdè", ha: "Harshe", pcm: "Language" },
  sign_in: { en: "Sign in", yo: "Wọlé", ha: "Shiga", pcm: "Sign in" },
  phone_number: { en: "Phone number", yo: "Nọ́mbà fóònù", ha: "Lambar waya", pcm: "Phone number" },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof STR) => string };
const I18nContext = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => STR[k]?.en ?? String(k) });

const KEY = "zyntomax.vendor.lang";

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
  const t = (k: keyof typeof STR) => STR[k]?.[lang] ?? STR[k]?.en ?? String(k);
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }
