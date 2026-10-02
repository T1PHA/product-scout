# Product Scout

Outil local d'analyse de viabilité produit, pour deux modèles :

- **E-commerce produit neuf** (méthode « produit gagnant » : panier ≥ 40 €, marge nette ≥ 25 € après pub, demande prouvée, pubs qui tournent depuis plus de 30 jours, démontrable en vidéo, logistique simple, potentiel de gamme, produits à bannir, angle libre).
- **Achat-revente d'occasion** (grille Tests Produits : approvisionnement, demande, marge, panier, liquidité, travail, logistique, expertise, scalabilité, sortie B2B).

Tu tapes un produit, l'outil collecte les données réelles, calcule la marge, note chaque critère, puis Gemini rédige l'analyse (leviers émotionnels, effet miroir, angles, accroches, gamme, risques, plan de test).

## Lancer

```bash
npm install
npm run build
npm run start      # http://localhost:3077
```

Ou double-clic sur `Lancer Product Scout.bat`.

En développement : `npm run dev` (port 3077).

## Première configuration

1. **Clé Gemini gratuite** : Réglages, puis colle une clé créée sur https://aistudio.google.com/apikey (sans carte bancaire). Sans clé, l'outil marche mais sans les critères qualitatifs ni l'analyse rédigée.
2. **Ventes conclues eBay** (facultatif) : Réglages, « Ouvrir la fenêtre de connexion », connecte-toi à eBay, puis « J'ai terminé ». La session est gardée dans `~/.product-scout/browser-profile`.

## Sources (toutes gratuites)

| Source | Ce qu'on en tire | Méthode |
|---|---|---|
| Google Trends FR | Courbe 5 ans, variation 12 mois, saisonnalité | Page Explorer dans le navigateur |
| Meta Ad Library FR | Nombre de pubs actives, ancienneté, annonceurs, domaines | Page publique |
| Boutiques concurrentes | Prix réels des boutiques qui font de la pub | `/products.json` des boutiques Shopify |
| AliExpress | Prix unitaire fournisseur, ventes affichées | Page de recherche |
| Alibaba | Prix de gros, MOQ | Page de recherche |
| Amazon.fr | Prix, avis, badges « achetés le mois dernier » | Page de recherche |
| eBay.fr | Annonces, ventes conclues si connecté | Page de recherche |
| Vinted | Prix demandés, états, marques | Page catalogue |
| YouTube | Vidéos de démonstration et vues | HTML public |
| DuckDuckGo / Bing | Avis, douleurs, concurrents | Navigateur |
| Wikipedia | Intérêt pour la catégorie | API publique |
| Frankfurter | Taux de change (USD, CNY) | API publique (public-apis) |
| SellersCalc | Barèmes de frais de référence | API publique (public-apis) |

Les pages sont lues par un vrai navigateur Edge placé hors écran (profil persistant), ce qui évite la plupart des blocages. Leboncoin, Reddit, Etsy et TikTok bloquent les robots et ne sont pas utilisés.

## Export

- Markdown et PDF depuis le rapport.
- « Envoyer vers Tests Produits » ajoute une colonne dans la feuille Google, en réutilisant le client OAuth de `~/Documents/Scraper prospection/app/sheets_client.py` (variable `PS_SHEETS_APP` pour changer ce chemin).

## Structure

- `src/lib/sources/` : un module par source (`run()` renvoie données + liens).
- `src/lib/scoring/` : calcul de marge, critères, score pondéré, confiance, verdict.
- `src/lib/ai.ts` : mots-clés et rapport Gemini (JSON).
- `src/lib/runner.ts` : orchestration (phase 1 en parallèle, phase 2 pour les sources dépendantes).
- `data/product-scout.db` : base SQLite locale (analyses, réglages).

## Tests

```bash
npm test
```
