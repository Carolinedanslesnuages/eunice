# Eunice

L'écoconception vérifiée à chaque pull request, avec le RGESN.

Le Référentiel général de l'écoconception des services numériques (RGESN 2024) compte 78
critères. Quelques-uns se mesurent sur le site construit : Eunice les vérifie à chaque PR. Les
autres demandent un regard humain (utilité du service, hébergement, algorithmes…) : Eunice les
pose en liste à cocher dans un commentaire de la PR, et garde les cases cochées d'un passage à
l'autre.

Le nom rend hommage à Eunice Newton Foote (1819-1888), scientifique américaine qui a montré en
1856 que la lumière du soleil chauffe davantage le dioxyde de carbone que l'air, trois ans avant
les travaux de John Tyndall, généralement crédité de la découverte de l'effet de serre. Parce
qu'elle était une femme, elle n'a pas pu présenter elle-même son article : il a été lu par le
professeur Joseph Henry, et ses travaux sont restés oubliés jusqu'en 2011.

```text
## Écoconception (RGESN 2024)

| Critère | Résultat     | Mesure                                                        |
|---------|--------------|---------------------------------------------------------------|
| 6.1     | ✅ validé     | Toutes les pages sous 500 Ko et 30 requêtes.                  |
| 5.1     | ❌ non validé | 50 % des 4 image(s) matricielle(s) en WebP, AVIF ou JPEG XL.  |
| 6.4     | ✅ validé     | 2 image(s) sur 3 à leur taille d'origine…                     |
| 4.8     | 🔎 à vérifier | Les polices viennent de fonts.googleapis.com : à peser à part. |
| 6.2     | ✅ validé     | Les 12 ressources du site en ligne peuvent être gardées…      |

### À vérifier à la main · 3/73
▸ 1. Stratégie · 2/10
  - [x] 1.1 Le service numérique a-t-il été évalué favorablement en termes d'utilité… (prioritaire)
  - [ ] 1.2 …
```

## Ce qui est mesuré

Les seuils sont ceux des méthodes de test du référentiel.

| Critère | Ce qu'Eunice mesure | Validé si |
| --- | --- | --- |
| **6.1** Poids et requêtes par écran | Pour chaque page HTML : ce qu'elle télécharge en arrivant (scripts, feuilles de style et ce qu'elles appellent, images, polices), en taille compressée, et le nombre de requêtes | Un poids et un nombre de requêtes maximum sont fixés dans `eunice.json`, et chaque page les respecte |
| **5.1** Format des images | Toutes les images matricielles du site construit | Plus de 75 % sont en WebP, AVIF ou JPEG XL |
| **6.4** Dimensions des images | Chaque `<img>` : sa largeur réelle, lue dans le fichier, face à son attribut `width` | La majorité des images sont vectorielles, à leur taille d'origine, ou proposées en plusieurs définitions (`srcset`) |
| **4.8** Polices | Pour chaque page : les `@font-face` de ses feuilles de style, leurs familles, variantes et le poids de leurs fichiers | Au plus 2 polices et 4 variantes, ou au plus 400 Ko de polices |
| **6.2** Cache | Les noms de fichiers versionnés (`index-DiwrgTda.js`) et, avec une `adresse`, les en-têtes du site en ligne | Chaque ressource en ligne a un `Cache-Control` avec une durée, un `ETag` ou un `Last-Modified` |

Chaque critère mesuré reçoit un résultat : **validé**, **non validé**, **à vérifier** (la mesure
ne suffit pas, par exemple des polices chargées depuis un autre site) ou **non applicable**.

### Les limites, dites franchement

- Eunice lit le site construit, sans navigateur. Une image ou une police ajoutée par JavaScript
  après le chargement n'est pas vue.
- Les ressources d'autres sites (Google Fonts, CDN) comptent comme requêtes mais ne sont pas
  pesées : leurs fichiers ne sont pas dans le site construit.
- Pour les polices, Eunice compte tout ce que les feuilles de style déclarent : c'est un
  maximum, le navigateur ne télécharge que ce que la page utilise.
- Sans attribut `width`, la taille affichée d'une image dépend du CSS : elle est signalée « à
  vérifier ».
- Sans `adresse`, le cache ne se juge pas : il dépend de l'hébergeur, pas du code.

## La liste à cocher

Les 73 autres critères sont rangés par thématique (stratégie, spécifications, architecture,
UX/UI, contenus, frontend, backend, hébergement, algorithmie), avec leur niveau de priorité.
Cochez-les directement dans le commentaire : quand Eunice le met à jour après un nouveau commit,
les cases cochées le restent. Les critères déclarés non applicables n'y figurent pas.

## Utilisation

```yaml
permissions:
  contents: read
  pull-requests: write

jobs:
  ecoconception:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci && npm run build
      - uses: Carolinedanslesnuages/eunice@v1
```

| Entrée | Rôle | Par défaut |
| --- | --- | --- |
| `dossier` | Site construit à vérifier | `dossier` de `eunice.json`, sinon `dist` |
| `config` | Fichier de configuration | `eunice.json` |
| `adresse` | Site en ligne, pour lire ses en-têtes de cache | `adresse` de `eunice.json` |
| `jeton` | Jeton qui écrit le commentaire | `github.token` |

Le rapport s'affiche aussi dans le résumé de l'exécution.

## La configuration : `eunice.json`

```json
{
  "dossier": "dist",
  "budgets": { "poids": 500, "requetes": 30 },
  "adresse": "https://mon-site.fr/",
  "non-applicables": ["5.3", "5.4", "5.5", "9.1"],
  "bloquant": true
}
```

- `budgets` : poids maximum par page, en Ko, et nombre de requêtes maximum. Le critère 6.1
  demande de les fixer : sans eux, il n'est pas validé.
- `non-applicables` : critères qui ne concernent pas le service (pas de vidéo, pas d'IA…). Ils
  disparaissent de la liste et des mesures.
- `bloquant` : à `true`, un critère mesuré non validé fait échouer le contrôle ; à `false`,
  Eunice informe sans bloquer.

## En ligne de commande

```sh
node bin/eunice.mjs --dossier dist --adresse https://mon-site.fr/
```

Le rapport Markdown s'écrit sur la sortie standard. `--precedent commentaire.md` reprend les
cases cochées d'un rapport précédent. Sans dépendance : Node 20 ou plus suffit.

## Les critères

Les critères viennent du [Référentiel général de l'écoconception des services numériques,
version 2024](https://ecoresponsable.numerique.gouv.fr/publications/referentiel-general-ecoconception/),
défini par l'Arcep et l'Arcom en lien avec l'ADEME, publié sous
[Licence Ouverte 2.0](https://github.com/etalab/licence-ouverte/blob/master/LO.md). Ils sont repris
tels quels dans `src/rgesn-2024.json`.

## Licence

MIT
