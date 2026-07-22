import moment from 'moment';
import 'moment/locale/de';
import Vue, { VueConstructor } from 'vue';
import type VueRouter from 'vue-router';
import type { Pinia } from 'pinia';

import { useSettingsStore } from '~/stores/settings';

export type LanguageCode = 'de' | 'en';

const GERMAN_MESSAGES: Record<string, string> = Object.assign(
  {},
  {
    Language: 'Sprache',
    German: 'Deutsch',
    English: 'Englisch',
    Columns: 'Spalten',
    'Reorder columns': 'Spalten neu anordnen',
    'Drag columns to change the order': 'Spalten per Ziehen neu anordnen',
    'Reset to default': 'Auf Standard zurücksetzen',
    Close: 'Schließen',
    Activity: 'Aktivität',
    Loading: 'Lädt',
    'Loading...': 'Lädt...',
    Timeline: 'Zeitachse',
    Fleet: 'Flotte',
    Stopwatch: 'Stoppuhr',
    Tools: 'Werkzeuge',
    Search: 'Suche',
    Trends: 'Trends',
    Report: 'Bericht',
    Alerts: 'Alarme',
    Timespiral: 'Zeitspirale',
    Query: 'Abfrage',
    Graph: 'Graph',
    'Raw Data': 'Rohdaten',
    Settings: 'Einstellungen',
    Live: 'Live',
    Users: 'Benutzer',
    Devices: 'Geräte',
    Refresh: 'Aktualisieren',
    Start: 'Start',
    End: 'Ende',
    'Apply range': 'Zeitraum anwenden',
    Active: 'Aktiv',
    'Active time': 'Aktivzeit',
    'Total time': 'Gesamtzeit',
    AFK: 'AFK',
    'AFK time': 'AFK-Zeit',
    Locked: 'Gesperrt',
    Disconnected: 'Getrennt',
    'App Time': 'App-Zeit',
    'Live Sessions': 'Live-Sitzungen',
    Session: 'Sitzung',
    Device: 'Gerät',
    User: 'Benutzer',
    Admin: 'Admin',
    'Admin settings': 'Admin-Einstellungen',
    Username: 'Benutzername',
    Password: 'Passwort',
    Time: 'Zeit',
    State: 'Status',
    Status: 'Status',
    Updated: 'Aktualisiert',
    Generated: 'Erstellt',
    Hours: 'Stunden',
    App: 'App',
    'Current app': 'Aktuelle App',
    'Last seen': 'Zuletzt gesehen',
    Sessions: 'Sitzungen',
    'Timeline details': 'Zeitachsen-Details',
    'Hover over a timeline item to inspect its details here.':
      'Fahre mit der Maus über ein Zeitachsen-Element, um hier dessen Details zu sehen.',
    Watcher: 'Watcher',
    Watchers: 'Watcher',
    Swimlanes: 'Swimlanes',
    'No watchers available for the current selection.':
      'Für die aktuelle Auswahl sind keine Watcher verfügbar.',
    'No timeline data found for the selected filters.':
      'Für die gewählten Filter wurden keine Zeitachsen-Daten gefunden.',
    'No activity summary data found for the selected range.':
      'Für den gewählten Zeitraum wurden keine Aktivitätsübersichtsdaten gefunden.',
    'No activity summary data matches the current filters.':
      'Keine Aktivitätsübersichtsdaten entsprechen den aktuellen Filtern.',
    'Unable to load activity summary': 'Aktivitätsübersicht konnte nicht geladen werden',
    'Search activity': 'Aktivität suchen',
    'Filter app, title, URL, device...': 'App, Titel, URL, Gerät filtern...',
    'Show AFK time': 'AFK-Zeit anzeigen',
    'Subtract AFK time': 'AFK-Zeit abziehen',
    'Show percent': 'Prozent anzeigen',
    'Events counted: {count}': 'Gezählte Ereignisse: {count}',
    'No data': 'Keine Daten',
    'Last updated': 'Zuletzt aktualisiert',
    'Sign in to continue': 'Zum Fortfahren anmelden',
    'Log in': 'Anmelden',
    'Log out': 'Abmelden',
    'Show stopwatch menu': 'Stoppuhr-Menü anzeigen',
    'Show tools menu': 'Werkzeuge-Menü anzeigen',
    'Change which top navigation menus are visible for all users.':
      'Lege fest, welche Menüs in der oberen Navigation für alle Benutzer sichtbar sind.',
    'Unable to save admin settings': 'Admin-Einstellungen konnten nicht gespeichert werden',
    'Signing in...': 'Anmeldung läuft...',
    'Saving...': 'Speichert...',
    'Invalid username or password': 'Ungültiger Benutzername oder ungültiges Passwort',
    online: 'online',
    stale: 'veraltet',
    active: 'aktiv',
    afk: 'AFK',
    locked: 'gesperrt',
    disconnected: 'getrennt',
    logged_in: 'angemeldet',
    logged_off: 'abgemeldet',
    no_session: 'keine Sitzung',
    unknown: 'unbekannt',
    'not-afk': 'aktiv',
    'No activity reports available': 'Keine Aktivitätsberichte verfügbar',
    'Make sure you have both an AFK and window watcher running':
      'Stelle sicher, dass sowohl der AFK- als auch der Fenster-Watcher laufen',
    'Made with': 'Gemacht mit',
    'by the': 'von den',
    'ActivityWatch developers': 'ActivityWatch-Entwicklern',
    'Host:': 'Host:',
    'Version:': 'Version:',
    'Report a bug': 'Fehler melden',
    'Ask for help': 'Hilfe anfordern',
    'Vote on features': 'Über Funktionen abstimmen',
    Donate: 'Spenden',
    'Note:': 'Hinweis:',
    'Hello early user,': 'Hallo früher Nutzer,',
    "It's still early days for ActivityWatch": 'Für ActivityWatch ist es noch eine frühe Phase',
    '(especially on Android!)': '(besonders auf Android!)',
    ". We've come a long way but we need users (like you!) to provide feedback and help us turn ActivityWatch into a successful project. Early users like you mean a lot to us, and we hope you'll reach out to us with any ideas you have for improvements!":
      '. Wir sind schon weit gekommen, aber wir brauchen Nutzer wie dich, die Feedback geben und uns helfen, ActivityWatch zu einem erfolgreichen Projekt zu machen. Frühe Nutzer wie du bedeuten uns viel, und wir hoffen, dass du dich mit Ideen für Verbesserungen bei uns meldest!',
    'Thank you for using ActivityWatch!': 'Danke, dass du ActivityWatch nutzt!',
    'user survey': 'Nutzerumfrage',
    or: 'oder',
    ' or ': ' oder ',
    and: 'und',
    ' and ': ' und ',
    'Spread the word': 'Weitersagen',
    'Support us!': 'Unterstütze uns!',
    Resources: 'Ressourcen',
    "Want to know what we're working on?": 'Möchtest du wissen, woran wir arbeiten?',
    'Give us a like and a review on ': 'Gib uns ein Like und eine Bewertung auf ',
    'Vote on us at ': 'Stimme für uns ab auf ',
    'Follow us and spread the word on ': 'Folge uns und erzähle davon auf ',
    'Star us on ': 'Gib uns einen Stern auf ',
    Website: 'Webseite',
    Documentation: 'Dokumentation',
    Forum: 'Forum',
    'API Browser': 'API-Browser',
    'Fleet Live': 'Live-Geräte',
    'Fleet Devices': 'Geräte',
    'Fleet Users': 'Benutzer',
    'Select user': 'Benutzer auswählen',
    'Live devices': 'Live-Geräte',
    'Server storage': 'Server-Speicher',
    Calculated: 'Berechnet',
    Recalculate: 'Neu berechnen',
    'ActivityWatch data': 'ActivityWatch-Daten',
    'Disk size': 'Datenträgergröße',
    'Free disk space': 'Freier Speicherplatz',
    'Disk used': 'Datenträger belegt',
    'Data path': 'Datenpfad',
    'Unable to load server storage': 'Server-Speicher konnte nicht geladen werden',
    'Devices grouped across all reported sessions':
      'Geräte, gruppiert über alle gemeldeten Sitzungen',
    'Users grouped across all reported devices': 'Benutzer, gruppiert über alle gemeldeten Geräte',
    'No fleet users found': 'Keine Benutzer gefunden',
    'No fleet devices found': 'Keine Geräte gefunden',
    'No users found': 'Keine Benutzer gefunden',
    'No devices found': 'Keine Geräte gefunden',
    'No fleet watcher data found yet. Start `aw-watcher-session`, `aw-watcher-afk`, and `aw-watcher-window` in central mode to populate this view.':
      'Es wurden noch keine Watcher-Daten gefunden. Starte `aw-watcher-session`, `aw-watcher-afk` und `aw-watcher-window` im Zentralmodus, um diese Ansicht zu füllen.',
    'No watcher data found yet. Start `aw-watcher-session`, `aw-watcher-afk`, and `aw-watcher-window` in central mode to populate this view.':
      'Es wurden noch keine Watcher-Daten gefunden. Starte `aw-watcher-session`, `aw-watcher-afk` und `aw-watcher-window` im Zentralmodus, um diese Ansicht zu füllen.',
    'No data found for this user.': 'Keine Daten für diesen Benutzer gefunden.',
    'No data found for this device.': 'Keine Daten für dieses Gerät gefunden.',
    'No app data found in the selected range': 'Keine App-Daten im gewählten Zeitraum gefunden',
    'No live sessions for this user': 'Keine Live-Sitzungen für diesen Benutzer',
    'No live sessions for this device': 'Keine Live-Sitzungen für dieses Gerät',
    'No live sessions found': 'Keine Live-Sitzungen gefunden',
    'Devices included in this summary': 'In dieser Zusammenfassung enthaltene Geräte',
    'All devices': 'Alle Geräte',
    Buckets: 'Buckets',
    'Are you looking to collect more data? Check out ':
      'Möchtest du mehr Daten erfassen? Sieh dir ',
    'the docs': 'die Dokumentation',
    ' for more watchers.': ' für weitere Watcher an.',
    'the current device': 'das aktuelle Gerät',
    'First seen:': 'Zuerst gesehen:',
    Open: 'Öffnen',
    More: 'Mehr',
    'Export bucket as JSON': 'Bucket als JSON exportieren',
    'Export events as CSV': 'Ereignisse als CSV exportieren',
    'Delete bucket': 'Bucket löschen',
    'Danger!': 'Achtung!',
    'Are you sure you want to delete bucket': 'Möchtest du den Bucket wirklich löschen',
    'This is permanent and cannot be undone!':
      'Dies ist dauerhaft und kann nicht rückgängig gemacht werden!',
    Cancel: 'Abbrechen',
    Confirm: 'Bestätigen',
    'Import and export buckets': 'Buckets importieren und exportieren',
    'Choose or drop a file here...': 'Datei hier auswählen oder ablegen...',
    'Drop file here...': 'Datei hier ablegen...',
    'A valid file to import is a JSON file from either an export of a single bucket or an export from multiple buckets.':
      'Eine gültige Importdatei ist eine JSON-Datei aus dem Export eines einzelnen Buckets oder mehrerer Buckets.',
    'If there are buckets with the same name the import will fail.':
      'Wenn Buckets mit demselben Namen vorhanden sind, schlägt der Import fehl.',
    'Export all buckets as JSON': 'Alle Buckets als JSON exportieren',
    'Developer zone': 'Entwicklerbereich',
    'Just some tools to aid in development and debugging.':
      'Nur einige Werkzeuge für Entwicklung und Debugging.',
    'Nothing to see here right now...': 'Hier gibt es im Moment nichts zu sehen...',
  },
  {
    Timeline: 'Zeitachse',
    Stopwatch: 'Stoppuhr',
    'This is an early experiment. Data entered here is not shown in the Activity view, yet.':
      'Dies ist ein frühes Experiment. Hier eingegebene Daten werden in der Aktivitätsansicht noch nicht angezeigt.',
    'What are you working on?': 'Woran arbeitest du gerade?',
    Start: 'Start',
    Running: 'Läuft',
    History: 'Verlauf',
    Stop: 'Stoppen',
    'Start new': 'Neu starten',
    Edit: 'Bearbeiten',
    'No label': 'Keine Bezeichnung',
    'Query Explorer': 'Abfrage-Explorer',
    'See ': 'Siehe ',
    'the documentation': 'die Dokumentation',
    ' for help on how to write queries.': ' für Hilfe beim Schreiben von Abfragen.',
    'Fleet report': 'Flottenbericht',
    'This feature is still in early development.':
      'Diese Funktion befindet sich noch in einer frühen Entwicklungsphase.',
    Generate: 'Generieren',
    'Show options': 'Optionen anzeigen',
    'Hide options': 'Optionen ausblenden',
    Options: 'Optionen',
    CSV: 'CSV',
    JSON: 'JSON',
    'Too many events, will only show last 500 events.':
      'Zu viele Ereignisse, es werden nur die letzten 500 angezeigt.',
    "Didn't find what you were looking for?": 'Nicht gefunden, wonach du gesucht hast?',
    'Add a week to the search:': 'Eine Woche zur Suche hinzufügen:',
    'New release notification': 'Benachrichtigung über neue Versionen',
    'We will send you a notification if there is a new release available for download, this check will happen at most once per day.':
      'Wir benachrichtigen dich, wenn eine neue Version zum Download verfügbar ist. Diese Prüfung erfolgt höchstens einmal pro Tag.',
    Theme: 'Design',
    'Auto (System)': 'Automatisch (System)',
    Light: 'Hell',
    Dark: 'Dunkel',
    'Landing page': 'Startseite',
    Home: 'Startseite',
    'Change color theme of the application (you need to change categories colors manually to be suitable with dark mode).':
      'Ändere das Farbdesign der Anwendung. Kategorienfarben müssen für den Dunkelmodus manuell angepasst werden.',
    'The page to open when opening ActivityWatch, or clicking the logo in the top menu.':
      'Die Seite, die beim Öffnen von ActivityWatch oder beim Klick auf das Logo im oberen Menü geöffnet wird.',
    'Duration default value': 'Standardwert für Dauer',
    "The default duration used for 'show last' in the timeline view.":
      "Die Standarddauer für 'letzte anzeigen' in der Zeitachsenansicht.",
  },
  {
    'Show last': 'Letzte anzeigen',
    'Show from': 'Anzeigen von',
    Refresh: 'Aktualisieren',
    'Last update:': 'Letzte Aktualisierung:',
    'The selected date range is invalid. The second date must be greater or equal to the first date.':
      'Der gewählte Zeitraum ist ungültig. Das zweite Datum muss größer oder gleich dem ersten sein.',
    'The selected date range is too long. The maximum is':
      'Der gewählte Zeitraum ist zu lang. Das Maximum beträgt',
    days: 'Tage',
    Hostname: 'Hostname',
  },
  {
    Start: 'Start',
    Stop: 'Stopp',
    Toggles: 'Schalter',
    'Filter AFK': 'AFK filtern',
    'High uncategorized time': 'Hoher Anteil unzugeordneter Zeit',
    'Category Builder': 'Kategorie-Builder',
    'Settings page': 'Einstellungsseite',
    'ActivityWatch on Android is in a very early stage of development. There will be bugs, but we hope you bear with us as we refine things and get it on par with the desktop version of ActivityWatch (which you should try!).':
      'ActivityWatch auf Android befindet sich in einer sehr frühen Entwicklungsphase. Es wird Fehler geben, aber wir hoffen auf dein Verständnis, während wir die App verbessern und auf das Niveau der Desktop-Version bringen.',
    'Nothing is as motivating as getting ActivityWatch into the hands of users.':
      'Nichts motiviert mehr, als ActivityWatch in die Hände von Nutzern zu bringen.',
    'By sharing it you get us to make ActivityWatch even better!':
      'Indem du es weiterempfiehlst, hilfst du uns, ActivityWatch noch besser zu machen!',
    'Do you like ActivityWatch? Has it helped you? Help us help you by donating!':
      'Gefällt dir ActivityWatch? Hat es dir geholfen? Hilf uns mit einer Spende, dir noch besser zu helfen!',
    'You can donate to us via:': 'Du kannst uns unterstützen über:',
    'For more info, please visit the ': 'Weitere Informationen findest du auf der ',
    'donation page on the website': 'Spendenseite der Webseite',
    'Check out the ': 'Sieh dir die ',
    'development updates': 'Entwicklungs-Updates',
    'You can change which page opens when you open ActivityWatch (instead of this page) in the ':
      'Du kannst in den ',
    settings: 'Einstellungen',
    ' page.': '-Seiten festlegen, welche Seite beim Öffnen von ActivityWatch angezeigt wird.',
    'vote on features on the forum': 'im Forum über Funktionen abstimmen',
    'Load demo data': 'Demodaten laden',
    Filters: 'Filter',
    'Exclude AFK time': 'AFK-Zeit ausschließen',
    'Count audible browser tab as active': 'Hörbaren Browser-Tab als aktiv zählen',
    'Include manually logged events (stopwatch)':
      'Manuell protokollierte Ereignisse einbeziehen (Stoppuhr)',
    'Show category': 'Kategorie anzeigen',
    'New view': 'Neue Ansicht',
    "Filter away time where the AFK watcher didn't detect any input.":
      'Zeit herausfiltern, in der der AFK-Watcher keine Eingaben erkannt hat.',
    'If the active window is an audible browser tab, count as active. Requires a browser watcher.':
      'Wenn das aktive Fenster ein hörbarer Browser-Tab ist, als aktiv zählen. Erfordert einen Browser-Watcher.',
    'WIP. Stopwatch events shadow other events, when overlapping with them. Only shown in devmode.':
      'In Arbeit: Stoppuhr-Ereignisse überdecken andere Ereignisse bei Überlappung. Wird nur im Entwicklermodus angezeigt.',
    "This feature doesn't support the current time period.":
      'Diese Funktion unterstützt den aktuellen Zeitraum nicht.',
    'This feature is missing data from a required watcher.':
      'Für diese Funktion fehlen Daten eines erforderlichen Watchers.',
    'You can find a list of all watchers in ': 'Eine Liste aller Watcher findest du in ',
    'the documentation.': 'der Dokumentation.',
    'This is a work-in-progress experiment.': 'Dies ist ein unfertiges Experiment.',
    'No events match selected criteria. Timeline is not updated.':
      'Keine Ereignisse entsprechen den gewählten Kriterien. Die Zeitachse wird nicht aktualisiert.',
    'Drag to pan and scroll to zoom': 'Zum Verschieben ziehen und zum Zoomen scrollen',
    'Edit event': 'Ereignis bearbeiten',
    Delete: 'Löschen',
    Save: 'Speichern',
    Randomize: 'Zufällig',
    'data key': 'Datenschlüssel',
    'Regex pattern to search for': 'Regex-Muster für die Suche',
  },
  {
    All: 'Alle',
    None: 'Keine',
    Categories: 'Kategorien',
    'Bucket Specific': 'Bucketspezifisch',
    'Client:': 'Client:',
    'Duration:': 'Dauer:',
    'Last duration': 'Letzte Dauer',
    'Date range': 'Datumsbereich',
    Apply: 'Anwenden',
    'Show last:': 'Letzte anzeigen:',
    Last: 'Letzte',
    Today: 'Heute',
    Range: 'Zeitraum',
    'Range:': 'Zeitraum:',
    'Previous range': 'Vorheriger Zeitraum',
    'Next range': 'Nächster Zeitraum',
    Zoom: 'Zoom',
    'Full range': 'Ganzer Zeitraum',
    Full: 'Ganz',
    'Activity density': 'Aktivitätsdichte',
    Days: 'Tage',
    Weeks: 'Wochen',
    Months: 'Monate',
    Month: 'Monat',
    Year: 'Jahr',
    events: 'Ereignisse',
    for: 'für',
    day: 'Tag',
    week: 'Woche',
    month: 'Monat',
    year: 'Jahr',
    '7 days': '7 Tage',
    '30 days': '30 Tage',
    'last 7 days': 'letzte 7 Tage',
    'last 30 days': 'letzte 30 Tage',
    'No stopwatch running': 'Keine Stoppuhr läuft',
    'No history to show': 'Kein Verlauf vorhanden',
    'Searching...': 'Suche...',
    'Live sessions': 'Live-Sitzungen',
    '{count} device(s)': '{count} Gerät(e)',
    '{selected} of {total} device(s) selected': '{selected} von {total} Gerät(en) ausgewählt',
    'Bucket ID': 'Bucket-ID',
    'Type:': 'Typ:',
    Client: 'Client',
    'Created:': 'Erstellt:',
    'First/last event:': 'Erstes/letztes Ereignis:',
    'Eventcount:': 'Ereignisanzahl:',
    'Data:': 'Daten:',
    'Import buckets': 'Buckets importieren',
    'Export buckets': 'Buckets exportieren',
    'Import failed, see aw-server logs for more info':
      'Import fehlgeschlagen, siehe aw-server-Protokolle für Details',
    'Validate buckets': 'Buckets prüfen',
    'This is a small tool to check the validity of your buckets and their events.':
      'Dies ist ein kleines Werkzeug, um die Gültigkeit deiner Buckets und ihrer Ereignisse zu prüfen.',
    Bucket: 'Bucket',
    Duplicates: 'Duplikate',
    Overlaps: 'Überschneidungen',
    'Zero-duration events': 'Ereignisse mit Null-Dauer',
    'Select the bucket to validate.': 'Wähle den Bucket aus, der geprüft werden soll.',
    'No duplicate events found.': 'Keine doppelten Ereignisse gefunden.',
    'No overlapping events found.': 'Keine sich überschneidenden Ereignisse gefunden.',
    'No zero-duration events found.': 'Keine Ereignisse mit Null-Dauer gefunden.',
    'Merge buckets': 'Buckets zusammenführen',
    'Device is a special device, unattributed to a hostname, or not assigned a device ID.':
      'Das Gerät ist ein spezielles Gerät, keinem Hostnamen zugeordnet oder ohne Geräte-ID.',
    'Sometimes, you might want to merge the events of two buckets together into one.':
      'Manchmal möchtest du die Ereignisse zweier Buckets zu einem zusammenführen.',
    'This is commonly useful to address the case where your hostname might have changed,':
      'Das ist besonders nützlich, wenn sich dein Hostname geändert hat,',
    'creating two buckets for the same watcher and host, which you want to combine together again.':
      'wodurch zwei Buckets für denselben Watcher und Host entstanden sind, die du wieder zusammenführen möchtest.',
    'Bucket from': 'Bucket von',
    'Bucket to': 'Bucket nach',
    'Select the bucket from which you want to merge the events.':
      'Wähle den Bucket aus, aus dem die Ereignisse übernommen werden sollen.',
    'This bucket will be deleted after the merge.':
      'Dieser Bucket wird nach dem Zusammenführen gelöscht.',
    'Select the bucket to which you want to merge the events.':
      'Wähle den Bucket aus, in den die Ereignisse zusammengeführt werden sollen.',
    'This bucket will remain after the merge.':
      'Dieser Bucket bleibt nach dem Zusammenführen bestehen.',
    'Overlapping events': 'Überlappende Ereignisse',
    Merge: 'Zusammenführen',
    'Edit category': 'Kategorie bearbeiten',
    Parent: 'Übergeordnet',
    Rule: 'Regel',
    Type: 'Typ',
    Pattern: 'Muster',
    'Case insensitive': 'Groß-/Kleinschreibung ignorieren',
    'Invalid pattern': 'Ungültiges Muster',
    'Pattern too broad': 'Muster ist zu allgemein',
    Color: 'Farbe',
    'Inherit parent color': 'Farbe von der Oberkategorie übernehmen',
    'Productivity score': 'Produktivitätswert',
    'Inherit parent score': 'Wert von der Oberkategorie übernehmen',
    Score: 'Wert',
    'Remove category': 'Kategorie entfernen',
    'Regular Expression': 'Regulärer Ausdruck',
    'No rule': 'Keine Regel',
    Categorization: 'Kategorisierung',
    'Restore defaults': 'Standardwerte wiederherstellen',
    Import: 'Importieren',
    Export: 'Exportieren',
    'Rules for categorizing events. An event can only have one category. If several categories match, the deepest one will be chosen.':
      'Regeln zur Kategorisierung von Ereignissen. Ein Ereignis kann nur eine Kategorie haben. Wenn mehrere Kategorien passen, wird die tiefste gewählt.',
    'You can use the ': 'Du kannst den ',
    ' to quickly create categories from uncategorized activity.':
      ' verwenden, um schnell Kategorien aus unkategorisierter Aktivität zu erstellen.',
    'You can also find and share categorization rule presets on ':
      'Du kannst außerdem Kategorisierungsregel-Vorlagen auf ',
    'For help on how to write categorization rules, see ':
      'Hilfe zum Schreiben von Kategorisierungsregeln findest du in ',
    'You have unsaved changes!': 'Du hast ungespeicherte Änderungen!',
    Discard: 'Verwerfen',
    'Add category': 'Kategorie hinzufügen',
    'Always count as active pattern': 'Immer-aktiv-Muster',
    'Apps or titles matching this regular expression will never be counted as AFK.':
      'Apps oder Titel, die diesem regulären Ausdruck entsprechen, werden nie als AFK gezählt.',
    'Can be used to count time as active, despite no input (like meetings, or games with controllers). An empty string disables it.':
      'Kann verwendet werden, um Zeit trotz fehlender Eingaben als aktiv zu zählen, etwa bei Meetings oder Spielen mit Controllern. Ein leerer String deaktiviert die Funktion.',
    'Example expression:': 'Beispielausdruck:',
    'AFK overlay color': 'AFK-Overlay-Farbe',
    'Color used for the hatched AFK overlay in summary bars.':
      'Farbe für das schraffierte AFK-Overlay in Übersichts-Balken.',
    'Fleet summary filter defaults': 'Standardfilter für Flottenübersichten',
    'Initial checkbox states for Fleet user summary filters.':
      'Anfangszustand der Checkboxen in Flotten-Benutzerübersichten.',
    'Show AFK time by default': 'AFK-Zeit standardmäßig anzeigen',
    'Subtract AFK time by default': 'AFK-Zeit standardmäßig abziehen',
    'Count audible browser tab as active by default':
      'Hörbaren Browser-Tab standardmäßig als aktiv zählen',
    Enabled: 'Aktiviert',
    Disabled: 'Deaktiviert',
    'Use fallback colors': 'Fallback-Farben verwenden',
    'Uses the old coloring style for some visualizations when uncategorized or no category color.':
      'Verwendet für einige Visualisierungen die alte Farbgebung, wenn keine Kategorie oder keine Kategorienfarbe vorhanden ist.',
    'Start of day': 'Tagesbeginn',
    'The time at which days "start", since humans don\'t always go to bed before midnight.':
      'Die Uhrzeit, zu der Tage beginnen, da Menschen nicht immer vor Mitternacht schlafen gehen.',
    'Set to 04:00 by default.': 'Standardmäßig auf 04:00 gesetzt.',
    'Start of week': 'Wochenbeginn',
    'The weekday which starts a new week.': 'Der Wochentag, an dem eine neue Woche beginnt.',
    Saturday: 'Samstag',
    Sunday: 'Sonntag',
    Monday: 'Montag',
    'Developer settings': 'Entwicklereinstellungen',
    'These settings are meant for developers who (hopefully) know what they are doing, and as such, may break things unexpectedly.':
      'Diese Einstellungen sind für Entwickler gedacht, die hoffentlich wissen, was sie tun, und können daher unerwartet Dinge kaputt machen.',
    'Force devmode': 'Devmodus erzwingen',
    'Devmode enables some features that are still work-in-progress.':
      'Der Devmodus aktiviert einige Funktionen, die sich noch in Entwicklung befinden.',
    'Show yearly time range': 'Jährlichen Zeitraum anzeigen',
    "Querying an entire year is a very heavy operation, and is likely to lead to timeouts. However, the query might be fast enough if you're running aw-server-rust.":
      'Die Abfrage eines ganzen Jahres ist sehr aufwendig und führt wahrscheinlich zu Timeouts. Mit aw-server-rust kann sie jedoch schnell genug sein.',
    'Use multidevice query': 'Mehrgeräte-Abfrage verwenden',
    'Multidevice query is where events are collected from several hosts in the Activity view. It is an early experiment, that currently does not support browser buckets (or the audible-as-active feature).':
      'Bei der Mehrgeräte-Abfrage werden Ereignisse in der Aktivitätsansicht von mehreren Hosts gesammelt. Dies ist ein frühes Experiment und unterstützt derzeit keine Browser-Buckets oder die Funktion "hörbar als aktiv".',
    'Request timeout': 'Anfrage-Timeout',
    'The maximum amount of time a server request can take before timing out. Setting this to a high value can be useful for large queries. Note that you need to reload the web UI for it to apply.':
      'Die maximale Zeit, die eine Serveranfrage dauern darf, bevor sie abbricht. Ein hoher Wert kann für große Abfragen sinnvoll sein. Danach muss die Weboberfläche neu geladen werden.',
    'Web UI commit hash:': 'Web-UI-Commit-Hash:',
    'Categorization helper': 'Kategorisierungsassistent',
    'This tool will help you create categories from your uncategorized time.':
      'Dieses Werkzeug hilft dir, Kategorien aus deiner unkategorisierten Zeit zu erstellen.',
    "When you're done, you can inspect the categories in the ":
      'Wenn du fertig bist, kannst du die Kategorien auf der ',
    ' page.': '-Seite ansehen.',
    "No words with significant duration. You're good to go!":
      'Keine Wörter mit signifikanter Dauer. Alles in Ordnung.',
    'New rule': 'Neue Regel',
    'Append rule': 'Regel anhängen',
    Ignore: 'Ignorieren',
    'Show events': 'Ereignisse anzeigen',
    'Hide events': 'Ereignisse ausblenden',
    Title: 'Titel',
    Word: 'Wort',
    Valid: 'Gültig',
    'Category is required': 'Kategorie ist erforderlich',
    'Time active:': 'Aktive Zeit:',
    'Query range:': 'Abfragebereich:',
    'Add visualization': 'Visualisierung hinzufügen',
    'Edit view': 'Ansicht bearbeiten',
    Remove: 'Entfernen',
    'ID is not unique': 'ID ist nicht eindeutig',
    'Missing ID': 'Fehlende ID',
    'Missing name': 'Fehlender Name',
    Summary: 'Übersicht',
    Window: 'Fenster',
    Browser: 'Browser',
    Editor: 'Editor',
    'Please enter the watcher name': 'Bitte gib den Watcher-Namen ein',
    'Please enter the visualization title': 'Bitte gib den Titel der Visualisierung ein',
    'Event List': 'Ereignisliste',
    'Raw JSON': 'Rohes JSON',
    'Top Applications': 'Top-Anwendungen',
    'Top Window Titles': 'Top-Fenstertitel',
    'Top Browser Domains': 'Top-Browser-Domains',
    'Top Browser URLs': 'Top-Browser-URLs',
    'Top Browser Titles': 'Top-Browser-Titel',
    'Top Editor Files': 'Top-Editor-Dateien',
    'Top Editor Languages': 'Top-Editor-Sprachen',
    'Top Editor Projects': 'Top-Editor-Projekte',
    'Top Categories': 'Top-Kategorien',
    'Category Tree': 'Kategorienbaum',
    'Category Sunburst': 'Kategorien-Sunburst',
    'Timeline (barchart)': 'Zeitachse (Balkendiagramm)',
    'Sunburst clock': 'Sunburst-Uhr',
    'Daily Timeline (Chronological)': 'Tägliche Zeitachse (chronologisch)',
    'Custom Visualization': 'Benutzerdefinierte Visualisierung',
    '(no data)': '(keine Daten)',
    'Generate a report of time spent on a certain category of device activity.':
      'Erzeuge einen Bericht über die aufgewendete Zeit für eine bestimmte Kategorie von Geräteaktivität.',
    'Export as:': 'Exportieren als:',
    'Displays a graph of categories and their transitions.':
      'Zeigt einen Graphen der Kategorien und ihrer Übergänge an.',
    'Max category depth': 'Maximale Kategorietiefe',
    'Exclude uncategorized': 'Unkategorisierte ausschließen',
    'This feature is still in early development. See PR ':
      'Diese Funktion befindet sich noch in einer frühen Entwicklungsphase. Siehe PR ',
    ' for more information.': ' für weitere Informationen.',
    'Select a hostname': 'Hostname auswählen',
    Day: 'Tag',
    Week: 'Woche',
    'Fit to active': 'An aktive Zeit anpassen',
    'Buckets with no events in the queried range will be hidden.':
      'Buckets ohne Ereignisse im abgefragten Zeitraum werden ausgeblendet.',
    'queried interval': 'abgefragter Zeitraum',
    'This will not appear in the production build': 'Dies erscheint nicht im Produktions-Build',
    Hide: 'Ausblenden',
    'Bucket:': 'Bucket:',
    'Show:': 'Anzeigen:',
    Events: 'Ereignisse',
    'Events:': 'Ereignisse:',
    'Goal name:': 'Zielname:',
    'Category:': 'Kategorie:',
    'Current:': 'Aktuell:',
    minutes: 'Minuten',
    Check: 'Prüfen',
    'New alert': 'Neuer Alarm',
    Goal: 'Ziel',
    'Add alert': 'Alarm hinzufügen',
    'Toggle autorefresh every 10s': 'Automatische Aktualisierung alle 10 s',
    'A new release, v': 'Eine neue Version, v',
    ', is available for': ', ist verfügbar zum',
    download: 'Herunterladen',
    disable: 'Deaktivieren',
    'future reminders and checks for updates.': 'zukünftige Erinnerungen und Update-Prüfungen.',
    'Checking for new releases is now disabled, you can re-enable it in the':
      'Die Prüfung auf neue Versionen ist jetzt deaktiviert. Du kannst sie in der',
    "Don't show again": 'Nicht mehr anzeigen',
    Submit: 'Absenden',
    "Hey there! You've been using ActivityWatch for a while. How likely are you to recommend it to a friend/colleague on a scale 1-10? (with 10 being the most likely)":
      'Hallo! Du nutzt ActivityWatch schon eine Weile. Wie wahrscheinlich ist es, dass du es einem Freund oder Kollegen auf einer Skala von 1 bis 10 weiterempfiehlst? 10 ist am wahrscheinlichsten.',
    "We're happy to hear you enjoy using ActivityWatch, but we can do better!":
      'Es freut uns, dass dir ActivityWatch gefällt, aber wir können noch besser werden.',
    'To help us help you, here are a few things you can do:':
      'Damit wir dir noch besser helfen können, hier ein paar Dinge, die du tun kannst:',
    'Tell your friends and colleagues!': 'Erzähl deinen Freunden und Kollegen davon!',
    'We are sorry to hear that you did not like ActivityWatch, but we want to improve! We would be very thankful if you helped us by:':
      'Es tut uns leid zu hören, dass dir ActivityWatch nicht gefallen hat, aber wir möchten besser werden. Wir wären dir dankbar, wenn du uns dabei hilfst:',
    'Woops, this page was not found!': 'Ups, diese Seite wurde nicht gefunden!',
    'Try navigating back where you came from.':
      'Versuche, zu der Seite zurückzugehen, von der du gekommen bist.',
    'Your categories have unsaved changes, are you sure you want to leave?':
      'Deine Kategorien enthalten ungespeicherte Änderungen. Möchtest du die Seite wirklich verlassen?',
    'Invalid form input: {errors}': 'Ungültige Formulareingabe: {errors}',
    "All views have been restored to defaults. Changes won't be saved until you click 'Save'.":
      "Alle Ansichten wurden auf die Standardwerte zurückgesetzt. Änderungen werden erst gespeichert, wenn du auf 'Speichern' klickst.",
    "Note: Changes won't be reflected in the timeline until the page is refreshed. This will be improved in a future version.":
      'Hinweis: Änderungen werden in der Zeitachse erst nach dem Neuladen der Seite sichtbar. Das wird in einer zukünftigen Version verbessert.',
    'selected multiple items: {items}': 'Mehrere Elemente ausgewählt: {items}',
  }
);

