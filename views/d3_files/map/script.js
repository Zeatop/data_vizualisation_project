// 1. CONFIG
const config = {
    colors: {
        outbound: "#2563eb",
        inbound: "#db2777",
        default: "#64748b"
    }
};

const container = document.getElementById("map-wrapper");
const width = container.clientWidth;
const height = container.clientHeight;

// 2. D3 SETUP
const svg = d3.select("#map-wrapper")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

// Projection composite d3.geoAlbersUsa qui gère automatiquement les encarts
const projection = d3.geoAlbersUsa()
    .translate([width / 2, height / 2 - 50])
    .scale(Math.min(width, height) * 1.6);

const path = d3.geoPath().projection(projection);

// Ajouter un rectangle de fond pour détecter les clics en dehors des éléments
svg.insert("rect", ":first-child")
    .attr("class", "background")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "transparent")
    .on("click", function() {
        // Vérifier que le clic n'est pas sur une ville ou une route
        if (d3.event.target === this) {
            resetView();
        }
    });

const mapGroup = svg.append("g");
const gStates = mapGroup.append("g").attr("class", "states-layer");
const gRoutes = mapGroup.append("g").attr("class", "routes-layer");
const gCities = mapGroup.append("g").attr("class", "cities-layer");

const tooltip = d3.select("#tooltip");

