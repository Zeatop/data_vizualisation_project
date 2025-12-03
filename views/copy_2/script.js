const width = document.getElementById("map-wrapper").clientWidth;
const height = document.getElementById("map-wrapper").clientHeight;

// --- CONFIGURATION D3 ---
const svg = d3.select("#map-wrapper").append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

// Définition des flèches (Markers)
const defs = svg.append("defs");
function createMarker(id, color) {
    defs.append("marker")
        .attr("id", id)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 18) // Recule la flèche pour qu'elle ne soit pas SUR le point de la ville
        .attr("refY", 0)
        .attr("markerWidth", 5)
        .attr("markerHeight", 5)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", color);
}
createMarker("arrow-outbound", "#2563eb");
createMarker("arrow-inbound", "#db2777");

const mapGroup = svg.append("g");
const gStates = mapGroup.append("g").attr("class", "states-layer");
const gRoutes = mapGroup.append("g").attr("class", "routes-layer");
const gCities = mapGroup.append("g").attr("class", "cities-layer");

// Projection Zoomable
const projection = d3.geoAlbersUsa().translate([width/2, height/2]).scale(width * 1.1);
const path = d3.geoPath().projection(projection);

const zoom = d3.zoom()
    .scaleExtent([0.5, 8]) // Permet de dézoomer (0.5) et de zoomer (8)
    .on("zoom", () => {
        mapGroup.attr("transform", d3.event.transform);
        // Zoom sémantique: garder les lignes fines
        gRoutes.selectAll("path").style("stroke-width", d => d.selected ? 2/d3.event.transform.k : 1/d3.event.transform.k);
        gCities.selectAll("circle").attr("r", d => (d.baseR || 3) / Math.sqrt(d3.event.transform.k));
    });
svg.call(zoom);

// --- ÉTAT (STATE) ---
const state = {
    data: {},
    lookup: {}, // Ville -> Coords
    mode: "month", // 'month' ou 'week'
    timeValue: 1,
    delayType: "all",
    selectedCity: null,
    direction: "all" // 'all', 'outbound', 'inbound'
};

// --- CHARGEMENT ---
const files = [
    "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json",
    "../../citiesData/us_cities_from_csv.geojson",
    "../../flightData/dataCredo/aggregated_by_month_and_route.csv",
    "../../flightData/dataCredo/aggregated_by_week_and_route.csv",
    "../../flightData/dataCredo/aggregated_by_late_type_and_route.csv"
];

Promise.all(files.map((url, i) => i < 2 ? d3.json(url) : d3.csv(url)))
    .then(([us, cities, monthData, weekData, lateData]) => {

        // 1. Carte USA
        gStates.selectAll("path")
            .data(topojson.feature(us, us.objects.states).features)
            .enter().append("path").attr("d", path);

        // 2. Préparation Villes
        const cityCounts = {}; // Pour la taille des cercles

        cities.features.forEach(f => {
            if(f.geometry) {
                state.lookup[f.properties.city] = f.geometry.coordinates;
                cityCounts[f.properties.city] = 0;
            }
        });

        // Nettoyage des données numériques
        const clean = (d) => ({
            ...d,
            flight_number: +d.flight_number,
            month: +d.month,
            week_number: +d.week_number,
            is_late: +d.is_late
        });

        state.data.month = monthData.map(clean);
        state.data.week = weekData.map(clean);
        state.data.late = lateData.map(clean);

        // 3. Initialisation Villes Graphiques
        // On calcule une taille par défaut basée sur le total annuel
        state.data.month.forEach(d => {
            if(cityCounts[d.origin_city] !== undefined) cityCounts[d.origin_city] += d.flight_number;
        });

        const sizeScale = d3.scaleSqrt().domain([0, 50000]).range([2, 8]);

        gCities.selectAll("circle")
            .data(cities.features.filter(d => state.lookup[d.properties.city]))
            .enter().append("circle")
            .attr("class", "city")
            .attr("transform", d => `translate(${projection(d.geometry.coordinates)})`)
            .attr("r", d => sizeScale(cityCounts[d.properties.city] || 0))
            .each(function(d) { d.baseR = sizeScale(cityCounts[d.properties.city] || 0); })
            .on("click", d => selectCity(d.properties.city))
            .on("mouseover", d => {
                const cityName = d.properties.city;
                const state_name = d.properties.state;
                const count = cityCounts[cityName] || 0;
                const html = `<div class="tooltip-title">✈️ ${cityName}</div>
                    <div class="tooltip-row"><strong>${state_name}</strong></div>
                    <div class="tooltip-stats">
                        <div class="tooltip-row"><span>📊 Total Flights:</span> <strong>${count}</strong></div>
                        <div class="tooltip-row"><span>💡 Click for details</span></div>
                    </div>`;
                showTooltip(html, d3.event.pageX, d3.event.pageY);
            })
            .on("mouseout", () => document.getElementById("tooltip").classList.add("hidden"));

        // 4. Remplir le datalist et Select Temps
        const cityList = document.getElementById("cities-list");
        Object.keys(state.lookup).sort().forEach(c => {
            let opt = document.createElement("option");
            opt.value = c;
            cityList.appendChild(opt);
        });

        populateTimeSelect();
        updateMap();
    });