type PatternTranslator = {
  pattern: RegExp;
  de: (...args: string[]) => string;
};

const GERMAN_PATTERNS: PatternTranslator[] = [
  {
    pattern: /^User (.+)$/,
    de: username => `Benutzer ${username}`,
  },
  {
    pattern: /^Device (.+)$/,
    de: device => `Gerät ${device}`,
  },
  {
    pattern: /^Trends for (.+)$/,
    de: period => `Trends für ${period}`,
  },
  {
    pattern: /^Using bucket: (.+)$/,
    de: bucket => `Verwendeter Bucket: ${bucket}`,
  },
  {
    pattern: /^Generated (.+)$/,
    de: value => `Erstellt ${value}`,
  },
  {
    pattern: /^Last updated (.+)$/,
    de: value => `Zuletzt aktualisiert ${value}`,
  },
  {
    pattern: /^(\d+) device\(s\)$/,
    de: count => `${count} Gerät(e)`,
  },
  {
    pattern: /^(\d+) of (\d+) device\(s\) selected$/,
    de: (selected, total) => `${selected} von ${total} Gerät(en) ausgewählt`,
  },
  {
    pattern: /^Events shown:\s*(.+)$/,
    de: count => `Angezeigte Ereignisse: ${count}`,
  },
  {
    pattern: /^Found (.+) events in (.+) seconds$/,
    de: (count, seconds) => `${count} Ereignisse in ${seconds} Sekunden gefunden`,
  },
  {
    pattern: /^(\d+)s ago$/,
    de: seconds => `vor ${seconds}s`,
  },
  {
    pattern: /^Activity \((.+)\)$/,
    de: hostname => `Aktivität (${hostname})`,
  },
  {
    pattern: /^Hostname: (.+)$/,
    de: hostname => `Hostname: ${hostname}`,
  },
  {
    pattern: /^Range: (.+) - (.+)$/,
    de: (start, end) => `Zeitraum: ${start} - ${end}`,
  },
  {
    pattern: /^Number of events: (.+)$/,
    de: count => `Anzahl der Ereignisse: ${count}`,
  },
  {
    pattern: /^Goal name: (.+)$/,
    de: name => `Zielname: ${name}`,
  },
  {
    pattern: /^Category: (.+)$/,
    de: category => `Kategorie: ${category}`,
  },
  {
    pattern: /^Current: (.+) \/ (.+) minutes$/,
    de: (current, goal) => `Aktuell: ${current} / ${goal} Minuten`,
  },
  {
    pattern: /^Device known by several hostnames: (.+)$/,
    de: hostnames => `Gerät ist unter mehreren Hostnamen bekannt: ${hostnames}`,
  },
  {
    pattern: /^Device known by several IDs: (.+)$/,
    de: ids => `Gerät ist unter mehreren IDs bekannt: ${ids}`,
  },
  {
    pattern: /^Common words in "(.+)" events$/,
    de: category => `Häufige Wörter in Ereignissen "${category}"`,
  },
  {
    pattern: /^Invalid form input: (.+)$/,
    de: errors => `Ungültige Formulareingabe: ${errors}`,
  },
];