// Markers
const defs = svg.append("defs");
['outbound', 'inbound'].forEach(type => {
    defs.append("marker")
        .attr("id", `arrow-${type}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", config.colors[type]);
});

// 4. STATE MANAGEMENT
const state = {
    data: {},
    lookup: {},
    mode: "month",
    timeValue: 1,
    lateFilter: "all",
    selectedCity: null,
    direction: "all"
};

// 5. LOAD DATA
const files = [
    "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json",
    "../../../citiesData/us_cities_from_csv.geojson",
    "../../../flightData/dataCredo/aggregated_by_month_and_route.csv",
    "../../../flightData/dataCredo/aggregated_by_week_and_route.csv",
    "../../../flightData/dataCredo/aggregated_by_late_type_and_route.csv"
];

Promise.all(files.map((url, i) => i < 2 ? d3.json(url) : d3.csv(url)))
    .then(function([usMap, cityGeo, monthData, weekData, lateData]) {

        // Nettoyer les données une seule fois à la source
        const cleanData = d => ({ ...d, is_late: +d.is_late, flight_number: +d.flight_number });
        monthData = monthData.map(cleanData);
        weekData = weekData.map(cleanData);
        lateData = lateData.map(cleanData);

        // Précalculer les datasets par mois
        state.dataByMonth = {};
        for (let m = 1; m <= 12; m++) {
            state.dataByMonth[m] = monthData.filter(d => d.month == m);
        }

        // Précalculer les datasets par semaine
        state.dataByWeek = {};
        for (let w = 1; w <= 52; w++) {
            state.dataByWeek[w] = weekData.filter(d => d.week_number == w);
        }

        // Précalculer les datasets par type de retard
        state.dataByLateType = {
            all: lateData,
            bool_carrier_delay_min: lateData.filter(d => d.bool_carrier_delay_min == 1),
            bool_weather_delay_min: lateData.filter(d => d.bool_weather_delay_min == 1),
            bool_traffic_delay_min: lateData.filter(d => d.bool_traffic_delay_min == 1),
            bool_security_delay_min: lateData.filter(d => d.bool_security_delay_min == 1),
            bool_late_aircraft_delay_min: lateData.filter(d => d.bool_late_aircraft_delay_min == 1)
        };

        state.data = { month: monthData, week: weekData, late: lateData };

        // Séparer les états par région
        const features = topojson.feature(usMap, usMap.objects.states).features;
        const mainland = features.filter(d => {
            const id = d.id;
            return id !== "02" && id !== "15" && id !== "72"; // Exclure Alaska (02), Hawaii (15), Porto Rico (72)
        });
        const alaska = features.filter(d => d.id === "02");
        const hawaii = features.filter(d => d.id === "15");
        const puertoRico = features.filter(d => d.id === "72");

        // Dessiner les états continentaux
        gStates.selectAll("path.mainland")
            .data(mainland)
            .enter().append("path")
            .attr("class", "mainland")
            .attr("d", path);

        // Dessiner Alaska avec sa propre projection
        const alaskaProjection = d3.geoAlbers()
            .rotate([154, 0])
            .center([-2, 64])
            .parallels([55, 65])
            .scale(Math.min(width, height) * 0.35)
            .translate([width * 0.15, height * 0.85 - 50]);
        
        const alaskaPath = d3.geoPath().projection(alaskaProjection);
        
        gStates.selectAll("path.alaska")
            .data(alaska)
            .enter().append("path")
            .attr("class", "alaska territory-inset")
            .attr("d", alaskaPath);

        // Dessiner Hawaii avec sa propre projection
        const hawaiiProjection = d3.geoMercator()
            .center([-157, 20.5])
            .scale(Math.min(width, height) * 0.5)
            .translate([width * 0.35, height * 0.88 - 20]);
        
        const hawaiiPath = d3.geoPath().projection(hawaiiProjection);
        
        gStates.selectAll("path.hawaii")
            .data(hawaii)
            .enter().append("path")
            .attr("class", "hawaii territory-inset")
            .attr("d", hawaiiPath);

        // Dessiner Porto Rico avec sa propre projection
        const puertoRicoProjection = d3.geoMercator()
            .center([-66.5, 18.2])
            .scale(Math.min(width, height) * 2)
            .translate([width * 0.75, height * 0.88 - 20]);
        
        const puertoRicoPath = d3.geoPath().projection(puertoRicoProjection);
        
        gStates.selectAll("path.puerto-rico")
            .data(puertoRico)
            .enter().append("path")
            .attr("class", "puerto-rico territory-inset")
            .attr("d", puertoRicoPath);

        // Créer la fonction de projection adaptative pour les villes
        function getProjectionForCoords(coords) {
            const [lon, lat] = coords;
            
            // Alaska
            if (lon < -130 && lat > 51) {
                return alaskaProjection;
            }
            // Hawaii
            else if (lon < -154 && lat < 23 && lat > 18) {
                return hawaiiProjection;
            }
            // Porto Rico et Caraïbes
            else if (lon > -68 && lon < -64 && lat > 17 && lat < 19) {
                return puertoRicoProjection;
            }
            // États-Unis continentaux
            return projection;
        }

        cityGeo.features.forEach(f => {
            if(f.geometry && f.geometry.coordinates) {
                const coords = f.geometry.coordinates;
                const cityProjection = getProjectionForCoords(coords);
                state.lookup[f.properties.city.trim()] = {
                    coords: coords,
                    projection: cityProjection,
                    projectedCoords: cityProjection(coords)
                };
            }
        });

        const cityCounts = {};
        const cityDepartures = {};
        const cityArrivals = {};
        monthData.forEach(d => {
            cityCounts[d.origin_city] = (cityCounts[d.origin_city] || 0) + (+d.flight_number);
            cityCounts[d.dest_city] = (cityCounts[d.dest_city] || 0) + (+d.flight_number);
            cityDepartures[d.origin_city] = (cityDepartures[d.origin_city] || 0) + (+d.flight_number);
            cityArrivals[d.dest_city] = (cityArrivals[d.dest_city] || 0) + (+d.flight_number);
        });

        // Stocker les statistiques dans state pour y accéder dans les événements
        state.cityStats = { cityCounts, cityDepartures, cityArrivals };

        // Phase 2.1 : Précalculer tous les chemins de routes possibles
        state.routePaths = {};
        const allCities = Object.keys(state.lookup);
        monthData.forEach(d => {
            const routeKey = `${d.origin_city}-${d.dest_city}`;
            if (state.routePaths[routeKey]) return; // Déjà calculé

            const src = state.lookup[d.origin_city];
            const dst = state.lookup[d.dest_city];
            if (!src || !dst || !src.projectedCoords || !dst.projectedCoords) return;

            const [x1, y1] = src.projectedCoords;
            const [x2, y2] = dst.projectedCoords;

            // Calculer le vecteur perpendiculaire une seule fois
            const dx = x2 - x1;
            const dy = y2 - y1;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const perpX = -dy / dist;
            const perpY = dx / dist;

            // Stocker les 3 variantes du chemin
            state.routePaths[routeKey] = {
                normal: `M${x1},${y1} L${x2},${y2}`,
                outbound: `M${x1 - perpX * 3},${y1 - perpY * 3} L${x2 - perpX * 3},${y2 - perpY * 3}`,
                inbound: `M${x1 + perpX * 3},${y1 + perpY * 3} L${x2 + perpX * 3},${y2 + perpY * 3}`
            };
        });
        
        // Précalculer les tooltips pour éviter de les recalculer à chaque hover
        state.cityTooltips = {};
        Object.keys(state.lookup).forEach(cityName => {
            const departures = cityDepartures[cityName] || 0;
            const arrivals = cityArrivals[cityName] || 0;
            const total = cityCounts[cityName] || 0;
            state.cityTooltips[cityName] = `
                <div style="font-weight:600; margin-bottom:6px; border-bottom:1px solid #555; padding-bottom:4px;">
                    ${cityName}
                </div>
                <div style="display:flex; justify-content:space-between; gap:15px; margin-top:4px;">
                    <span>Départs:</span> <strong>${departures.toLocaleString()}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; gap:15px;">
                    <span>Arrivées:</span> <strong>${arrivals.toLocaleString()}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; gap:15px; margin-top:4px; padding-top:4px; border-top:1px solid #555;">
                    <span>Total:</span> <strong>${total.toLocaleString()}</strong>
                </div>
            `;
        });

        const maxCityCount = d3.max(Object.values(cityCounts)) || 1;

        const sizeScale = d3.scaleSqrt()
            .domain([0, maxCityCount])
            .range([3, 12]);

        const colorScale = d3.scaleSequential()
            .domain([0, maxCityCount])
            .interpolator(d3.interpolateBlues);

        gCities.selectAll("circle")
            .data(cityGeo.features, d => d.properties.city)
            .enter().append("circle")
            .attr("class", "city-node")
            .attr("r", d => {
                const cityData = state.lookup[d.properties.city];
                if (!cityData || !cityData.projectedCoords) return 0;
                const cityName = (d.properties.city || "").trim();
                return sizeScale(cityCounts[cityName] || 0);
            })
            .attr("fill", d => {
                const cityData = state.lookup[d.properties.city];
                if (!cityData || !cityData.projectedCoords) return "transparent";
                const cityName = (d.properties.city || "").trim();
                const count = cityCounts[cityName] || 0;
                if (count === 0) return "#e0f2fe";
                try {
                    return colorScale(count);
                } catch(e) {
                    console.warn("ColorScale error for", d.properties.city, count, e);
                    return "#001f3f";
                }
            })
            .attr("transform", d => {
                const cityData = state.lookup[d.properties.city];
                if (!cityData || !cityData.projectedCoords) return "translate(0,0)";
                return `translate(${cityData.projectedCoords})`;
            })
            .attr("opacity", d => {
                const cityData = state.lookup[d.properties.city];
                if (!cityData || !cityData.projectedCoords) return 0;
                return 1;
            })
            .on("click", d => selectCity(d.properties.city))
            .on("mouseover", function(d) {
                const html = state.cityTooltips[d.properties.city];
                if (html) showTooltip(html, d3.event.pageX, d3.event.pageY);
            })
            .on("mouseout", function(d) {
                hideTooltip();
            });

        // Envoyer la liste des villes triées au parent
        const sortedCities = Object.keys(state.lookup)
            .filter(cityName => cityCounts[cityName] > 0)
            .sort((a, b) => cityCounts[b] - cityCounts[a]);
        
        window.parent.postMessage({
            type: 'mapCitiesLoaded',
            cities: sortedCities
        }, '*');

        // Écouter les messages du parent pour mettre à jour la ville sélectionnée
        window.addEventListener('message', function(event) {
            if (event.data.type === 'updateMapCity') {
                const cityName = event.data.city;
                if (cityName && cityName !== '') {
                    selectCity(cityName);
                } else {
                    resetView();
                }
            }
            
            if (event.data.type === 'updateMapPeriod') {
                const period = event.data.period; // 'month' or 'week'
                const timeValue = event.data.timeValue; // numéro
                
                if (period) {
                    state.mode = period;
                    
                    if (timeValue !== undefined) {
                        state.timeValue = +timeValue;
                    }
                    
                    // Préserver la ville sélectionnée et les contrôles de direction
                    if (state.selectedCity) {
                        document.getElementById("direction-controls").classList.remove("hidden");
                        document.getElementById("legend-directions").classList.remove("hidden");
                    }
                    
                    updateMap();
                }
            }
        });

        updateMap();
    });

// 6. LOGIC & UPDATE
function updateMap() {
    // Phase 1.1 : Utiliser les datasets précalculés (pas de filtrage répété)
    let dataset = [];
    if (state.mode === "month") {
        dataset = state.dataByMonth[state.timeValue] || [];
    } else if (state.mode === "week") {
        dataset = state.dataByWeek[state.timeValue] || [];
    } else {
        dataset = state.dataByLateType[state.lateFilter] || [];
    }

    let displayData = [];

    if (state.selectedCity) {
        dataset.forEach(d => {
            const isOut = d.origin_city === state.selectedCity;
            const isIn = d.dest_city === state.selectedCity;

            if (isOut && (state.direction === 'all' || state.direction === 'outbound')) {
                d.type = 'outbound';
                displayData.push(d);
            } else if (isIn && (state.direction === 'all' || state.direction === 'inbound')) {
                d.type = 'inbound';
                displayData.push(d);
            }
        });
    } else {
        displayData = dataset.filter(d => d.flight_number > 0);
        displayData.forEach(d => d.type = 'default');
    }

    const links = gRoutes.selectAll("path")
        .data(displayData, d => d.origin_city + "-" + d.dest_city);

    links.exit().remove();

    const enterLinks = links.enter().append("path")
        .attr("fill", "none")
        .attr("stroke-linecap", "round");

    links.merge(enterLinks)
        .attr("class", d => `flight-route ${d.type}`)
        .attr("d", d => {
            // Phase 2.1 : Utiliser les chemins précalculés
            const routeKey = `${d.origin_city}-${d.dest_city}`;
            const paths = state.routePaths[routeKey];
            if (!paths) return null;
            
            // Sélectionner le bon chemin selon le contexte
            if (state.selectedCity) {
                return d.type === 'outbound' ? paths.outbound : paths.inbound;
            }
            return paths.normal;
        })
        .attr("stroke", d => {
            if (d.type === 'outbound') return config.colors.outbound;
            if (d.type === 'inbound') return config.colors.inbound;
            return "#94a3b8";
        })
        .attr("stroke-width", d => {
            const base = Math.sqrt(d.flight_number);
            return state.selectedCity ? Math.max(1.5, base) : Math.max(0.5, base/2);
        })
        .attr("marker-end", d => {
            if (!state.selectedCity) return null;
            return d.type === 'outbound' ? "url(#arrow-outbound)" : "url(#arrow-inbound)";
        });

    // Phase 3.1 : Délégation d'événements (un seul listener au lieu de milliers)
    gRoutes.on("mouseover", function() {
        const event = d3.event;
        const target = event.target;
        if (target.tagName === 'path') {
            d3.select(target).attr("stroke-width", 4).attr("stroke", "#333");
        }
    });

    gRoutes.on("mouseout", function() {
        const event = d3.event;
        const target = event.target;
        if (target.tagName === 'path') {
            d3.select(target).attr("stroke-width", null).attr("stroke", null);
        }
    });

    // Phase 1.2 : Créer un Set des villes connectées (O(n) au lieu de O(n²))
    const connectedCities = new Set();
    if (state.selectedCity) {
        displayData.forEach(d => {
            connectedCities.add(d.origin_city);
            connectedCities.add(d.dest_city);
        });
    }

    gCities.selectAll("circle")
        .classed("active", d => d.properties.city === state.selectedCity)
        .attr("opacity", d => {
            if (!state.selectedCity) return 1;
            return connectedCities.has(d.properties.city) || d.properties.city === state.selectedCity ? 1 : 0.1;
        });
}

// 7. ACTIONS
function selectCity(cityName) {
    state.selectedCity = cityName;
    document.getElementById("direction-controls").classList.remove("hidden");
    document.getElementById("legend-directions").classList.remove("hidden");
    updateMap();
}

function resetView() {
    state.selectedCity = null;
    document.getElementById("direction-controls").classList.add("hidden");
    document.getElementById("legend-directions").classList.add("hidden");
    state.direction = 'all';
    document.querySelector('input[name="direction"][value="all"]').checked = true;
    updateMap();
}

// TOOLTIPS
function showTooltip(text, x, y) {
    tooltip.html(text).style("left", (x+10)+"px").style("top", (y-50)+"px").classed("hidden", false);
}

function showLinkTooltip(d, x, y) {
    const latePct = d.flight_number > 0 ? ((d.is_late / d.flight_number) * 100).toFixed(1) : 0;
    const html = `
        <div style="font-weight:600; margin-bottom:4px; border-bottom:1px solid #555; padding-bottom:4px;">
            ${d.origin_city} ➝ ${d.dest_city}
        </div>
        <div style="display:flex; justify-content:space-between; gap:15px;">
            <span>Total:</span> <strong>${d.flight_number}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; gap:15px;">
            <span>Late:</span> <strong style="color:${latePct>20?'#f87171':'#4ade80'}">${latePct}%</strong>
        </div>
    `;
    showTooltip(html, x, y);
}

function hideTooltip() {
    tooltip.classed("hidden", true);
}

// 8. EVENT LISTENERS
document.getElementById("delay-select").addEventListener("change", function(e) {
    state.lateFilter = e.target.value;
    updateMap();
});

document.querySelectorAll('input[name="direction"]').forEach(radio => {
    radio.addEventListener("change", function(e) {
        state.direction = e.target.value;
        console.log("Direction changed to:", state.direction);
        updateMap();
    });
});