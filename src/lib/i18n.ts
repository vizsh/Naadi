'use client';
// English, Hindi and Marathi. The Hindi and Marathi strings are machine-drafted and
// need a native speaker's review before the app reaches owners (see docs/08-roadmap.md).
import { useNaadi } from './store';
import type { Lang, State } from './model/core';

type Dict = Record<string, string | string[]>;
const EN: Dict = {
  'nav.floor': 'Shed floor', 'nav.case': 'Case file', 'nav.lab': 'Live lab', 'nav.agents': 'Agents', 'nav.rulebook': 'Rulebook', 'nav.model': 'Model card', 'nav.home': 'Overview',
  demo: 'Demo data', 'net.ready': 'Works offline · saved on this device', 'net.saving': 'Saving for offline use…', 'net.online': 'Online', 'net.offline': 'Offline · running from this device',
  'h.cards': 'Every machine, card by card', 'h.cards.sub': 'One card per 6 hours. A hole marks a signal that left its learned normal.',
  'h.decision': 'Next decision', 'h.why': 'Why NAADI thinks so', 'h.watch': 'Also watching',
  'st.act': 'Act', 'st.watch': 'Watch', 'st.normal': 'Normal', 'st.off': 'Off',
  'btn.approve': 'Approve repair', 'btn.snooze': 'Not now',
  'dec.fine': "Approving drafts a WhatsApp to the bearing dealer and holds the technician's Thursday. Nothing is sent until you confirm.",
  'link.case': 'Open the case file', replay: 'Replay the fortnight', stop: 'Stop replay',
  dec: ['Repair Loom 03 on ', 'Thursday 19 Nov, 14:00–18:00', ', during the scheduled power cut.'],
  cost: ['Expected cost ', '{a}', ' instead of ', '{b}', ' if it runs to failure.'],
};
const HI: Dict = {
  'nav.floor': 'शेड', 'nav.case': 'केस फ़ाइल', 'nav.lab': 'लाइव लैब', 'nav.agents': 'एजेंट', 'nav.rulebook': 'नियमावली', 'nav.model': 'मॉडल कार्ड', 'nav.home': 'परिचय',
  demo: 'डेमो डेटा', 'net.ready': 'ऑफ़लाइन भी चलता है · इस डिवाइस पर सहेजा', 'net.saving': 'ऑफ़लाइन के लिए सहेज रहे हैं…', 'net.online': 'ऑनलाइन', 'net.offline': 'ऑफ़लाइन · इसी डिवाइस से चल रहा है',
  'h.cards': 'हर मशीन, कार्ड-दर-कार्ड', 'h.cards.sub': 'हर 6 घंटे पर एक कार्ड। छेद का मतलब: कोई सिग्नल अपनी सामान्य सीमा से बाहर गया।',
  'h.decision': 'अगला फ़ैसला', 'h.why': 'NAADI ऐसा क्यों मानता है', 'h.watch': 'इन पर भी नज़र',
  'st.act': 'तुरंत कार्रवाई', 'st.watch': 'नज़र रखें', 'st.normal': 'सामान्य', 'st.off': 'बंद',
  'btn.approve': 'मरम्मत मंज़ूर करें', 'btn.snooze': 'अभी नहीं',
  'dec.fine': 'मंज़ूरी देने पर बेयरिंग डीलर के लिए WhatsApp का मसौदा बनेगा और मिस्त्री का गुरुवार रोका जाएगा। आपकी पुष्टि के बिना कुछ नहीं भेजा जाएगा।',
  'link.case': 'केस फ़ाइल खोलें', replay: 'पिछले 14 दिन दोबारा देखें', stop: 'रोकें',
  dec: ['लूम 03 की मरम्मत ', 'गुरुवार 19 नवंबर, 14:00–18:00', ' को, तय बिजली कटौती के दौरान करें।'],
  cost: ['अनुमानित ख़र्च ', '{a}', '; ख़राब होने तक चलाने पर ', '{b}', '।'],
};
const MR: Dict = {
  'nav.floor': 'शेड', 'nav.case': 'केस फाइल', 'nav.lab': 'लाइव्ह लॅब', 'nav.agents': 'एजंट', 'nav.rulebook': 'नियमावली', 'nav.model': 'मॉडेल कार्ड', 'nav.home': 'ओळख',
  demo: 'डेमो डेटा', 'net.ready': 'ऑफलाइनही चालते · या डिव्हाइसवर जतन', 'net.saving': 'ऑफलाइन वापरासाठी जतन करत आहे…', 'net.online': 'ऑनलाइन', 'net.offline': 'ऑफलाइन · याच डिव्हाइसवरून चालू',
  'h.cards': 'प्रत्येक मशीन, कार्ड-दर-कार्ड', 'h.cards.sub': 'दर 6 तासांनी एक कार्ड. छिद्र म्हणजे एखादा सिग्नल त्याच्या नेहमीच्या पातळीबाहेर गेला.',
  'h.decision': 'पुढचा निर्णय', 'h.why': 'NAADI असे का म्हणते', 'h.watch': 'यांच्यावरही लक्ष',
  'st.act': 'त्वरित कारवाई', 'st.watch': 'लक्ष ठेवा', 'st.normal': 'सामान्य', 'st.off': 'बंद',
  'btn.approve': 'दुरुस्ती मंजूर करा', 'btn.snooze': 'आत्ता नाही',
  'dec.fine': 'मंजुरी दिल्यावर बेअरिंग डीलरसाठी WhatsApp मसुदा तयार होईल आणि मेकॅनिकचा गुरुवार राखून ठेवला जाईल. तुमच्या पुष्टीशिवाय काहीही पाठवले जाणार नाही.',
  'link.case': 'केस फाइल उघडा', replay: 'मागील 14 दिवस पुन्हा पाहा', stop: 'थांबवा',
  dec: ['लूम 03 ची दुरुस्ती ', 'गुरुवार 19 नोव्हेंबर, 14:00–18:00', ' या नियोजित वीजकपातीच्या वेळेत करा.'],
  cost: ['अपेक्षित खर्च ', '{a}', '; बंद पडेपर्यंत चालवल्यास ', '{b}', '.'],
};
const DICTS: Record<Lang, Dict> = { en: EN, hi: HI, mr: MR };

export function translate(lang: Lang, key: string): string {
  const v = DICTS[lang][key] ?? EN[key];
  return typeof v === 'string' ? v : key;
}
export function parts(lang: Lang, key: string): string[] {
  const v = DICTS[lang][key] ?? EN[key];
  return Array.isArray(v) ? v : [String(v)];
}
export function useT() {
  const lang = useNaadi((s) => s.lang);
  return {
    lang,
    t: (key: string) => translate(lang, key),
    parts: (key: string) => parts(lang, key),
    st: (s: State) => translate(lang, 'st.' + s),
  };
}