// --- LOGIQUE METIER ---

function populateTimeSelect() {
    const sel = document.getElementById("time-select");
    sel.innerHTML = "";
    if(state.mode === 'month') {
        const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        months.forEach((m, i) => {
            let opt = document.createElement("option");
            opt.value = i + 1;
            opt.text = m;
            sel.appendChild(opt);
        });
    } else {
        for(let i=1; i<=52; i++) {
            let opt = document.createElement("option");
            opt.value = i;
            opt.text = "Semaine " + i;
            sel.appendChild(opt);
        }
    }
    sel.value = state.timeValue;
}

function updateMap() {
    // 1. Choisir le bon Dataset
    let currentData = [];
    if(state.delayType !== 'all') {
        // Mode 'Cause de retard' -> on utilise le dataset late
        currentData = state.data.late.filter(d => +d[state.delayType] === 1);
    } else {
        // Mode temporel standard
        if(state.mode === 'month') {
            currentData = state.data.month.filter(d => d.month === state.timeValue);
        } else {
            currentData = state.data.week.filter(d => d.week_number === state.timeValue);
        }
    }

    // 2. Filtrer par Ville (et Direction) si une ville est sélectionnée
    let displayRoutes = [];

    if (state.selectedCity) {
        currentData.forEach(d => {
            const isOut = d.origin_city === state.selectedCity;
            const isIn = d.dest_city === state.selectedCity;

            if (!isOut && !isIn) return; // Pas concerné

            // Filtre Directionnel
            if (state.direction === 'all') {
                d.type = isOut ? 'outbound' : 'inbound';
                displayRoutes.push(d);
            } else if (state.direction === 'outbound' && isOut) {
                d.type = 'outbound';
                displayRoutes.push(d);
            } else if (state.direction === 'inbound' && isIn) {
                d.type = 'inbound';
                displayRoutes.push(d);
            }
        });
    } else {
        // Vue d'ensemble (Overview) : On montre tout mais en simplifié
        // Si trop de données, on filtre les petits vols pour la performance
        displayRoutes = currentData.filter(d => d.flight_number > 5);
        displayRoutes.forEach(d => d.type = 'default');
    }

    // 3. DESSIN (Data Join)
    // Clé unique: origine-dest
    const routes = gRoutes.selectAll("path").data(displayRoutes, d => d.origin_city + "-" + d.dest_city);

    routes.exit().remove();

    // Calculer les statistiques
    const totalFlights = displayRoutes.reduce((sum, d) => sum + d.flight_number, 0);
    const totalLate = displayRoutes.reduce((sum, d) => sum + d.is_late, 0);
    const latePct = totalFlights > 0 ? ((totalLate / totalFlights) * 100).toFixed(1) : 0;
    const onTimePct = totalFlights > 0 ? (100 - latePct).toFixed(1) : 0;

    // Mettre à jour les statistiques
    document.getElementById('route-count').textContent = displayRoutes.length;
    document.getElementById('flight-count').textContent = totalFlights;
    document.getElementById('ontime-pct').textContent = onTimePct + '%';
    document.getElementById('late-pct').textContent = latePct + '%';

    const enterRoutes = routes.enter().append("path")
        .attr("fill", "none");

    routes.merge(enterRoutes)
        .attr("class", d => `route ${d.type}`)
        .attr("d", d => {
            const src = state.lookup[d.origin_city];
            const dst = state.lookup[d.dest_city];
            if(!src || !dst) return null;
            return path({type: "LineString", coordinates: [src, dst]});
        })
        .attr("marker-end", d => {
            // Pas de flèche en vue globale (trop chargé)
            if(!state.selectedCity) return null;
            return d.type === 'outbound' ? "url(#arrow-outbound)" : "url(#arrow-inbound)";
        })
        .style("stroke-width", d => state.selectedCity ? 2 : 0.5)
        .on("mouseover", function(d) {
            d3.select(this).style("stroke-width", 4).raise();
            const latePct = d.flight_number > 0 ? ((d.is_late/d.flight_number)*100).toFixed(1) : 0;
            const onTimePct = d.flight_number > 0 ? (100 - latePct).toFixed(1) : 0;
            const direction = d.type === 'outbound' ? '📤 Departure' : '📥 Arrival';
            const html = `<div class="tooltip-title">${direction}</div>
                <div class="tooltip-row"><strong>${d.origin_city}</strong> ✈️ <strong>${d.dest_city}</strong></div>
                <div class="tooltip-stats">
                    <div class="tooltip-row"><span>📊 Total Flights:</span> <strong>${d.flight_number}</strong></div>
                    <div class="tooltip-row"><span>⏰ On Time:</span> <strong style="color: #10b981;">${onTimePct}%</strong></div>
                    <div class="tooltip-row"><span>⚠️ Late:</span> <strong style="color: #ef4444;">${latePct}%</strong></div>
                </div>`;
            showTooltip(html, d3.event.pageX, d3.event.pageY);
        })
        .on("mouseout", function(d) {
            d3.select(this).style("stroke-width", state.selectedCity ? 2 : 0.5);
            document.getElementById("tooltip").classList.add("hidden");
        });

    // Mise à jour visuelle des villes
    gCities.selectAll("circle")
        .classed("active", d => d.properties.city === state.selectedCity)
        .attr("opacity", d => {
            if(!state.selectedCity) return 1;
            // Si une ville est sélectionnée, on estompe les villes non connectées
            const isConnected = displayRoutes.some(r => r.origin_city === d.properties.city || r.dest_city === d.properties.city);
            return (d.properties.city === state.selectedCity || isConnected) ? 1 : 0.1;
        });
}

