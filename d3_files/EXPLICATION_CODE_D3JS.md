# Explication du Code D3.js - Streamchart des Retards de Vols

## Vue d'ensemble
Ce fichier HTML crée une visualisation interactive avec deux streamcharts (graphiques en rivières) côte à côte, comparant les retards de vols au départ et à l'arrivée d'une ville donnée.

---

## 1. Structure HTML et CSS (Lignes 1-139)

### 1.1 En-tête et métadonnées
```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Analyse des retards de vols - 2024</title>
```
**Explication :** Définit la page comme document HTML5 en français, avec encodage UTF-8 et responsive design.

### 1.2 Styles CSS
Le bloc `<style>` (lignes 7-135) définit toute la mise en page :

**Container principal :**
```css
.container {
    max-width: 1800px;
    margin: 0 auto;
    background: white;
    border-radius: 15px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    overflow: hidden;
}
```
**Explication :** Crée une carte blanche centrée avec coins arrondis et ombre portée, limitée à 1800px de largeur.

**Barre de contrôles :**
```css
.controls {
    background: #f8f9fa;
    padding: 25px;
    display: flex;
    flex-wrap: wrap;
    gap: 30px;
    align-items: center;
    justify-content: center;
}
```
**Explication :** Utilise flexbox pour aligner horizontalement les contrôles (menu déroulant, boutons radio, checkbox) avec espacement automatique de 30px entre chaque groupe.

### 1.3 Chargement de D3.js
```html
<script src="https://d3js.org/d3.v6.js"></script>
```
**Explication :** Charge la bibliothèque D3.js version 6 depuis un CDN. C'est elle qui permet de créer les visualisations interactives.

---

## 2. Contrôles Interactifs (Lignes 143-207)

### 2.1 Menu déroulant des villes
```html
<select id="citySelect">
    <option value="">Chargement...</option>
</select>
```
**Explication :** Créé un menu vide qui sera rempli dynamiquement avec la liste des villes une fois les données chargées.

### 2.2 Boutons radio pour la période
```html
<input type="radio" name="timePeriod" value="month" checked>
<input type="radio" name="timePeriod" value="week">
```
**Explication :** Deux boutons radio avec le même `name="timePeriod"` (donc exclusifs). L'un affiche les données par mois, l'autre par semaine. `checked` rend "mois" sélectionné par défaut.

### 2.3 Boutons radio pour le mode d'affichage
```html
<input type="radio" name="viewMode" value="count" checked>
<input type="radio" name="viewMode" value="percentage">
```
**Explication :** Bascule entre affichage en nombre absolu de vols ou en pourcentage.

### 2.4 Checkbox pour les vols à l'heure
```html
<input type="checkbox" id="showOnTime">
```
**Explication :** Permet d'ajouter ou retirer une rivière supplémentaire montrant les vols sans retard.

---

## 3. Configuration Initiale D3.js (Lignes 213-239)

### 3.1 Dimensions des graphiques
```javascript
const margin = {top: 60, right: 30, bottom: 50, left: 30},
    width = (window.innerWidth * 0.85) / 2 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom
```
**Explication :** 
- `margin` : Espace réservé autour du graphique pour les axes et titres
- `width` : Prend 85% de la largeur de l'écran, divisé par 2 (car deux graphiques), moins les marges
- `height` : Hauteur fixe de 500px moins les marges

### 3.2 Création des conteneurs SVG
```javascript
const svgOrigin = d3.select("#streamchart-origin")
  .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);
```
**Explication détaillée :**
1. `d3.select("#streamchart-origin")` : Sélectionne la div HTML avec id="streamchart-origin"
2. `.append("svg")` : Ajoute un élément SVG (zone de dessin) dedans
3. `.attr("width", ...)` : Définit les dimensions du SVG (taille totale avec marges)
4. `.append("g")` : Ajoute un groupe SVG (comme un calque)
5. `.attr("transform", "translate(...)")` : Déplace le groupe pour laisser place aux marges

Le même processus est répété pour `svgDest` (graphique de destination).

### 3.3 Variables globales
```javascript
let allDataMonthOrigin = [];
let allDataWeekOrigin = [];
let allDataMonthDest = [];
let allDataWeekDest = [];
```
**Explication :** Stockent les 4 datasets CSV chargés :
- Données mensuelles/hebdomadaires × villes d'origine/destination = 4 combinaisons

