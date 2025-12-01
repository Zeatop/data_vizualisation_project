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

// Projection
const projection = d3.geoAlbersUsa()
    .translate([width / 2, height / 2])
    .scale(Math.min(width, height) * 1.3);

const path = d3.geoPath().projection(projection);

// 3. ZOOM BEHAVIOR
const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", zoomed);

svg.call(zoom);

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
    "us_cities_from_csv.geojson",
    "aggregated_by_month_and_route.csv",
    "aggregated_by_week_and_route.csv",
    "aggregated_by_late_type_and_route.csv"
];

Promise.all(files.map((url, i) => i < 2 ? d3.json(url) : d3.csv(url)))
    .then(function([usMap, cityGeo, monthData, weekData, lateData]) {

        state.data = { month: monthData, week: weekData, late: lateData };

        const states = topojson.feature(usMap, usMap.objects.states).features;
        gStates.selectAll("path")
            .data(states)
            .enter().append("path")
            .attr("d", path);

        cityGeo.features.forEach(f => {
            if(f.geometry && f.geometry.coordinates) {
                state.lookup[f.properties.city.trim()] = {
                    coords: f.geometry.coordinates
                };
            }
        });

        const cityCounts = {};
        monthData.forEach(d => {
            cityCounts[d.origin_city] = (cityCounts[d.origin_city] || 0) + (+d.flight_number);
            cityCounts[d.dest_city] = (cityCounts[d.dest_city] || 0) + (+d.flight_number);
        });

        const sizeScale = d3.scaleSqrt()
            .domain([0, d3.max(Object.values(cityCounts))])
            .range([3, 10]);

        gCities.selectAll("circle")
            .data(cityGeo.features)
            .enter().append("circle")
            .attr("class", "city-node")
            .filter(d => projection(d.geometry.coordinates))
            .attr("r", d => sizeScale(cityCounts[d.properties.city] || 0))
            .attr("transform", d => `translate(${projection(d.geometry.coordinates)})`)
            .on("click", d => selectCity(d.properties.city))
            .on("mouseover", function(d) {
                d3.select(this).style("fill", config.colors.outbound);
                showTooltip(d.properties.city, d3.event.pageX, d3.event.pageY);
            })
            .on("mouseout", function(d) {
                if(d.properties.city !== state.selectedCity) {
                    d3.select(this).style("fill", null);
                }
                hideTooltip();
            });

        const cityList = Object.keys(state.lookup).sort();
        const select = document.getElementById("city-search");
        cityList.forEach(city => {
            const option = document.createElement("option");
            option.value = city;
            option.text = city;
            select.appendChild(option);
        });

        updateMap();
    });

// 6. LOGIC & UPDATE
function cleanData(d) {
    return { ...d, is_late: +d.is_late, flight_number: +d.flight_number };
}

function updateMap() {
    let dataset = [];
    if (state.mode === "month") {
        dataset = state.data.month.filter(d => +d.month === state.timeValue);
    } else if (state.mode === "week") {
        dataset = state.data.week.filter(d => +d.week_number === state.timeValue);
    } else {
        dataset = state.data.late;
        if (state.lateFilter !== "all") {
            dataset = dataset.filter(d => +d[state.lateFilter] === 1);
        }
    }
    dataset = dataset.map(cleanData);

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
            const src = state.lookup[d.origin_city];
            const dst = state.lookup[d.dest_city];
            if(!src || !dst) return null;
            return path({type: "LineString", coordinates: [src.coords, dst.coords]});
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
        })
        .on("mouseover", function(d) {
            d3.select(this).style("stroke-width", 4).style("stroke", "#333").raise();
            showLinkTooltip(d, d3.event.pageX, d3.event.pageY);
        })
        .on("mouseout", function(d) {
            d3.select(this).style("stroke-width", null).style("stroke", null);
            if(state.selectedCity) {
                d3.select(this).style("stroke", d.type === 'outbound' ? config.colors.outbound : config.colors.inbound);
            }
            hideTooltip();
        });

    gCities.selectAll("circle")
        .classed("active", d => d.properties.city === state.selectedCity)
        .attr("opacity", d => {
            if (!state.selectedCity) return 1;
            const isConnected = displayData.some(l => l.origin_city === d.properties.city || l.dest_city === d.properties.city);
            return isConnected || d.properties.city === state.selectedCity ? 1 : 0.1;
        });
}

// 7. ACTIONS & ZOOM
function zoomed() {
    mapGroup.attr("transform", d3.event.transform);
}

function selectCity(cityName) {
    state.selectedCity = cityName;
    document.getElementById("city-search").value = cityName;
    document.getElementById("direction-controls").classList.remove("hidden");

    const cityData = state.lookup[cityName];
    if (cityData) {
        const coords = projection(cityData.coords);
        const scale = 3;
        const translate = [width / 2 - scale * coords[0], height / 2 - scale * coords[1]];

        svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
    }
    updateMap();
}

function resetView() {
    state.selectedCity = null;
    document.getElementById("city-search").value = "";
    document.getElementById("direction-controls").classList.add("hidden");
    state.direction = 'all';
    document.querySelector('input[name="direction"][value="all"]').checked = true;

    svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity
    );

    updateMap();
}

// TOOLTIPS
function showTooltip(text, x, y) {
    tooltip.html(text).style("left", (x+15)+"px").style("top", (y+15)+"px").classed("hidden", false);
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
document.getElementById("dataset-select").addEventListener("change", (e) => {
    state.mode = e.target.value;
    const isLate = state.mode === "late";
    document.getElementById("time-controls").classList.toggle("hidden", isLate);
    document.getElementById("late-controls").classList.toggle("hidden", !isLate);

    if (state.mode === "month") {
        document.getElementById("time-label").textContent = "MONTH";
        const slider = document.getElementById("time-slider");
        slider.max = 12;
        slider.value = 1;
        state.timeValue = 1;
        document.getElementById("time-display").textContent = "January";
    } else if (state.mode === "week") {
        document.getElementById("time-label").textContent = "WEEK";
        const slider = document.getElementById("time-slider");
        slider.max = 52;
        slider.value = 1;
        state.timeValue = 1;
        document.getElementById("time-display").textContent = "Week 1";
    }
    updateMap();
});

document.getElementById("time-slider").addEventListener("input", (e) => {
    state.timeValue = +e.target.value;
    const display = document.getElementById("time-display");
    if (state.mode === "month") {
        const date = new Date(2023, state.timeValue - 1, 1);
        display.textContent = date.toLocaleString('default', { month: 'long' });
    } else {
        display.textContent = "Week " + state.timeValue;
    }
    updateMap();
});

document.getElementById("delay-select").addEventListener("change", (e) => {
    state.lateFilter = e.target.value;
    updateMap();
});

document.getElementById("city-search").addEventListener("change", (e) => {
    if(e.target.value) selectCity(e.target.value);
    else resetView();
});

document.getElementById("reset-btn").addEventListener("click", resetView);

document.querySelectorAll('input[name="direction"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
        state.direction = e.target.value;
        updateMap();
    });
});

// ZOOM BUTTONS
document.getElementById("zoom-in").addEventListener("click", () => {
    svg.transition().duration(300).call(zoom.scaleBy, 1.3);
});

document.getElementById("zoom-out").addEventListener("click", () => {
    svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.3);
});