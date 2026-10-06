# PopChat for Twitch

Eine inoffizielle Erweiterung, die nicht von Twitch bereitgestellt oder empfohlen wird.

## Lokales Paket installieren

1. Entpacke die Laufzeit-/Store-ZIP in einen eigenen Ordner. `manifest.json` liegt direkt im Stammverzeichnis der ZIP.
2. Öffne in Chrome `chrome://extensions` oder in Edge `edge://extensions` und aktiviere den Entwicklermodus.
3. Wähle „Entpackte Erweiterung laden“ und diesen entpackten Ordner selbst. Bei der Quellcode-ZIP wählst du stattdessen `popchat-for-twitch/extension` im entpackten Quellpaket. Wähle jeweils den Ordner, der `manifest.json` direkt enthält.
4. Bei der ersten Installation öffnet sich automatisch eine lokale Seite der Erweiterung in einem neuen Tab. Lies die Hinweise und wähle „Aktivieren“, wenn du einverstanden bist. Mit „Jetzt nicht“ bleibt die Erweiterung deaktiviert.
5. Lade die Twitch-Seiten bei Bedarf neu.

Das Erweiterungs-Popup in der Symbolleiste zeigt den Aktivierungsstatus. Wähle „Hilfe und Einstellungen“, um die eigene Seite zu öffnen. Ist sie bereits geöffnet, kehrst du zu diesem Tab zurück. Auf dieser Seite kannst du die Funktionen jederzeit aktivieren oder deaktivieren.

## Verwendung

Klicke auf einer Twitch-Livestream-Seite auf das Zahnrad im Player. Wähle „Popout“ für ein normales kleines Fenster oder „Popout (immer im Vordergrund)“ für ein Fenster, das über anderen Fenstern bleibt. Wähle oben im kleinen Fenster die Anordnung des Chats.

AUTO passt die Anordnung an das Fenster an. SIDE zeigt den Chat rechts, BOTTOM unter dem Video. HIDE blendet ihn aus, während er geladen bleibt. Wähle einen anderen Modus, um ihn wieder anzuzeigen. „Neu laden“ aktualisiert den offiziellen Chat. „Chatfenster“ öffnet nur den offiziellen Chat separat.

Lass den ursprünglichen Twitch-Tab geöffnet, solange du das Vordergrundfenster verwendest. Wenn du den Tab schließt, neu lädst oder zu einer anderen Seite wechselst, schließt sich auch das kleine Fenster. Wenn du das kleine Fenster schließt, kehrt das Video zum ursprünglichen Tab zurück.

## Unterstützung und Einschränkungen

Für Chrome und Edge auf dem Desktop mit Document Picture-in-Picture (Chromium 116 oder neuer). Mobilgeräte, Firefox, VODs und Clips werden nicht unterstützt. Der Menüpunkt wird nur bei erkannter Twitch-Menüstruktur ergänzt; nach einem Twitch-Update kann er fehlen. Schließen, Neuladen oder ein Seitenwechsel im ursprünglichen Tab schließt das Vordergrundfenster. Manche Twitch-Einstellungen und Player-Einblendungen werden nicht mit dem Video verschoben. Anmeldung und Chatnachrichten hängen von Twitch und den Browsereinstellungen ab.

Das Vordergrundfenster verwendet Document Picture-in-Picture. Der normale PiP-Modus für Videos wird dadurch nicht um einen Chat ergänzt.

## Datenschutz

Nach dem Aktivieren werden die aktuelle Kanal-URL, das vorhandene Videoelement und die Player-/Menüstruktur lokal für die Anordnung von Video und Chat verwendet. Der offizielle Chat verbindet sich direkt mit Twitch und kann deine Twitch-Anmeldung nutzen. Nur Anzeigeeinstellungen und dein Zustimmungsstatus werden lokal gespeichert. Es werden keine Daten an den Entwickler gesendet.

Vor dem Aktivieren liest die Erweiterung weder die Kanal-URL noch die Player-/Menüstruktur und lädt keinen offiziellen Chat. Öffne über das Erweiterungs-Popup in der Symbolleiste „Hilfe und Einstellungen“ und wähle auf der Seite „Deaktivieren“, um deine Einwilligung zu widerrufen. Der von der Erweiterung verwaltete eingebettete Chat und das Vordergrundfenster werden geschlossen und das Video zurückgebracht. Deine Anzeigeeinstellungen bleiben erhalten.

Die Erweiterung enthält keine Analysefunktionen oder Werbung und verwendet keinen eigenen Server. Sie liest den Kanal aus der aktuellen Seiten-URL ausschließlich zum Anzeigen des zugehörigen offiziellen Chats. Nur Anordnung, Fensterbreite und -höhe sowie dein Zustimmungsstatus werden lokal im Erweiterungsspeicher abgelegt, ohne Synchronisierung. Chats, Browserverlauf, Kanal- und Benutzernamen, Zugangsdaten sowie Cookies werden nicht gespeichert. Der Inhalt des offiziellen Chat-Frames wird nicht ausgelesen. Offizielle Twitch-Einbettungen verbinden sich direkt mit Twitch und nutzen dessen Sitzung, soweit der Browser dies zulässt. Twitch verarbeitet Anmeldung und Chat gemäß seinen eigenen Richtlinien. Die Erweiterung nutzt nur die Berechtigung storage und läuft auf HTTPS-Seiten von www.twitch.tv und player.twitch.tv.

## Aktualisieren

Schließe das kleine Fenster. Ersetze den gesamten geladenen Ordner am selben im Browser registrierten Pfad, statt neue und alte Dateien zusammenzuführen. Lade danach die Erweiterung in der Erweiterungsverwaltung und alle geöffneten Twitch-Seiten neu. Normale Updates behalten die gespeicherten Anzeigeeinstellungen bei.

Bei Updates und beim Start des Browsers öffnet sich die Hilfeseite nicht automatisch. Auch dein in Version 1.5.0 gespeicherter Zustimmungsstatus bleibt erhalten. Vorhandene Anzeigeeinstellungen allein gelten nicht als Einwilligung. Beim Update von einer Version ohne Einwilligungsabfrage öffnest du „Hilfe und Einstellungen“ über das Erweiterungs-Popup in der Symbolleiste, liest die Hinweise und wählst „Aktivieren“, bevor du die Funktionen nutzt.