---

## 4. Fonction `drawStreamchart` (Lignes 243-439)

C'est la fonction principale qui dessine un graphique. Elle prend 8 paramètres :

```javascript
function drawStreamchart(selectedCity, viewMode, timePeriod, includeOnTime, svg, allData, cityColumn, chartTitle)
```

### 4.1 Nettoyage et filtrage (Lignes 245-258)
```javascript
svg.selectAll("*").remove();
let data = allData.filter(d => d[cityColumn] === selectedCity);
```
**Explication :**
- Efface tout ce qui était dessiné avant dans le SVG
- Filtre les données pour ne garder que la ville sélectionnée (ex: "Atlanta, GA")
- `cityColumn` peut être "origin_city" ou "dest_city" selon le graphique

### 4.2 Ajout des titres (Lignes 267-279)
```javascript
svg.append("text")
    .attr("x", width / 2)
    .attr("y", -30)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .text(chartTitle);
```
**Explication :**
- Ajoute un élément texte SVG
- Position x au milieu (`width / 2`), y à -30px (au-dessus du graphique grâce à la marge)
- `text-anchor: middle` centre le texte horizontalement
- Le deuxième texte affiche le nom de la ville juste en dessous

### 4.3 Définition des clés de données (Lignes 281-288)
```javascript
const baseKeys = ['bool_carrier_delay_min', 'bool_weather_delay_min', 'bool_traffic_delay_min', 
                'bool_security_delay_min', 'bool_late_aircraft_delay_min'];

const keys = includeOnTime 
    ? [...baseKeys, 'on_time_flights']
    : baseKeys;
```
**Explication :**
- `baseKeys` : Liste des 5 types de retard (colonnes dans votre CSV)
- `keys` : Si la checkbox est cochée, ajoute aussi 'on_time_flights' à la liste
- `...baseKeys` (spread operator) : copie tous les éléments de baseKeys

### 4.4 Transformation des données (Lignes 290-315)
```javascript
data.forEach(function(d) {
    if (timePeriod === "month") {
      d.month = +d.month;
      d.timeValue = d.month;
    } else {
      d.week_number = +d.week_number;
      d.timeValue = d.week_number;
    }
    d.flight_number = +d.flight_number;
    d.is_late = +d.is_late;
    
    d.on_time_flights = d.flight_number - d.is_late;
    
    keys.forEach(function(key) {
      if (key !== 'on_time_flights') {
        d[key] = +d[key];
      }
      
      if (viewMode === "percentage" && d.flight_number > 0) {
        d[key + "_pct"] = (d[key] / d.flight_number) * 100;
      }
    });
  });
```
**Explication détaillée :**
- `+d.month` : Convertit la chaîne "6" en nombre 6 (important pour D3)
- `d.timeValue` : Variable unifiée (mois ou semaine) pour simplifier le code
- `d.on_time_flights` : Calcul des vols sans retard (total - retards)
- Boucle sur chaque type de retard : convertit en nombre
- Si mode pourcentage : crée une nouvelle propriété `_pct` avec le calcul `(retards / total) * 100`

### 4.5 Ajustement des clés selon le mode (Lignes 317-320)
```javascript
const dataKeys = viewMode === "percentage" 
    ? keys.map(k => k + "_pct")
    : keys;
```
**Explication :**
- Si mode pourcentage : transforme `['bool_carrier_delay_min', ...]` en `['bool_carrier_delay_min_pct', ...]`
- Sinon : garde les clés originales
- `.map()` : crée un nouveau tableau en transformant chaque élément