const ATTRIBUTE_NAMES = ['title', 'placeholder', 'aria-label', 'data-original-title'];
const textOriginals = new WeakMap<Text, string>();
const attributeOriginals = new WeakMap<Element, Record<string, string>>();

let activeLocale: LanguageCode = 'de';
let localizationObserver: MutationObserver | null = null;
let localizationScheduled = false;

function interpolate(template: string, params?: Record<string, string | number>) {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_match, key) => String(params[key] ?? ''));
}

function translateCore(value: string, locale: LanguageCode) {
  if (locale === 'en') {
    return value;
  }

  const exact = GERMAN_MESSAGES[value];
  if (exact !== undefined) {
    return exact;
  }

  for (const entry of GERMAN_PATTERNS) {
    const match = value.match(entry.pattern);
    if (!match) {
      continue;
    }
    return entry.de(...match.slice(1));
  }

  return value;
}

function translateTrimmed(value: string, locale: LanguageCode) {
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  const translated = translateCore(trimmed, locale);
  if (translated === trimmed) {
    return value;
  }

  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  return `${leading}${translated}${trailing}`;
}

function shouldSkipTextNode(node: Text) {
  const parent = node.parentElement;
  if (!parent) {
    return true;
  }

  return ['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE'].includes(parent.tagName);
}

