const width = document.getElementById("map-wrapper").clientWidth;
const height = document.getElementById("map-wrapper").clientHeight;

console.log(`Map dimensions: ${width}x${height}`);

// --- CONFIGURATION D3 ---
const svg = d3.select("#map-wrapper").append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("shape-rendering", "crispEdges")
    .style("text-rendering", "geometricPrecision");

// Définition des flèches (Markers)
const defs = svg.append("defs");
function createMarker(id, color) {
    defs.append("marker")
        .attr("id", id)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 18)
        .attr("refY", 0)
        .attr("markerWidth", 5)
        .attr("markerHeight", 5)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", color)
        .attr("stroke", "none");
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
    .scaleExtent([0.5, 8])
    .on("zoom", () => {
        mapGroup.attr("transform", d3.event.transform);
        // Zoom sémantique pour Windows: garder stroke-width visible
        gRoutes.selectAll("path").style("stroke-width", d => {
            const baseWidth = d.selected ? 2 : 1.5;
            const scaledWidth = Math.max(0.7, baseWidth / d3.event.transform.k);
            return scaledWidth + "px";
        });
        gCities.selectAll("circle").attr("r", d => Math.max(2, (d.baseR || 3) / Math.sqrt(d3.event.transform.k)));
    });
svg.call(zoom);

// --- ÉTAT (STATE) ---
const state = {
    data: {},
    lookup: {},
    mode: "month",
    timeValue: 1,
    delayType: "all",
    selectedCity: null,
    direction: "all"
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
        console.log("✓ All files loaded successfully");

        // 1. Carte USA
        gStates.selectAll("path")
            .data(topojson.feature(us, us.objects.states).features)
            .enter().append("path")
            .attr("d", path)
            .style("fill", "#e2e8f0")
            .style("stroke", "#ffffff")
            .style("stroke-width", "1px");

        // 2. Préparation Villes avec validation stricte
        const cityCounts = {};
        let invalidCount = 0;

        cities.features.forEach(f => {
            if(f.geometry &&
               f.geometry.type === "Point" &&
               f.geometry.coordinates &&
               Array.isArray(f.geometry.coordinates) &&
               f.geometry.coordinates.length === 2 &&
               typeof f.geometry.coordinates[0] === 'number' &&
               typeof f.geometry.coordinates[1] === 'number') {
                state.lookup[f.properties.city] = f.geometry.coordinates;
                cityCounts[f.properties.city] = 0;
            } else {
                invalidCount++;
            }
        });

        console.log(`✓ Cities loaded: ${Object.keys(state.lookup).length} valid, ${invalidCount} invalid`);

        // Nettoyage des données numériques
        const clean = (d) => ({
            ...d,
            flight_number: +d.flight_number || 0,
            month: +d.month || 0,
            week_number: +d.week_number || 0,
            is_late: +d.is_late || 0,
            bool_carrier_delay_min: +d.bool_carrier_delay_min || 0,
            bool_weather_delay_min: +d.bool_weather_delay_min || 0,
            bool_traffic_delay_min: +d.bool_traffic_delay_min || 0,
            bool_security_delay_min: +d.bool_security_delay_min || 0,
            bool_late_aircraft_delay_min: +d.bool_late_aircraft_delay_min || 0
        });

        // Filter to only keep flights for cities we have coordinates for
        state.data.month = monthData
            .map(clean)
            .filter(d => state.lookup[d.origin_city] && state.lookup[d.dest_city]);

        state.data.week = weekData
            .map(clean)
            .filter(d => state.lookup[d.origin_city] && state.lookup[d.dest_city]);

        state.data.late = lateData
            .map(clean)
            .filter(d => state.lookup[d.origin_city] && state.lookup[d.dest_city]);

        console.log(`✓ Flight data: month=${state.data.month.length}, week=${state.data.week.length}, late=${state.data.late.length}`);

        // 3. Initialisation Villes Graphiques
        state.data.month.forEach(d => {
            if(cityCounts[d.origin_city] !== undefined) {
                cityCounts[d.origin_city] += d.flight_number;
            }
        });

        const sizeScale = d3.scaleSqrt().domain([0, 50000]).range([3, 8]);

        // Safe projection helper
        const safeProject = (coords) => {
            if (!coords || !Array.isArray(coords) || coords.length !== 2) {
                return [0, 0];
            }
            try {
                const result = projection(coords);
                return result && Array.isArray(result) && result.length === 2 ? result : [0, 0];
            } catch (e) {
                console.warn('Projection error:', e);
                return [0, 0];
            }
        };

        // Create circles for cities
        const cityFeatures = cities.features.filter(d =>
            d.geometry &&
            d.geometry.coordinates &&
            Array.isArray(d.geometry.coordinates) &&
            d.geometry.coordinates.length === 2 &&
            state.lookup[d.properties.city]
        );

        console.log(`✓ Creating ${cityFeatures.length} city circles`);

        gCities.selectAll("circle")
            .data(cityFeatures)
            .enter().append("circle")
            .attr("class", "city")
            .attr("cx", d => safeProject(d.geometry.coordinates)[0])
            .attr("cy", d => safeProject(d.geometry.coordinates)[1])
            .attr("r", d => sizeScale(cityCounts[d.properties.city] || 0))
            .each(function(d) {
                d.baseR = sizeScale(cityCounts[d.properties.city] || 0);
            })
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
            .on("mouseout", () => {
                const tooltip = document.getElementById("tooltip");
                if(tooltip) tooltip.classList.add("hidden");
            });

        // 4. Remplir le datalist et Select Temps
        const cityList = document.getElementById("cities-list");
        if(cityList) {
            Object.keys(state.lookup).sort().forEach(c => {
                let opt = document.createElement("option");
                opt.value = c;
                cityList.appendChild(opt);
            });
        }

        populateTimeSelect();
        updateMap();

        console.log("✓ Visualization initialized");
    })
    .catch(error => {
        console.error('Error loading data:', error);
        const loadingEl = document.getElementById("loading");
        if (loadingEl) {
            loadingEl.innerHTML = '<p style="color: red;">Error: ' + error.message + '</p>';
        }
        alert('Error loading data: ' + error.message);
    });

