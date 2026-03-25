# TreeniAI - Full-Stack Treenisovellus

AI-pohjainen progressiivinen treenisovellus painomuistilla, uniseurannalla ja push-ilmoituksilla.

## Tech Stack

- **Backend:** Node.js + Express
- **Tietokanta:** SQLite (sql.js)
- **Frontend:** PWA (vanilla JS)
- **Deploy:** Railway.app / Docker

## Ominaisuudet

- AI-generoitu progressiivinen treeniohjelma (Anthropic/OpenAI)
- Painomuisti: ehdottaa seuraavan treenin painot edellisen perusteella
- Adaptiivinen ohjelma: tunnistaa vaaliinjaaneet treenit ja ehdottaa muutoksia
- Uniseuranta: vaikuttaa treenin intensiteettiin
- PR-seuranta ja edistymistilastot
- Push-ilmoitukset (uni-muistutus, treenipaivamuistutus)
- YouTube-ohjeet liikkeille
- PWA: toimii offlinena, asennettavissa

## Lokaali kehitys

```bash
# 1. Asenna riippuvuudet
npm install

# 2. Kopioi env-tiedosto
cp .env.example .env
# Tayta API-avaimet .env-tiedostoon

# 3. Generoi VAPID-avaimet push-ilmoituksille (valinnainen)
npx web-push generate-vapid-keys

# 4. Generoi ikonit
node generate-icons.js

# 5. Kaynnista
npm start
# Avaa http://localhost:3000
```

## Railway Deploy

1. Luo uusi projekti Railway.app:ssa
2. Yhdista GitHub-repo
3. Lisaa ymparistomuuttujat (Variables):
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY` (valinnainen)
   - `YOUTUBE_API_KEY` (valinnainen)
   - `VAPID_PUBLIC_KEY` ja `VAPID_PRIVATE_KEY`
4. Railway tunnistaa Dockerfilen ja deployaa automaattisesti

Railway tarjoaa persistent storage SQLite-tietokannalle kun kaytat Volume-ominaisuutta:
- Luo Volume ja mounttaa se polkuun `/app/data`

## API-rajapinnat

| Endpoint | Metodi | Kuvaus |
|----------|--------|--------|
| `/api/users/register` | POST | Luo/hae kayttaja |
| `/api/ai/anthropic` | POST | AI-proxy (Anthropic) |
| `/api/ai/openai` | POST | AI-proxy (OpenAI) |
| `/api/ai/youtube` | GET | YouTube-haku |
| `/api/programs` | POST | Tallenna ohjelma |
| `/api/programs/:userId` | GET | Hae ohjelma |
| `/api/workouts/sessions` | POST | Tallenna treeni |
| `/api/workouts/sessions/:userId` | GET | Treenihistoria |
| `/api/workouts/weight-suggestion/:userId/:exercise` | GET | Painoehdotus |
| `/api/workouts/exercise-history/:userId/:exercise` | GET | Liikkeen historia |
| `/api/workouts/missed/:userId` | GET | Vaaliinjaaneet treenit |
| `/api/sleep` | POST | Tallenna uni |
| `/api/sleep/:userId` | GET | Unihistoria |
| `/api/stats/overview/:userId` | GET | Tilastot & PR:t |
| `/api/stats/prs/:userId` | GET | Henkilokohtaiset ennatykset |
| `/api/push/subscribe` | POST | Push-tilaus |
| `/api/push/cron/notifications` | POST | Cron: laheta ilmoitukset |

## Rate Limiting

- AI-endpointit: max 20 pyyntoa/tunti per IP
- Muut API:t: max 300 pyyntoa/15min per IP