function localizeTextNodes(root: ParentNode, locale: LanguageCode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();

  while (current) {
    const textNode = current as Text;
    if (!shouldSkipTextNode(textNode)) {
      const original = textOriginals.get(textNode) ?? textNode.nodeValue ?? '';
      if (!textOriginals.has(textNode)) {
        textOriginals.set(textNode, original);
      }
      const translated = translateTrimmed(original, locale);
      if (textNode.nodeValue !== translated) {
        textNode.nodeValue = translated;
      }
    }
    current = walker.nextNode();
  }
}

function localizeAttributes(root: ParentNode, locale: LanguageCode) {
  if (!(root instanceof Element) && !(root instanceof Document)) {
    return;
  }

  const elements =
    root instanceof Document
      ? Array.from(root.querySelectorAll('*'))
      : [root, ...Array.from(root.querySelectorAll('*'))];

  for (const element of elements) {
    const stored = attributeOriginals.get(element) || {};
    let changed = false;

    for (const attributeName of ATTRIBUTE_NAMES) {
      const raw = element.getAttribute(attributeName);
      if (raw === null) {
        continue;
      }
      if (stored[attributeName] === undefined) {
        stored[attributeName] = raw;
      }
      const translated = translateTrimmed(stored[attributeName], locale);
      if (translated !== raw) {
        element.setAttribute(attributeName, translated);
      }
      changed = true;
    }

    if (changed) {
      attributeOriginals.set(element, stored);
    }
  }
}