### 4.6 Création de l'axe X (Lignes 322-342)
```javascript
const xDomain = timePeriod === "month" ? [1, 12] : [1, 53];
const xTickValues = timePeriod === "month" 
    ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    : [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 53];

const x = d3.scaleLinear()
    .domain(xDomain)
    .range([ 0, width ]);

svg.append("g")
    .attr("transform", `translate(0, ${height*0.85})`)
    .call(d3.axisBottom(x).tickSize(-height*.75).tickValues(xTickValues))
    .select(".domain").remove()
```
**Explication détaillée :**
- `xDomain` : Définit les valeurs min/max (1 à 12 pour mois, 1 à 53 pour semaines)
- `d3.scaleLinear()` : Crée une échelle qui convertit valeurs de données → pixels à l'écran
- `.domain([1, 12])` : Entrée (valeurs données)
- `.range([0, width])` : Sortie (pixels, de 0 à largeur du graphique)
- `svg.append("g")` : Ajoute un groupe pour l'axe
- `.attr("transform", "translate(0, height*0.85)")` : Place l'axe à 85% de la hauteur (vers le bas)
- `.call(d3.axisBottom(x))` : Génère automatiquement l'axe horizontal
- `.tickSize(-height*.75)` : Étend les graduations vers le haut pour créer une grille (taille négative)
- `.tickValues(xTickValues)` : Spécifie exactement quelles graduations afficher
- `.select(".domain").remove()` : Supprime la ligne noire de l'axe (on garde juste les graduations)

Puis personnalisation :
```javascript
svg.selectAll(".tick line").attr("stroke", "#e0e0e0").attr("opacity", 0.7)
svg.selectAll(".tick text").attr("fill", "#666").style("font-size", "12px")
```
- Change la couleur des lignes de grille en gris clair avec 70% d'opacité
- Met les nombres de l'axe en gris foncé, taille 12px

### 4.7 Stack et échelle Y (Lignes 344-359)
```javascript
const tempStackedData = d3.stack()
    .offset(d3.stackOffsetSilhouette)
    .keys(dataKeys)
    (data);

const yExtent = d3.extent(tempStackedData.flat(2));
const yPadding = (yExtent[1] - yExtent[0]) * 0.3;

const y = d3.scaleLinear()
    .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
    .range([ height, 0 ]);
```
**Explication détaillée - le concept de "stack" :**

Imagine que tu as ces données pour janvier :
```
Retard compagnie: 100 vols
Retard météo: 50 vols
Retard trafic: 30 vols
```

Le stack les empile verticalement :
- Compagnie : de 0 à 100
- Météo : de 100 à 150 (100+50)
- Trafic : de 150 à 180 (150+30)

`d3.stackOffsetSilhouette` : Centre cette pile autour de l'axe Y (symétrique haut/bas)

