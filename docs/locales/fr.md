# PopChat for Twitch

Extension non officielle, ni fournie ni approuvée par Twitch.

## Installer le paquet local

1. Décompressez le ZIP d’exécution destiné au store dans un dossier dédié. Son fichier `manifest.json` est à la racine du ZIP.
2. Ouvrez `chrome://extensions` dans Chrome ou `edge://extensions` dans Edge et activez le mode développeur.
3. Choisissez « Charger l’extension non empaquetée » et sélectionnez ce dossier extrait lui-même. Avec le ZIP du code source, sélectionnez plutôt `popchat-for-twitch/extension` dans le paquet extrait. Dans les deux cas, choisissez le dossier contenant directement `manifest.json`.
4. Lors de la première installation, une page locale de l’extension s’ouvre automatiquement dans un nouvel onglet. Lisez les informations et choisissez « Activer » si vous êtes d’accord. Choisissez « Pas maintenant » pour laisser l’extension désactivée.
5. Rechargez les pages Twitch si nécessaire.

La fenêtre de l’extension dans la barre d’outils indique si elle est activée. Choisissez « Aide et réglages » pour ouvrir la page dédiée ou revenir à son onglet s’il est déjà ouvert. Vous pouvez y activer ou désactiver les fonctions à tout moment.

## Utilisation

### Diffusions en direct

Sur la page d’une chaîne Twitch en direct, cliquez sur la roue dentée du lecteur. Choisissez « Fenêtre détachée » pour une fenêtre normale ou « Fenêtre détachée (au premier plan) » pour la garder au-dessus des autres fenêtres. Choisissez la disposition du chat en haut de la petite fenêtre.

AUTO adapte la disposition à la fenêtre ; SIDE place le chat à droite ; BOTTOM le place sous la vidéo ; HIDE le masque tout en le gardant chargé. Choisissez un autre mode pour le réafficher. « Recharger » actualise le chat officiel. « Autre fenêtre » ouvre uniquement le chat officiel séparément.

Gardez l’onglet Twitch d’origine ouvert pendant l’utilisation de la fenêtre au premier plan. Fermer, recharger ou changer de page dans cet onglet ferme aussi la petite fenêtre. Fermer la petite fenêtre remet la vidéo dans l’onglet d’origine.

### Vidéos archivées (VOD, version 1.6.0)

Sur la page officielle d’une vidéo archivée Twitch, ouvrez les paramètres du lecteur via l’icône d’engrenage et choisissez « Ouvrir dans une fenêtre avec rediffusion du chat ». Une fenêtre classique ouvre la page officielle de la vidéo à la position de lecture actuelle, avec le lecteur et la rediffusion du chat de Twitch. L’onglet d’origine reste ouvert et sa vidéo est mise en pause. La fermeture de la fenêtre ne reporte pas automatiquement sa position de lecture dans l’onglet d’origine et ne relance pas la vidéo d’origine.

AUTO, SIDE, BOTTOM et HIDE fonctionnent aussi avec la rediffusion du chat. Les VOD prennent uniquement en charge les fenêtres classiques, sans option pour rester toujours au premier plan. La barre d’outils VOD ne comporte pas les boutons « Recharger » ni « Autre fenêtre ». La disponibilité de la rediffusion du chat et le comportement de lecture dépendent de Twitch.

## Compatibilité et limites

Pour Chrome et Edge sur ordinateur (Chromium 116 ou version ultérieure). Les fenêtres de direct toujours au premier plan nécessitent Document Picture-in-Picture ; les fenêtres classiques de VOD n’en ont pas besoin. Les appareils mobiles, Firefox et les clips ne sont pas pris en charge. L’option n’est ajoutée que si la structure du menu Twitch est reconnue ; une mise à jour de Twitch peut la faire disparaître. Fermer, recharger ou changer de page dans l’onglet d’origine ferme la fenêtre au premier plan. Certains réglages et éléments superposés du lecteur Twitch ne suivent pas la vidéo. La connexion et l’envoi de messages dépendent de Twitch et des paramètres du navigateur.

La fenêtre au premier plan utilise Document Picture-in-Picture. Cette fonction n’ajoute pas de chat au PiP classique réservé à la vidéo.

## Confidentialité

Une fois activée, l’extension utilise localement l’URL de la chaîne ou de la vidéo actuelle, la position de lecture actuelle, l’élément vidéo existant et la structure du lecteur et du menu pour disposer vidéo et chat. Le chat officiel se connecte directement à Twitch et peut utiliser votre session Twitch. Seuls les réglages d’affichage et votre choix de consentement sont enregistrés localement ; aucune donnée n’est envoyée au développeur.

Avant son activation, l’extension ne lit ni l’URL de la chaîne ou de la vidéo, ni la position de lecture, ni la structure du lecteur ou du menu, et ne charge pas le chat officiel. Ouvrez « Aide et réglages » depuis la fenêtre de l’extension dans la barre d’outils, puis choisissez « Désactiver » sur la page dédiée pour retirer votre consentement. Le chat intégré et la fenêtre au premier plan gérés par l’extension se ferment et la vidéo revient à sa place. Vos réglages d’affichage sont conservés.

L’extension ne comporte ni analyse, ni publicité, ni serveur propre. Pour les diffusions en direct, elle lit le nom de la chaîne dans l’URL actuelle uniquement pour afficher le chat officiel correspondant. Seuls le mode de disposition, les dimensions de la fenêtre et votre choix de consentement sont conservés dans le stockage local de l’extension, sans synchronisation. Elle ne conserve ni chats, ni historique de navigation, ni noms de chaînes ou d’utilisateurs, ni identifiants, ni cookies, et ne lit pas le contenu du cadre du chat officiel. Les intégrations officielles se connectent directement à Twitch et utilisent sa session lorsque le navigateur le permet. Twitch gère la connexion et le chat selon ses propres règles. Seule l’autorisation storage est utilisée, sur les pages HTTPS de www.twitch.tv et player.twitch.tv.

Pour les VOD, l’identifiant de la vidéo et la position de lecture actuelle servent à ouvrir la page officielle de la vidéo archivée Twitch. L’extension dispose le lecteur et la rediffusion du chat existants, sans requêtes supplémentaires à l’API Twitch ni lecture du contenu des messages de la rediffusion. Aucune donnée n’est envoyée au développeur. La désactivation rétablit la disposition normale dans une fenêtre VOD ouverte ; la page officielle Twitch reste ouverte.

## Mise à jour

Gardez une seule édition de PopChat activée. Désactivez les anciennes installations ou les doublons avant d’activer l’édition mise à jour, puis rechargez toutes les pages Twitch ouvertes.

Fermez la petite fenêtre. Remplacez entièrement le dossier chargé au même emplacement enregistré dans le navigateur, sans mélanger les nouveaux fichiers avec les anciens. Rechargez l’extension dans le gestionnaire d’extensions du navigateur, puis toutes les pages Twitch ouvertes. Les mises à jour normales conservent les réglages d’affichage enregistrés.

Les mises à jour et le démarrage du navigateur n’ouvrent pas automatiquement la page d’aide. Votre choix de consentement enregistré dans la version 1.5.0 est également conservé. Les réglages d’affichage existants ne valent pas à eux seuls consentement. Si vous mettez à jour une version qui ne demandait pas votre consentement, ouvrez « Aide et réglages » depuis la fenêtre de l’extension dans la barre d’outils, lisez les informations et choisissez « Activer » avant d’utiliser les fonctions.