function localizeDom(locale: LanguageCode) {
  const appRoot = document.getElementById('app');
  if (!appRoot) {
    return;
  }
  localizeTextNodes(appRoot, locale);
  localizeAttributes(appRoot, locale);
}

function scheduleLocalization(locale: LanguageCode) {
  activeLocale = locale;
  if (localizationScheduled) {
    return;
  }
  localizationScheduled = true;
  Vue.nextTick(() => {
    localizationScheduled = false;
    localizeDom(activeLocale);
  });
}

function updateMomentLocale(locale: LanguageCode) {
  moment.locale(locale === 'de' ? 'de' : 'en');
  document.documentElement.lang = locale;
}

export function translate(
  key: string,
  locale: LanguageCode = 'de',
  params?: Record<string, string | number>
) {
  const template = translateCore(key, locale);
  return interpolate(template, params);
}

export function translateCurrent(key: string, params?: Record<string, string | number>) {
  const store = useSettingsStore();
  return translate(key, (store.language || 'de') as LanguageCode, params);
}

export function getLanguageOptions(locale: LanguageCode) {
  return [
    { value: 'de', text: translate('German', locale) },
    { value: 'en', text: translate('English', locale) },
  ];
}

export function installI18n(VueCtor: VueConstructor<Vue>, pinia: Pinia) {
  const settingsStore = useSettingsStore(pinia);
  activeLocale = settingsStore.language || 'de';
  updateMomentLocale(activeLocale);

  settingsStore.$subscribe((_mutation, state) => {
    const locale = (state.language || 'de') as LanguageCode;
    updateMomentLocale(locale);
    scheduleLocalization(locale);
  });

  VueCtor.mixin({
    computed: {
      $localeCode(): LanguageCode {
        const store = useSettingsStore();
        return (store.language || 'de') as LanguageCode;
      },
    },
    methods: {
      $tr(key: string, params?: Record<string, string | number>) {
        return translateCurrent(key, params);
      },
    },
  });
}

export function startLocalization(router: VueRouter, pinia: Pinia) {
  const settingsStore = useSettingsStore(pinia);

  if (!localizationObserver) {
    localizationObserver = new MutationObserver(() => {
      scheduleLocalization((settingsStore.language || 'de') as LanguageCode);
    });
  }

  const appRoot = document.getElementById('app');
  if (appRoot) {
    localizationObserver.observe(appRoot, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  router.afterEach(() => {
    scheduleLocalization((settingsStore.language || 'de') as LanguageCode);
  });

  scheduleLocalization((settingsStore.language || 'de') as LanguageCode);
}
