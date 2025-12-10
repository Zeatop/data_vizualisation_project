// ============================================================================
// CONNECTION MAP - D3.JS VISUALIZATION FOR FLIGHT NETWORK
// ============================================================================
// Principes: Shneiderman's 8 Golden Rules + Munzner's Framework
// ============================================================================

// 1. CONFIG & CONSTANTS
const config = {
    colors: {
        outbound: "#2563eb",      // Primary Blue (departures)
        inbound: "#db2777",       // Accent Pink (arrivals)
        neutralRoute: "#94a3b8"   // Slate Grey (overview)
    },
    zoom: {
        minScale: 0.8,
        maxScale: 4,
        step: 0.2
    }
};

// Get container dimensions safely
const container = document.getElementById("map-wrapper");
const width = container.clientWidth || 800;
const height = container.clientHeight || 600;

// 2. D3 SETUP - SVG & PROJECTION
const svg = d3.select("#map-wrapper")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

// Main projection for continental US
const projection = d3.geoAlbersUsa()
    .translate([width / 2, height / 2])
    .scale(Math.min(width, height) * 1.6);

const path = d3.geoPath().projection(projection);

// Background click detection - Shneiderman #7 (user control)
svg.insert("rect", ":first-child")
    .attr("class", "background")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "transparent")
    .on("click", function() {
        if (d3.event.target === this) {
            resetView();
        }
    });

// Layer organization for proper rendering order
const mapGroup = svg.append("g").attr("class", "map-group");
const gStates = mapGroup.append("g").attr("class", "states-layer");
const gRoutes = mapGroup.append("g").attr("class", "routes-layer");
const gCities = mapGroup.append("g").attr("class", "cities-layer");

const tooltip = d3.select("#tooltip");

// Arrow markers for directed edges - Munzner (Expressiveness)
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

// 3. STATE MANAGEMENT - Shneiderman #2 (minimize cognitive load)
const state = {
    data: {},
    lookup: {},
    mode: "month",              // month | week | late
    timeValue: 1,
    lateFilter: "all",
    selectedCity: null,
    filteredCities: [],         // For city filter
    direction: "all",           // all | outbound | inbound
    zoomScale: 1,
    zoomTranslate: [0, 0]
};

// 4. ZOOM & PAN HANDLING - Shneiderman #1 (overview first, zoom/filter)
const zoom = d3.zoom()
    .scaleExtent([config.zoom.minScale, config.zoom.maxScale])
    .on("zoom", function() {
        mapGroup.attr("transform", d3.event.transform);
        state.zoomScale = d3.event.transform.k;
        state.zoomTranslate = [d3.event.transform.x, d3.event.transform.y];
    });

svg.call(zoom);

// Zoom button controls
document.getElementById("zoom-in").addEventListener("click", function() {
    svg.transition().duration(300).call(zoom.scaleBy, 1.3);
});

document.getElementById("zoom-out").addEventListener("click", function() {
    svg.transition().duration(300).call(zoom.scaleBy, 0.77);
});

document.getElementById("zoom-reset").addEventListener("click", function() {
    svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity.translate(0, 0));
    state.zoomScale = 1;
    state.zoomTranslate = [0, 0];
});

// 5. DATA LOADING
const files = [
    "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json",
    "../../../citiesData/us_cities_from_csv.geojson",
    "../../../flightData/dataCredo/aggregated_by_month_and_route.csv",
    "../../../flightData/dataCredo/aggregated_by_week_and_route.csv",
    "../../../flightData/dataCredo/aggregated_by_late_type_and_route.csv"
];