// --- INTERACTIONS ---

function selectCity(name) {
    state.selectedCity = name;
    document.getElementById("city-search").value = name;

    // Afficher les contrôles de direction
    const dirGroup = document.getElementById("direction-group");
    if(name) {
        dirGroup.classList.remove("hidden");
        // Zoom automatique vers la ville
        const coords = state.lookup[name];
        if(coords) {
            const tr = projection(coords);
            svg.transition().duration(750).call(
                zoom.transform,
                d3.zoomIdentity.translate(width/2 - tr[0]*3, height/2 - tr[1]*3).scale(3)
            );
        }
    } else {
        dirGroup.classList.add("hidden");
        state.direction = 'all'; // Reset direction
        // Reset zoom
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    }
    updateMap();
}

// Events Listeners
document.getElementById("mode-select").addEventListener("change", (e) => {
    state.mode = e.target.value;
    state.timeValue = 1;
    populateTimeSelect();
    updateMap();
});

document.getElementById("time-select").addEventListener("change", (e) => {
    state.timeValue = +e.target.value;
    updateMap();
});

document.getElementById("delay-select").addEventListener("change", (e) => {
    state.delayType = e.target.value;
    updateMap();
});

document.getElementById("city-search").addEventListener("change", (e) => selectCity(e.target.value));
document.getElementById("reset-btn").addEventListener("click", () => {
    document.getElementById("city-search").value = "";
    selectCity(null);
});

// Délégation d'événement pour les radios buttons (Direction)
document.querySelector(".toggle-group").addEventListener("change", (e) => {
    if(e.target.name === "dir") {
        state.direction = e.target.value;
        updateMap();
    }
});

document.getElementById("zoom-in").addEventListener("click", () => svg.transition().call(zoom.scaleBy, 1.4));
document.getElementById("zoom-out").addEventListener("click", () => svg.transition().call(zoom.scaleBy, 0.6));

function showTooltip(html, x, y) {
    const t = document.getElementById("tooltip");
    t.innerHTML = html;

    // Positionnement intelligent du tooltip
    let tooltipX = x + 15;
    let tooltipY = y + 15;

    // Vérifier les limites de l'écran
    if (tooltipX + 350 > width) tooltipX = x - 365;
    if (tooltipY + 200 > height) tooltipY = y - 210;

    t.style.left = tooltipX + "px";
    t.style.top = tooltipY + "px";
    t.classList.remove("hidden");
}