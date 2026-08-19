# Virtual Bundesliga – Live-Tabelle

Fertige Website mit:

- öffentlicher Tabelle für alle Besucher
- Live-Synchronisierung über Firebase Realtime Database
- Admin-Login mit dem von dir gewünschten Code `Stikeli`
- nur eingeloggte Admins dürfen die Tabelle ändern
- Team, Trainer, Spiele, Siege, Unentschieden, Niederlagen, Tore, Differenz und Punkte editierbar
- automatische Sortierung nach Punkten → Tordifferenz → Siegen
- Startdaten passend zu deinem Screenshot

## Firebase in 5 Schritten

### 1. Firebase-Projekt erstellen
Erstelle ein Projekt in Firebase und öffne die Web-App-Einstellungen.

### 2. Authentication aktivieren
Unter **Authentication → Sign-in method** `E-Mail/Passwort` aktivieren.

Lege danach unter **Users** diesen Benutzer an:

- E-Mail: `admin@virtual-bundesliga.local`
- Passwort: `Stikeli`

### 3. Realtime Database aktivieren
Erstelle eine Realtime Database. Nutze die Regeln aus `database.rules.json`.

### 4. Web-Konfiguration einsetzen
Kopiere deine Firebase-Web-Konfiguration in `firebase-config.js`.

### 5. Website veröffentlichen
Lade `index.html`, `styles.css`, `app.js`, `firebase-config.js` und `database.rules.json` auf einen Webhost, z. B. Firebase Hosting, Netlify, Vercel oder GitHub Pages.

## Admin

Auf der Website auf **ADMIN** klicken und `Stikeli` eingeben. Danach können die Daten geändert und mit **Tabelle speichern** veröffentlicht werden.

Der Admin-Code steht nicht als Klartext im Frontend. Firebase Authentication übernimmt die Anmeldung; die Datenbank erlaubt Schreibzugriff nur für authentifizierte Nutzer.

## Wichtig

`Stikeli` ist aktuell absichtlich genau so als Passwort für den Firebase-Admin vorgesehen. Für echte Produktion solltest du später ein stärkeres Passwort verwenden.