Promise.all(files.map((url, i) => i < 2 ? d3.json(url) : d3.csv(url)))
    .then(function([usMap, cityGeo, monthData, weekData, lateData]) {

        // Data cleaning - convert numeric fields
        const cleanData = d => ({
            ...d,
            is_late: +d.is_late,
            flight_number: +d.flight_number
        });
        monthData = monthData.map(cleanData);
        weekData = weekData.map(cleanData);
        lateData = lateData.map(cleanData);

        // Pre-calculate datasets by mode
        state.dataByMonth = {};
        for (let m = 1; m <= 12; m++) {
            state.dataByMonth[m] = monthData.filter(d => d.month == m);
        }
        state.dataByWeek = {};
        for (let w = 1; w <= 52; w++) {
            state.dataByWeek[w] = weekData.filter(d => d.week_number == w);
        }
        state.dataByLateType = {
            all: lateData,
            bool_carrier_delay_min: lateData.filter(d => d.bool_carrier_delay_min == 1),
            bool_weather_delay_min: lateData.filter(d => d.bool_weather_delay_min == 1),
            bool_traffic_delay_min: lateData.filter(d => d.bool_traffic_delay_min == 1),
            bool_security_delay_min: lateData.filter(d => d.bool_security_delay_min == 1),
            bool_late_aircraft_delay_min: lateData.filter(d => d.bool_late_aircraft_delay_min == 1)
        };
        state.data = { month: monthData, week: weekData, late: lateData };

        // --- DRAW MAP BACKGROUND (States) ---
        const features = topojson.feature(usMap, usMap.objects.states).features;
        const mainland = features.filter(d => {
            const id = d.id;
            return id !== "02" && id !== "15" && id !== "72";
        });

        // Projections for Alaska, Hawaii, Puerto Rico (insets)
        const alaskaProjection = d3.geoAlbers()
            .rotate([154, 0]).center([-2, 64])
            .parallels([55, 65])
            .scale(Math.min(width, height) * 0.35)
            .translate([width * 0.15, height * 0.85]);

        const hawaiiProjection = d3.geoMercator()
            .center([-157, 20.5])
            .scale(Math.min(width, height) * 0.5)
            .translate([width * 0.35, height * 0.88]);

        const puertoRicoProjection = d3.geoMercator()
            .center([-66.5, 18.2])
            .scale(Math.min(width, height) * 2)
            .translate([width * 0.75, height * 0.88]);

        // Draw state paths
        function drawStates(data, projectionFn, className) {
            gStates.selectAll(`path.${className}`)
                .data(data)
                .enter().append("path")
                .attr("class", className)
                .attr("d", d3.geoPath().projection(projectionFn));
        }

        drawStates(mainland, projection, "mainland");
        drawStates(features.filter(d => d.id === "02"), alaskaProjection, "alaska territory-inset");
        drawStates(features.filter(d => d.id === "15"), hawaiiProjection, "hawaii territory-inset");
        drawStates(features.filter(d => d.id === "72"), puertoRicoProjection, "puerto-rico territory-inset");

        // --- CITY DATA PREPARATION ---
        function getProjectionForCoords(coords) {
            const [lon, lat] = coords;
            if (lon < -130 && lat > 51) return alaskaProjection;
            if (lon < -154 && lat < 23 && lat > 18) return hawaiiProjection;
            if (lon > -68 && lon < -64 && lat > 17 && lat < 19) return puertoRicoProjection;
            return projection;
        }

        const cityCounts = {};
        const cityDepartures = {};
        const cityArrivals = {};

        // Aggregate flight numbers by city
        monthData.forEach(d => {
            const originCity = (d.origin_city || "").trim();
            const destCity = (d.dest_city || "").trim();
            const flightNum = +d.flight_number || 0;

            cityCounts[originCity] = (cityCounts[originCity] || 0) + flightNum;
            cityCounts[destCity] = (cityCounts[destCity] || 0) + flightNum;
            cityDepartures[originCity] = (cityDepartures[originCity] || 0) + flightNum;
            cityArrivals[destCity] = (cityArrivals[destCity] || 0) + flightNum;
        });

        // Map city coordinates to projections
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

        state.cityStats = { cityCounts, cityDepartures, cityArrivals };

        // Debug: log city names to understand mismatch
        console.log("Sample cityCounts keys:", Object.keys(cityCounts).slice(0, 5));
        console.log("Sample cityGeo cities:", cityGeo.features.slice(0, 5).map(f => f.properties.city));

        // Pre-calculate all possible route paths
        state.routePaths = {};
        monthData.forEach(d => {
            const originCity = (d.origin_city || "").trim();
            const destCity = (d.dest_city || "").trim();
            const routeKey = `${originCity}-${destCity}`;
            if (state.routePaths[routeKey]) return;

            const src = state.lookup[originCity];
            const dst = state.lookup[destCity];
            if (!src || !dst || !src.projectedCoords || !dst.projectedCoords) return;

            const [x1, y1] = src.projectedCoords;
            const [x2, y2] = dst.projectedCoords;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return;

            const perpX = -dy / dist;
            const perpY = dx / dist;

            const offset = 3;
            state.routePaths[routeKey] = {
                normal: `M${x1},${y1} L${x2},${y2}`,
                outbound: `M${x1 - perpX * offset},${y1 - perpY * offset} L${x2 - perpX * offset},${y2 - perpY * offset}`,
                inbound: `M${x1 + perpX * offset},${y1 + perpY * offset} L${x2 + perpX * offset},${y2 + perpY * offset}`
            };
        });

        // Pre-calculate tooltips - Details on demand (Shneiderman #1)
        state.cityTooltips = {};
        Object.keys(state.lookup).forEach(cityName => {
            const departures = cityDepartures[cityName] || 0;
            const arrivals = cityArrivals[cityName] || 0;
            const total = cityCounts[cityName] || 0;
            const ratio = total > 0 ? ((departures / total) * 100).toFixed(1) : 0;

            state.cityTooltips[cityName] = `
                <div style="font-weight:700; margin-bottom:8px; border-bottom:1px solid #888; padding-bottom:6px; font-size:0.9rem;">
                    ${cityName}
                </div>
                <div style="display:flex; justify-content:space-between; gap:20px; margin-top:4px; font-size:0.8rem;">
                    <span>Départs:</span> <strong>${departures.toLocaleString()}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; gap:20px; font-size:0.8rem;">
                    <span>Arrivées:</span> <strong>${arrivals.toLocaleString()}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; gap:20px; margin-top:6px; padding-top:6px; border-top:1px solid #888; font-size:0.8rem;">
                    <span>Total:</span> <strong>${total.toLocaleString()}</strong>
                </div>
            `;
        });

        // Initialize city filter dropdown with sorted cities
        const cityFilterSelect = document.getElementById("city-filter");
        const sortedCities = Object.keys(state.lookup)
            .filter(cityName => cityCounts[cityName] > 0)
            .sort((a, b) => cityCounts[b] - cityCounts[a]);  // Sort by volume descending

        sortedCities.forEach(cityName => {
            const option = document.createElement("option");
            option.value = cityName;
            option.textContent = cityName;
            cityFilterSelect.appendChild(option);
        });

        // --- CITY CIRCLES (Size & Color encoding) ---
        const maxCityCount = d3.max(Object.values(cityCounts)) || 1;

        const sizeScale = d3.scaleSqrt()
            .domain([0, maxCityCount])
            .range([3, 12]);

        // Sequential color scale for volume - using Blues
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
                if (count === 0) return "#e0f2fe"; // Very light blue for cities with no data
                try {
                    return colorScale(count);
                } catch(e) {
                    console.warn("ColorScale error for", d.properties.city, count, e);
                    return "#001f3f"; // Fallback to dark blue
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
            .on("click", d => {
                selectCity(d.properties.city);
                // Feedback: indicate selection
                showTooltip(`<strong>${d.properties.city} - Sélectionné</strong>`,
                    d3.event.pageX, d3.event.pageY);
            })
            .on("mouseover", function(d) {
                const html = state.cityTooltips[d.properties.city];
                if (html) showTooltip(html, d3.event.pageX, d3.event.pageY);
            })
            .on("mouseout", hideTooltip);

        // Initialize visualization
        updateMap();

    })
    .catch(err => {
        console.error("Error loading data:", err);
        showTooltip(`<strong>⚠️ Erreur</strong><br>Impossible de charger les données`,
            window.innerWidth / 2, window.innerHeight / 2);
    });

// ============================================================================
// 6. CORE VISUALIZATION UPDATE - Data-driven updates
// ============================================================================
function updateMap() {
    let dataset = [];

    // Get appropriate dataset based on mode
    if (state.mode === "month") {
        dataset = state.dataByMonth[state.timeValue];
    } else if (state.mode === "week") {
        dataset = state.dataByWeek[state.timeValue];
    } else {
        dataset = state.dataByLateType[state.lateFilter];
    }

    let displayData = [];

    // Apply city filter if selected
    if (state.filteredCities.length > 0) {
        dataset = dataset.filter(d => {
            const originCity = (d.origin_city || "").trim();
            const destCity = (d.dest_city || "").trim();
            return state.filteredCities.includes(originCity) || state.filteredCities.includes(destCity);
        });
    }

    // Filter data based on city selection (clicking a node)
    if (state.selectedCity) {
        dataset.forEach(d => {
            const originCity = (d.origin_city || "").trim();
            const destCity = (d.dest_city || "").trim();
            const isOut = originCity === state.selectedCity;
            const isIn = destCity === state.selectedCity;

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

    // --- UPDATE ROUTES ---
    const links = gRoutes.selectAll("path")
        .data(displayData, d => d.origin_city + "-" + d.dest_city);

    links.exit().remove();

    const enterLinks = links.enter().append("path")
        .attr("fill", "none")
        .attr("stroke-linecap", "round");

    links.merge(enterLinks)
        .attr("class", d => `flight-route ${d.type}`)
        .attr("d", d => {
            const originCity = (d.origin_city || "").trim();
            const destCity = (d.dest_city || "").trim();
            const routeKey = `${originCity}-${destCity}`;
            const paths = state.routePaths[routeKey];
            if (!paths) return null;

            if (state.selectedCity) {
                return d.type === 'outbound' ? paths.outbound : paths.inbound;
            }
            return paths.normal;
        })
        .attr("stroke", d => {
            if (d.type === 'outbound') return config.colors.outbound;
            if (d.type === 'inbound') return config.colors.inbound;
            return config.colors.neutralRoute;
        })
        .attr("stroke-width", d => {
            const base = Math.sqrt(d.flight_number);
            return state.selectedCity ? Math.max(1.5, base) : Math.max(0.5, base/2);
        })
        .attr("marker-end", d => {
            if (!state.selectedCity) return null;
            return d.type === 'outbound' ? "url(#arrow-outbound)" : "url(#arrow-inbound)";
        });

    // Route hover interactions
    gRoutes.on("mouseover", function() {
        const event = d3.event;
        const target = event.target;
        if (target.tagName === 'path') {
            const d = d3.select(target).datum();
            if (d) {
                d3.select(target).attr("stroke-width", 4).attr("stroke", "#333");
                showLinkTooltip(d, event.pageX, event.pageY);
            }
        }
    }).on("mouseout", function() {
        const event = d3.event;
        const target = event.target;
        if (target.tagName === 'path') {
            const d = d3.select(target).datum();
            d3.select(target)
                .attr("stroke-width", d => {
                    const base = Math.sqrt(d.flight_number);
                    return state.selectedCity ? Math.max(1.5, base) : Math.max(0.5, base/2);
                })
                .attr("stroke", d => {
                    if (d.type === 'outbound') return config.colors.outbound;
                    if (d.type === 'inbound') return config.colors.inbound;
                    return config.colors.neutralRoute;
                });
            hideTooltip();
        }
    });

    // --- UPDATE CITIES ---
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
            return connectedCities.has(d.properties.city) || d.properties.city === state.selectedCity ? 1 : 0.15;
        });
}

// ============================================================================
// 7. INTERACTION HANDLERS - User control (Shneiderman #7)
// ============================================================================
// 7. INTERACTION HANDLERS - User control (Shneiderman #7)
// ============================================================================
function selectCity(cityName) {
    state.selectedCity = cityName;
    state.filteredCities = [cityName];

    // Synchronize city filter dropdown
    document.getElementById("city-filter").value = cityName;

    // Show direction controls
    document.getElementById("direction-controls").classList.remove("hidden");

    updateMap();
}

function resetView() {
    state.selectedCity = null;
    state.filteredCities = [];
    document.getElementById("direction-controls").classList.add("hidden");
    document.getElementById("city-filter").value = "";
    state.direction = 'all';
    document.querySelector('input[name="direction"][value="all"]').checked = true;
    updateMap();
}

// Event listener for reset button - Shneiderman #7 (reversible actions)
document.getElementById("reset-view-btn").addEventListener("click", resetView);

// ============================================================================
// 8. TOOLTIP FUNCTIONS - Details on demand (Shneiderman #1)
// ============================================================================
function showTooltip(text, x, y) {
    const offset = 40;
    const maxX = window.innerWidth - 250;
    const maxY = window.innerHeight - 100;

    let posX = Math.min(x + 10, maxX);
    let posY = Math.min(y - offset, maxY);

    tooltip.html(text)
        .style("left", posX + "px")
        .style("top", posY + "px")
        .classed("hidden", false);
}

function showLinkTooltip(d, x, y) {
    const latePct = d.flight_number > 0 ? ((d.is_late / d.flight_number) * 100).toFixed(1) : 0;
    const statusColor = latePct > 20 ? '#ff6b6b' : '#51cf66';

    const html = `
        <div style="font-weight:700; margin-bottom:6px; border-bottom:1px solid #888; padding-bottom:4px; font-size:0.85rem;">
            ${d.origin_city} → ${d.dest_city}
        </div>
        <div style="display:flex; justify-content:space-between; gap:15px; font-size:0.8rem; margin-top:4px;">
            <span>Vols:</span> <strong>${d.flight_number.toLocaleString()}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; gap:15px; font-size:0.8rem;">
            <span>Retards:</span> <strong style="color:${statusColor}">${latePct}%</strong>
        </div>
    `;
    showTooltip(html, x, y);
}

function hideTooltip() {
    tooltip.classed("hidden", true);
}

// ============================================================================
// 9. CONTROL PANEL EVENT LISTENERS - Shneiderman #3 (shortcuts)
// ============================================================================
function updateTimeDisplay() {
    const display = document.getElementById("month-select");
    if (display) {
        display.value = state.timeValue;
    }
}

// Dataset mode change - Shneiderman #1 (overview/filter)
document.getElementById("dataset-select").addEventListener("change", function(e) {
    state.mode = e.target.value;
    const isLate = state.mode === "late";
    document.getElementById("time-controls").classList.toggle("hidden", isLate);
    document.getElementById("week-controls").classList.toggle("hidden", isLate);
    document.getElementById("late-controls").classList.toggle("hidden", !isLate);

    state.timeValue = 1;
    updateMap();
});

// Month select change
document.getElementById("month-select").addEventListener("change", function(e) {
    state.mode = "month";
    state.timeValue = +e.target.value;
    document.getElementById("dataset-select").value = "month";
    document.getElementById("time-controls").classList.remove("hidden");
    document.getElementById("week-controls").classList.add("hidden");
    document.getElementById("late-controls").classList.add("hidden");
    updateMap();
});

// Week select change (changed from slider to select)
document.getElementById("week-select").addEventListener("change", function(e) {
    state.mode = "week";
    state.timeValue = +e.target.value;
    document.getElementById("dataset-select").value = "week";
    document.getElementById("time-controls").classList.add("hidden");
    document.getElementById("week-controls").classList.remove("hidden");
    document.getElementById("late-controls").classList.add("hidden");
    updateMap();
});

// Delay type filter
document.getElementById("delay-select").addEventListener("change", function(e) {
    state.lateFilter = e.target.value;
    updateMap();
});

// City filter - synchronize with selected city
document.getElementById("city-filter").addEventListener("change", function(e) {
    if (e.target.value === "") {
        state.filteredCities = [];
        state.selectedCity = null;
        document.getElementById("direction-controls").classList.add("hidden");
        updateMap();
    } else {
        // Select city without double updateMap
        state.selectedCity = e.target.value;
        state.filteredCities = [e.target.value];
        document.getElementById("direction-controls").classList.remove("hidden");
        updateMap();

        // Show feedback tooltip (center of screen)
        showTooltip(`<strong>${e.target.value} - Sélectionné</strong>`,
            window.innerWidth / 2, window.innerHeight / 2);
    }
});

// Direction filter - Shneiderman #7 (user control)
document.querySelectorAll('input[name="direction"]').forEach(radio => {
    radio.addEventListener("change", function(e) {
        state.direction = e.target.value;
        updateMap();
    });
});

// Initialize time display
updateTimeDisplay();