**Calculs :**
- `d3.extent()` : Trouve le min et max de toutes les valeurs empilées
- `.flat(2)` : Aplatit le tableau 2D en 1D pour trouver la vraie amplitude
- `yPadding = ... * 0.3` : Ajoute 30% d'espace supplémentaire en haut et en bas
- `y` : Échelle qui convertit valeurs → pixels (attention : `range([height, 0])` inverse car SVG a l'origine en haut)

### 4.8 Palette de couleurs (Lignes 361-364)
```javascript
const color = d3.scaleOrdinal()
    .domain(dataKeys)
    .range(d3.schemeDark2);
```
**Explication :**
- `d3.scaleOrdinal()` : Échelle pour données catégorielles (non numériques)
- `.domain(dataKeys)` : Les 5 ou 6 types de retard
- `.range(d3.schemeDark2)` : Palette de 8 couleurs prédéfinie par D3 (sombres/saturées)
- Chaque type de retard reçoit automatiquement une couleur unique

### 4.9 Stack final (Lignes 366-370)
```javascript
const stackedData = d3.stack()
    .offset(d3.stackOffsetSilhouette)
    .keys(dataKeys)
    (data)
```
**Explication :** Refait le stack (cette fois pour vraiment dessiner, pas juste calculer le domaine Y).

### 4.10 Création du tooltip (Lignes 372-383)
```javascript
const tooltipId = "tooltip-" + Math.random().toString(36).substr(2, 9);
const Tooltip = d3.select("body")
    .append("div")
    .attr("id", tooltipId)
    .style("opacity", 0)
    .attr("class", "tooltip")
    .style("background-color", "white")
    .style("border", "2px solid #667eea")
    .style("border-radius", "8px")
    .style("padding", "12px 15px")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("z-index", "1000")
    .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")
```
**Explication :**
- Génère un ID aléatoire pour éviter les conflits (deux graphiques = deux tooltips)
- `d3.select("body")` : Attache le tooltip au body (pas au SVG) pour qu'il soit visible partout
- `.style("opacity", 0)` : Caché par défaut
- `.style("position", "absolute")` : Positionnement libre à l'écran
- `.style("pointer-events", "none")` : Le tooltip ne bloque pas le survol de la souris
- `z-index: 1000` : Au-dessus de tout

### 4.11 Mapping des noms (Lignes 385-397)
```javascript
const delayNames = {
    'bool_carrier_delay_min': 'Retard Compagnie',
    'bool_weather_delay_min': 'Retard Météo',
    // ...
    'on_time_flights_pct': 'Vols à l\'heure'
};
```
**Explication :** Dictionnaire pour convertir les noms techniques en français lisible dans le tooltip.

### 4.12 Fonctions d'interactivité (Lignes 399-428)

**mouseover :**
```javascript
const mouseover = function(event,d) {
    Tooltip.style("opacity", 1)
    d3.selectAll(".myArea").style("opacity", .2)
    d3.select(this)
      .style("stroke", "black")
      .style("opacity", 1)
}
```
**Explication :**
- Rend le tooltip visible
- Met toutes les rivières à 20% d'opacité (transparentes)
- Met celle survolée à 100% avec un contour noir
- `this` : la rivière actuellement survolée

**mousemove :**
```javascript
const mousemove = function(event,d) {
    const mouseX = d3.pointer(event)[0];
    const timeValue = Math.round(x.invert(mouseX));
    const timeData = d.find(point => point.data.timeValue === timeValue);
    
    if (timeData) {
      const delayType = delayNames[d.key];
      const value = timeData.data[d.key];
      const displayValue = viewMode === "percentage" 
        ? value.toFixed(1) + "%" 
        : Math.round(value);
      
      const timeLabel = timePeriod === "month" ? "Mois" : "Semaine";
      
      Tooltip
        .html(`<strong>${delayType}</strong><br/>${timeLabel}: ${timeValue}<br/>${viewMode === "percentage" ? "Taux" : "Nombre de vols"}: ${displayValue}`)
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 28) + "px")
    }
}
```
**Explication détaillée :**
- `d3.pointer(event)[0]` : Position X de la souris en pixels
- `x.invert(mouseX)` : Convertit pixels → valeur de données (inverse de l'échelle X)
- `Math.round()` : Arrondit au mois/semaine le plus proche
- `d.find()` : Cherche le point de données correspondant à ce mois/semaine
- Récupère le nom lisible, la valeur, formate selon le mode
- Met à jour le contenu HTML du tooltip
- `.style("left", event.pageX + 15)` : Positionne le tooltip 15px à droite du curseur
- `event.pageY - 28` : 28px au-dessus du curseur

**mouseleave :**
```javascript
const mouseleave = function(event,d) {
    Tooltip.style("opacity", 0)
    d3.selectAll(".myArea").style("opacity", 1).style("stroke", "none")
}
```
**Explication :** Cache le tooltip et remet toutes les rivières à 100% d'opacité, sans contour.

### 4.13 Générateur de zone (Lignes 430-435)
```javascript
const area = d3.area()
    .x(function(d) { return x(d.data.timeValue); })
    .y0(function(d) { return y(d[0]); })
    .y1(function(d) { return y(d[1]); })
    .curve(d3.curveCatmullRom.alpha(0.5))
```
**Explication :**
- `d3.area()` : Crée un générateur de forme de zone (entre deux lignes)
- `.x()` : Position X de chaque point (mois/semaine converti en pixels)
- `.y0()` : Limite inférieure de la zone (valeur basse du stack)
- `.y1()` : Limite supérieure de la zone (valeur haute du stack)
- `d[0]` et `d[1]` : Positions dans le stack (ex: [100, 150] pour météo)
- `.curve(d3.curveCatmullRom.alpha(0.5))` : Interpolation qui rend les courbes arrondies et fluides (alpha=0.5 est un bon équilibre entre lisse et fidèle aux données)

### 4.14 Dessin des rivières (Lignes 437-446)
```javascript
svg
    .selectAll("mylayers")
    .data(stackedData)
    .join("path")
      .attr("class", "myArea")
      .style("fill", function(d) { return color(d.key); })
      .attr("d", area)
      .on("mouseover", mouseover)
      .on("mousemove", mousemove)
      .on("mouseleave", mouseleave)
```
**Explication du pattern D3 "data-join" :**
1. `.selectAll("mylayers")` : Sélectionne des éléments (même s'ils n'existent pas encore)
2. `.data(stackedData)` : Associe chaque élément de stackedData à un élément SVG
3. `.join("path")` : Crée un `<path>` SVG pour chaque élément de données
4. `.attr("class", "myArea")` : Donne la classe CSS "myArea" à chaque rivière
5. `.style("fill", function(d) { return color(d.key); })` : Applique la couleur selon le type de retard
6. `.attr("d", area)` : Définit la forme du path avec le générateur area (c'est ce qui dessine la rivière)
7. `.on("mouseover", mouseover)` : Attache les fonctions d'interactivité

**Résultat :** Pour chaque type de retard dans stackedData, un chemin SVG coloré est créé, formant une rivière.

---

## 5. Chargement des Données et Initialisation (Lignes 448-531)

### 5.1 Chargement des 4 CSV (Lignes 448-456)
```javascript
Promise.all([
  d3.csv("../flightData/dataLeo/aggregated_by_month_and_origin_city.csv"),
  d3.csv("../flightData/dataLeo/aggregated_by_week_and_origin_city.csv"),
  d3.csv("../flightData/dataLeo/aggregated_by_month_and_dest_city.csv"),
  d3.csv("../flightData/dataLeo/aggregated_by_week_and_dest_city.csv")
]).then(function([dataMonthOrigin, dataWeekOrigin, dataMonthDest, dataWeekDest]) {
```
**Explication :**
- `Promise.all()` : Charge les 4 fichiers en parallèle (plus rapide que séquentiel)
- `d3.csv()` : Fonction qui charge un CSV et le convertit en tableau d'objets JavaScript
- `.then()` : S'exécute une fois que TOUS les fichiers sont chargés
- Destructuring `[dataMonthOrigin, ...]` : Récupère les 4 datasets dans l'ordre

### 5.2 Stockage et extraction des villes (Lignes 457-462)
```javascript
allDataMonthOrigin = dataMonthOrigin;
// ... (stockage des 4 datasets dans les variables globales)

const cities = [...new Set(dataMonthOrigin.map(d => d.origin_city))].sort();
```
**Explication :**
- `dataMonthOrigin.map(d => d.origin_city)` : Extrait toutes les valeurs de la colonne origin_city
- `new Set(...)` : Crée un ensemble (supprime les doublons)
- `[...new Set(...)]` : Convertit l'ensemble en tableau
- `.sort()` : Trie alphabétiquement

### 5.3 Peuplement du menu déroulant (Lignes 464-475)
```javascript
const citySelect = d3.select("#citySelect");
citySelect.selectAll("option").remove();

citySelect
    .selectAll("option")
    .data(cities)
    .enter()
    .append("option")
      .attr("value", d => d)
      .text(d => d);
```
**Explication :**
- Sélectionne le select HTML
- Supprime le "Chargement..." initial
- Pattern data-join : crée une `<option>` pour chaque ville
- `.attr("value", d => d)` : Définit la valeur (ex: "Atlanta, GA")
- `.text(d => d)` : Définit le texte affiché (même chose)

### 5.4 Définition de la ville par défaut (Lignes 477-479)
```javascript
const defaultCity = cities.includes("Atlanta, GA") ? "Atlanta, GA" : cities[0];
citySelect.property("value", defaultCity);
```
**Explication :** Si Atlanta existe, la sélectionne, sinon prend la première ville de la liste.

### 5.5 Fonction de mise à jour (Lignes 481-500)
```javascript
function updateCharts() {
    const selectedCity = citySelect.property("value");
    const viewMode = d3.select('input[name="viewMode"]:checked').property("value");
    const timePeriod = d3.select('input[name="timePeriod"]:checked').property("value");
    const includeOnTime = d3.select('#showOnTime').property("checked");
    
    currentCity = selectedCity;
    currentMode = viewMode;
    currentPeriod = timePeriod;
    showOnTime = includeOnTime;
    
    const dataOrigin = timePeriod === "month" ? allDataMonthOrigin : allDataWeekOrigin;
    const dataDest = timePeriod === "month" ? allDataMonthDest : allDataWeekDest;
    
    drawStreamchart(selectedCity, viewMode, timePeriod, includeOnTime, svgOrigin, dataOrigin, "origin_city", "Vols au départ");
    drawStreamchart(selectedCity, viewMode, timePeriod, includeOnTime, svgDest, dataDest, "dest_city", "Vols à l'arrivée");
}
```
**Explication :**
- Récupère les valeurs actuelles de tous les contrôles :
  - `.property("value")` : Valeur du menu déroulant ou du radio coché
  - `.property("checked")` : État booléen de la checkbox
- Sélectionne les bons datasets selon la période (mois ou semaine)
- Appelle `drawStreamchart()` deux fois : une pour origine, une pour destination
- Les deux graphiques se redessinent avec les nouveaux paramètres

### 5.6 Attachement des écouteurs d'événements (Lignes 502-517)
```javascript
updateCharts();

citySelect.on("change", updateCharts);
d3.selectAll('input[name="viewMode"]').on("change", updateCharts);
d3.selectAll('input[name="timePeriod"]').on("change", updateCharts);
d3.select('#showOnTime').on("change", updateCharts);
```
**Explication :**
- `updateCharts()` : Dessine les graphiques initiaux au chargement
- `.on("change", updateCharts)` : Attache un écouteur qui appelle `updateCharts` à chaque changement
- Résultat : Dès que l'utilisateur change un contrôle, les deux graphiques se mettent à jour automatiquement

---

## Résumé du Flux d'Exécution

1. **Chargement de la page** → HTML/CSS s'affichent, D3.js se charge
2. **Promise.all()** → Les 4 CSV se chargent en parallèle
3. **Extraction des villes** → Liste unique triée
4. **Peuplement du menu** → Toutes les villes deviennent des options
5. **Premier appel updateCharts()** → Dessine Atlanta par défaut, par mois, en nombre de vols
6. **drawStreamchart() × 2** → Un graphique pour origine, un pour destination
   - Filtrage des données pour la ville
   - Transformation (calculs de pourcentages, etc.)
   - Création des échelles X et Y
   - Stack des données
   - Dessin des rivières avec couleurs
   - Ajout des événements de survol
7. **Attente d'interactions** → L'utilisateur change un contrôle
8. **Événement déclenché** → updateCharts() est appelé à nouveau
9. **Retour à l'étape 6** → Les graphiques se redessinèrent avec les nouveaux paramètres

---

## Concepts Clés à Retenir

### 1. **Échelles D3** (Scales)
Convertissent valeurs de données → pixels à l'écran
```javascript
const x = d3.scaleLinear().domain([1, 12]).range([0, width]);
x(6) // → retourne la position en pixels du mois 6
x.invert(300) // → retourne le mois correspondant à 300 pixels
```

### 2. **Stack Layout**
Empile des valeurs verticalement pour créer l'effet de rivières qui se superposent
```
Données: {compagnie: 100, météo: 50}
Stack:   compagnie [0, 100], météo [100, 150]
```

### 3. **Data-Join**
Le cœur de D3 : associer données ↔ éléments SVG
```javascript
.selectAll("path").data(stackedData).join("path")
```
Crée/met à jour/supprime automatiquement des paths selon les données.

### 4. **Générateurs** (Generators)
Fonctions qui créent des formes SVG complexes
```javascript
d3.area() // → générateur de zones
.x(), .y0(), .y1() // → définissent comment calculer les points
area(data) // → retourne le code SVG de la forme
```

### 5. **Événements et Interactivité**
```javascript
.on("mouseover", function) // → attache un événement
d3.pointer(event) // → récupère position de la souris
```

---

## Pour Aller Plus Loin

Si tu veux modifier le code :

1. **Changer les couleurs** → Modifie `d3.schemeDark2` ligne 363 (ex: `d3.schemeSet3`)
2. **Ajuster les marges** → Change `margin` ligne 213
3. **Modifier l'interpolation** → Change `.curve()` ligne 435 (ex: `d3.curveMonotoneX`)
4. **Ajouter des données** → Rajoute une colonne dans `baseKeys` ligne 282

N'hésite pas si tu as des questions sur une partie spécifique ! 🎓