// --- LOGIQUE METIER ---

function populateTimeSelect() {
    const sel = document.getElementById("time-select");
    if(!sel) return;

    sel.innerHTML = "";
    if(state.mode === 'month') {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
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
            opt.text = "Week " + i;
            sel.appendChild(opt);
        }
    }
    sel.value = state.timeValue;
}

function updateMap() {
    // 1. Choisir le bon Dataset
    let currentData = [];
    if(state.delayType !== 'all') {
        currentData = state.data.late.filter(d => d[state.delayType] == 1);
    } else {
        if(state.mode === 'month') {
            currentData = state.data.month.filter(d => d.month == state.timeValue);
        } else {
            currentData = state.data.week.filter(d => d.week_number == state.timeValue);
        }
    }

    // 2. Filtrer par Ville et Direction
    let displayRoutes = [];

    if (state.selectedCity) {
        currentData.forEach(d => {
            const isOut = d.origin_city === state.selectedCity;
            const isIn = d.dest_city === state.selectedCity;

            if (!isOut && !isIn) return;

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
        displayRoutes = currentData.filter(d => d.flight_number > 2);
        displayRoutes.forEach(d => d.type = 'default');
    }

    // 3. DESSIN (Data Join)
    const routes = gRoutes.selectAll("path").data(displayRoutes, d => d.origin_city + "|" + d.dest_city);

    routes.exit().remove();

    // Calculer les statistiques
    const totalFlights = displayRoutes.reduce((sum, d) => sum + d.flight_number, 0);
    const totalLate = displayRoutes.reduce((sum, d) => sum + d.is_late, 0);
    const latePct = totalFlights > 0 ? ((totalLate / totalFlights) * 100).toFixed(1) : 0;
    const onTimePct = totalFlights > 0 ? (100 - latePct).toFixed(1) : 0;

    // Mettre à jour les statistiques
    const routeCount = document.getElementById('route-count');
    const flightCount = document.getElementById('flight-count');
    const ontimePct = document.getElementById('ontime-pct');
    const latePctEl = document.getElementById('late-pct');

    if(routeCount) routeCount.textContent = displayRoutes.length;
    if(flightCount) flightCount.textContent = totalFlights;
    if(ontimePct) ontimePct.textContent = onTimePct + '%';
    if(latePctEl) latePctEl.textContent = latePct + '%';

    const enterRoutes = routes.enter().append("path")
        .attr("fill", "none")
        .style("stroke-linecap", "round")
        .style("stroke-linejoin", "round")
        .style("paint-order", "stroke");

    routes.merge(enterRoutes)
        .attr("class", d => `route ${d.type}`)
        .attr("d", d => {
            const src = state.lookup[d.origin_city];
            const dst = state.lookup[d.dest_city];
            if(!src || !dst) return null;
            return path({type: "LineString", coordinates: [src, dst]});
        })
        .attr("marker-end", d => {
            if(!state.selectedCity) return null;
            return d.type === 'outbound' ? "url(#arrow-outbound)" : "url(#arrow-inbound)";
        })
        .style("stroke-width", d => (state.selectedCity ? "2px" : "1.5px"))
        .on("mouseover", function(d) {
            d3.select(this)
                .style("stroke-width", "4px")
                .style("opacity", 1);
            const latePct = d.flight_number > 0 ? ((d.is_late/d.flight_number)*100).toFixed(1) : 0;
            const onTimePct = d.flight_number > 0 ? (100 - latePct).toFixed(1) : 0;
            const direction = d.type === 'outbound' ? '📤 Departure' : (d.type === 'inbound' ? '📥 Arrival' : '✈️ Flight');
            const html = `<div class="tooltip-title">${direction}</div>
                <div class="tooltip-row"><strong>${d.origin_city}</strong> ✈️ <strong>${d.dest_city}</strong></div>
                <div class="tooltip-stats">
                    <div class="tooltip-row"><span>📊 Flights:</span> <strong>${d.flight_number}</strong></div>
                    <div class="tooltip-row"><span>⏰ On Time:</span> <strong style="color: #10b981;">${onTimePct}%</strong></div>
                    <div class="tooltip-row"><span>⚠️ Late:</span> <strong style="color: #ef4444;">${latePct}%</strong></div>
                </div>`;
            showTooltip(html, d3.event.pageX, d3.event.pageY);
        })
        .on("mouseout", function(d) {
            d3.select(this).style("stroke-width", state.selectedCity ? "2px" : "1.5px").style("opacity", 0.65);
            const tooltip = document.getElementById("tooltip");
            if(tooltip) tooltip.classList.add("hidden");
        });

    // Mise à jour visuelle des villes
    gCities.selectAll("circle")
        .classed("active", d => d.properties.city === state.selectedCity)
        .attr("opacity", d => {
            if(!state.selectedCity) return 1;
            const isConnected = displayRoutes.some(r => r.origin_city === d.properties.city || r.dest_city === d.properties.city);
            return (d.properties.city === state.selectedCity || isConnected) ? 1 : 0.2;
        });
}

// --- INTERACTIONS ---

function selectCity(name) {
    state.selectedCity = name;
    const citySearch = document.getElementById("city-search");
    if(citySearch) citySearch.value = name;

    const dirGroup = document.getElementById("direction-group");
    if(dirGroup) {
        if(name) {
            dirGroup.classList.remove("hidden");
            const coords = state.lookup[name];
            if(coords) {
                const tr = projection(coords);
                if(tr) {
                    svg.transition().duration(750).call(
                        zoom.transform,
                        d3.zoomIdentity.translate(width/2 - tr[0]*3, height/2 - tr[1]*3).scale(3)
                    );
                }
            }
        } else {
            dirGroup.classList.add("hidden");
            state.direction = 'all';
            svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
        }
    }
    updateMap();
}

// Events Listeners
const modeSelect = document.getElementById("mode-select");
if(modeSelect) {
    modeSelect.addEventListener("change", (e) => {
        state.mode = e.target.value;
        state.timeValue = 1;
        populateTimeSelect();
        updateMap();
    });
}

const timeSelect = document.getElementById("time-select");
if(timeSelect) {
    timeSelect.addEventListener("change", (e) => {
        state.timeValue = +e.target.value;
        updateMap();
    });
}

const delaySelect = document.getElementById("delay-select");
if(delaySelect) {
    delaySelect.addEventListener("change", (e) => {
        state.delayType = e.target.value;
        updateMap();
    });
}

const citySearch = document.getElementById("city-search");
if(citySearch) {
    citySearch.addEventListener("change", (e) => selectCity(e.target.value));
}

const resetBtn = document.getElementById("reset-btn");
if(resetBtn) {
    resetBtn.addEventListener("click", () => {
        if(citySearch) citySearch.value = "";
        selectCity(null);
    });
}

const toggleGroup = document.querySelector(".toggle-group");
if(toggleGroup) {
    toggleGroup.addEventListener("change", (e) => {
        if(e.target.name === "dir") {
            state.direction = e.target.value;
            updateMap();
        }
    });
}

const zoomIn = document.getElementById("zoom-in");
if(zoomIn) {
    zoomIn.addEventListener("click", () => svg.transition().call(zoom.scaleBy, 1.4));
}

const zoomOut = document.getElementById("zoom-out");
if(zoomOut) {
    zoomOut.addEventListener("click", () => svg.transition().call(zoom.scaleBy, 0.6));
}

function showTooltip(html, x, y) {
    const t = document.getElementById("tooltip");
    if(!t) return;

    t.innerHTML = html;

    let tooltipX = x + 15;
    let tooltipY = y + 15;

    if (tooltipX + 350 > width) tooltipX = x - 365;
    if (tooltipY + 200 > height) tooltipY = y - 210;

    t.style.left = tooltipX + "px";
    t.style.top = tooltipY + "px";
    t.classList.remove("hidden");
}

